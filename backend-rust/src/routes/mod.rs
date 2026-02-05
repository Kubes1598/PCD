//! Routes module

pub mod ai;
pub mod auth;
pub mod config;
pub mod game;
pub mod matchmaking;
pub mod oauth;
pub mod users;

use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
}

/// Basic health check
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy",
        version: env!("CARGO_PKG_VERSION"),
    })
}

/// Database health check
pub async fn db_health_check(
    State(state): State<AppState>,
) -> Result<Json<HealthResponse>, crate::error::AppError> {
    state.db.health_check().await?;
    Ok(Json(HealthResponse {
        status: "healthy",
        version: env!("CARGO_PKG_VERSION"),
    }))
}
