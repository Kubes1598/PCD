//! Game timer manager

use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{Duration, Instant};
use uuid::Uuid;

use crate::game::GameEngine;

/// Timer info
#[derive(Debug, Clone)]
pub struct TimerInfo {
    #[allow(dead_code)]
    pub game_id: Uuid,
    #[allow(dead_code)]
    pub player_id: Uuid,
    pub started_at: Instant,
    pub duration: Duration,
    pub cancel_tx: mpsc::Sender<()>,
}

/// Game timer manager - handles turn timeouts
/// 
/// Production-grade timer management with:
/// - Per-player turn timers with configurable duration
/// - Automatic timeout handling with game result notification
/// - Financial settlement on timeout (winner rewards, refunds)
/// - Clean cancellation for normal game progression
#[derive(Clone)]
pub struct GameTimerManager {
    /// Active timers: (game_id, player_id) -> timer info
    timers: DashMap<(Uuid, Uuid), TimerInfo>,
    /// Game engine reference
    game_engine: Arc<GameEngine>,
    /// Connection manager for notifications
    connection_manager: Option<crate::ws::ConnectionManager>,
    /// Database reference for settlements
    db: Option<crate::db::Database>,
}

impl GameTimerManager {
    /// Create new timer manager
    pub fn new(game_engine: Arc<GameEngine>) -> Self {
        Self {
            timers: DashMap::new(),
            game_engine,
            connection_manager: None,
            db: None,
        }
    }

    /// Set database reference
    pub fn set_db(&mut self, db: crate::db::Database) {
        self.db = Some(db);
    }

    /// Set connection manager (deferred to avoid circular dependency during initialization)
    pub fn set_connection_manager(&mut self, cm: crate::ws::ConnectionManager) {
        self.connection_manager = Some(cm);
    }

    /// Start a timer for a player's turn
    pub async fn start_timer(&self, game_id: Uuid, player_id: Uuid, duration_secs: u32) {
        // Cancel existing timer if any
        self.stop_timer(game_id, player_id).await;

        let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);
        let duration = Duration::from_secs(duration_secs as u64);

        let info = TimerInfo {
            game_id,
            player_id,
            started_at: Instant::now(),
            duration,
            cancel_tx,
        };

        self.timers.insert((game_id, player_id), info);

        // Spawn timer task
        let game_engine = self.game_engine.clone();
        let connection_manager = self.connection_manager.clone();
        let timers = self.timers.clone();
        let db = self.db.clone();

        tokio::spawn(async move {
            tokio::select! {
                _ = tokio::time::sleep(duration) => {
                    // Timer expired - handle timeout
                    tracing::info!("Timer expired for player {} in game {}", player_id, game_id);

                    match game_engine.handle_timeout(game_id, player_id) {
                        Ok(result) => {
                            if result.game_over {
                                // Game truly ended (Playing phase timeout = forfeit)
                                let game = game_engine.get_game(game_id);

                                if let Some(cm) = &connection_manager {
                                    if let Some(ref g) = game {
                                        let state1 = g.for_viewer(g.player1.id);
                                        let msg1 = serde_json::json!({
                                            "type": "game_over",
                                            "reason": "timeout",
                                            "data": result.clone(),
                                            "game_state": state1
                                        });
                                        cm.send_message(&g.player1.id, axum::extract::ws::Message::Text(msg1.to_string()));

                                        let state2 = g.for_viewer(g.player2.id);
                                        let msg2 = serde_json::json!({
                                            "type": "game_over",
                                            "reason": "timeout",
                                            "data": result,
                                            "game_state": state2
                                        });
                                        cm.send_message(&g.player2.id, axum::extract::ws::Message::Text(msg2.to_string()));
                                    }
                                }

                                // Atomic Financial & Statistics Settlement
                                if let (Some(g), Some(db)) = (game, &db) {
                                    let result_type = match g.result {
                                        crate::game::GameResult::Player1Win => "p1_win",
                                        crate::game::GameResult::Player2Win => "p2_win",
                                        crate::game::GameResult::Draw => "draw",
                                        _ => "timeout_cancel",
                                    };
                                    let winner_id = match g.result {
                                        crate::game::GameResult::Player1Win => Some(g.player1.id),
                                        crate::game::GameResult::Player2Win => Some(g.player2.id),
                                        _ => None,
                                    };
                                    if let Err(e) = db.settle_match_result(
                                        g.id, &g.player1.id, &g.player2.id, winner_id, g.entry_fee, g.prize, result_type, &g.city
                                    ).await {
                                        tracing::error!("CRITICAL: Atomic Timeout Settlement FAILED for {}: {}", g.id, e);
                                    }
                                }
                            } else {
                                // Poison was auto-picked, game continues!
                                let game = game_engine.get_game(game_id);

                                if let Some(ref g) = game {
                                    if let Some(cm) = &connection_manager {
                                        // Notify the timed-out player that their poison was auto-selected
                                        let auto_msg = serde_json::json!({
                                            "type": "poison_auto_picked",
                                            "message": "Time expired. A random poison candy was selected for you."
                                        });
                                        cm.send_message(&player_id, axum::extract::ws::Message::Text(auto_msg.to_string()));

                                        // If both poisons are now set, game has transitioned to Playing
                                        if g.state == crate::game::GameState::Playing {
                                            let p1_id = g.player1.id;
                                            let turn_timer = g.turn_timer_secs;

                                            // Notify both players the game has started
                                            let state1 = g.for_viewer(g.player1.id);
                                            let msg1 = serde_json::json!({
                                                "type": "game_started",
                                                "game_id": game_id,
                                                "game_state": state1
                                            });
                                            cm.send_message(&g.player1.id, axum::extract::ws::Message::Text(msg1.to_string()));

                                            let state2 = g.for_viewer(g.player2.id);
                                            let msg2 = serde_json::json!({
                                                "type": "game_started",
                                                "game_id": game_id,
                                                "game_state": state2
                                            });
                                            cm.send_message(&g.player2.id, axum::extract::ws::Message::Text(msg2.to_string()));

                                            // START THE TURN TIMER for Player 1
                                            // We can't call self.start_timer() from inside a timer callback,
                                            // so we replicate the timer creation logic inline.
                                            let (turn_cancel_tx, mut turn_cancel_rx) = mpsc::channel::<()>(1);
                                            let turn_duration = Duration::from_secs(turn_timer as u64);
                                            
                                            let turn_info = TimerInfo {
                                                game_id,
                                                player_id: p1_id,
                                                started_at: Instant::now(),
                                                duration: turn_duration,
                                                cancel_tx: turn_cancel_tx,
                                            };
                                            timers.insert((game_id, p1_id), turn_info);

                                            // Spawn the turn timeout task
                                            let turn_ge = game_engine.clone();
                                            let turn_cm = connection_manager.clone();
                                            let turn_timers = timers.clone();
                                            let turn_db = db.clone();
                                            tokio::spawn(async move {
                                                tokio::select! {
                                                    _ = tokio::time::sleep(turn_duration) => {
                                                        // Player 1 timed out during their turn
                                                        tracing::info!("Turn timer expired for P1 {} in game {} (post-autopick)", p1_id, game_id);
                                                        if let Ok(result) = turn_ge.handle_timeout(game_id, p1_id) {
                                                            if result.game_over {
                                                                if let Some(tg) = turn_ge.get_game(game_id) {
                                                                    if let Some(tcm) = &turn_cm {
                                                                        let s1 = tg.for_viewer(tg.player1.id);
                                                                        let m1 = serde_json::json!({"type":"game_over","reason":"timeout","data":result.clone(),"game_state":s1});
                                                                        tcm.send_message(&tg.player1.id, axum::extract::ws::Message::Text(m1.to_string()));
                                                                        let s2 = tg.for_viewer(tg.player2.id);
                                                                        let m2 = serde_json::json!({"type":"game_over","reason":"timeout","data":result,"game_state":s2});
                                                                        tcm.send_message(&tg.player2.id, axum::extract::ws::Message::Text(m2.to_string()));
                                                                    }
                                                                    if let Some(tdb) = &turn_db {
                                                                        let rt = match tg.result {
                                                                            crate::game::GameResult::Player1Win => "p1_win",
                                                                            crate::game::GameResult::Player2Win => "p2_win",
                                                                            crate::game::GameResult::Draw => "draw",
                                                                            _ => "timeout_cancel",
                                                                        };
                                                                        let wid = match tg.result {
                                                                            crate::game::GameResult::Player1Win => Some(tg.player1.id),
                                                                            crate::game::GameResult::Player2Win => Some(tg.player2.id),
                                                                            _ => None,
                                                                        };
                                                                        let _ = tdb.settle_match_result(tg.id, &tg.player1.id, &tg.player2.id, wid, tg.entry_fee, tg.prize, rt, &tg.city).await;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        turn_timers.remove(&(game_id, p1_id));
                                                    }
                                                    _ = turn_cancel_rx.recv() => {
                                                        tracing::debug!("Post-autopick turn timer cancelled for P1 {} in game {}", p1_id, game_id);
                                                    }
                                                }
                                            });

                                            tracing::info!("Turn timer ({}s) started for P1 {} in game {} (post-autopick)", turn_timer, p1_id, game_id);
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to handle timeout: {}", e);
                        }
                    }

                    // Remove timer
                    timers.remove(&(game_id, player_id));
                }
                _ = cancel_rx.recv() => {
                    // Timer cancelled
                    tracing::debug!("Timer cancelled for player {} in game {}", player_id, game_id);
                }
            }
        });

        tracing::debug!(
            "Started {}s timer for player {} in game {}",
            duration_secs,
            player_id,
            game_id
        );
    }

    /// Stop a player's timer
    pub async fn stop_timer(&self, game_id: Uuid, player_id: Uuid) {
        if let Some((_, info)) = self.timers.remove(&(game_id, player_id)) {
            let _ = info.cancel_tx.send(()).await;
            tracing::debug!("Stopped timer for player {} in game {}", player_id, game_id);
        }
    }

    /// Get remaining time for a player
    pub fn remaining_time(&self, game_id: Uuid, player_id: Uuid) -> Option<Duration> {
        self.timers.get(&(game_id, player_id)).map(|info| {
            let elapsed = info.started_at.elapsed();
            if elapsed >= info.duration {
                Duration::ZERO
            } else {
                info.duration - elapsed
            }
        })
    }

    /// Stop all timers for a game
    pub async fn stop_game_timers(&self, game_id: Uuid) {
        let keys: Vec<_> = self
            .timers
            .iter()
            .filter(|e| e.key().0 == game_id)
            .map(|e| *e.key())
            .collect();

        for key in keys {
            if let Some((_, info)) = self.timers.remove(&key) {
                let _ = info.cancel_tx.send(()).await;
            }
        }

        tracing::debug!("Stopped all timers for game {}", game_id);
    }

    /// Get active timer count
    pub fn timer_count(&self) -> usize {
        self.timers.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::GameEngine;

    fn create_test_manager() -> GameTimerManager {
        let engine = Arc::new(GameEngine::new());
        GameTimerManager::new(engine)
    }

    #[tokio::test]
    async fn test_start_and_stop_timer() {
        let manager = create_test_manager();
        let game_id = Uuid::new_v4();
        let player_id = Uuid::new_v4();

        // Start timer
        manager.start_timer(game_id, player_id, 30).await;
        assert_eq!(manager.timer_count(), 1);

        // Stop timer
        manager.stop_timer(game_id, player_id).await;
        // Give async task time to clean up
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(manager.timer_count(), 0);
    }

    #[tokio::test]
    async fn test_remaining_time() {
        let manager = create_test_manager();
        let game_id = Uuid::new_v4();
        let player_id = Uuid::new_v4();

        manager.start_timer(game_id, player_id, 10).await;
        
        // Check remaining time is reasonable
        let remaining = manager.remaining_time(game_id, player_id);
        assert!(remaining.is_some());
        assert!(remaining.unwrap().as_secs() <= 10);

        manager.stop_timer(game_id, player_id).await;
    }

    #[tokio::test]
    async fn test_stop_game_timers() {
        let manager = create_test_manager();
        let game_id = Uuid::new_v4();
        let p1 = Uuid::new_v4();
        let p2 = Uuid::new_v4();

        // Start timers for both players
        manager.start_timer(game_id, p1, 30).await;
        manager.start_timer(game_id, p2, 30).await;
        assert_eq!(manager.timer_count(), 2);

        // Stop all game timers
        manager.stop_game_timers(game_id).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(manager.timer_count(), 0);
    }

    #[tokio::test]
    async fn test_timer_replacement() {
        let manager = create_test_manager();
        let game_id = Uuid::new_v4();
        let player_id = Uuid::new_v4();

        // Start first timer
        manager.start_timer(game_id, player_id, 30).await;
        assert_eq!(manager.timer_count(), 1);

        // Start new timer (should replace old one)
        manager.start_timer(game_id, player_id, 20).await;
        assert_eq!(manager.timer_count(), 1);
        
        // Check new duration
        let remaining = manager.remaining_time(game_id, player_id);
        assert!(remaining.is_some());
        assert!(remaining.unwrap().as_secs() <= 20);

        manager.stop_timer(game_id, player_id).await;
    }
}
