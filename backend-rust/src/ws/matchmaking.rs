//! City-based matchmaking queue with ELO-based skill matching

use dashmap::DashMap;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::game::GameEngine;

/// Player waiting in queue
#[derive(Debug, Clone)]
pub struct QueuedPlayer {
    pub id: Uuid,
    pub name: String,
    pub elo: i32,
    pub joined_at: std::time::Instant,
}

/// City configuration
#[derive(Debug, Clone)]
pub struct CityConfig {
    pub name: String,
    pub entry_fee: i32,
    pub prize: i32,
    pub turn_timer: u32,
}

impl Default for CityConfig {
    fn default() -> Self {
        Self {
            name: "dubai".into(),
            entry_fee: 500,
            prize: 900,
            turn_timer: 30,
        }
    }
}

/// ELO matchmaking constants
const ELO_BASE_WINDOW: i32 = 100;     // Initial search range: ±100
const ELO_EXPANSION_RATE: i32 = 50;   // Expand by ±50 per interval
const ELO_EXPANSION_INTERVAL: u64 = 5; // Every 5 seconds of waiting
const ELO_MAX_WINDOW: i32 = 500;      // Maximum search range: ±500

/// City matchmaking queue
/// 
/// Thread-safe matchmaking queue that groups players by city.
/// Uses ELO-based skill matching with a dynamic search window
/// that expands over time to balance fairness vs. wait time.
#[derive(Clone)]
pub struct CityMatchmakingQueue {
    /// City -> Queue of waiting players
    queues: DashMap<String, Arc<RwLock<VecDeque<QueuedPlayer>>>>,
    /// Player ID -> City they're queued in
    player_cities: DashMap<Uuid, String>,
    /// City configurations
    configs: DashMap<String, CityConfig>,
    /// Reference to game engine
    game_engine: GameEngine,
}

impl CityMatchmakingQueue {
    /// Create new matchmaking queue
    pub fn new(game_engine: GameEngine) -> Self {
        let queue = Self {
            queues: DashMap::new(),
            player_cities: DashMap::new(),
            configs: DashMap::new(),
            game_engine,
        };

        // Initialize city configs - MUST match routes/config.rs
        queue.configs.insert(
            "dubai".into(),
            CityConfig {
                name: "dubai".into(),
                entry_fee: 500,
                prize: 900,
                turn_timer: 30, // Easy
            },
        );
        queue.configs.insert(
            "cairo".into(),
            CityConfig {
                name: "cairo".into(),
                entry_fee: 1000,
                prize: 1800,
                turn_timer: 20, // Medium
            },
        );
        queue.configs.insert(
            "oslo".into(),
            CityConfig {
                name: "oslo".into(),
                entry_fee: 5000,
                prize: 9000,
                turn_timer: 10, // Hard
            },
        );

        queue
    }

    /// Add player to queue (legacy — uses default ELO of 1000)
    pub async fn join(
        &self,
        player_id: Uuid,
        player_name: String,
        city: String,
    ) -> crate::error::Result<bool> {
        self.join_with_elo(player_id, player_name, city, 1000).await
    }

    /// Add player to queue with their ELO rating
    pub async fn join_with_elo(
        &self,
        player_id: Uuid,
        player_name: String,
        city: String,
        elo: i32,
    ) -> crate::error::Result<bool> {
        // If already in a queue, leave it first
        if let Some(old_city) = self.player_cities.get(&player_id).map(|c| c.clone()) {
            if old_city == city {
                return Ok(false); // Already in this queue
            }
            self.leave(player_id).await;
        }

        // Get or create queue for city
        let queue = self
            .queues
            .entry(city.to_string())
            .or_insert_with(|| Arc::new(RwLock::new(VecDeque::new())));

        // Add player
        let player = QueuedPlayer {
            id: player_id,
            name: player_name,
            elo,
            joined_at: std::time::Instant::now(),
        };

        queue.write().await.push_back(player);
        self.player_cities.insert(player_id, city.to_string());

        tracing::info!("Player {} (ELO: {}) added to {} queue", player_id, elo, city);
        Ok(true)
    }

    /// Remove player from queue
    pub async fn leave(&self, player_id: Uuid) -> Option<String> {
        if let Some((_, city)) = self.player_cities.remove(&player_id) {
            if let Some(queue) = self.queues.get(&city) {
                let mut q = queue.write().await;
                q.retain(|p| p.id != player_id);
                return Some(city);
            }
        }
        None
    }

    /// Try to match players in a city using ELO-based skill pairing
    ///
    /// Algorithm:
    /// 1. For each player in the queue, calculate their dynamic search window
    ///    based on how long they've been waiting (starts at ±100, expands by ±50
    ///    every 5 seconds, capped at ±500).
    /// 2. Find the best pair: the two players whose ELO difference is smallest
    ///    AND who fall within each other's search windows.
    /// 3. If a valid pair is found, pop them both and create the game.
    pub async fn try_match(&self, city: &str) -> Option<(QueuedPlayer, QueuedPlayer, Uuid)> {
        let queue = self.queues.get(city)?;
        let mut q = queue.write().await;

        if q.len() < 2 {
            return None;
        }

        // Find the best ELO-compatible pair
        let now = std::time::Instant::now();
        let mut best_pair: Option<(usize, usize, i32)> = None; // (idx1, idx2, elo_diff)

        for i in 0..q.len() {
            let p1 = &q[i];
            let p1_wait_secs = now.duration_since(p1.joined_at).as_secs();
            let p1_window = std::cmp::min(
                ELO_BASE_WINDOW + ELO_EXPANSION_RATE * (p1_wait_secs / ELO_EXPANSION_INTERVAL) as i32,
                ELO_MAX_WINDOW,
            );

            for j in (i + 1)..q.len() {
                let p2 = &q[j];
                let p2_wait_secs = now.duration_since(p2.joined_at).as_secs();
                let p2_window = std::cmp::min(
                    ELO_BASE_WINDOW + ELO_EXPANSION_RATE * (p2_wait_secs / ELO_EXPANSION_INTERVAL) as i32,
                    ELO_MAX_WINDOW,
                );

                let elo_diff = (p1.elo - p2.elo).abs();

                // Both players must accept each other within their respective windows
                if elo_diff <= p1_window && elo_diff <= p2_window {
                    match &best_pair {
                        Some((_, _, best_diff)) if elo_diff >= *best_diff => {}
                        _ => {
                            best_pair = Some((i, j, elo_diff));
                        }
                    }
                }
            }
        }

        if let Some((idx1, idx2, elo_diff)) = best_pair {
            // Remove in reverse order to preserve indices
            let p2 = q.remove(idx2).expect("idx2 valid");
            let p1 = q.remove(idx1).expect("idx1 valid");

            // Remove from tracking
            self.player_cities.remove(&p1.id);
            self.player_cities.remove(&p2.id);

            let turn_timer = self.get_turn_timer(city);
            // Poison selection time — 30 seconds for all cities
            let poison_timer = 30u32;

            // Create game instance with city-specific timers
            let game_id = self
                .game_engine
                .create_game(
                    p1.name.clone(),
                    p2.name.clone(),
                    Some(p1.id),
                    Some(p2.id),
                    false, // p1 is human
                    false, // p2 is human
                    turn_timer,
                    poison_timer,
                    city.to_string(),
                )
                .await;

            tracing::info!(
                "ELO Match! {} (ELO:{}) vs {} (ELO:{}) [Δ{}] in {} [Game: {}, Timer: {}s]",
                p1.name, p1.elo,
                p2.name, p2.elo,
                elo_diff,
                city,
                game_id,
                turn_timer
            );

            return Some((p1, p2, game_id));
        }

        None
    }

    /// Get current matchmaking statistics for a specific city
    pub async fn get_city_stats(&self, city: &str) -> (usize, i32, i32) {
        let waiting = if let Some(q) = self.queues.get(city) {
            q.read().await.len()
        } else {
            0
        };

        let config = self.get_city_config(city).unwrap_or_default();
        (waiting, config.entry_fee, config.prize)
    }

    /// Get queue stats for all cities
    pub async fn get_stats(&self) -> Vec<(String, usize)> {
        let mut stats = Vec::new();
        for entry in self.queues.iter() {
            let city = entry.key().clone();
            let count = entry.value().read().await.len();
            stats.push((city, count));
        }
        stats
    }

    /// Check if player is currently in any queue
    pub fn is_queued(&self, player_id: &Uuid) -> bool {
        self.player_cities.contains_key(player_id)
    }

    /// Get city config
    pub fn get_city_config(&self, city: &str) -> Option<CityConfig> {
        self.configs.get(city).map(|c| c.clone())
    }

    /// Get turn timer for city
    pub fn get_turn_timer(&self, city: &str) -> u32 {
        self.configs.get(city).map(|c| c.turn_timer).unwrap_or(30)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::GameEngine;

    #[tokio::test]
    async fn test_elo_matchmaking_close_skill() {
        let engine = GameEngine::new();
        let queue = CityMatchmakingQueue::new(engine);
        let p1_id = Uuid::new_v4();
        let p2_id = Uuid::new_v4();

        // Two players with close ELO should match immediately
        queue.join_with_elo(p1_id, "Pro".into(), "dubai".into(), 1050).await.unwrap();
        queue.join_with_elo(p2_id, "Semi-Pro".into(), "dubai".into(), 980).await.unwrap();

        let matched = queue.try_match("dubai").await;
        assert!(matched.is_some(), "Close-ELO players should match");
    }

    #[tokio::test]
    async fn test_elo_matchmaking_wide_gap_no_match() {
        let engine = GameEngine::new();
        let queue = CityMatchmakingQueue::new(engine);
        let p1_id = Uuid::new_v4();
        let p2_id = Uuid::new_v4();

        // Two players with huge ELO gap should NOT match immediately
        queue.join_with_elo(p1_id, "Newbie".into(), "dubai".into(), 800).await.unwrap();
        queue.join_with_elo(p2_id, "Legend".into(), "dubai".into(), 1500).await.unwrap();

        let matched = queue.try_match("dubai").await;
        assert!(matched.is_none(), "700-ELO-gap players should NOT match with fresh window");

        // Queue should still have both players
        let stats = queue.get_stats().await;
        let dubai = stats.iter().find(|(c, _)| c == "dubai").unwrap();
        assert_eq!(dubai.1, 2);
    }
}
