import time
import json
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from utils.redis_client import redis_client

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = 60, window: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for static/health checks if needed
        if request.url.path in ["/health", "/"]:
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host
        path = request.url.path
        
        # Determine limit based on path
        is_auth = path.startswith("/auth")
        limit = 10 if is_auth else self.limit
        
        try:
            r = await redis_client.connect()
            key = f"pcd:rate_limit:{client_ip}:{path}"
            
            # Use Redis for atomic increment and expiry
            # We use a simple fixed window for simplicity
            current_hits = await r.get(key)
            
            if current_hits and int(current_hits) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later.", "retry_after": self.window}
                )
            
            # Increment or set with expiry
            if not current_hits:
                await r.setex(key, self.window, 1)
            else:
                await r.incr(key)
                
            response = await call_next(request)
            return response
            
        except Exception as e:
            # Fallback: if Redis is down, allow request but log
            print(f"⚠️ Rate Limiter Error: {e}")
            return await call_next(request)
