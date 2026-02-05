//! Configuration management
//!
//! Loads settings from environment variables.

use std::env;

/// Application configuration
#[derive(Clone, Debug)]
pub struct Config {
    /// PostgreSQL connection URL
    pub database_url: String,
    /// Redis connection URL
    pub redis_url: Option<String>,
    /// JWT secret key
    pub jwt_secret: String,
    /// JWT token expiry in seconds (default: 7 days)
    pub jwt_expiry_seconds: u64,
    /// Server port
    pub port: u16,
    /// Environment (development, staging, production)
    pub environment: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| ConfigError::Missing("DATABASE_URL"))?,
            redis_url: env::var("REDIS_URL").ok(),
            jwt_secret: env::var("JWT_SECRET").map_err(|_| ConfigError::Missing("JWT_SECRET"))?,
            jwt_expiry_seconds: env::var("JWT_EXPIRY_SECONDS")
                .unwrap_or_else(|_| "604800".to_string())
                .parse()
                .unwrap_or(604800),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()
                .unwrap_or(8000),
            environment: env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),
        })
    }

    /// Check if running in production
    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }
}

/// Configuration errors
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    Missing(&'static str),
}
