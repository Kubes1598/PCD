//! Authentication middleware

use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

/// JWT Claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
}

/// Authenticated user info
#[derive(Debug, Clone)]
pub struct AuthUser {
    #[allow(dead_code)]
    pub id: Uuid,
}

/// Auth middleware - extracts user from JWT
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // Get token from header or query
    let token = extract_token(&request);

    if let Some(token) = token {
        if let Ok(claims) = validate_token(&token, &state.config.jwt_secret) {
            if let Ok(user_id) = Uuid::parse_str(&claims.sub) {
                // Insert user into request extensions
                request.extensions_mut().insert(AuthUser { id: user_id });
            }
        }
    }

    Ok(next.run(request).await)
}

/// Required auth middleware - returns 401 if not authenticated
#[allow(dead_code)]
pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let token = extract_token(&request).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "success": false,
                "message": "Authentication required",
                "error_code": "AUTH_REQUIRED"
            })),
        )
    })?;

    let claims = validate_token(&token, &state.config.jwt_secret).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "success": false,
                "message": "Invalid or expired token",
                "error_code": "INVALID_TOKEN"
            })),
        )
    })?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "success": false,
                "message": "Invalid token payload",
                "error_code": "INVALID_TOKEN"
            })),
        )
    })?;

    request.extensions_mut().insert(AuthUser { id: user_id });
    Ok(next.run(request).await)
}

/// Extract token from Authorization header or query param
fn extract_token(request: &Request<Body>) -> Option<String> {
    // Try Authorization header first
    if let Some(auth_header) = request.headers().get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // Try query parameter
    if let Some(query) = request.uri().query() {
        for pair in query.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                if key == "token" {
                    return Some(value.to_string());
                }
            }
        }
    }

    None
}

/// Validate JWT token
fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}
