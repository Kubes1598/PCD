//! PostgreSQL database connection and queries

use sqlx::{postgres::PgPoolOptions, PgPool};

/// Database connection wrapper
#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Connect to PostgreSQL with connection pooling
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .min_connections(2)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect(database_url)
            .await?;

        // Run migrations on startup
        sqlx::migrate!("./migrations").run(&pool).await.ok(); // Ignore if migrations folder doesn't exist yet

        Ok(Self { pool })
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Health check - verify database connectivity
    pub async fn health_check(&self) -> Result<(), sqlx::Error> {
        sqlx::query("SELECT 1").execute(&self.pool).await?;
        Ok(())
    }

    /// Create an audit log entry for sensitive events
    pub async fn create_audit_log(
        &self,
        player_id: Option<uuid::Uuid>,
        email: Option<Option<String>>, // Double option for sqlx NULL support
        event_type: &str,
        severity: &str,
        metadata: serde_json::Value,
    ) -> Result<(), sqlx::Error> {
        let email_deref = email.flatten();
        sqlx::query!(
            r#"
            INSERT INTO audit_logs (player_id, email, event_type, severity, metadata)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            player_id, email_deref, event_type, severity, metadata
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// =============================================================================
// PLAYER QUERIES
// =============================================================================

impl Database {
    /// Get player by ID
    pub async fn get_player(
        &self,
        player_id: &uuid::Uuid,
    ) -> Result<Option<super::Player>, sqlx::Error> {
        sqlx::query_as!(
            super::Player,
            r#"
            SELECT id, name, email, profile_id, games_played, games_won, 
                   coin_balance, diamonds_balance, rank, tier, stars,
                   created_at, last_active, password_hash, mfa_enabled, totp_secret,
                   failed_login_attempts, lockout_until
            FROM players
            WHERE id = $1
            "#,
            player_id
        )
        .fetch_optional(&self.pool)
        .await
    }

    /// Get player by name
    pub async fn get_player_by_name(
        &self,
        name: &str,
    ) -> Result<Option<super::Player>, sqlx::Error> {
        sqlx::query_as!(
            super::Player,
            r#"
            SELECT id, name, email, profile_id, games_played, games_won,
                   coin_balance, diamonds_balance, rank, tier, stars,
                   created_at, last_active, password_hash, mfa_enabled, totp_secret,
                   failed_login_attempts, lockout_until
            FROM players
            WHERE name = $1
            "#,
            name
        )
        .fetch_optional(&self.pool)
        .await
    }

    /// Update player stats after game
    pub async fn update_player_stats(
        &self,
        player_id: &uuid::Uuid,
        won: bool,
    ) -> Result<(), sqlx::Error> {
        if won {
            sqlx::query!(
                r#"
                UPDATE players 
                SET games_played = games_played + 1,
                    games_won = games_won + 1,
                    last_active = NOW()
                WHERE id = $1
                "#,
                player_id
            )
            .execute(&self.pool)
            .await?;
        } else {
            sqlx::query!(
                r#"
                UPDATE players 
                SET games_played = games_played + 1,
                    last_active = NOW()
                WHERE id = $1
                "#,
                player_id
            )
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    /// Execute an idempotent transaction for both coins and diamonds
    pub async fn execute_transaction(
        &self,
        player_id: &uuid::Uuid,
        coins: i32,
        diamonds: i32,
        category: &str,
        game_id: Option<uuid::Uuid>,
        reference_id: Option<String>,
    ) -> Result<bool, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // 1. Check if reference_id already exists (idempotency)
        if let Some(ref ref_id) = reference_id {
            let exists = sqlx::query!(
                "SELECT id FROM transactions WHERE reference_id = $1",
                ref_id
            )
            .fetch_optional(&mut *tx)
            .await?;

            if exists.is_some() {
                tx.rollback().await?;
                return Ok(false); // Already processed
            }
        }

        // 2. Perform balance update with atomic checks for deductions
        // We'll calculate the positive values for comparison (thresholds)
        let coin_req = if coins < 0 { -coins } else { 0 };
        let diamond_req = if diamonds < 0 { -diamonds } else { 0 };

        let update_result = sqlx::query!(
            r#"
            UPDATE players 
            SET coin_balance = coin_balance + $1,
                diamonds_balance = diamonds_balance + $2
            WHERE id = $3 AND coin_balance >= $4 AND diamonds_balance >= $5
            "#,
            coins, diamonds, player_id, coin_req, diamond_req
        ).execute(&mut *tx).await?;

        if update_result.rows_affected() == 0 {
            tx.rollback().await?;
            return Err(sqlx::Error::RowNotFound); // Player not found or Insufficient funds
        }

        // 3. Record transaction
        sqlx::query!(
            r#"
            INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            player_id,
            coins,
            diamonds,
            category,
            game_id,
            reference_id
        )
        .execute(&mut *tx)
        .await?;

        // 4. Audit Log for "LARGE_TRANSFER" (e.g. > 10,000 coins or > 100 diamonds)
        if coins.abs() >= 10000 || diamonds.abs() >= 100 {
            sqlx::query!(
                r#"
                INSERT INTO audit_logs (player_id, event_type, severity, metadata)
                VALUES ($1, 'LARGE_TRANSFER', 'warning', $2)
                "#,
                player_id,
                serde_json::json!({
                    "coins": coins,
                    "diamonds": diamonds,
                    "category": category,
                    "game_id": game_id,
                    "reference_id": reference_id
                })
            ).execute(&mut *tx).await?;
        }

        tx.commit().await?;
        Ok(true)
    }

    /// Update player balance directly (Logged via Transaction)
    pub async fn update_player_balance(
        &self,
        player_id: &uuid::Uuid,
        coins: i32,
        diamonds: i32,
    ) -> Result<(), sqlx::Error> {
        // We use internal reference ID for direct balance updates
        let ref_id = format!("direct_update_{}_{}", player_id, Uuid::new_v4());
        self.execute_transaction(player_id, coins, diamonds, "direct_adjustment", None, Some(ref_id)).await?;
        Ok(())
    }

    /// Atomic entry fee deduction for two players
    pub async fn execute_matchmaking_entry(
        &self,
        p1_id: &uuid::Uuid,
        p2_id: &uuid::Uuid,
        amount: i32,
        game_id: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // 1. Check/Deduct Player 1
        let ref1 = format!("{}_{}_entry", game_id, p1_id);
        let exists1 = sqlx::query!("SELECT id FROM transactions WHERE reference_id = $1", ref1)
            .fetch_optional(&mut *tx)
            .await?;

        if exists1.is_none() {
            let res = sqlx::query!(
                "UPDATE players SET coin_balance = coin_balance - $1 WHERE id = $2 AND coin_balance >= $1",
                amount, p1_id
            ).execute(&mut *tx).await?;

            if res.rows_affected() == 0 {
                tx.rollback().await?;
                return Err(sqlx::Error::RowNotFound);
            }

            sqlx::query!(
                "INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                p1_id, -amount, 0, "entry_fee", game_id, ref1
            ).execute(&mut *tx).await?;
        }

        // 2. Check/Deduct Player 2
        let ref2 = format!("{}_{}_entry", game_id, p2_id);
        let exists2 = sqlx::query!("SELECT id FROM transactions WHERE reference_id = $1", ref2)
            .fetch_optional(&mut *tx)
            .await?;

        if exists2.is_none() {
            let res = sqlx::query!(
                "UPDATE players SET coin_balance = coin_balance - $1 WHERE id = $2 AND coin_balance >= $1",
                amount, p2_id
            ).execute(&mut *tx).await?;

            if res.rows_affected() == 0 {
                tx.rollback().await?;
                return Err(sqlx::Error::RowNotFound);
            }

            sqlx::query!(
                "INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                p2_id, -amount, 0, "entry_fee", game_id, ref2
            ).execute(&mut *tx).await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Get leaderboard
    pub async fn get_leaderboard(&self, limit: i64) -> Result<Vec<super::Player>, sqlx::Error> {
        sqlx::query_as!(
            super::Player,
            r#"
            SELECT id, name, email, profile_id, games_played, games_won,
                   coin_balance, diamonds_balance, rank, tier, stars,
                   created_at, last_active, password_hash, mfa_enabled, totp_secret,
                   failed_login_attempts, lockout_until
            FROM players
            ORDER BY games_won DESC, games_played DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await
    }
}

// =============================================================================
// GAME QUERIES
// =============================================================================

impl Database {
    /// Create a new game record
    pub async fn create_game(&self, game: &super::CreateGame) -> Result<uuid::Uuid, sqlx::Error> {
        let result = sqlx::query!(
            r#"
            INSERT INTO games (player1_id, player2_id, player1_name, player2_name, status, game_state)
            VALUES ($1, $2, $3, $4, 'waiting_for_poison', $5)
            RETURNING id
            "#,
            game.player1_id,
            game.player2_id,
            game.player1_name,
            game.player2_name,
            serde_json::json!({})
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(result.id)
    }

    /// Get game by ID
    pub async fn get_game(&self, game_id: &uuid::Uuid) -> Result<Option<super::Game>, sqlx::Error> {
        sqlx::query_as!(
            super::Game,
            r#"
            SELECT id, player1_id, player2_id, player1_name, player2_name,
                   status, winner, game_state, created_at, ended_at
            FROM games
            WHERE id = $1
            "#,
            game_id
        )
        .fetch_optional(&self.pool)
        .await
    }

    /// Update game state
    pub async fn update_game_state(
        &self,
        game_id: &uuid::Uuid,
        status: &str,
        game_state: serde_json::Value,
        winner: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            UPDATE games
            SET status = $2, game_state = $3, winner = $4,
                ended_at = CASE WHEN $2 = 'finished' THEN NOW() ELSE ended_at END
            WHERE id = $1
            "#,
            game_id,
            status,
            game_state,
            winner,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// =============================================================================
// USER AUTH QUERIES
// =============================================================================

impl Database {
    /// Create a new user
    pub async fn create_user(&self, user: &super::CreateUser) -> Result<uuid::Uuid, sqlx::Error> {
        // Generate a unique profile_id (e.g. PCD-XXXXXX)
        use rand::{distributions::Alphanumeric, Rng};
        let random_string: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(6)
            .map(char::from)
            .collect();
        let profile_id = format!("PCD-{}", random_string.to_uppercase());

        let result = sqlx::query!(
            r#"
            INSERT INTO players (name, email, password_hash, profile_id, coin_balance, diamonds_balance)
            VALUES ($1, $2, $3, $4, 1000, 5)
            RETURNING id
            "#,
            user.username,
            user.email,
            user.password_hash,
            profile_id,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(result.id)
    }

    pub async fn get_user_by_email(
        &self,
        email: &str,
    ) -> Result<Option<super::UserAuth>, sqlx::Error> {
        sqlx::query_as!(
            super::UserAuth,
            r#"
            SELECT id, name, email, password_hash, mfa_enabled, failed_login_attempts, lockout_until
            FROM players
            WHERE email = $1
            "#,
            email
        )
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_user_by_password_hash(
        &self,
        hash: &str,
    ) -> Result<Option<super::UserAuth>, sqlx::Error> {
        sqlx::query_as!(
            super::UserAuth,
            r#"
            SELECT id, name, email, password_hash, mfa_enabled, failed_login_attempts, lockout_until
            FROM players
            WHERE password_hash = $1
            "#,
            hash
        )
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn upgrade_user(&self, user: &super::UpgradeUser) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            UPDATE players
            SET name = $1, email = $2, password_hash = $3
            WHERE id = $4
            "#,
            user.username,
            user.email,
            user.password_hash,
            user.id,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// =============================================================================
// REFRESH TOKEN & SECURITY MANAGEMENT
// =============================================================================

impl Database {
    /// Save a new refresh token
    pub async fn create_refresh_token(
        &self,
        user_id: &uuid::Uuid,
        token: &str,
        expires_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            user_id, token, expires_at
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Verify and return user_id if token is valid and not expired
    pub async fn verify_refresh_token(&self, token: &str) -> Result<Option<uuid::Uuid>, sqlx::Error> {
        let res = sqlx::query!(
            "SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()",
            token
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(res.map(|r| r.user_id))
    }

    /// Revoke a specific refresh token
    pub async fn revoke_refresh_token(&self, token: &str) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM refresh_tokens WHERE token = $1", token)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Revoke all refresh tokens for a user
    pub async fn revoke_all_sessions(&self, user_id: &uuid::Uuid) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM refresh_tokens WHERE user_id = $1", user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Update Account Lockout status
    pub async fn update_lockout(
        &self,
        user_id: &uuid::Uuid,
        attempts: i32,
        lockout_until: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE players SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3",
            attempts, lockout_until, user_id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Set MFA secret and status
    pub async fn set_mfa_secret(&self, user_id: &uuid::Uuid, secret: &str) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE players SET totp_secret = $1, mfa_enabled = TRUE WHERE id = $2",
            secret, user_id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
