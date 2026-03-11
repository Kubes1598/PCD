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
pub fn router(state: AppState) -> Router<AppState> {
    use crate::middleware::auth::require_auth;
    use ax_mw::from_fn_with_state;
    use axum::middleware as ax_mw;

    let protected = Router::new()
        .route("/logout", post(logout))
        .route("/me", get(me))
        .layer(from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh_token))
        .route("/guest", post(guest_login))
        .route("/google", post(google_auth))
        .route("/apple", post(apple_auth))
        .route("/oauth/status", get(oauth_status))
        .merge(protected)
}

/// Logout handler
async fn logout(
    State(state): State<AppState>,
    axum::http::HeaderMap(headers): axum::http::HeaderMap,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>> {
    // 1. Extract token from Authorization header (Access Token)
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::BadRequest("Missing Authorization header".into()))?;

    // 2. Revoke Refresh Token if provided
    if let Some(rt) = req["refresh_token"].as_str() {
        state.db.revoke_refresh_token(rt).await?;
    }

    // 3. Blacklist Access Token in Redis
    if let Some(redis) = &state.redis {
        redis.blacklist_token(token, 86400).await.map_err(|e| {
            AppError::Internal(format!("Failed to blacklist token: {}", e))
        })?;
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Logged out successfully and session revoked."
    })))
}

/// Refresh token handler
async fn refresh_token(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let old_refresh_token = req["refresh_token"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("Missing refresh_token".into()))?;

    // 1. Verify Refresh Token against DB
    let user_id = state.db.verify_refresh_token(old_refresh_token).await?
        .ok_or(AppError::Unauthorized)?;

    // 2. ROTATE: Revoke old, Create new
    state.db.revoke_refresh_token(old_refresh_token).await?;
    
    use rand::{distributions::Alphanumeric, Rng};
    let new_refresh_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();
    let expires_at = chrono::Utc::now() + chrono::Duration::days(30);
    state.db.create_refresh_token(&user_id, &new_refresh_token, expires_at).await?;

    // 3. Generate new Access JWT
    let token = generate_jwt(user_id, &state.config.jwt_secret)?;

    // 4. Get User data
    let player = state.db.get_player(&user_id).await?
        .ok_or_else(|| AppError::Unauthorized)?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Token refreshed and rotated".into()),
        data: AuthData {
            token,
            refresh_token: new_refresh_token,
            user: UserResponse {
                id: player.id,
                username: player.name,
                email: player.email,
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
                mfa_enabled: player.mfa_enabled.unwrap_or(false),
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
    let pseudo_hash = format!("device:{}", device_id);

    // 1. Try to find existing guest by device ID
    if let Some(user) = state.db.get_user_by_password_hash(&pseudo_hash).await? {
        let player = state
            .db
            .get_player(&user.id)
            .await?
            .ok_or_else(|| AppError::Internal("Guest player data missing".into()))?;

        let token = generate_jwt(user.id, &state.config.jwt_secret)?;
        
        use rand::{distributions::Alphanumeric, Rng};
        let refresh_token: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(64)
            .map(char::from)
            .collect();
        let expires_at = chrono::Utc::now() + chrono::Duration::days(30);
        state.db.create_refresh_token(&user.id, &refresh_token, expires_at).await?;

        return Ok(Json(AuthResponse {
            success: true,
            message: Some("Welcome back, Guest!".into()),
            data: AuthData {
                token,
                refresh_token,
                user: UserResponse {
                    id: user.id,
                    username: user.name,
                    email: "".into(),
                    coin_balance: player.coin_balance,
                    diamonds_balance: player.diamonds_balance,
                    games_played: player.games_played,
                    games_won: player.games_won,
                    mfa_enabled: false,
                },
            },
        }));
    }

    // 2. Create new guest if not found
    let guest_uuid = uuid::Uuid::new_v4();
    let guest_name = format!("Guest_{}", &guest_uuid.to_string()[..8]);

    let user_id = state
        .db
        .create_user(&crate::db::CreateUser {
            username: guest_name.clone(),
            email: format!("{}@guest.pcd", guest_uuid),
            password_hash: pseudo_hash,
        })
        .await?;

    let token = generate_jwt(user_id, &state.config.jwt_secret)?;
    
    use rand::{distributions::Alphanumeric, Rng};
    let refresh_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();
    let expires_at = chrono::Utc::now() + chrono::Duration::days(30);
    state.db.create_refresh_token(&user_id, &refresh_token, expires_at).await?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Guest account created".into()),
        data: AuthData {
            token,
            refresh_token,
            user: UserResponse {
                id: user_id,
                username: guest_name,
                email: "".into(),
                coin_balance: 1000,
                diamonds_balance: 5,
                games_played: 0,
                games_won: 0,
                mfa_enabled: false,
            },
        },
    }))
}

/// Google auth handler — NOT YET IMPLEMENTED
///
/// TODO: Verify id_token against Google's tokeninfo endpoint,
///       validate `aud` matches our client ID, require verified email,
///       upsert user keyed on Google `sub` (not email).
async fn google_auth(
    State(_state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let _id_token = req["id_token"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("Missing id_token".into()))?;

    // SECURITY: Do not accept tokens without proper verification.
    // Implement Google token verification before enabling this endpoint.
    tracing::warn!("Google OAuth called but not yet implemented — rejecting");
    Err(AppError::Internal(
        "Google authentication is not yet available. Please use email or guest login.".into(),
    ))
}

/// Apple auth handler — NOT YET IMPLEMENTED
///
/// TODO: Verify identity_token as RS256 JWT signed by Apple's public keys
///       (https://appleid.apple.com/auth/keys), validate `iss`, `aud`, `exp`,
///       upsert user keyed on Apple `sub`.
async fn apple_auth(
    State(_state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<AuthResponse>> {
    let _identity_token = req["identity_token"]
        .as_str()
        .or_else(|| req["id_token"].as_str())
        .ok_or_else(|| AppError::BadRequest("Missing identity_token".into()))?;

    // SECURITY: Do not accept tokens without proper verification.
    tracing::warn!("Apple OAuth called but not yet implemented — rejecting");
    Err(AppError::Internal(
        "Apple authentication is not yet available. Please use email or guest login.".into(),
    ))
}

/// OAuth status handler
async fn oauth_status() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "success": true,
        "data": {
            "google": false,
            "apple": false,
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
    pub guest_id: Option<uuid::Uuid>,
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
    pub refresh_token: String,
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
    pub mfa_enabled: bool,
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
    if !is_password_strong(&req.password) {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters long and include uppercase, lowercase, numbers, and symbols".into(),
        ));
    }

    // Check if user exists
    if state.db.get_user_by_email(&req.email).await?.is_some() {
        return Err(AppError::Conflict("Email already registered".into()));
    }

    // Hash password
    let password_hash = hash_password(&req.password)?;

    let user_id;
    let mut is_upgrade = false;
    let mut existing_coins = 1000;
    let mut existing_diamonds = 5;
    let mut existing_played = 0;
    let mut existing_won = 0;

    // Handle Guest Transfer/Upgrade
    if let Some(gid) = req.guest_id {
        if let Some(player) = state.db.get_player(&gid).await? {
            // Verify it's actually a guest account (e.g. contains @guest.pcd or has device: prefix)
            let user_auth = state.db.get_user_by_email(&player.email).await?;
            let is_guest = user_auth.as_ref().map(|ua| ua.password_hash.as_ref().map(|h| h.starts_with("device:")).unwrap_or(false)).unwrap_or(false);

            if is_guest {
                state.db.upgrade_user(&crate::db::UpgradeUser {
                    id: gid,
                    username: req.username.clone(),
                    email: req.email.clone(),
                    password_hash: password_hash.clone(),
                }).await?;
                
                user_id = gid;
                is_upgrade = true;
                existing_coins = player.coin_balance;
                existing_diamonds = player.diamonds_balance;
                existing_played = player.games_played;
                existing_won = player.games_won;
                tracing::info!("Upgraded guest {} to full account {}", gid, req.email);
            } else {
                // Not a guest or already upgraded, create fresh
                user_id = state.db.create_user(&crate::db::CreateUser {
                    username: req.username.clone(),
                    email: req.email.clone(),
                    password_hash,
                }).await?;
            }
        } else {
            // Guest ID provided but not found, create fresh
            user_id = state.db.create_user(&crate::db::CreateUser {
                username: req.username.clone(),
                email: req.email.clone(),
                password_hash,
            }).await?;
        }
    } else {
        // No Guest ID, create fresh
        user_id = state.db.create_user(&crate::db::CreateUser {
            username: req.username.clone(),
            email: req.email.clone(),
            password_hash,
        }).await?;
    }

    // Generate Tokens
    let token = generate_jwt(user_id, &state.config.jwt_secret)?;
    
    // Generate secure Refresh Token (64 chars)
    use rand::{distributions::Alphanumeric, Rng};
    let refresh_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    // Store refresh token in DB (30 days)
    let expires_at = chrono::Utc::now() + chrono::Duration::days(30);
    state.db.create_refresh_token(&user_id, &refresh_token, expires_at).await?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some(if is_upgrade { "Guest data transferred successfully!" } else { "Account created successfully" }.into()),
        data: AuthData {
            token,
            refresh_token,
            user: UserResponse {
                id: user_id,
                username: req.username,
                email: req.email,
                coin_balance: existing_coins,
                diamonds_balance: existing_diamonds,
                games_played: existing_played,
                games_won: existing_won,
                mfa_enabled: false, // New accounts don't have MFA enabled by default
            },
        },
    }))
}

/// Login
async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // 1. Find user
    let user_res = state.db.get_user_by_email(&req.email).await?;
    if user_res.is_none() {
        let _ = state.db.create_audit_log(
            None, Some(Some(req.email.clone())), "LOGIN_FAILED", "warning",
            serde_json::json!({ "reason": "User not found" })
        ).await;
        return Err(AppError::InvalidCredentials);
    }
    let user = user_res.unwrap();

    // 2. CHECK ACCOUNT LOCKOUT
    if let Some(lockout_until) = user.lockout_until {
        if lockout_until > chrono::Utc::now() {
            let wait_mins = (lockout_until - chrono::Utc::now()).num_minutes();
            return Err(AppError::Forbidden(format!("Account is temporarily locked. Please try again in {} minutes.", wait_mins)));
        }
    }

    // 3. Verify password
    let password_hash = user.password_hash.as_ref().ok_or_else(|| AppError::InvalidCredentials)?;

    if !verify_password(&req.password, password_hash)? {
        // Increment failed attempts
        let new_attempts = user.failed_login_attempts.unwrap_or(0) + 1;
        let mut lockout_time = None;
        if new_attempts >= 5 {
            lockout_time = Some(chrono::Utc::now() + chrono::Duration::minutes(15));
            tracing::warn!("Account {} locked due to 5+ failed attempts", user.email.as_ref().unwrap_or(&"unknown".into()));
        }
        
        state.db.update_lockout(&user.id, new_attempts, lockout_time).await?;
        
        let _ = state.db.create_audit_log(
            Some(user.id), Some(user.email.clone()), "LOGIN_FAILED", "warning", 
            serde_json::json!({ "reason": "Invalid password", "attempts": new_attempts, "locked": lockout_time.is_some() })
        ).await;
        return Err(AppError::InvalidCredentials);
    }

    // 4. Success: Reset lockout counters
    state.db.update_lockout(&user.id, 0, None).await?;
    
    // Log success
    let _ = state.db.create_audit_log(
        Some(user.id), Some(user.email.clone()), "LOGIN_SUCCESS", "info", serde_json::json!({})
    ).await;

    // 5. Generate Tokens
    let token = generate_jwt(user.id, &state.config.jwt_secret)?;
    
    use rand::{distributions::Alphanumeric, Rng};
    let refresh_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    let expires_at = chrono::Utc::now() + chrono::Duration::days(30);
    state.db.create_refresh_token(&user.id, &refresh_token, expires_at).await?;

    // 6. Get full player data
    let player = state.db.get_player(&user.id).await?.ok_or(AppError::Internal("Player data missing".into()))?;

    Ok(Json(AuthResponse {
        success: true,
        message: Some("Logged in successfully".into()),
        data: AuthData {
            token,
            refresh_token,
            user: UserResponse {
                id: user.id,
                username: user.name,
                email: user.email.unwrap_or_default(),
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
                mfa_enabled: user.mfa_enabled.unwrap_or(false),
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
            token: "".into(), 
            refresh_token: "".into(),
            user: UserResponse {
                id: player.id,
                username: player.name,
                email: player.email,
                coin_balance: player.coin_balance,
                diamonds_balance: player.diamonds_balance,
                games_played: player.games_played,
                games_won: player.games_won,
                mfa_enabled: player.mfa_enabled.unwrap_or(false),
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
        exp: now + 86400, // 24 hours
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("JWT generation failed: {}", e)))
}

/// Helper to validate password strength
fn is_password_strong(password: &str) -> bool {
    if password.len() < 8 {
        return false;
    }

    let mut has_upper = false;
    let mut has_lower = false;
    let mut has_digit = false;
    let mut has_symbol = false;

    for c in password.chars() {
        if c.is_uppercase() {
            has_upper = true;
        } else if c.is_lowercase() {
            has_lower = true;
        } else if c.is_digit(10) {
            has_digit = true;
        } else if !c.is_alphanumeric() {
            has_symbol = true;
        }
    }

    has_upper && has_lower && has_digit && has_symbol
}
