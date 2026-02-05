//! Game types and enums

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Available candy emojis (30 to pick from)
pub const CANDY_POOL: [&str; 30] = [
    "🍬", "🍭", "🍫", "🧁", "🍰", "🎂", "🍪", "🍩", "🍯", "🍮", "🧊", "🍓", "🍒", "🍑", "🥭", "🍍",
    "🥝", "🍇", "🫐", "🍉", "🍊", "🍋", "🍌", "🍈", "🍎", "🍏", "🥥", "🥕", "🌽", "🥜",
];

/// Win threshold - candies needed to win
pub const WIN_THRESHOLD: usize = 11;

/// Game state enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GameState {
    #[default]
    Setup,
    PoisonSelection,
    Playing,
    Finished,
}

/// Game result enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GameResult {
    Player1Win,
    Player2Win,
    Draw,
    #[default]
    Ongoing,
}

/// Player in a game session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePlayer {
    pub id: uuid::Uuid,
    pub name: String,
    pub owned_candies: HashSet<String>,
    pub collected_candies: Vec<String>,
    pub poison_choice: Option<String>,
    pub timeout_count: u32,
}

impl GamePlayer {
    pub fn new(id: uuid::Uuid, name: String) -> Self {
        Self {
            id,
            name,
            owned_candies: HashSet::new(),
            collected_candies: Vec::new(),
            poison_choice: None,
            timeout_count: 0,
        }
    }
}

/// Move result returned after making a move
#[derive(Debug, Clone, Serialize)]
pub struct MoveResult {
    pub success: bool,
    pub picked_candy: String,
    pub is_poison: bool,
    pub game_over: bool,
    pub result: GameResult,
    pub winner: Option<String>,
    pub current_turn: u32,
}

/// Timeout result
#[derive(Debug, Clone, Serialize)]
pub struct TimeoutResult {
    pub game_over: bool,
    pub result: GameResult,
    pub loser: Option<String>,
}
