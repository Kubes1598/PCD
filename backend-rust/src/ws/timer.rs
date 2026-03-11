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
                            let game = game_engine.get_game(game_id);

                            // Notify players if we have connection manager
                            if let Some(cm) = connection_manager {
                                if let Some(ref g) = game {
                                    // Send to player 1
                                    let state1 = g.for_viewer(g.player1.id);
                                    let msg1 = serde_json::json!({
                                        "type": "game_over",
                                        "reason": "timeout",
                                        "data": result.clone(),
                                        "game_state": state1
                                    });
                                    cm.send_message(&g.player1.id, axum::extract::ws::Message::Text(msg1.to_string()));

                                    // Send to player 2
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

                            // 2. Financial Settlement (Reward winner or Draw Refund)
                            if let (Some(g), Some(db)) = (game, db) {
                                let prize = g.prize;
                                let fee = g.entry_fee;
                                let game_id = g.id;

                                if g.result == crate::game::GameResult::Draw || g.result == crate::game::GameResult::Ongoing {
                                    if fee > 0 {
                                        let cat = if g.result == crate::game::GameResult::Draw { "draw_refund" } else { "cancel_refund" };
                                        let ref1 = format!("{}_{}_{}", game_id, g.player1.id, cat);
                                        let ref2 = format!("{}_{}_{}", game_id, g.player2.id, cat);
                                        let _ = db.execute_transaction(&g.player1.id, fee as i32, 0, cat, Some(game_id), Some(ref1)).await;
                                        let _ = db.execute_transaction(&g.player2.id, fee as i32, 0, cat, Some(game_id), Some(ref2)).await;
                                    }
                                } else if prize > 0 {
                                    let winner_id = match g.result {
                                        crate::game::GameResult::Player1Win => Some(g.player1.id),
                                        crate::game::GameResult::Player2Win => Some(g.player2.id),
                                        _ => None,
                                    };

                                    if let Some(w_id) = winner_id {
                                        let ref_id = format!("{}_{}_victory", game_id, w_id);
                                        let _ = db.execute_transaction(&w_id, prize as i32, 0, "victory_reward", Some(game_id), Some(ref_id)).await;
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
