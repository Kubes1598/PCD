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
}
