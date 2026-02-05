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
                   created_at, last_active
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
                   created_at, last_active
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

    /// Execute an idempotent transaction (deduct or add)
    pub async fn execute_transaction(
        &self,
        player_id: &uuid::Uuid,
        amount: i32,
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

        // 2. Update player balance
        let update_result = if amount < 0 {
            // Deduction - check for sufficient funds
            sqlx::query!(
                "UPDATE players SET coin_balance = coin_balance + $1 WHERE id = $2 AND coin_balance >= $3",
                amount, // amount is negative, e.g. -500
                player_id,
                -amount // 500
            )
            .execute(&mut *tx)
            .await?
        } else {
            // Addition
            sqlx::query!(
                "UPDATE players SET coin_balance = coin_balance + $1 WHERE id = $2",
                amount,
                player_id
            )
            .execute(&mut *tx)
            .await?
        };

        if update_result.rows_affected() == 0 && amount < 0 {
            tx.rollback().await?;
            return Err(sqlx::Error::RowNotFound); // Insufficient funds or player not found
        }

        // 3. Record transaction
        sqlx::query!(
            r#"
            INSERT INTO transactions (player_id, amount, category, game_id, reference_id)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            player_id,
            amount,
            category,
            game_id,
            reference_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(true)
    }

    /// Update player balance directly (Legacy/Internal)
    pub async fn update_player_balance(
        &self,
        player_id: &uuid::Uuid,
        coins: i32,
        diamonds: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE players SET coin_balance = coin_balance + $1, diamonds_balance = diamonds_balance + $2 WHERE id = $3",
            coins,
            diamonds,
            player_id
        )
        .execute(&self.pool)
        .await?;
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
                "INSERT INTO transactions (player_id, amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5)",
                p1_id, -amount, "entry_fee", game_id, ref1
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
                "INSERT INTO transactions (player_id, amount, category, game_id, reference_id) VALUES ($1, $2, $3, $4, $5)",
                p2_id, -amount, "entry_fee", game_id, ref2
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
                   created_at, last_active
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
        let result = sqlx::query!(
            r#"
            INSERT INTO players (name, email, password_hash, coin_balance, diamonds_balance)
            VALUES ($1, $2, $3, 1000, 5)
            RETURNING id
            "#,
            user.username,
            user.email,
            user.password_hash,
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
            SELECT id, name, email, password_hash
            FROM players
            WHERE email = $1
            "#,
            email
        )
        .fetch_optional(&self.pool)
        .await
    }
}
