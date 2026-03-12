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
    // Security fields
    pub password_hash: Option<String>,
    pub mfa_enabled: Option<bool>,
    pub totp_secret: Option<String>,
    pub failed_login_attempts: Option<i32>,
    pub lockout_until: Option<DateTime<Utc>>,
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
    pub mfa_enabled: Option<bool>,
    pub failed_login_attempts: Option<i32>,
    pub lockout_until: Option<DateTime<Utc>>,
}

/// Create user request
#[derive(Debug)]
pub struct CreateUser {
    pub username: String,
    pub email: String,
    pub password_hash: String,
}

/// Upgrade user request (guest to full)
#[derive(Debug)]
pub struct UpgradeUser {
    pub id: Uuid,
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

/// Match Status for persistent state machine
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MatchStatus {
    MATCHED,
    READY,
    STARTED,
    FINISHED,
    CANCELED,
}

/// Persistent match record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PersistentMatch {
    pub id: Uuid,
    pub p1_id: Uuid,
    pub p2_id: Uuid,
    pub city: String,
    pub status: MatchStatus,
    pub p1_poison: Option<String>,
    pub p2_poison: Option<String>,
    pub final_result: Option<String>,
    pub game_data: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Outbox event for reliable messaging
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OutboxEvent {
    pub id: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub target_player_id: Option<Uuid>,
    pub status: Option<String>,
    pub retry_count: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}
