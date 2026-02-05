//! OAuth routes (Google, Apple Sign-In)

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, Result},
    AppState,
};

/// Create OAuth router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/google/callback", get(google_callback))
        .route("/apple/callback", get(apple_callback))
        .route("/guest", get(guest_login))
}

/// OAuth callback query params
#[derive(Debug, Deserialize)]
pub struct OAuthCallback {
    #[allow(dead_code)]
    pub code: Option<String>,
    pub id_token: Option<String>,
    #[allow(dead_code)]
    pub state: Option<String>,
    pub error: Option<String>,
}

/// OAuth response
#[derive(Debug, Serialize)]
pub struct OAuthResponse {
    pub success: bool,
    pub token: Option<String>,
    pub user: Option<OAuthUser>,
    pub error: Option<String>,
}

/// OAuth user info
#[derive(Debug, Serialize)]
pub struct OAuthUser {
    pub id: String,
    pub email: String,
    pub name: String,
    pub provider: String,
}

/// Google OAuth callback
async fn google_callback(
    State(state): State<AppState>,
    Query(params): Query<OAuthCallback>,
) -> Result<Json<OAuthResponse>> {
    if let Some(error) = params.error {
        return Ok(Json(OAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some(error),
        }));
    }

    let id_token = params
        .id_token
        .ok_or_else(|| AppError::BadRequest("Missing id_token".into()))?;

    // TODO: Verify Google ID token with Google's public keys
    // For now, decode without verification (development only)
    let claims = decode_google_token(&id_token)?;

    // Find or create user
    let user_id =
        find_or_create_oauth_user(&state, &claims.email, &claims.name, "google", &claims.sub)
            .await?;

    // Generate JWT
    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    Ok(Json(OAuthResponse {
        success: true,
        token: Some(token),
        user: Some(OAuthUser {
            id: user_id.to_string(),
            email: claims.email,
            name: claims.name,
            provider: "google".into(),
        }),
        error: None,
    }))
}

/// Apple OAuth callback
async fn apple_callback(
    State(state): State<AppState>,
    Query(params): Query<OAuthCallback>,
) -> Result<Json<OAuthResponse>> {
    if let Some(error) = params.error {
        return Ok(Json(OAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some(error),
        }));
    }

    let id_token = params
        .id_token
        .ok_or_else(|| AppError::BadRequest("Missing id_token".into()))?;

    // TODO: Verify Apple ID token
    let claims = decode_apple_token(&id_token)?;
    let email = claims.email.clone().unwrap_or_default();

    // Find or create user
    let user_id = find_or_create_oauth_user(
        &state,
        &email,
        "Apple User", // Apple may not provide name
        "apple",
        &claims.sub,
    )
    .await?;

    // Generate JWT
    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    Ok(Json(OAuthResponse {
        success: true,
        token: Some(token),
        user: Some(OAuthUser {
            id: user_id.to_string(),
            email,
            name: "Apple User".into(),
            provider: "apple".into(),
        }),
        error: None,
    }))
}

/// Guest login (anonymous)
async fn guest_login(State(state): State<AppState>) -> Result<Json<OAuthResponse>> {
    let guest_id = uuid::Uuid::new_v4();
    let guest_name = format!("Guest_{}", &guest_id.to_string()[..8]);

    // Create guest user
    let user_id = state
        .db
        .create_user(&crate::db::CreateUser {
            username: guest_name.clone(),
            email: format!("{}@guest.pcd", guest_id),
            password_hash: String::new(), // No password for guests
        })
        .await?;

    // Generate JWT
    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    Ok(Json(OAuthResponse {
        success: true,
        token: Some(token),
        user: Some(OAuthUser {
            id: user_id.to_string(),
            email: String::new(),
            name: guest_name,
            provider: "guest".into(),
        }),
        error: None,
    }))
}

/// Google ID token claims
#[derive(Debug, Deserialize)]
struct GoogleClaims {
    sub: String,
    email: String,
    name: String,
}

/// Apple ID token claims
#[derive(Debug, Deserialize)]
struct AppleClaims {
    sub: String,
    email: Option<String>,
}

/// Decode Google token (simplified - production should verify signature)
fn decode_google_token(token: &str) -> Result<GoogleClaims> {
    // Split JWT and decode payload
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(AppError::BadRequest("Invalid token format".into()));
    }

    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    let payload = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| AppError::BadRequest("Invalid token encoding".into()))?;

    serde_json::from_slice(&payload)
        .map_err(|_| AppError::BadRequest("Invalid token payload".into()))
}

/// Decode Apple token (simplified)
fn decode_apple_token(token: &str) -> Result<AppleClaims> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(AppError::BadRequest("Invalid token format".into()));
    }

    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    let payload = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| AppError::BadRequest("Invalid token encoding".into()))?;

    serde_json::from_slice(&payload)
        .map_err(|_| AppError::BadRequest("Invalid token payload".into()))
}

/// Find or create OAuth user
async fn find_or_create_oauth_user(
    state: &AppState,
    email: &str,
    name: &str,
    _provider: &str,
    _provider_id: &str,
) -> Result<uuid::Uuid> {
    // Check if user exists
    if let Some(user) = state.db.get_user_by_email(email).await? {
        return Ok(user.id);
    }

    // Create new user
    let user_id = state
        .db
        .create_user(&crate::db::CreateUser {
            username: name.to_string(),
            email: email.to_string(),
            password_hash: String::new(), // OAuth users don't have passwords
        })
        .await?;

    Ok(user_id)
}

/// Generate JWT token
fn generate_jwt(user_id: uuid::Uuid, secret: &str) -> Result<String> {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    #[derive(Serialize)]
    struct Claims {
        sub: String,
        exp: u64,
        iat: u64,
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = Claims {
        sub: user_id.to_string(),
        iat: now,
        exp: now + 604800, // 7 days
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("JWT generation failed: {}", e)))
}
