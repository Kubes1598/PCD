//! PostgreSQL database connection and queries

use sqlx::{postgres::PgPoolOptions, PgPool};

/// Database connection wrapper
#[derive(Clone)]
pub struct Database {
    pool: PgPool,
    pub redis: Option<crate::db::RedisClient>,
}

impl Database {
    /// Connect to PostgreSQL with connection pooling
    pub async fn connect(database_url: &str, redis: Option<crate::db::RedisClient>) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .min_connections(2)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect(database_url)
            .await?;

        // Run migrations on startup
        sqlx::migrate!("./migrations").run(&pool).await.ok(); // Ignore if migrations folder doesn't exist yet

        Ok(Self { pool, redis })
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
        let ref_id = format!("direct_update_{}_{}", player_id, uuid::Uuid::new_v4());
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

    // =========================================================================
    // HIGH-ASSURANCE MATCHMAKING (Transactional Outbox + Atomicity)
    // =========================================================================

    /// Create match, reserve fees, and queue outbox event in ONE transaction
    pub async fn create_match_with_outbox(
        &self,
        match_id: uuid::Uuid,
        p1_id: &uuid::Uuid,
        p2_id: &uuid::Uuid,
        city: &str,
        fee: i32,
        match_event_payload: serde_json::Value,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // 1. Deduct fees using atomic reference check
        for pid in &[p1_id, p2_id] {
            let ref_id = format!("{}_{}_entry", match_id, pid);
            let res = sqlx::query!(
                "UPDATE players SET coin_balance = coin_balance - $1 WHERE id = $2 AND coin_balance >= $1",
                fee, pid
            ).execute(&mut *tx).await?;

            if res.rows_affected() == 0 {
                tx.rollback().await?;
                return Err(sqlx::Error::RowNotFound); // Insufficient funds
            }

            sqlx::query!(
                "INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                pid, -fee, 0, "entry_fee", match_id, ref_id
            ).execute(&mut *tx).await?;
        }

        // 2. Insert Persistent Match
        sqlx::query!(
            "INSERT INTO matches (id, p1_id, p2_id, city, status) VALUES ($1, $2, $3, $4, 'MATCHED')",
            match_id, p1_id, p2_id, city
        ).execute(&mut *tx).await?;

        // 3. Queue Outbox Event (Transactional Outbox Pattern)
        // This ensures the match notification is reliably sent even if worker dies
        sqlx::query!(
            "INSERT INTO outbox_events (event_type, payload, status) VALUES ($1, $2, 'pending')",
            "MATCH_FOUND", match_event_payload
        ).execute(&mut *tx).await?;

        tx.commit().await?;
        Ok(())
    }

    /// Create AI match and reserve fee in ONE transaction (Atomic)
    pub async fn create_ai_match_atomic(
        &self,
        match_id: uuid::Uuid,
        player_id: &uuid::Uuid,
        difficulty: &str,
        fee: i32,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // 1. Deduct fee (only if > 0)
        if fee > 0 {
            let ref_id = format!("ai_{}_{}", player_id, match_id);
            let res = sqlx::query!(
                "UPDATE players SET coin_balance = coin_balance - $1 WHERE id = $2 AND coin_balance >= $1",
                fee, player_id
            ).execute(&mut *tx).await?;

            if res.rows_affected() == 0 {
                tx.rollback().await?;
                return Err(sqlx::Error::RowNotFound); // Insufficient funds
            }

            sqlx::query!(
                "INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                player_id, -fee, 0, "ai_entry_fee", match_id, ref_id
            ).execute(&mut *tx).await?;
        }

        // 2. Insert Match record for stats/tracking
        let city = format!("ai_{}", difficulty);
        sqlx::query!(
            "INSERT INTO matches (id, p1_id, p2_id, city, status) VALUES ($1, $2, $3, $4, 'STARTED')",
            match_id, player_id, player_id, city // We use player_id twice or leave p2 null if schema allows, but here we'll just track player1
        ).execute(&mut *tx).await?;

        tx.commit().await?;
        Ok(())
    }

    /// Settle match result, update wallet AND statistics atomically
    pub async fn settle_match_result(
        &self,
        match_id: uuid::Uuid,
        p1_id: &uuid::Uuid,
        p2_id: &uuid::Uuid,
        winner_id: Option<uuid::Uuid>,
        fee: i32,
        prize: i32,
        result_type: &str,
        city: &str, // Add city for leaderboard
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        // 1. Immutable Ledger Entry (Idempotent shield)
        let _ref_ledger = format!("match_ledger_{}", match_id);
        let exists = sqlx::query!("SELECT match_id FROM match_ledger WHERE match_id = $1", match_id)
            .fetch_optional(&mut *tx).await?;
        if exists.is_some() {
            tx.rollback().await?;
            return Ok(()); // Already settled
        }

        sqlx::query!(
            "INSERT INTO match_ledger (match_id, p1_id, p2_id, winner_id, entry_fee, prize, result_type) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            match_id, p1_id, p2_id, winner_id, fee, prize, result_type
        ).execute(&mut *tx).await?;

        // 2. Atomic Wallet Payout (only if there's a winner/prize)
        if let Some(w_id) = winner_id {
            if prize > 0 {
                let ref_payout = format!("{}_{}_victory", match_id, w_id);
                sqlx::query!(
                    "UPDATE players SET coin_balance = coin_balance + $1 WHERE id = $2",
                    prize, w_id
                ).execute(&mut *tx).await?;

                sqlx::query!(
                    "INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                    w_id, prize, 0, "victory_reward", match_id, ref_payout
                ).execute(&mut *tx).await?;
            }
        } else if result_type == "draw" && fee > 0 {
            // Refund on draw
            for pid in &[p1_id, p2_id] {
                let ref_refund = format!("{}_{}_draw_refund", match_id, pid);
                sqlx::query!(
                    "UPDATE players SET coin_balance = coin_balance + $1 WHERE id = $2",
                    fee, pid
                ).execute(&mut *tx).await?;

                sqlx::query!(
                    "INSERT INTO transactions (player_id, amount, diamond_amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                    pid, fee, 0, "draw_refund", match_id, ref_refund
                ).execute(&mut *tx).await?;
            }
        }

        // 3. Update Player Statistics Aggregates
        // Use row locking to prevent racing updates
        for pid in &[p1_id, p2_id] {
            let is_winner = winner_id.map(|id| id == **pid).unwrap_or(false);
            let win_inc = if is_winner { 1 } else { 0 };

            sqlx::query!(
                "UPDATE players SET games_played = games_played + 1, games_won = games_won + $1 WHERE id = $2",
                win_inc, pid
            ).execute(&mut *tx).await?;
        }

        // 4. Finalize Match Status
        sqlx::query!(
            "UPDATE matches SET status = 'FINISHED', final_result = $1, updated_at = NOW() WHERE id = $2",
            result_type, match_id
        ).execute(&mut *tx).await?;

        tx.commit().await?;

        // 5. Update ELO ratings (outside the main transaction — non-blocking)
        if let Err(e) = self.update_elo_after_match(winner_id, p1_id, p2_id).await {
            tracing::error!("ELO update failed for match {}: {}", match_id, e);
        }

        // 6. Update Redis Leaderboard (Cache-Aside)
        if let Some(redis) = &self.redis {
            for pid in &[p1_id, p2_id] {
                // Get updated wins count from DB to ensure consistency
                if let Ok(wins) = sqlx::query_scalar!("SELECT games_won FROM players WHERE id = $1", *pid)
                    .fetch_one(&self.pool)
                    .await
                {
                    let _ = redis.update_leaderboard(city, pid, wins).await;
                }
            }
        }

        Ok(())
    }

    /// Process pending outbox events
    pub async fn get_pending_outbox(&self, limit: i64) -> Result<Vec<super::OutboxEvent>, sqlx::Error> {
        sqlx::query_as!(
            super::OutboxEvent,
            "SELECT id, event_type, payload, target_player_id, status, retry_count, created_at FROM outbox_events WHERE status = 'pending' ORDER BY created_at LIMIT $1",
            limit
        ).fetch_all(&self.pool).await
    }

    /// Mark outbox event as sent
    pub async fn mark_outbox_sent(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE outbox_events SET status = 'sent', processed_at = NOW() WHERE id = $1",
            id
        ).execute(&self.pool).await?;
        Ok(())
    }

    // =========================================================================
    // ELO RATING SYSTEM
    // =========================================================================

    /// Get a player's ELO rating
    pub async fn get_player_elo(&self, player_id: &uuid::Uuid) -> Result<i32, sqlx::Error> {
        let row = sqlx::query_scalar!(
            "SELECT elo_rating FROM players WHERE id = $1",
            player_id
        ).fetch_optional(&self.pool).await?;

        // elo_rating is NOT NULL DEFAULT 1000 — but fetch_optional wraps it in Option
        Ok(row.unwrap_or(1000))
    }

    /// Update ELO ratings for both players after a match (standard K=32 formula)
    pub async fn update_elo_after_match(
        &self,
        winner_id: Option<uuid::Uuid>,
        p1_id: &uuid::Uuid,
        p2_id: &uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        let p1_elo = self.get_player_elo(p1_id).await? as f64;
        let p2_elo = self.get_player_elo(p2_id).await? as f64;

        let k: f64 = 32.0;

        // Expected scores
        let expected_p1 = 1.0 / (1.0 + 10f64.powf((p2_elo - p1_elo) / 400.0));
        let expected_p2 = 1.0 / (1.0 + 10f64.powf((p1_elo - p2_elo) / 400.0));

        // Actual scores
        let (score_p1, score_p2) = match winner_id {
            Some(w) if w == *p1_id => (1.0, 0.0),
            Some(w) if w == *p2_id => (0.0, 1.0),
            _ => (0.5, 0.5), // Draw
        };

        let new_p1 = (p1_elo + k * (score_p1 - expected_p1)).round() as i32;
        let new_p2 = (p2_elo + k * (score_p2 - expected_p2)).round() as i32;

        // Floor at 100 to prevent going to 0
        let new_p1 = std::cmp::max(new_p1, 100);
        let new_p2 = std::cmp::max(new_p2, 100);

        sqlx::query!(
            "UPDATE players SET elo_rating = $1 WHERE id = $2",
            new_p1, p1_id
        ).execute(&self.pool).await?;

        sqlx::query!(
            "UPDATE players SET elo_rating = $1 WHERE id = $2",
            new_p2, p2_id
        ).execute(&self.pool).await?;

        tracing::info!(
            "ELO Update: P1({})={}->{}, P2({})={}->{}",
            p1_id, p1_elo as i32, new_p1,
            p2_id, p2_elo as i32, new_p2
        );

        Ok(())
    }

    // =========================================================================
    // RECONNECT RECOVERY
    // =========================================================================

    /// Check if a player has an active (non-finished) match
    pub async fn get_active_match_for_player(
        &self,
        player_id: &uuid::Uuid,
    ) -> Result<Option<uuid::Uuid>, sqlx::Error> {
        let row = sqlx::query!(
            "SELECT id FROM matches WHERE (p1_id = $1 OR p2_id = $1) AND status IN ('MATCHED', 'READY', 'STARTED') LIMIT 1",
            player_id
        ).fetch_optional(&self.pool).await?;

        Ok(row.map(|r| r.id))
    }
}
