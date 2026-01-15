import redis.asyncio as redis
from config import settings
import json
import asyncio

class MockRedis:
    """In-memory fallback for Redis when no server is available."""
    def __init__(self):
        self.data = {}
        self.lists = {}
        print("⚠️  Using In-Memory Mock Redis Fallback")

    async def rpush(self, key, value):
        if key not in self.lists: self.lists[key] = []
        self.lists[key].append(value)
        return len(self.lists[key])

    async def lpush(self, key, value):
        """Add to the front of the list (for returning players to queue)."""
        if key not in self.lists: self.lists[key] = []
        self.lists[key].insert(0, value)
        return len(self.lists[key])

    async def lpop(self, key):
        if key in self.lists and self.lists[key]:
            return self.lists[key].pop(0)
        return None

    async def hdel(self, name, key):
        """Delete a hash field."""
        if name in self.data and key in self.data[name]:
            del self.data[name][key]
            return 1
        return 0

    async def hset(self, name, key, value):
        if name not in self.data: self.data[name] = {}
        self.data[name][key] = value
        return 1

    async def hget(self, name, key):
        return self.data.get(name, {}).get(key)

    async def get(self, key):
        return self.data.get(key)

    async def setex(self, key, time, value):
        self.data[key] = value
        return True

    async def incr(self, key):
        val = int(self.data.get(key, 0)) + 1
        self.data[key] = str(val)
        return val

    async def decr(self, key):
        val = int(self.data.get(key, 0)) - 1
        self.data[key] = str(val)
        return val

    async def delete(self, *keys):
        for k in keys:
            if k in self.data: del self.data[k]
            if k in self.lists: del self.lists[k]
        return len(keys)

    async def llen(self, key):
        return len(self.lists.get(key, []))

    async def ping(self):
        return True

    async def close(self):
        pass

class RedisClient:
    """Async Redis client wrapper with graceful fallback."""
    
    def __init__(self):
        self.redis = None
        self.use_mock = False
        self._lock = asyncio.Lock()
    
    async def connect(self):
        async with self._lock:
            if not self.redis:
                try:
                    self.redis = await redis.from_url(
                        settings.REDIS_URL, 
                        encoding="utf-8", 
                        decode_responses=True,
                        socket_connect_timeout=1
                    )
                    # Test connection
                    await self.redis.ping()
                    print("🚀 Redis connected successfully")
                    self.use_mock = False
                except Exception as e:
                    print(f"📡 Redis connection failed: {e}. Falling back to In-Memory.")
                    self.redis = MockRedis()
                    self.use_mock = True
            return self.redis

    async def rpush(self, key, value):
        r = await self.connect()
        return await r.rpush(key, value)
# ... (rest of proxy methods)

    async def lpop(self, key):
        r = await self.connect()
        return await r.lpop(key)

    async def hset(self, name, key, value):
        r = await self.connect()
        return await r.hset(name, key, value)

    async def hget(self, name, key):
        r = await self.connect()
        return await r.hget(name, key)

    async def llen(self, key):
        r = await self.connect()
        return await r.llen(key)
    
    async def close(self):
        if self.redis:
            await self.redis.close()
            self.redis = None

redis_client = RedisClient()

async def get_redis():
    return await redis_client.connect()
