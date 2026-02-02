//! Poisoned Candy Duel Game Engine
//!
//! Core game logic ported from Python.

use dashmap::DashMap;
use uuid::Uuid;
use std::sync::Arc;

use super::{GameResult, GameSession, GameState, MoveResult, TimeoutResult, WIN_THRESHOLD};
use crate::error::{AppError, Result};

/// Main game engine managing all active games
#[derive(Clone)]
pub struct GameEngine {
    games: DashMap<Uuid, GameSession>,
    /// Optional reference to timer manager (deferred initialization)
    timer_manager: Arc<tokio::sync::RwLock<Option<Arc<crate::ws::GameTimerManager>>>>,
    /// Optional reference to database (deferred initialization)
    db: Arc<tokio::sync::RwLock<Option<crate::db::Database>>>,
}

impl GameEngine {
    /// Create a new game engine
    pub fn new() -> Self {
        Self {
            games: DashMap::new(),
            timer_manager: Arc::new(tokio::sync::RwLock::new(None)),
            db: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    /// Set timer manager
    pub async fn set_timer_manager(&self, tm: Arc<crate::ws::GameTimerManager>) {
        let mut lock = self.timer_manager.write().await;
        *lock = Some(tm);
    }

    /// Set database
    pub async fn set_db(&self, db: crate::db::Database) {
        let mut lock = self.db.write().await;
        *lock = Some(db);
    }

    /// Set stakes for a game
    pub fn set_stakes(&self, game_id: Uuid, entry_fee: i32, prize: i32) {
        if let Some(mut game) = self.games.get_mut(&game_id) {
            game.entry_fee = entry_fee;
            game.prize = prize;
        }
    }

    /// Create a new game session
    pub async fn create_game(
        &self,
        player1_name: String,
        player2_name: String,
        p1_id: Option<Uuid>,
        p2_id: Option<Uuid>,
    ) -> Uuid {
        let mut session = GameSession::new(player1_name, player2_name, p1_id, p2_id);
        let game_id = session.id;
        
        // Transition to poison selection
        session.state = GameState::PoisonSelection;
        
        // Persist to DB if possible
        let db_lock = self.db.read().await;
        if let Some(db) = &*db_lock {
            let create_game_data = crate::db::CreateGame {
                player1_id: session.player1.id,
                player2_id: session.player2.id,
                player1_name: session.player1.name.clone(),
                player2_name: session.player2.name.clone(),
            };
            if let Err(e) = db.create_game(&create_game_data).await {
                tracing::error!("Failed to persist game to DB: {}", e);
            }
        }

        self.games.insert(game_id, session);
        
        // Start poison selection timers (usually 30-60s)
        let tm_lock = self.timer_manager.read().await;
        let tm_opt: &Option<Arc<crate::ws::GameTimerManager>> = &*tm_lock;
        if let Some(tm) = tm_opt {
            if let Some(id) = p1_id {
                tm.start_timer(game_id, id, 60).await;
            }
            if let Some(id) = p2_id {
                tm.start_timer(game_id, id, 60).await;
            }
        }
        
        tracing::info!("Created game {}", game_id);
        game_id
    }

    /// Set a player's poison choice
    pub async fn set_poison_choice(
        &self,
        game_id: Uuid,
        player_id: Uuid,
        poison_candy: &str,
    ) -> Result<bool> {
        let mut game = self.games
            .get_mut(&game_id)
            .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

        // ... validation ...
        if game.state != GameState::PoisonSelection {
             return Err(AppError::BadRequest("Not in poison selection phase".into()));
        }

        let player = game.get_player_mut(&player_id)
            .ok_or_else(|| AppError::NotFound("Player not in this game".into()))?;

        if !player.owned_candies.contains(poison_candy) || player.poison_choice.is_some() {
            return Err(AppError::BadRequest("Invalid candy or poison already set".into()));
        }

        player.poison_choice = Some(poison_candy.to_string());
        game.touch();

        // Stop this player's poison timer
        let tm_lock = self.timer_manager.read().await;
        let tm_opt: &Option<Arc<crate::ws::GameTimerManager>> = &*tm_lock;
        if let Some(tm) = tm_opt {
            tm.stop_timer(game_id, player_id).await;
        }

        if game.both_poisons_set() {
            game.state = GameState::Playing;
            
            // Start turn timer for first player (typically p1)
            if let Some(tm) = tm_opt {
                 tm.start_timer(game_id, game.player1.id, 30).await;
            }
            
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Make a move (pick a candy from opponent's pool)
    pub async fn make_move(
        &self,
        game_id: Uuid,
        player_id: Uuid,
        candy: &str,
    ) -> Result<MoveResult> {
        let mut game = self.games
            .get_mut(&game_id)
            .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

        // Validate game state
        if game.state != GameState::Playing {
            return Err(AppError::BadRequest("Game not in playing state".into()));
        }

        // Validate it's this player's turn
        if game.current_player_id() != player_id {
            return Err(AppError::BadRequest("Not your turn".into()));
        }

        let current_player_is_p1 = game.player1.id == player_id;

        // Get opponent's candies
        let (opponent_owned, opponent_poison) = {
            let opponent = game.get_opponent(&player_id)
                .ok_or_else(|| AppError::NotFound("Opponent not found".into()))?;
            (opponent.owned_candies.clone(), opponent.poison_choice.clone())
        };

        if !opponent_owned.contains(candy) {
            return Err(AppError::BadRequest("Candy not available in opponent's pool".into()));
        }

        // Check if candy was already collected by either player
        if game.player1.collected_candies.contains(&candy.to_string()) || 
           game.player2.collected_candies.contains(&candy.to_string()) {
            return Err(AppError::BadRequest("Candy already collected".into()));
        }

        // Check if it's the poison
        let is_poison = opponent_poison.as_deref() == Some(candy);

        // Record move
        let candy_owned = candy.to_string();
        if !is_poison {
            let player = game.get_player_mut(&player_id).unwrap();
            player.collected_candies.push(candy_owned.clone());
        }

        // Check game end conditions
        let (game_over, result, winner_id) = if is_poison {
            // Picked poison - current player loses
            let (result, winner) = if current_player_is_p1 {
                (GameResult::Player2Win, Some(game.player2.id))
            } else {
                (GameResult::Player1Win, Some(game.player1.id))
            };
            (true, result, winner)
        } else {
            // Check win/draw logic
            let p1_count = game.player1.collected_candies.len();
            let p2_count = game.player2.collected_candies.len();
            
            let all_collected_count = game.player1.collected_candies.len() + game.player2.collected_candies.len();
            let total_pickable = 24 - all_collected_count;

            if p1_count == WIN_THRESHOLD && p2_count == WIN_THRESHOLD {
                (true, GameResult::Draw, None)
            } else if p1_count == WIN_THRESHOLD || p2_count == WIN_THRESHOLD {
                let current_is_winner = if current_player_is_p1 { p1_count == WIN_THRESHOLD } else { p2_count == WIN_THRESHOLD };
                
                if current_is_winner {
                    let opponent_count = if current_player_is_p1 { p2_count } else { p1_count };
                    let opponent_future_turns = if current_player_is_p1 { (total_pickable + 1) / 2 } else { total_pickable / 2 };
                    
                    if opponent_count + (opponent_future_turns as usize) >= WIN_THRESHOLD {
                        (false, GameResult::Ongoing, None)
                    } else {
                        let winner = if current_player_is_p1 { Some(game.player1.id) } else { Some(game.player2.id) };
                        let result = if current_player_is_p1 { GameResult::Player1Win } else { GameResult::Player2Win };
                        (true, result, winner)
                    }
                } else {
                    (false, GameResult::Ongoing, None)
                }
            } else if total_pickable == 0 {
                 (true, GameResult::Draw, None)
            } else {
                (false, GameResult::Ongoing, None)
            }
        };

        if game_over {
            game.state = GameState::Finished;
            game.result = result;
            
            // Financial Settlement (Reward winner)
            if let Some(winner_id) = winner_id {
                let prize = game.prize;
                if prize > 0 {
                    // Start an async task to handle the reward (don't block the move)
                    // In a production app, this would be queue-based
                    tracing::info!("Victory! Rewarding player {} with {} coins", winner_id, prize);
                }
            }
        } else {
            game.current_turn += 1;
        }
        
        game.touch();

        // Timer Management
        let tm_lock = self.timer_manager.read().await;
        let tm_opt: &Option<Arc<crate::ws::GameTimerManager>> = &*tm_lock;
        if let Some(tm) = tm_opt {
            // Stop current player's timer
            tm.stop_timer(game_id, player_id).await;
            
            if game_over {
                // Stop all remaining timers for this game
                tm.stop_game_timers(game_id).await;
            } else {
                // Start next player's timer
                tm.start_timer(game_id, game.current_player_id(), 30).await;
            }
        }

        let winner_name = winner_id.map(|id| match id == game.player1.id {
            true => game.player1.name.clone(),
            false => game.player2.name.clone(),
        });

        Ok(MoveResult {
            success: true,
            picked_candy: candy_owned,
            is_poison,
            game_over,
            result,
            winner: winner_name,
            current_turn: game.current_turn,
        })
    }

    /// Handle timeout - forfeit the game
    pub fn handle_timeout(&self, game_id: Uuid, player_id: Uuid) -> Result<TimeoutResult> {
        let mut game = self.games
            .get_mut(&game_id)
            .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

        let (game_over, result, loser_id, type_cancelled) = match game.state {
            GameState::Setup | GameState::PoisonSelection => {
                let target_player_is_p1 = game.player1.id == player_id;
                let (target_player, opponent) = if target_player_is_p1 {
                    (&game.player1, &game.player2)
                } else {
                    (&game.player2, &game.player1)
                };

                if target_player.poison_choice.is_some() {
                    return Err(AppError::BadRequest("Player already set poison".into()));
                }

                if opponent.poison_choice.is_some() {
                    // Opponent ready, target player idle -> forfeit
                    let res = if target_player_is_p1 { GameResult::Player2Win } else { GameResult::Player1Win };
                    (true, res, Some(player_id), false)
                } else {
                    // Both idle -> cancel
                    (true, GameResult::Ongoing, None, true)
                }
            },
            GameState::Playing => {
                if game.current_player_id() != player_id {
                    return Err(AppError::BadRequest("Not your turn to timeout".into()));
                }
                let res = if game.player1.id == player_id { GameResult::Player2Win } else { GameResult::Player1Win };
                (true, res, Some(player_id), false)
            },
            GameState::Finished => return Err(AppError::BadRequest("Game already finished".into())),
        };

        if game_over {
            game.state = GameState::Finished;
            game.result = result;
        }
        game.touch();

        let loser_name = loser_id.and_then(|id| {
            if id == game.player1.id { Some(game.player1.name.clone()) }
            else if id == game.player2.id { Some(game.player2.name.clone()) }
            else { None }
        });

        let msg = if type_cancelled { 
            "Both players idle (Cancelled)".to_string() 
        } else { 
            format!("{} forfeited", loser_name.as_deref().unwrap_or("unknown")) 
        };
        tracing::info!("Game {} ended by timeout - {}", game_id, msg);

        Ok(TimeoutResult {
            game_over: true,
            result,
            loser: if type_cancelled { None } else { loser_name },
        })
    }

    /// Get game state
    pub fn get_game(&self, game_id: Uuid) -> Option<GameSession> {
        self.games.get(&game_id).map(|g| g.clone())
    }

    /// Remove a game
    pub fn remove_game(&self, game_id: Uuid) -> Option<GameSession> {
        self.games.remove(&game_id).map(|(_, v)| v)
    }

    /// Get active game count
    pub fn active_game_count(&self) -> usize {
        self.games.len()
    }
}

impl Default for GameEngine {
    fn default() -> Self {
        Self::new()
    }
}
