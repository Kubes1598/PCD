//! PCD Backend Library
//!
//! Core logic for the Poisoned Candy Duel server.

pub mod config;
pub mod db;
pub mod error;
pub mod game;
pub mod middleware;
pub mod routes;
pub mod schemas;
pub mod utils;
pub mod ws;

use axum::middleware::from_fn_with_state;
use axum::routing::get;
use axum::Router;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use std::sync::Arc;

use crate::config::Config;
use crate::db::{Database, RedisClient};

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub redis: Option<RedisClient>,
    pub config: Config,
    pub game_engine: game::GameEngine,
    pub connection_manager: ws::ConnectionManager,
    pub matchmaking_queue: Arc<ws::CityMatchmakingQueue>,
    pub timer_manager: Arc<ws::GameTimerManager>,
}

/// Create the application router
pub fn create_app(state: AppState) -> Router {
    Router::new()
        // Health checks
        .route("/health", get(routes::health_check))
        .route("/health/db", get(routes::db_health_check))
        // Auth routes
        .nest("/auth", routes::auth::router())
        // OAuth routes
        .nest("/oauth", routes::oauth::router())
        // Game routes
        .nest("/games", routes::game::router())
        // Player routes
        .nest("/players", routes::users::router())
        // AI routes
        .nest("/ai", routes::ai::router())
        // Config routes
        .nest("/api", routes::config::router())
        // Matchmaking routes
        .nest("/matchmaking", routes::matchmaking::router())
        // Add state
        .with_state(state.clone())
        // Add middleware layers
        .layer(from_fn_with_state(state.clone(), middleware::auth::auth_middleware))
        .layer(from_fn_with_state(state.clone(), middleware::rate_limit::rate_limit_middleware))
        .layer(axum::middleware::from_fn(middleware::security::security_headers))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
}

/// Graceful shutdown handler
pub async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    tracing::info!("🛑 Shutdown signal received, gracefully shutting down...");
}
