//! Game session state

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{GamePlayer, GameResult, GameState};

/// Complete game session between two players
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSession {
    pub id: Uuid,
    pub player1: GamePlayer,
    pub player2: GamePlayer,
    pub state: GameState,
    pub current_turn: u32,
    pub result: GameResult,
    pub entry_fee: i32,
    pub prize: i32,
    pub created_at: f64,
    pub last_updated: f64,
}

impl GameSession {
    /// Create a new game session
    pub fn new(
        player1_name: String,
        player2_name: String,
        p1_id: Option<Uuid>,
        p2_id: Option<Uuid>,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();

        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        let mut pool = super::types::CANDY_POOL.to_vec();
        pool.shuffle(&mut rng);

        // Assign 12 unique candies to each player from the first 24 shuffled
        let p1_candies: std::collections::HashSet<String> = pool[0..12].iter().map(|&s| s.to_string()).collect();
        let p2_candies: std::collections::HashSet<String> = pool[12..24].iter().map(|&s| s.to_string()).collect();

        let mut player1 = GamePlayer::new(p1_id.unwrap_or_else(Uuid::new_v4), player1_name);
        player1.owned_candies = p1_candies;

        let mut player2 = GamePlayer::new(p2_id.unwrap_or_else(Uuid::new_v4), player2_name);
        player2.owned_candies = p2_candies;

        Self {
            id: Uuid::new_v4(),
            player1,
            player2,
            state: GameState::Setup,
            current_turn: 1,
            result: GameResult::Ongoing,
            entry_fee: 0, // Default, will be set by engine
            prize: 0,     // Default, will be set by engine
            created_at: now,
            last_updated: now,
        }
    }

    /// Get player by ID (mutable)
    pub fn get_player_mut(&mut self, player_id: &Uuid) -> Option<&mut GamePlayer> {
        match (self.player1.id == *player_id, self.player2.id == *player_id) {
            (true, _) => Some(&mut self.player1),
            (_, true) => Some(&mut self.player2),
            _ => None,
        }
    }

    /// Get opponent of the given player
    pub fn get_opponent(&self, player_id: &Uuid) -> Option<&GamePlayer> {
        match (self.player1.id == *player_id, self.player2.id == *player_id) {
            (true, _) => Some(&self.player2),
            (_, true) => Some(&self.player1),
            _ => None,
        }
    }

    /// Get opponent (mutable)
    pub fn get_opponent_mut(&mut self, player_id: &Uuid) -> Option<&mut GamePlayer> {
        match (self.player1.id == *player_id, self.player2.id == *player_id) {
            (true, _) => Some(&mut self.player2),
            (_, true) => Some(&mut self.player1),
            _ => None,
        }
    }

    /// Check if both players have set their poison
    pub fn both_poisons_set(&self) -> bool {
        matches!((&self.player1.poison_choice, &self.player2.poison_choice), (Some(_), Some(_)))
    }

    /// Get whose turn it is (player1 on odd turns, player2 on even)
    pub fn current_player_id(&self) -> Uuid {
        match self.current_turn % 2 {
            1 => self.player1.id,
            _ => self.player2.id,
        }
    }

    /// Update last_updated timestamp
    pub fn touch(&mut self) {
        self.last_updated = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
    }
}
