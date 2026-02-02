//! AI opponent routes

use axum::{routing::post, Json, Router};
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

use crate::{error::Result, AppState};

/// Create AI router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/move", post(calculate_move))
}

/// AI move request
#[derive(Debug, Deserialize)]
pub struct AIMoveRequest {
    pub player_candies: Vec<String>,
    pub opponent_collection: Vec<String>,
    pub player_poison: String,
    pub difficulty: String,
}

/// AI move response
#[derive(Debug, Serialize)]
pub struct AIMoveResponse {
    pub success: bool,
    pub choice: String, // Changed from selected_candy
    pub reasoning: String,
}

/// Calculate AI move
async fn calculate_move(
    Json(req): Json<AIMoveRequest>,
) -> Result<Json<AIMoveResponse>> {
    let available: Vec<&String> = req.player_candies
        .iter()
        .filter(|c| *c != &req.player_poison)
        .collect();

    if available.is_empty() {
        // Only poison left - must pick it
        return Ok(Json(AIMoveResponse {
            success: true,
            choice: req.player_poison.clone(),
            reasoning: "No safe candies remaining".into(),
        }));
    }

    let not_collected: Vec<&String> = available
        .iter()
        .filter(|c| !req.opponent_collection.contains(c))
        .cloned()
        .collect();

    let selected = match req.difficulty.as_str() {
        "easy" => {
            // Random selection
            available.choose(&mut rand::thread_rng())
                .map(|s| (*s).clone())
                .unwrap_or_else(|| req.player_candies[0].clone())
        }
        "medium" => {
            // Avoid candies the opponent has collected (pattern detection)
            if !not_collected.is_empty() {
                not_collected.choose(&mut rand::thread_rng())
                    .map(|s| (*s).clone())
                    .unwrap_or_else(|| available[0].clone())
            } else {
                available.choose(&mut rand::thread_rng())
                    .map(|s| (*s).clone())
                    .unwrap_or_else(|| req.player_candies[0].clone())
            }
        }
        "hard" => {
            // Strategic: pick candies that minimize opponent's win chance
            if !not_collected.is_empty() {
                not_collected.into_iter()
                    .min()
                    .cloned()
                    .unwrap_or_else(|| available[0].clone())
            } else {
                available.into_iter()
                    .min()
                    .cloned()
                    .unwrap_or_else(|| req.player_candies[0].clone())
            }
        }
        _ => {
            available.choose(&mut rand::thread_rng())
                .map(|s| (*s).clone())
                .unwrap_or_else(|| req.player_candies[0].clone())
        }
    };

    Ok(Json(AIMoveResponse {
        success: true,
        choice: selected,
        reasoning: format!("AI ({}) selected candy", req.difficulty),
    }))
}
