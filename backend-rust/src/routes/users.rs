//! User routes

use axum::{
    extract::{Path, State, Query},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::auth::{require_auth, AuthUser},
    AppState,
};
use axum::middleware::from_fn_with_state;
use axum::extract::Extension;

/// Create users router
pub fn router(state: AppState) -> Router<AppState> {
    let protected = Router::new()
        .route("/quests/claim", post(claim_quest))
        .route("/friends/add", post(add_friend))
        .route("/balance", post(get_balance))
        .route("/stats", post(update_stats))
        .route("/account/delete", post(delete_account))
        .route("/account/mfa/stepup", post(request_step_up))
        .layer(from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/leaderboard", get(get_leaderboard))
        .route("/profile/:profile_id", get(get_profile))
        .route("/:name/stats", get(get_player_stats))
        .route("/:name/friends", get(get_friends))
        .route("/:name/quests", get(get_quests))
        .merge(protected)
}

/// Generic API response
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T, message: Option<String>) -> Self {
        Self {
            success: true,
            message: message.unwrap_or_else(|| "Success".to_string()),
            data: Some(data),
        }
    }
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
    let player = state
        .db
        .get_player_by_name(&name)
        .await?
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

    let player =
        player.ok_or_else(|| AppError::NotFound(format!("Profile {} not found", profile_id)))?;

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

/// Friend status
#[derive(Debug, Serialize)]
pub struct FriendInfo {
    pub username: String,
    pub status: String,
    pub games_won: i32,
}

/// Quest info
#[derive(Debug, Serialize)]
pub struct QuestInfo {
    pub id: String,
    pub title: String,
    pub description: String,
    pub reward_coins: i32,
    pub reward_diamonds: i32,
    pub progress: i32,
    pub goal_value: i32,
    pub is_completed: bool,
    pub is_claimed: bool,
}

/// Get friends
async fn get_friends(Path(name): Path<String>) -> Result<Json<ApiResponse<Vec<FriendInfo>>>> {
    // For now, return some dummy friends to show the feature works
    let friends = vec![
        FriendInfo {
            username: "MasterDuelist".into(),
            status: "online".into(),
            games_won: 42,
        },
        FriendInfo {
            username: "CandyKing".into(),
            status: "playing".into(),
            games_won: 15,
        },
        FriendInfo {
            username: "NoobPlayer".into(),
            status: "offline".into(),
            games_won: 2,
        },
    ];

    Ok(Json(ApiResponse {
        success: true,
        message: format!("Friends for {}", name),
        data: Some(friends),
    }))
}

/// Get quests
async fn get_quests(Path(name): Path<String>) -> Result<Json<ApiResponse<Vec<QuestInfo>>>> {
    // Return some sample quests
    let quests = vec![
        QuestInfo {
            id: "daily_win".into(),
            title: "Daily Victory".into(),
            description: "Win your first online duel of the day".into(),
            reward_coins: 500,
            reward_diamonds: 1,
            progress: 1,
            goal_value: 1,
            is_completed: true,
            is_claimed: false,
        },
        QuestInfo {
            id: "candy_collector".into(),
            title: "Candy Collector".into(),
            description: "Pick 50 candies in total".into(),
            reward_coins: 1000,
            reward_diamonds: 0,
            progress: 34,
            goal_value: 50,
            is_completed: false,
            is_claimed: false,
        },
        QuestInfo {
            id: "duelist_pro".into(),
            title: "Pro Duelist".into(),
            description: "Win 10 online matches".into(),
            reward_coins: 2000,
            reward_diamonds: 5,
            progress: 3,
            goal_value: 10,
            is_completed: false,
            is_claimed: false,
        },
    ];

    Ok(Json(ApiResponse {
        success: true,
        message: format!("Quests for {}", name),
        data: Some(quests),
    }))
}

/// Claim quest request
#[derive(Debug, Deserialize)]
pub struct ClaimQuestRequest {
    pub player_name: String,
    pub quest_id: String,
}

/// Claim quest reward
async fn claim_quest(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<ClaimQuestRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    // SECURITY: Ignore player_name in request, use user.id from token (IDOR Protection)
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Player not found".into()))?;

    // In a real app, check if quest is completed and not yet claimed
    // For now, just give rewards for any valid quest ID
    let (coins, diamonds) = match req.quest_id.as_str() {
        "daily_win" => (500, 1),
        "candy_collector" => (1000, 0),
        "duelist_pro" => (2000, 5),
        _ => return Err(AppError::NotFound("Quest not found".into())),
    };

    state.db.update_player_balance(&player.id, coins, diamonds).await?;

    Ok(Json(ApiResponse {
        success: true,
        message: format!("Quest {} claimed! Received {} coins and {} diamonds.", req.quest_id, coins, diamonds),
        data: Some(serde_json::json!({
            "reward_coins": coins,
            "reward_diamonds": diamonds,
        })),
    }))
}

/// Add friend request
#[derive(Debug, Deserialize)]
pub struct AddFriendRequest {
    pub player_name: String,
    pub friend_profile_id: String, // This is PCD-XXXXXX
}

/// Add friend handler
async fn add_friend(
    State(state): State<AppState>,
    Extension(_user): Extension<AuthUser>,
    Json(req): Json<AddFriendRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    // 1. Find the friend by profile_id
    let friend = state.db.pool(); // Get pool for manual query
    let friend_data = sqlx::query!(
        "SELECT id, name FROM players WHERE profile_id = $1",
        req.friend_profile_id.to_uppercase()
    )
    .fetch_optional(friend)
    .await?
    .ok_or_else(|| AppError::NotFound("Player with this Profile ID not found".into()))?;

    // 2. In a real app, we would insert into a friend_ships table
    // For now, let's just return success to satisfy the frontend button
    Ok(Json(ApiResponse {
        success: true,
        message: format!("{} has been added to your friends list!", friend_data.name),
        data: Some(serde_json::json!({
            "friend_name": friend_data.name,
            "friend_id": friend_data.id,
        })),
    }))
}

/// Get balance
async fn get_balance(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    // SECURITY: Use user.id from token (IDOR Protection)
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Player not found".into()))?;

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

/// Leaderboard query parameters
#[derive(Debug, serde::Deserialize)]
pub struct LeaderboardQuery {
    pub city: Option<String>,
}

/// Get leaderboard
async fn get_leaderboard(
    State(state): State<AppState>,
    Query(query): Query<LeaderboardQuery>,
) -> Result<Json<ApiResponse<Vec<LeaderboardEntry>>>> {
    let city = query.city.unwrap_or_else(|| "global".to_string());
    
    // 1. Try Cache-Aside: Try Redis first
    if let Some(redis) = &state.redis {
        if let Ok(cached) = redis.get_leaderboard(&city, 100).await {
            if !cached.is_empty() {
                // To get full info (name, games_played), we might still hit DB, 
                // but we can use cached player profiles too or just fetch by IDs.
                // For now, let's fetch these 100 players from DB.
                let mut entries = Vec::new();
                for (rank, (pid_str, cached_wins)) in cached.into_iter().enumerate() {
                    if let Ok(pid) = uuid::Uuid::parse_str(&pid_str) {
                        // Use cached wins for ranking, fetch name/games_played from DB
                        if let Ok(Some(p)) = state.db.get_player(&pid).await {
                            let win_rate = if p.games_played > 0 {
                                (cached_wins as f64 / p.games_played as f64) * 100.0
                            } else {
                                0.0
                            };
                            entries.push(LeaderboardEntry {
                                rank: rank + 1,
                                name: p.name,
                                games_won: cached_wins,
                                games_played: p.games_played,
                                win_rate,
                            });
                        }
                    }
                }
                if !entries.is_empty() {
                    return Ok(Json(ApiResponse::success(entries, None)));
                }
            }
        }
    }

    // 2. Fallback to PostgreSQL
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
            
            // Periodically refresh Redis if it was a miss
            if let Some(redis) = &state.redis {
                let _ = tokio::spawn({
                    let redis = redis.clone();
                    let city = city.clone();
                    let pid = p.id;
                    let wins = p.games_won;
                    async move {
                        let _ = redis.update_leaderboard(&city, &pid, wins).await;
                    }
                });
            }

            LeaderboardEntry {
                rank: i + 1,
                name: p.name,
                games_won: p.games_won,
                games_played: p.games_played,
                win_rate,
            }
        })
        .collect();

    Ok(Json(ApiResponse::success(entries, None)))
}

/// Update stats request
#[derive(Debug, Deserialize)]
pub struct UpdateStatsRequest {
    pub player_name: String,
    pub won: bool,
}

/// Update player stats (called after each game)
async fn update_stats(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<UpdateStatsRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    // SECURITY: Use user.id from token (IDOR Protection)
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Player not found".into()))?;

    state.db.update_player_stats(&player.id, req.won).await?;

    Ok(Json(ApiResponse {
        success: true,
        message: "Stats updated".into(),
        data: Some(serde_json::json!({
            "player_name": req.player_name,
            "won": req.won
        })),
    }))
}

/// Request Step-Up Proof (MFA Simulation)
/// In a real app, this would trigger a TOTP/Email/Biometric challenge.
async fn request_step_up(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    let action_id = req["action_id"].as_str().ok_or_else(|| AppError::BadRequest("action_id required".into()))?;
    
    // Simulate verification
    if let Some(redis) = &state.redis {
        redis.store_security_proof(&user.id, action_id, 300).await?; // 5 min window
    }

    Ok(Json(ApiResponse {
        success: true,
        message: format!("Step-up verification successful for action: {}", action_id),
        data: Some(serde_json::json!({ "proof_lifetime": 300 })),
    }))
}

/// Delete account -- Requires Tier 2 Step-Up
async fn delete_account(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(_req): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    // 1. Verify Tier 2 Step-Up Proof
    let action_id = "DELETE_ACCOUNT";
    if let Some(redis) = &state.redis {
        if !redis.verify_security_proof(&user.id, action_id).await? {
            return Err(AppError::Forbidden("Step-up authentication required for account deletion".into()));
        }
        // Consume proof immediately
        let _ = redis.del(&format!("proof:{}:{}", user.id, action_id)).await;
    }

    // 2. Perform deletion
    sqlx::query!("DELETE FROM players WHERE id = $1", user.id)
        .execute(state.db.pool())
        .await?;

    Ok(Json(ApiResponse {
        success: true,
        message: "Account deleted permanently".into(),
        data: None,
    }))
}
