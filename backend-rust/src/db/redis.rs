//! Redis connection and caching

use redis::aio::ConnectionManager;
use redis::AsyncCommands;

/// Redis client wrapper
#[derive(Clone)]
pub struct RedisClient {
    conn: ConnectionManager,
}

impl RedisClient {
    /// Connect to Redis
    pub async fn connect(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    /// Set a value with expiry
    pub async fn set_ex<V: redis::ToRedisArgs + Send + Sync>(
        &self,
        key: &str,
        value: V,
        ttl_secs: u64,
    ) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.set_ex(key, value, ttl_secs).await
    }

    /// Get a value
    pub async fn get<V: redis::FromRedisValue>(
        &self,
        key: &str,
    ) -> Result<Option<V>, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.get(key).await
    }

    /// Delete a key
    pub async fn del(&self, key: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.del(key).await
    }

    /// Check if key exists
    pub async fn exists(&self, key: &str) -> Result<bool, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.exists(key).await
    }

    /// Increment a counter
    pub async fn incr(&self, key: &str) -> Result<i64, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.incr(key, 1).await
    }

    /// Set TTL on a key
    pub async fn expire(&self, key: &str, secs: i64) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.expire(key, secs).await
    }

    /// Health check
    pub async fn ping(&self) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        redis::cmd("PING").query_async(&mut conn).await
    }

    // =========================================================================
    // GAME STATE CACHING
    // =========================================================================

    /// Cache game state
    pub async fn cache_game_state(
        &self,
        game_id: &uuid::Uuid,
        state: &serde_json::Value,
    ) -> Result<(), redis::RedisError> {
        let key = format!("game:{}", game_id);
        let value = serde_json::to_string(state).unwrap_or_default();
        self.set_ex(&key, value, 3600).await // 1 hour TTL
    }

    /// Get cached game state
    pub async fn get_game_state(
        &self,
        game_id: &uuid::Uuid,
    ) -> Result<Option<serde_json::Value>, redis::RedisError> {
        let key = format!("game:{}", game_id);
        let value: Option<String> = self.get(&key).await?;
        Ok(value.and_then(|v| serde_json::from_str(&v).ok()))
    }

    /// Delete game state
    pub async fn delete_game_state(&self, game_id: &uuid::Uuid) -> Result<(), redis::RedisError> {
        let key = format!("game:{}", game_id);
        self.del(&key).await
    }

    // =========================================================================
    // TOKEN BLACKLISTING
    // =========================================================================

    /// Blacklist a JWT token (e.g. on logout)
    pub async fn blacklist_token(&self, token: &str, ttl_secs: u64) -> Result<(), redis::RedisError> {
        let key = format!("blacklist:{}", token);
        self.set_ex(&key, "revoked", ttl_secs).await
    }

    /// Check if a token is blacklisted
    pub async fn is_token_blacklisted(&self, token: &str) -> Result<bool, redis::RedisError> {
        let key = format!("blacklist:{}", token);
        self.exists(&key).await
    }

    // =========================================================================
    // RATE LIMITING
    // =========================================================================

    /// Check and increment rate limit
    pub async fn check_rate_limit(
        &self,
        identifier: &str,
        max_requests: i64,
        window_secs: i64,
    ) -> Result<bool, redis::RedisError> {
        let key = format!("ratelimit:{}", identifier);

        let count: i64 = self.incr(&key).await?;

        if count == 1 {
            self.expire(&key, window_secs).await?;
        }

        Ok(count <= max_requests)
    }

    // =========================================================================
    // DISTRIBUTED GOVERNANCE (WS & SESSIONS)
    // =========================================================================

    /// Track a new active connection (Global, Per-User, or Per-IP)
    pub async fn track_connection(&self, key: &str, limit: i64) -> Result<bool, redis::RedisError> {
        let count: i64 = self.incr(key).await?;
        if count == 1 {
            self.expire(key, 86400).await?; // 24h cleanup safety
        }

        if count > limit {
            // Rollback the increment if limit exceeded
            let mut conn = self.conn.clone();
            let _: () = conn.decr(key, 1).await?;
            return Ok(false);
        }
        Ok(true)
    }

    /// Release an active connection
    pub async fn release_connection(&self, key: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        let _: () = conn.decr(key, 1).await?;
        Ok(())
    }

    /// Store a short-lived security proof (e.g. for Step-Up MFA)
    pub async fn store_security_proof(
        &self,
        user_id: &uuid::Uuid,
        action_id: &str,
        ttl_secs: u64,
    ) -> Result<(), redis::RedisError> {
        let key = format!("proof:{}:{}", user_id, action_id);
        self.set_ex(&key, "verified", ttl_secs).await
    }

    /// Verify if a security proof exists and is valid
    pub async fn verify_security_proof(&self, user_id: &uuid::Uuid, action_id: &str) -> Result<bool, redis::RedisError> {
        let key = format!("proof:{}:{}", user_id, action_id);
        self.exists(&key).await
    }

    // =========================================================================
    // LEADERBOARD (Sorted Sets)
    // =========================================================================

    /// Update player score in city leaderboard
    pub async fn update_leaderboard(
        &self,
        city: &str,
        player_id: &uuid::Uuid,
        wins: i32,
    ) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        let key = format!("leaderboard:{}", city);
        // ZADD key score member
        conn.zadd(key, player_id.to_string(), wins).await
    }

    /// Get top players for a city
    pub async fn get_leaderboard(
        &self,
        city: &str,
        limit: isize,
    ) -> Result<Vec<(String, i32)>, redis::RedisError> {
        let mut conn = self.conn.clone();
        let key = format!("leaderboard:{}", city);
        // ZREVRANGE key 0 limit-1 WITHSCORES
        conn.zrevrange_withscores(key, 0, limit - 1).await
    }
}
