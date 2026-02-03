//! AI opponent routes

use axum::{routing::post, Json, Router};
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

use crate::{error::{Result, AppError}, AppState};
use uuid::Uuid;

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
    pub game_id: Option<Uuid>, // Added to match frontend
}

/// AI move response
#[derive(Debug, Serialize)]
pub struct AIMoveResponse {
    pub success: bool,
    pub choice: String,
    pub reasoning: String,
}

/// Calculate AI move
async fn calculate_move(
    Json(req): Json<AIMoveRequest>,
) -> Result<Json<AIMoveResponse>> {
    let difficulty = req.difficulty.to_lowercase();
    
    // Find candies still in the pool (not yet collected by AI)
    let available_pool: Vec<String> = req.player_candies
        .iter()
        .filter(|c| !req.opponent_collection.contains(c))
        .cloned()
        .collect();

    if available_pool.is_empty() {
         return Err(AppError::BadRequest("No candies left in pool".into()));
    }

    // Determine the safe candidates (excluding poison)
    let safe_candidates: Vec<String> = available_pool
        .iter()
        .filter(|c| *c != &req.player_poison)
        .cloned()
        .collect();

    let selected = if safe_candidates.is_empty() {
        // Only poison left - must pick it
        available_pool[0].clone()
    } else {
        // AI Fallibility check based on difficulty
        let mut rng = rand::thread_rng();
        let prob_to_ignore_poison: f32 = match difficulty.as_str() {
            "easy" => 0.30,   // 30% chance to be "clueless" about poison
            "medium" => 0.10, // 10% chance
            "hard" => 0.0,    // 0% chance (plays perfectly)
            _ => 0.15,
        };

        use rand::Rng;
        let ignore_poison = rng.gen::<f32>() < prob_to_ignore_poison;

        if ignore_poison {
            // Pick any candy from the remaining pool (including poison!)
            available_pool.choose(&mut rng).unwrap().clone()
        } else {
            // Pick from safe candidates
            match difficulty.as_str() {
                "easy" => {
                    // Random safe choice
                    safe_candidates.choose(&mut rng).unwrap().clone()
                },
                "medium" | "hard" => {
                    // Try to pick a candy that doesn't exist in human's collection yet? 
                    // Actually, the human doesn't have a "collection" from THEIR OWN pool.
                    // Strategic moves in this game are mostly about avoiding poison.
                    // For hard, we could implement a more advanced strategy, 
                    // but random safe is already quite effective.
                    safe_candidates.choose(&mut rng).unwrap().clone()
                },
                _ => safe_candidates.choose(&mut rng).unwrap().clone(),
            }
        }
    };

    Ok(Json(AIMoveResponse {
        success: true,
        choice: selected.clone(),
        reasoning: format!("AI ({}) selected candy", difficulty),
    }))
}
