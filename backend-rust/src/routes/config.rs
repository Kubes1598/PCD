use axum::{Json, Router, routing::get};
use serde::Serialize;
use std::collections::HashMap;
use crate::AppState;

/// Create config router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/config", get(get_config))
}

#[derive(Debug, Serialize)]
pub struct CityConfig {
    pub entry_fee: i32,
    pub prize_amount: i32,
    pub turn_timer: u32,
    pub difficulty: String,
}

#[derive(Debug, Serialize)]
pub struct AIConfig {
    pub entry_fee: i32,
    pub prize_amount: i32,
    pub turn_timer: u32,
}

/// Game configuration response
#[derive(Debug, Serialize)]
pub struct GameConfig {
    pub win_threshold: usize,
    pub candy_count: usize,
    pub city_config: HashMap<String, CityConfig>,
    pub ai_config: HashMap<String, AIConfig>,
}

/// Get game configuration
pub async fn get_config() -> Json<GameConfig> {
    let mut city_config = HashMap::new();
    city_config.insert("Dubai".into(), CityConfig { entry_fee: 500, prize_amount: 900, turn_timer: 30, difficulty: "easy".into() });
    city_config.insert("Cairo".into(), CityConfig { entry_fee: 1000, prize_amount: 1800, turn_timer: 20, difficulty: "medium".into() });
    city_config.insert("Oslo".into(), CityConfig { entry_fee: 5000, prize_amount: 9000, turn_timer: 10, difficulty: "hard".into() });

    let mut ai_config = HashMap::new();
    ai_config.insert("easy".into(), AIConfig { entry_fee: 0, prize_amount: 0, turn_timer: 30 });
    ai_config.insert("medium".into(), AIConfig { entry_fee: 100, prize_amount: 180, turn_timer: 20 });
    ai_config.insert("hard".into(), AIConfig { entry_fee: 250, prize_amount: 450, turn_timer: 10 });

    Json(GameConfig {
        win_threshold: 11,
        candy_count: 12,
        city_config,
        ai_config,
    })
}
