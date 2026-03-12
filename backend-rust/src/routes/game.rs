//! Game routes

use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::auth::AuthUser,
    AppState,
};

/// Create game router
pub fn router(state: AppState) -> Router<AppState> {
    use crate::middleware::auth::require_auth;
    use axum::middleware::from_fn_with_state;

    Router::new()
        .route("/", post(create_game))
        .route("/ai", post(create_ai_game))
        .route("/:game_id", get(get_game))
        .route("/:game_id", delete(delete_game))
        .route("/:game_id/poison", post(set_poison))
        .route("/:game_id/pick", post(pick_candy))
        .layer(from_fn_with_state(state, require_auth))
}

/// Create game request
#[derive(Debug, Deserialize)]
pub struct CreateGameRequest {
    pub player1_name: String,
    pub player2_name: String,
    pub player1_id: Option<Uuid>,
    pub player2_id: Option<Uuid>,
}

/// Set poison request
#[derive(Debug, Deserialize)]
pub struct SetPoisonRequest {
    pub poison_choice: String,
}

/// Pick candy request
#[derive(Debug, Deserialize)]
pub struct PickCandyRequest {
    pub candy_choice: String,
}

/// Game response
#[derive(Debug, Serialize)]
pub struct GameResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Create a new game
async fn create_game(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateGameRequest>,
) -> Result<Json<GameResponse>> {
    // 1. Get player name from DB (IDOR Protection)
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Player not found".into()))?;
    // Default timers for generic game creation
    let turn_timer = 30u32;
    let poison_timer = 30u32; // Standard 30s poison pick

    let game_id = state
        .game_engine
        .create_game(
            player.name.clone(),
            req.player2_name.clone(),
            Some(user.id),
            req.player2_id,
            false, // p1 is human
            false, // p2 is human
            turn_timer,
            poison_timer,
            "local".to_string(),
        )
        .await;

    let game = state
        .game_engine
        .get_game(game_id)
        .ok_or_else(|| AppError::Internal("Failed to create game".into()))?;

    Ok(Json(GameResponse {
        success: true,
        message: "Game created".into(),
        data: Some(serde_json::json!({
            "game_id": game_id,
            "player1_id": game.player1.id,
            "player2_id": game.player2.id,
            "state": game.state,
        })),
    }))
}

/// AI difficulty query
#[derive(Debug, Deserialize)]
pub struct AIDifficultyQuery {
    pub difficulty: Option<String>,
}

/// Create a new game against AI
async fn create_ai_game(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<AIDifficultyQuery>,
) -> Result<Json<GameResponse>> {
    let difficulty = query.difficulty.unwrap_or_else(|| "easy".to_string());

    // Get player name
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Player not found".into()))?;

    // Deduct entry fee (using AI_CONFIG equivalents)
    let fee = match difficulty.as_str() {
        "medium" => 100,
        "hard" => 250,
        _ => 0,
    };

    // Generate game ID first for atomic transaction
    let game_id = Uuid::new_v4();

    // ATOMIC TRANSACTION: Deduct fee and Create Match record
    state.db.create_ai_match_atomic(
        game_id,
        &user.id,
        &difficulty,
        fee
    ).await.map_err(|e| {
        if matches!(e, sqlx::Error::RowNotFound) {
            AppError::BadRequest("Insufficient coins".into())
        } else {
            AppError::Internal("Transaction failed".into())
        }
    })?;

    // Create game session in engine
    let actual_game_id = state
        .game_engine
        .create_game(
            player.name.clone(),
            "Computer".to_string(),
            Some(user.id),
            Some(Uuid::new_v4()), // AI UUID (virtual)
            false,
            true,
            match difficulty.as_str() {
                "medium" => 20,
                "hard" => 10,
                _ => 30,
            },
            30,
            format!("ai_{}", difficulty),
        )
        .await;

    // Set stakes
    let prize = match difficulty.as_str() {
        "medium" => 180,
        "hard" => 450,
        _ => 0,
    };
    state.game_engine.set_stakes(actual_game_id, fee, prize);

    let game = state.game_engine.get_game(actual_game_id).unwrap();

    // NOTE: AI poison is handled secretly by the server when it moves.
    // We don't need to pick it now or expose it to anyone.

    Ok(Json(GameResponse {
        success: true,
        message: format!("AI Game ({}) created", difficulty),
        data: Some(serde_json::json!({
            "game_id": actual_game_id,
            "player1_id": game.player1.id,
            "player2_id": game.player2.id,
            "state": game.state,
            "game_state": {
                "player1": {
                    "id": game.player1.id,
                    "owned_candies": game.player1.owned_candies,
                },
                "player2": {
                    "id": game.player2.id,
                    "owned_candies": game.player2.owned_candies,
                }
            }
        })),
    }))
}

/// Get game state
async fn get_game(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(game_id): Path<Uuid>,
) -> Result<Json<GameResponse>> {
    let game = state
        .game_engine
        .get_game(game_id)
        .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

    // SECURITY: Only players in the game can view full state
    if game.player1.id != user.id && game.player2.id != user.id {
        return Err(AppError::Forbidden("You are not part of this game".into()));
    }

    Ok(Json(GameResponse {
        success: true,
        message: "Game state retrieved".into(),
        data: Some(serde_json::to_value(game.for_viewer(user.id)).unwrap()),
    }))
}

/// Delete a game — requires authentication + ownership
async fn delete_game(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(game_id): Path<Uuid>,
) -> Result<Json<GameResponse>> {
    let game = state
        .game_engine
        .get_game(game_id)
        .ok_or_else(|| AppError::NotFound(format!("Game {} not found", game_id)))?;

    // Only participants can delete their own game
    if game.player1.id != user.id && game.player2.id != user.id {
        return Err(AppError::Forbidden("Only participants can delete this game".into()));
    }

    state.game_engine.remove_game(game_id);

    Ok(Json(GameResponse {
        success: true,
        message: "Game deleted".into(),
        data: None,
    }))
}

/// Set poison choice — uses authenticated user, not request body
async fn set_poison(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(game_id): Path<Uuid>,
    Json(req): Json<SetPoisonRequest>,
) -> Result<Json<GameResponse>> {
    let game_started = state
        .game_engine
        .set_poison_choice(game_id, user.id, &req.poison_choice)
        .await?;

    let message = if game_started {
        "Poison set - game started!"
    } else {
        "Poison set - waiting for opponent"
    };

    Ok(Json(GameResponse {
        success: true,
        message: message.into(),
        data: Some(serde_json::json!({
            "game_started": game_started,
        })),
    }))
}

/// Pick a candy — uses authenticated user, not request body
async fn pick_candy(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(game_id): Path<Uuid>,
    Json(req): Json<PickCandyRequest>,
) -> Result<Json<GameResponse>> {
    let result = state
        .game_engine
        .make_move(game_id, user.id, req.candy_choice.clone())
        .await?;

    // If game over, process victory/draw settlement
    if result.game_over {
        let game = state.game_engine.get_game(game_id).unwrap();

        let winner_id = if let Some(winner_name) = result.winner.as_deref() {
            if winner_name == game.player1.name && !game.player1.is_ai {
                Some(game.player1.id)
            } else if winner_name == game.player2.name && !game.player2.is_ai {
                Some(game.player2.id)
            } else {
                None
            }
        } else {
            None
        };

        let result_type = match result.result {
             crate::game::GameResult::Player1Win => "p1_win",
             crate::game::GameResult::Player2Win => "p2_win",
             crate::game::GameResult::Draw => "draw",
             _ => "playing",
        };

        // Centralized atomic settlement
        let _ = state.db.settle_match_result(
            game_id,
            &game.player1.id,
            &game.player2.id,
            winner_id,
            game.entry_fee,
            game.prize,
            result_type,
            &game.city
        ).await;
    }

    Ok(Json(GameResponse {
        success: true,
        message: if result.is_poison {
            "You picked the poison!".into()
        } else if result.game_over {
            format!(
                "Game over - {} wins!",
                result.winner.as_deref().unwrap_or("Unknown")
            )
        } else {
            "Candy collected".into()
        },
        data: Some(serde_json::to_value(&result).unwrap()),
    }))
}
