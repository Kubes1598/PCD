import redis.asyncio as redis
from config import settings

class RedisClient:
    """Async Redis client wrapper."""
    
    def __init__(self):
        self.redis = None
    
    async def connect(self):
        if not self.redis:
            self.redis = await redis.from_url(
                settings.REDIS_URL, 
                encoding="utf-8", 
                decode_responses=True
            )
            print("🚀 Redis connected successfully")
        return self.redis
    
    async def close(self):
        if self.redis:
            await self.redis.close()
            self.redis = None

redis_client = RedisClient()

async def get_redis():
    return await redis_client.connect()
