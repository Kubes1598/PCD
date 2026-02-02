//! Database models
//!
//! Rust structs matching PostgreSQL schema.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Player record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub profile_id: Option<String>,
    pub games_played: i32,
    pub games_won: i32,
    pub coin_balance: i32,
    pub diamonds_balance: i32,
    pub rank: Option<String>,
    pub tier: Option<i32>,
    pub stars: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
}

/// Game record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Game {
    pub id: Uuid,
    pub player1_id: Option<Uuid>,
    pub player2_id: Option<Uuid>,
    pub player1_name: String,
    pub player2_name: String,
    pub status: String,
    pub winner: Option<String>,
    pub game_state: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

/// User auth data (for login)
#[derive(Debug, Clone, FromRow)]
pub struct UserAuth {
    pub id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub password_hash: Option<String>,
}

/// Create user request
#[derive(Debug)]
pub struct CreateUser {
    pub username: String,
    pub email: String,
    pub password_hash: String,
}

/// Create game request
#[derive(Debug)]
pub struct CreateGame {
    pub player1_id: Uuid,
    pub player2_id: Uuid,
    pub player1_name: String,
    pub player2_name: String,
}
