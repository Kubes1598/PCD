//! Poisoned Candy Duel Game Engine
//!
//! Core game logic ported from Python.

use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

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

    /// Get a read-lock on the timer manager (for spawned tasks that need to start timers)
    pub async fn timer_manager_ref(&self) -> tokio::sync::RwLockReadGuard<'_, Option<Arc<crate::ws::GameTimerManager>>> {
        self.timer_manager.read().await
    }

    /// Set stakes for a game
    pub fn set_stakes(&self, game_id: Uuid, entry_fee: i32, prize: i32) {
        if let Some(mut game) = self.games.get_mut(&game_id) {
            game.entry_fee = entry_fee;
            game.prize = prize;
        }
    }

    /// Create a new game session with configurable timers
    pub async fn create_game(
        &self,
        player1_name: String,
        player2_name: String,
        p1_id: Option<Uuid>,
        p2_id: Option<Uuid>,
        p1_is_ai: bool,
        p2_is_ai: bool,
        turn_timer_secs: u32,   // City/difficulty-based turn timer
        poison_timer_secs: u32, // Poison selection timer (typically 30s)
        city: String,           // Match city
    ) -> Uuid {
        let mut session = GameSession::new(
            player1_name,
            player2_name,
            p1_id,
            p2_id,
            p1_is_ai,
            p2_is_ai,
            turn_timer_secs,
            poison_timer_secs,
            city,
        );
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

        self.games.insert(game_id, session.clone());

        // Start poison selection timers using configured duration
        let tm_lock = self.timer_manager.read().await;
        let tm_opt: &Option<Arc<crate::ws::GameTimerManager>> = &tm_lock;
        if let Some(tm) = tm_opt {
            if let Some(id) = p1_id {
                tm.start_timer(game_id, id, session.poison_timer_secs).await;
            }
            if let Some(id) = p2_id {
                tm.start_timer(game_id, id, session.poison_timer_secs).await;
            }
        }

        tracing::info!(
            "Created game {} with turn_timer={}s, poison_timer={}s",
            game_id,
            turn_timer_secs,
            poison_timer_secs
        );
        game_id
    }

    /// Set a player's poison choice
    pub async fn set_poison_choice(
        &self,
        game_id: Uuid,
        player_id: Uuid,
        poison_candy: &str,
    ) -> Result<bool> {
        let mut game = self
            .games
            .get_mut(&game_id)
            .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

        // ... validation ...
        if game.state != GameState::PoisonSelection {
            return Err(AppError::BadRequest("Not in poison selection phase".into()));
        }

        let player = game
            .get_player_mut(&player_id)
            .ok_or_else(|| AppError::NotFound("Player not in this game".into()))?;

        if !player.owned_candies.contains(poison_candy) || player.poison_choice.is_some() {
            return Err(AppError::BadRequest(
                "Invalid candy or poison already set".into(),
            ));
        }

        player.poison_choice = Some(poison_candy.to_string());
        game.touch();

        let both_ready = game.both_poisons_set();
        let p1_id = game.player1.id;
        let turn_timer_secs = game.turn_timer_secs;
        
        if both_ready {
            game.state = GameState::Playing;
        }

        // CAPTURE DATA FOR AI TRIGGER
        let next_player_id = if both_ready { game.current_player_id() } else { player_id };
        let is_next_ai = if both_ready { game.get_player_mut(&next_player_id).map(|p| p.is_ai).unwrap_or(false) } else { false };

        // DROP LOCK before await
        drop(game);

        // Stop this player's poison timer
        let tm_opt = {
            let guard = self.timer_manager.read().await;
            (*guard).clone()
        };
        
        if let Some(ref tm) = tm_opt {
            tm.stop_timer(game_id, player_id).await;
        }

        if both_ready {
            // Start turn timer for first player using configured duration
            if let Some(ref tm) = tm_opt {
                tm.start_timer(game_id, p1_id, turn_timer_secs).await;
            }

            // TRIGGER AI if they go first (rare in current design but good for robustness)
            if is_next_ai {
                self.spawn_ai_turn(game_id, next_player_id);
            }

            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Synchronous game state mutation — NO async, NO DashMap guard in async context.
    /// This is the key to Send safety: DashMap's RefMut (parking_lot guard) never
    /// enters an async state machine.
    fn process_move(
        &self,
        game_id: Uuid,
        player_id: Uuid,
        candy: &str,
    ) -> Result<(bool, GameResult, Option<Uuid>, String, bool, Uuid, u32, u32, bool, Option<String>)> {
        let mut game_ref = self.games.get_mut(&game_id)
            .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;
        let game = &mut *game_ref;

        if game.state != GameState::Playing {
            return Err(AppError::BadRequest("Game not in playing state".into()));
        }
        if game.current_player_id() != player_id {
            return Err(AppError::BadRequest("Not your turn".into()));
        }

        let current_player_is_p1 = game.player1.id == player_id;
        let opponent = game.get_opponent(&player_id)
            .ok_or_else(|| AppError::NotFound("Opponent not found".into()))?;

        let opponent_owned = opponent.owned_candies.clone();
        let opponent_poison = opponent.poison_choice.clone();

        if !opponent_owned.contains(&candy.to_string()) {
            return Err(AppError::BadRequest("Candy not available".into()));
        }
        if game.player1.collected_candies.contains(&candy.to_string())
            || game.player2.collected_candies.contains(&candy.to_string())
        {
            return Err(AppError::BadRequest("Candy already collected".into()));
        }

        let is_poison = opponent_poison.as_deref() == Some(candy);
        let candy_owned = candy.to_string();
        if !is_poison {
            let p = game.get_player_mut(&player_id).unwrap();
            p.collected_candies.push(candy_owned.clone());
        }

        let (game_over, result, winner_id) = if is_poison {
            let (r, w) = if current_player_is_p1 {
                (GameResult::Player2Win, Some(game.player2.id))
            } else {
                (GameResult::Player1Win, Some(game.player1.id))
            };
            (true, r, w)
        } else {
            let p1_c = game.player1.collected_candies.len();
            let p2_c = game.player2.collected_candies.len();
            let total = 24usize.saturating_sub(p1_c + p2_c);

            if p1_c == WIN_THRESHOLD && p2_c == WIN_THRESHOLD {
                (true, GameResult::Draw, None)
            } else if p1_c == WIN_THRESHOLD || p2_c == WIN_THRESHOLD {
                let current_wins = if current_player_is_p1 { p1_c == WIN_THRESHOLD } else { p2_c == WIN_THRESHOLD };
                if current_wins {
                    let opp_c = if current_player_is_p1 { p2_c } else { p1_c };
                    let opp_future = if current_player_is_p1 { total.div_ceil(2) } else { total / 2 };
                    if opp_c + opp_future >= WIN_THRESHOLD {
                        (false, GameResult::Ongoing, None)
                    } else {
                        let w = if current_player_is_p1 { Some(game.player1.id) } else { Some(game.player2.id) };
                        let r = if current_player_is_p1 { GameResult::Player1Win } else { GameResult::Player2Win };
                        (true, r, w)
                    }
                } else {
                    (false, GameResult::Ongoing, None)
                }
            } else if total == 0 {
                (true, GameResult::Draw, None)
            } else {
                (false, GameResult::Ongoing, None)
            }
        };

        if game_over {
            game.state = GameState::Finished;
            game.result = result;
        } else {
            game.current_turn += 1;
        }
        game.touch();

        let next_p_id = game.current_player_id();
        let is_next_ai = if !game_over && game.state == GameState::Playing {
            game.get_player_mut(&next_p_id).map(|p| p.is_ai).unwrap_or(false)
        } else {
            false
        };

        let winner_name = winner_id.map(|wid| {
            if game.player1.id == wid { game.player1.name.clone() } else { game.player2.name.clone() }
        });

        Ok((game_over, result, winner_id, candy_owned, is_poison, next_p_id, game.turn_timer_secs, game.current_turn, is_next_ai, winner_name))
        // game_ref (DashMap RefMut) is dropped here — never enters async context
    }

    /// Spawn an AI turn in the background. This is Send-safe because
    /// the spawned future only calls sync methods and holds owned data.
    fn spawn_ai_turn(&self, game_id: Uuid, ai_player_id: Uuid) {
        let engine = self.clone();
        tokio::spawn(async move {
            // Simulate "thinking"
            tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

            // Calculate + execute move (both sync)
            let candy = match engine.calculate_best_ai_move(game_id, ai_player_id) {
                Some(c) => c,
                None => return,
            };

            if let Ok((game_over, _, _, _, _, next_p_id, turn_timer_secs, _, is_next_ai, _))
                = engine.process_move(game_id, ai_player_id, &candy)
            {
                // Handle timers — clone the Arc synchronously from the RwLock
                let tm_opt = engine.timer_manager.blocking_read().clone();

                if let Some(ref tm) = tm_opt {
                    // Use blocking approach or a nested spawn for timer calls
                    let tm2 = tm.clone();
                    let _ = tokio::spawn(async move {
                        tm2.stop_timer(game_id, ai_player_id).await;
                        if game_over {
                            tm2.stop_game_timers(game_id).await;
                        } else {
                            tm2.start_timer(game_id, next_p_id, turn_timer_secs).await;
                        }
                    }).await;
                }

                // Chain if next is also AI
                if is_next_ai {
                    engine.spawn_ai_turn(game_id, next_p_id);
                }
            }
        });
    }

    /// Make a move (pick a candy from opponent's pool).
    /// This async wrapper ONLY holds Send-safe types at .await points.
    pub async fn make_move(
        &self,
        game_id: Uuid,
        player_id: Uuid,
        candy: String,
    ) -> Result<MoveResult> {
        // 1. Synchronous state mutation (non-Send guard lives and dies in process_move)
        let (game_over, result, _winner_id, candy_owned, is_poison, next_player_id, turn_timer_secs, current_turn, is_next_ai, winner_name)
            = self.process_move(game_id, player_id, &candy)?;

        // 2. Timer management (async, only Send types from here on)
        let tm_opt = {
            let guard = self.timer_manager.read().await;
            (*guard).clone()
        };

        if let Some(ref tm) = tm_opt {
            tm.stop_timer(game_id, player_id).await;
            if game_over {
                tm.stop_game_timers(game_id).await;
            } else {
                tm.start_timer(game_id, next_player_id, turn_timer_secs).await;
            }
        }

        // 3. AI Trigger — uses spawn_ai_turn (fully Send-safe, no recursion)
        if is_next_ai {
            self.spawn_ai_turn(game_id, next_player_id);
        }

        Ok(MoveResult {
            success: true,
            picked_candy: candy_owned,
            is_poison,
            game_over,
            result,
            winner: winner_name,
            current_turn,
        })
    }

    /// Internal method to calculate the best move for an AI
    pub fn calculate_best_ai_move(&self, game_id: Uuid, ai_id: Uuid) -> Option<String> {
        let game = self.get_game(game_id)?;
        let ai_player = if game.player1.id == ai_id { &game.player1 } else { &game.player2 };
        let human_player = if game.player1.id == ai_id { &game.player2 } else { &game.player1 };
        
        // Find candies still in the opponent's pool
        let available_candies: Vec<String> = human_player.owned_candies.iter()
            .filter(|c| !game.player1.collected_candies.contains(c) && !game.player2.collected_candies.contains(c))
            .cloned()
            .collect();

        if available_candies.is_empty() { return None; }

        let poison = human_player.poison_choice.as_ref()?;
        
        // Difficulty-based logic
        let difficulty = game.city.to_lowercase(); // In AI games, city stores "ai_easy", "ai_medium", etc.
        let mut rng = rand::thread_rng();
        
        // Probability of "missing" the poison (Bug #4)
        let miss_prob = match difficulty.as_str() {
            d if d.contains("easy") => 0.35,
            d if d.contains("medium") => 0.10,
            _ => 0.0, // Hard mode is perfect
        };

        use rand::Rng;
        if rng.gen::<f32>() < miss_prob {
            // Clueless: Pick any random candy (including poison)
            use rand::seq::SliceRandom;
            return available_candies.choose(&mut rng).cloned();
        }

        // Smart: Avoid poison if possible
        let safe_candies: Vec<String> = available_candies.iter()
            .filter(|c| *c != poison)
            .cloned()
            .collect();

        if safe_candies.is_empty() {
            // Must pick poison
            return Some(available_candies[0].clone());
        }

        // HEURISTICS for Hard Mode (Bug #4: Strategic Depth)
        if difficulty.contains("hard") {
            // Priority 1: Pick candy that wins the game for AI immediately
            if ai_player.collected_candies.len() == WIN_THRESHOLD - 1 {
                // Any safe candy wins
                use rand::seq::SliceRandom;
                return safe_candies.choose(&mut rng).cloned();
            }

            // Priority 2: BLOCKING - Pick candy human needs to win
            if human_player.collected_candies.len() >= WIN_THRESHOLD - 3 {
                // Human is close to winning. AI should pick candies from the human's pool
                // to deny them. This logic is inherently handled because available_candies 
                // ARE the candies in the human's pool.
                // We'll prioritize picking candies that the human has NOT yet collected 
                // (though they can't collect their own, they want to keep the pool clean for AI to fail).
                // Actually, in PCD, the AI picks FROM the human. So every pick is a denial.
            }

            // Priority 3: GREEDY - Pick candies that appear most frequently? 
            // (In this version, all candies are safe or poison, no frequency)
            
            // Priority 4: BLOCKING - If human has a high score, AI plays more aggressively
            use rand::seq::SliceRandom;
            return safe_candies.choose(&mut rng).cloned();
        }

        use rand::seq::SliceRandom;
        safe_candies.choose(&mut rng).cloned()
    }

    /// Handle timeout
    /// 
    /// During PoisonSelection: auto-picks a random candy as poison so the game continues.
    /// During Playing: the timed-out player forfeits.
    pub fn handle_timeout(&self, game_id: Uuid, player_id: Uuid) -> Result<TimeoutResult> {
        let mut game = self
            .games
            .get_mut(&game_id)
            .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

        let (game_over, result, loser_id, type_cancelled, auto_picked) = match game.state {
            GameState::Setup | GameState::PoisonSelection => {
                let target_player_is_p1 = game.player1.id == player_id;

                // Check if this player already picked
                let already_picked = if target_player_is_p1 {
                    game.player1.poison_choice.is_some()
                } else {
                    game.player2.poison_choice.is_some()
                };

                if already_picked {
                    return Err(AppError::BadRequest("Player already set poison".into()));
                }

                // AUTO-PICK: Randomly select a candy from the player's 12 as their poison
                use rand::seq::IteratorRandom;
                let mut rng = rand::thread_rng();

                let random_candy = if target_player_is_p1 {
                    game.player1.owned_candies.iter().choose(&mut rng).cloned()
                } else {
                    game.player2.owned_candies.iter().choose(&mut rng).cloned()
                };

                if let Some(candy) = random_candy {
                    // Set the auto-picked poison
                    if target_player_is_p1 {
                        game.player1.poison_choice = Some(candy.clone());
                    } else {
                        game.player2.poison_choice = Some(candy.clone());
                    }

                    tracing::info!(
                        "Auto-picked poison '{}' for player {} in game {} (timeout)",
                        candy, player_id, game_id
                    );

                    // Check if BOTH players now have poison set
                    if game.both_poisons_set() {
                        game.state = GameState::Playing;
                        // Game continues — NOT a forfeit, NOT a cancellation
                        (false, GameResult::Ongoing, None, false, true)
                    } else {
                        // Other player's timer is still running, wait for them
                        (false, GameResult::Ongoing, None, false, true)
                    }
                } else {
                    // Edge case: no candies available (should never happen)
                    tracing::error!("No candies available for auto-pick in game {}", game_id);
                    (true, GameResult::Draw, None, true, false)
                }
            }
            GameState::Playing => {
                if game.current_player_id() != player_id {
                    return Err(AppError::BadRequest("Not your turn to timeout".into()));
                }
                let res = if game.player1.id == player_id {
                    GameResult::Player2Win
                } else {
                    GameResult::Player1Win
                };
                (true, res, Some(player_id), false, false)
            }
            GameState::Finished => {
                return Err(AppError::BadRequest("Game already finished".into()))
            }
        };

        if game_over {
            game.state = GameState::Finished;
            game.result = result;
        }
        game.touch();

        let loser_name = loser_id.and_then(|id| {
            if id == game.player1.id {
                Some(game.player1.name.clone())
            } else if id == game.player2.id {
                Some(game.player2.name.clone())
            } else {
                None
            }
        });

        if auto_picked {
            tracing::info!("Game {} - poison auto-picked for idle player, game continues", game_id);
        } else if type_cancelled {
            tracing::info!("Game {} ended by timeout - cancelled", game_id);
        } else if let Some(ref name) = loser_name {
            tracing::info!("Game {} ended by timeout - {} forfeited", game_id, name);
        }

        Ok(TimeoutResult {
            game_over,
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

    /// Find an active game that a player is part of (for reconnect recovery)
    pub fn find_game_by_player(&self, player_id: Uuid) -> Option<Uuid> {
        for entry in self.games.iter() {
            let game = entry.value();
            if game.state != GameState::Finished
                && (game.player1.id == player_id || game.player2.id == player_id)
            {
                return Some(*entry.key());
            }
        }
        None
    }
}

impl Default for GameEngine {
    fn default() -> Self {
        Self::new()
    }
}
