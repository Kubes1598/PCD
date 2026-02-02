use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{header, Request, StatusCode, Response, HeaderValue},
    middleware::Next,
    Json,
};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use once_cell::sync::Lazy;

use crate::AppState;

/// Rate limit bucket
#[derive(Debug, Clone)]
pub struct RateBucket {
    pub count: u32,
    pub window_start: Instant,
}

/// In-memory rate limiter fallback
#[derive(Clone)]
pub struct RateLimiter {
    buckets: Arc<RwLock<HashMap<String, RateBucket>>>,
    last_cleanup: Arc<RwLock<Instant>>,
}

impl RateLimiter {
    /// Create new rate limiter
    pub fn new() -> Self {
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
            last_cleanup: Arc::new(RwLock::new(Instant::now())),
        }
    }

    /// Check if request is allowed
    pub async fn check(&self, key: &str, limit: u32, window_secs: u64) -> bool {
        let now = Instant::now();
        
        // Periodic cleanup (every 10 minutes)
        let should_cleanup = {
            let last = self.last_cleanup.read().await;
            now.duration_since(*last) > Duration::from_secs(600)
        };

        if should_cleanup {
            let mut last = self.last_cleanup.write().await;
            if now.duration_since(*last) > Duration::from_secs(600) {
                self.cleanup().await;
                *last = now;
            }
        }

        let mut buckets = self.buckets.write().await;
        let window = Duration::from_secs(window_secs);

        let bucket = buckets.entry(key.to_string()).or_insert(RateBucket {
            count: 0,
            window_start: now,
        });

        // Reset if window expired
        if now.duration_since(bucket.window_start) >= window {
            bucket.count = 0;
            bucket.window_start = now;
        }

        // Check limit
        if bucket.count >= limit {
            return false;
        }

        bucket.count += 1;
        true
    }

    /// Clean up old entries
    pub async fn cleanup(&self) {
        let mut buckets = self.buckets.write().await;
        let now = Instant::now();
        // Keep entries for 1 hour to avoid frequent re-creation
        let expiry = Duration::from_secs(3600);

        buckets.retain(|_, bucket| {
            now.duration_since(bucket.window_start) < expiry
        });
    }
}

/// Global fallback limiter
static FALLBACK_LIMITER: Lazy<RateLimiter> = Lazy::new(RateLimiter::new);

/// Paths to skip rate limiting entirely
const SKIP_PATHS: &[&str] = &[
    "/health",
    "/health/db",
    "/health/redis",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/favicon.ico",
];

/// Rate limit configuration for different paths
fn get_path_config(path: &str) -> (u32, u64, String) {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let prefix = parts.first().copied().unwrap_or("root");

    let (limit, window) = match prefix {
        "auth" => {
            if path.contains("/login") {
                (5, 60)      // 5 per minute for login
            } else if path.contains("/register") {
                (10, 60)     // 10 per minute for register
            } else {
                (20, 60)     // 20 per minute for other auth
            }
        }
        "oauth" => (20, 60),    // 20 per minute for oauth
        "matchmaking" | "ws" => (30, 60), // 30 per minute
        "games" => (100, 60),   // 100 per minute
        "users" => (60, 60),    // 60 per minute
        "ai" => (200, 60),      // 200 per minute (moves are fast)
        _ => (60, 60),          // Default 60 per minute
    };

    (limit, window, prefix.to_string())
}

/// Rate limit middleware
pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response<Body>, (StatusCode, Json<serde_json::Value>)> {
    let path = request.uri().path();

    // 1. Skip rate limiting for specific paths
    if SKIP_PATHS.iter().any(|&p| path == p) {
        return Ok(next.run(request).await);
    }

    // 2. Skip for WebSocket upgrades (handled at connection level if needed)
    if is_websocket_upgrade(&request) {
        return Ok(next.run(request).await);
    }

    // 3. Get client identifier and path config
    let client_ip = get_client_id(&request);
    let (mut limit, window, prefix) = get_path_config(path);

    // 4. Adjust limits for development/local environment
    let is_local = is_local_address(&client_ip);
    if is_local || !state.config.is_production() {
        limit *= 10; // 10x higher limits for dev
    }

    let identifier = format!("{}:{}", client_ip, prefix);

    // 5. Try Redis rate limiting if available
    if let Some(redis) = &state.redis {
        match redis.check_rate_limit(&identifier, limit as i64, window as i64).await {
            Ok(allowed) => {
                if !allowed {
                    return Err(build_rate_limit_error(window, &identifier));
                }
            }
            Err(e) => {
                tracing::error!("Redis rate limit error: {}, falling back to in-memory", e);
                // Fall through to in-memory fallback
                if !FALLBACK_LIMITER.check(&identifier, limit, window).await {
                    return Err(build_rate_limit_error(window, &identifier));
                }
            }
        }
    } else {
        // 6. Use in-memory fallback if Redis is not configured
        if !FALLBACK_LIMITER.check(&identifier, limit, window).await {
            return Err(build_rate_limit_error(window, &identifier));
        }
    }

    // 7. Proceed with request
    let mut response = next.run(request).await;

    // 8. Add rate limit headers to response (optional but good for clients)
    let headers = response.headers_mut();
    if let Ok(limit_val) = HeaderValue::from_str(&limit.to_string()) {
        headers.insert("X-RateLimit-Limit", limit_val);
    }
    
    Ok(response)
}

/// Check if request is a WebSocket upgrade
fn is_websocket_upgrade(request: &Request<Body>) -> bool {
    request
        .headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.to_lowercase() == "websocket")
        .unwrap_or(false)
}

/// Check if IP address is local/dev
fn is_local_address(ip: &str) -> bool {
    ip.starts_with("127.") 
        || ip.starts_with("192.168.")
        || ip.starts_with("10.")
        || ip == "localhost"
        || ip.starts_with("::1")
        || ip == "unknown"
        || ip.starts_with("local_")
}

/// Helper to build a rate limit error response
fn build_rate_limit_error(window_secs: u64, identifier: &str) -> (StatusCode, Json<serde_json::Value>) {
    tracing::warn!("Rate limit exceeded for: {}", identifier);
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(serde_json::json!({
            "success": false,
            "message": "Too many requests. Please slow down!",
            "error_code": "RATE_LIMITED",
            "retry_after": window_secs
        })),
    )
}

/// Get client identifier from request
fn get_client_id(request: &Request<Body>) -> String {
    // Try X-Forwarded-For first (for proxied requests)
    if let Some(xff) = request.headers().get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            if let Some(ip) = xff_str.split(',').next() {
                let ip = ip.trim();
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }

    // Try X-Real-IP
    if let Some(real_ip) = request.headers().get("x-real-ip") {
        if let Ok(ip) = real_ip.to_str() {
            if !ip.is_empty() {
                return ip.to_string();
            }
        }
    }

    // Try to get from ConnectInfo extension
    if let Some(connect_info) = request.extensions().get::<ConnectInfo<SocketAddr>>() {
        return connect_info.0.ip().to_string();
    }

    // For development, use a unique ID based on headers to differentiate clients
    if let Some(user_agent) = request.headers().get(header::USER_AGENT) {
        if let Ok(ua) = user_agent.to_str() {
            let hash: u32 = ua.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32));
            return format!("local_{:x}", hash);
        }
    }

    "unknown".to_string()
}
