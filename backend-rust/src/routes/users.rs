//! User routes

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::{error::{AppError, Result}, AppState};

/// Create users router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/leaderboard", get(get_leaderboard))
        .route("/profile/:profile_id", get(get_profile))
        .route("/:name/stats", get(get_player_stats))
        .route("/:name/friends", get(get_friends))
        .route("/:name/quests", get(get_quests))
        .route("/balance", post(get_balance))
}

/// Generic API response
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

/// User profile response
#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub profile_id: Option<String>,
    pub games_played: i32,
    pub games_won: i32,
    pub coin_balance: i32,
    pub diamonds_balance: i32,
    pub rank: Option<String>,
    pub tier: Option<i32>,
    pub stars: Option<i32>,
}

/// Get player stats by name
async fn get_player_stats(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<UserProfile>>> {
    let player = state.db.get_player_by_name(&name).await?
        .ok_or_else(|| AppError::NotFound(format!("Player {} not found", name)))?;

    Ok(Json(ApiResponse {
        success: true,
        message: "Stats retrieved".into(),
        data: Some(UserProfile {
            id: player.id,
            name: player.name,
            email: Some(player.email),
            profile_id: player.profile_id,
            games_played: player.games_played,
            games_won: player.games_won,
            coin_balance: player.coin_balance,
            diamonds_balance: player.diamonds_balance,
            rank: player.rank,
            tier: player.tier,
            stars: player.stars,
        }),
    }))
}

/// Get profile by profile_id
async fn get_profile(
    State(state): State<AppState>,
    Path(profile_id): Path<String>,
) -> Result<Json<ApiResponse<UserProfile>>> {
    // For now, search by name if profile_id looks like a name, or by UUID if it is one
    let player = if let Ok(uuid) = Uuid::parse_str(&profile_id) {
        state.db.get_player(&uuid).await?
    } else {
        state.db.get_player_by_name(&profile_id).await?
    };

    let player = player.ok_or_else(|| AppError::NotFound(format!("Profile {} not found", profile_id)))?;

    Ok(Json(ApiResponse {
        success: true,
        message: "Profile retrieved".into(),
        data: Some(UserProfile {
            id: player.id,
            name: player.name,
            email: Some(player.email),
            profile_id: player.profile_id,
            games_played: player.games_played,
            games_won: player.games_won,
            coin_balance: player.coin_balance,
            diamonds_balance: player.diamonds_balance,
            rank: player.rank,
            tier: player.tier,
            stars: player.stars,
        }),
    }))
}

/// Get friends
async fn get_friends(
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>> {
    Ok(Json(ApiResponse {
        success: true,
        message: format!("Friends for {} (Stub)", name),
        data: Some(vec![]),
    }))
}

/// Get quests
async fn get_quests(
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>> {
    Ok(Json(ApiResponse {
        success: true,
        message: format!("Quests for {} (Stub)", name),
        data: Some(vec![]),
    }))
}

/// Get balance
async fn get_balance(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    let name = req["player_name"].as_str()
        .ok_or_else(|| AppError::BadRequest("Missing player_name".into()))?;

    let player = state.db.get_player_by_name(name).await?
        .ok_or_else(|| AppError::NotFound(format!("Player {} not found", name)))?;

    Ok(Json(ApiResponse {
        success: true,
        message: "Balance retrieved".into(),
        data: Some(serde_json::json!({
            "coin_balance": player.coin_balance,
            "diamonds_balance": player.diamonds_balance,
        })),
    }))
}

/// Leaderboard response
#[derive(Debug, Serialize)]
pub struct LeaderboardResponse {
    pub players: Vec<LeaderboardEntry>,
}

/// Leaderboard entry
#[derive(Debug, Serialize)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub name: String,
    pub games_won: i32,
    pub games_played: i32,
    pub win_rate: f64,
}

/// Get leaderboard
async fn get_leaderboard(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<LeaderboardEntry>>>> {
    let players = state.db.get_leaderboard(100).await?;

    let entries: Vec<LeaderboardEntry> = players
        .into_iter()
        .enumerate()
        .map(|(i, p)| {
            let win_rate = if p.games_played > 0 {
                (p.games_won as f64 / p.games_played as f64) * 100.0
            } else {
                0.0
            };
            LeaderboardEntry {
                rank: i + 1,
                name: p.name,
                games_won: p.games_won,
                games_played: p.games_played,
                win_rate,
            }
        })
        .collect();

    Ok(Json(ApiResponse {
        success: true,
        message: "Leaderboard retrieved".into(),
        data: Some(entries),
    }))
}
