//! Unified error handling
//!
//! Provides consistent error types and HTTP responses.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// Application error type
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Authentication required")]
    Unauthorized,

    #[error("Invalid email or password")]
    InvalidCredentials,

    #[error("Access denied")]
    Forbidden,

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Rate limit exceeded")]
    RateLimited,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("Internal server error")]
    Internal(String),
}

/// Error response body
#[derive(Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub message: String,
    pub error_code: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_code, message) = match &self {
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "AUTH_REQUIRED",
                self.to_string(),
            ),
            AppError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                self.to_string(),
            ),
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                "ACCESS_DENIED",
                self.to_string(),
            ),
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                msg.clone(),
            ),
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                "BAD_REQUEST",
                msg.clone(),
            ),
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
                "CONFLICT",
                msg.clone(),
            ),
            AppError::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                self.to_string(),
            ),
            AppError::Database(_) => {
                tracing::error!("Database error: {:?}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "A database error occurred".to_string(),
                )
            }
            AppError::Redis(_) => {
                tracing::error!("Redis error: {:?}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "CACHE_ERROR",
                    "A cache error occurred".to_string(),
                )
            }
            AppError::Jwt(_) => (
                StatusCode::UNAUTHORIZED,
                "INVALID_TOKEN",
                "Invalid or expired token".to_string(),
            ),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "An internal error occurred".to_string(),
                )
            }
        };

        let body = Json(ErrorResponse {
            success: false,
            message,
            error_code: error_code.to_string(),
        });

        (status, body).into_response()
    }
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, AppError>;
