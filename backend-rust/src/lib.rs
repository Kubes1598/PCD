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

use axum::http::{HeaderValue, Method};
use axum::middleware::from_fn_with_state;
use axum::routing::get;
use axum::Router;
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;

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

/// Build a locked-down CORS policy based on environment
fn cors_layer(config: &Config) -> CorsLayer {
    let origins = if config.is_production() {
        // Production: only your real domains
        let mut allowed = vec![];
        if let Ok(v) = std::env::var("CORS_ALLOWED_ORIGINS") {
            for origin in v.split(',') {
                if let Ok(hv) = origin.trim().parse::<HeaderValue>() {
                    allowed.push(hv);
                }
            }
        }
        if allowed.is_empty() {
            // Fallback — deny all cross-origin (same-origin requests still work)
            tracing::warn!("⚠️  No CORS_ALLOWED_ORIGINS set in production — cross-origin requests will be rejected");
        }
        AllowOrigin::list(allowed)
    } else {
        // Dev: allow common local origins
        AllowOrigin::list([
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "http://localhost:8081".parse::<HeaderValue>().unwrap(),
            "http://localhost:19006".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:3000".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:8000".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:8081".parse::<HeaderValue>().unwrap(),
            "http://10.0.2.2:8000".parse::<HeaderValue>().unwrap(),
        ])
    };

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(3600))
}

/// Create the application router
pub fn create_app(state: AppState) -> Router {
    Router::new()
        // Health checks
        .route("/health", get(routes::health_check))
        .route("/health/db", get(routes::db_health_check))
        // Auth routes
        .nest("/auth", routes::auth::router(state.clone()))
        // OAuth routes
        .nest("/oauth", routes::oauth::router())
        // Game routes
        .nest("/games", routes::game::router(state.clone()))
        // Player routes
        .nest("/players", routes::users::router(state.clone()))
        // AI routes
        .nest("/ai", routes::ai::router(state.clone()))
        // Config routes
        .nest("/api", routes::config::router())
        // Matchmaking routes
        .nest("/matchmaking", routes::matchmaking::router())
        // Add state
        .with_state(state.clone())
        // Add middleware layers
        .layer(from_fn_with_state(
            state.clone(),
            middleware::auth::auth_middleware,
        ))
        .layer(from_fn_with_state(
            state.clone(),
            middleware::rate_limit::rate_limit_middleware,
        ))
        .layer(axum::middleware::from_fn(
            middleware::security::security_headers,
        ))
        .layer(TraceLayer::new_for_http())
        // Body size limit: 64 KB max (DDoS prevention)
        .layer(RequestBodyLimitLayer::new(1024 * 64))
        .layer(cors_layer(&state.config))
}

/// Graceful shutdown handler
pub async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    tracing::info!("🛑 Shutdown signal received, gracefully shutting down...");
}
