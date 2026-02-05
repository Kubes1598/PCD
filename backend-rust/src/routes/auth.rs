//! Authentication routes

use axum::{
    extract::{Extension, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, Result},
    middleware::auth::AuthUser,
    AppState,
};

/// Create auth router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/refresh", post(refresh_token))
        .route("/me", get(me))
        .route("/guest", post(guest_login))
        .route("/google", post(google_auth))
        .route("/apple", post(apple_auth))
        .route("/oauth/status", get(oauth_status))
}

/// Logout handler
async fn logout() -> Result<Json<serde_json::Value>> {
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Logged out successfully"
    })))
}

/// Refresh token handler
async fn refresh_token(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let refresh_token = req["refresh_token"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("Missing refresh_token".into()))?;

    // In a real app, we would verify the refresh token against the DB
    // For now, let's just decode the old one to get user ID
    use jsonwebtoken::{decode, DecodingKey, Validation};
    #[derive(Debug, Deserialize, Serialize)]
    struct Claims {
        sub: String,
        exp: u64,
        iat: u64,
    }

    let token_data = decode::<Claims>(
        refresh_token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized)?;

    let user_id =
        uuid::Uuid::parse_str(&token_data.claims.sub).map_err(|_| AppError::Unauthorized)?;

    let player = state
        .db
        .get_player(&user_id)
        .await?
        .ok_or_else(|| AppError::Unauthorized)?;

    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Token refreshed".into()),
        data: AuthData {
            token,
            user: UserResponse {
                id: player.id,
                username: player.name,
                email: player.email,
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
            },
        },
    }))
}

/// Guest login handler
async fn guest_login(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let device_id = req["device_id"].as_str().unwrap_or("unknown");
    let guest_id = uuid::Uuid::new_v4();
    let guest_name = format!("Guest_{}", &guest_id.to_string()[..8]);

    // Create guest user
    let user_id = state
        .db
        .create_user(&crate::db::CreateUser {
            username: guest_name.clone(),
            email: format!("{}@guest.pcd", guest_id),
            password_hash: format!("device:{}", device_id), // Use device ID as a pseudo-password
        })
        .await?;

    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Guest login successful".into()),
        data: AuthData {
            token,
            user: UserResponse {
                id: user_id,
                username: guest_name,
                email: "".into(),
                coin_balance: 1000,
                diamonds_balance: 5,
                games_played: 0,
                games_won: 0,
            },
        },
    }))
}

/// Google auth handler
async fn google_auth(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let id_token = req["id_token"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("Missing id_token".into()))?;

    // Stub for Google authentication
    tracing::info!("Google Auth attempt with token: {}...", &id_token[..10]);

    // In production, verify token and get email/name
    let email = "google_user@example.com";
    let name = "Google User";

    let player = if let Some(p) = state.db.get_player_by_name(name).await? {
        p
    } else {
        let user_id = state
            .db
            .create_user(&crate::db::CreateUser {
                username: name.to_string(),
                email: email.to_string(),
                password_hash: "oauth:google".into(),
            })
            .await?;
        state.db.get_player(&user_id).await?.unwrap()
    };

    let token = generate_jwt(player.id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("OAuth login successful".into()),
        data: AuthData {
            token,
            user: UserResponse {
                id: player.id,
                username: player.name,
                email: player.email,
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
            },
        },
    }))
}

/// Apple auth handler
async fn apple_auth(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let _id_token = req["id_token"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("Missing id_token".into()))?;

    // Stub for Apple authentication
    let email = "apple_user@example.com";
    let name = "Apple User";

    let player = if let Some(p) = state.db.get_player_by_name(name).await? {
        p
    } else {
        let user_id = state
            .db
            .create_user(&crate::db::CreateUser {
                username: name.to_string(),
                email: email.to_string(),
                password_hash: "oauth:apple".into(),
            })
            .await?;
        state.db.get_player(&user_id).await?.unwrap()
    };

    let token = generate_jwt(player.id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("OAuth login successful".into()),
        data: AuthData {
            token,
            user: UserResponse {
                id: player.id,
                username: player.name,
                email: player.email,
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
            },
        },
    }))
}

/// OAuth status handler
async fn oauth_status() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "success": true,
        "data": {
            "google": true,
            "apple": true,
            "email": true,
            "guest": true
        }
    }))
}

/// Register request
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub username: String,
}

/// Login request
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Auth response
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: Option<String>,
    pub data: AuthData,
}

/// Auth data container
#[derive(Debug, Serialize)]
pub struct AuthData {
    pub token: String,
    pub user: UserResponse,
}

/// User response (without password)
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: uuid::Uuid,
    pub username: String,
    pub email: String,
    pub coin_balance: i32,
    pub diamonds_balance: i32,
    pub games_played: i32,
    pub games_won: i32,
}

/// Register a new user
async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate email format
    if !req.email.contains('@') {
        return Err(AppError::BadRequest("Invalid email format".into()));
    }

    // Validate password strength
    if req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    // Check if user exists
    if state.db.get_user_by_email(&req.email).await?.is_some() {
        return Err(AppError::Conflict("Email already registered".into()));
    }

    // Hash password
    let password_hash = hash_password(&req.password)?;

    // Create user
    let user_id = state
        .db
        .create_user(&crate::db::CreateUser {
            username: req.username.clone(),
            email: req.email.clone(),
            password_hash,
        })
        .await?;

    // Generate JWT
    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Account created successfully".into()),
        data: AuthData {
            token,
            user: UserResponse {
                id: user_id,
                username: req.username,
                email: req.email,
                coin_balance: 1000,
                diamonds_balance: 5,
                games_played: 0,
                games_won: 0,
            },
        },
    }))
}

/// Login
async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Find user
    let user = state
        .db
        .get_user_by_email(&req.email)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    // Verify password
    let password_hash = user
        .password_hash
        .as_ref()
        .ok_or(AppError::InvalidCredentials)?;

    if !verify_password(&req.password, password_hash)? {
        return Err(AppError::InvalidCredentials);
    }

    // Get full player data
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or(AppError::Internal("Player data not found".into()))?;

    // Generate JWT
    let token = generate_jwt(user.id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Logged in successfully".into()),
        data: AuthData {
            token,
            user: UserResponse {
                id: user.id,
                username: user.name,
                email: user.email.unwrap_or_default(),
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
            },
        },
    }))
}

/// Get current user
async fn me(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<AuthResponse>> {
    let player = state
        .db
        .get_player(&user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Current user retrieved".into()),
        data: AuthData {
            token: "".into(), // We don't need to send the token back here
            user: UserResponse {
                id: player.id,
                username: player.name,
                email: player.email,
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
            },
        },
    }))
}

/// Hash password using Argon2
fn hash_password(password: &str) -> Result<String> {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))
}

/// Verify password
fn verify_password(password: &str, hash: &str) -> Result<bool> {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };

    let parsed_hash =
        PasswordHash::new(hash).map_err(|_| AppError::Internal("Invalid password hash".into()))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
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
