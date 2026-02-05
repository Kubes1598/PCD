//! City-based matchmaking queue

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

/// City matchmaking queue
/// 
/// Thread-safe matchmaking queue that groups players by city.
/// Each city has its own independent queue with configurable 
/// entry fees, prizes, and turn timers.
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

    /// Add player to queue
    pub async fn join(
        &self,
        player_id: Uuid,
        player_name: String,
        city: String,
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
            joined_at: std::time::Instant::now(),
        };

        queue.write().await.push_back(player);
        self.player_cities.insert(player_id, city.to_string());

        tracing::info!("Player {} added to {} queue", player_id, city);
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

    /// Try to match players in a city (Advanced: pops them only if successful)
    pub async fn try_match(&self, city: &str) -> Option<(QueuedPlayer, QueuedPlayer, Uuid)> {
        let queue = self.queues.get(city)?;
        let mut q = queue.write().await;

        if q.len() >= 2 {
            // Peek and check (could add logic here for rank matchmaking)
            let p1 = q.pop_front()?;
            let p2 = q.pop_front()?;

            // Remove from tracking
            self.player_cities.remove(&p1.id);
            self.player_cities.remove(&p2.id);

            let turn_timer = self.get_turn_timer(city);
            // Standard poison selection time - 60 seconds for all cities
            // This is intentionally longer than turn timers to allow thoughtful poison choice
            let poison_timer = 60u32;

            // Create game instance with city-specific timers
            let game_id = self
                .game_engine
                .create_game(
                    p1.name.clone(),
                    p2.name.clone(),
                    Some(p1.id),
                    Some(p2.id),
                    turn_timer,
                    poison_timer,
                )
                .await;

            tracing::info!(
                "Match Found! {} vs {} in City: {} [Game ID: {}, Timer: {}s]",
                p1.name,
                p2.name,
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
    async fn test_matchmaking_flow() {
        let engine = GameEngine::new();
        let queue = CityMatchmakingQueue::new(engine);
        let p1_id = Uuid::new_v4();
        let p2_id = Uuid::new_v4();

        // Join queue
        queue
            .join(p1_id, "Player 1".into(), "dubai".into())
            .await
            .unwrap();
        queue
            .join(p2_id, "Player 2".into(), "dubai".into())
            .await
            .unwrap();

        // Check stats
        let stats = queue.get_stats().await;
        let dubai_stats = stats.iter().find(|(c, _)| c == "dubai").unwrap();
        assert_eq!(dubai_stats.1, 2);

        // Try match
        let matched = queue.try_match("dubai").await;
        assert!(matched.is_some());
        let (p1, p2, _game_id) = matched.unwrap();
        assert_eq!(p1.id, p1_id);
        assert_eq!(p2.id, p2_id);

        // Queue should be empty now
        let stats_after = queue.get_stats().await;
        let dubai_stats_after = stats_after.iter().find(|(c, _)| c == "dubai").unwrap();
        assert_eq!(dubai_stats_after.1, 0);
    }
}
