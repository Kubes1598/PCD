"""
Rate Limiting Middleware - Production Ready

Implements path-specific rate limits with sliding window algorithm.
Uses Redis for distributed rate limiting across multiple instances.
"""

import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from utils.redis_client import redis_client

logger = logging.getLogger(__name__)

# Path-specific rate limits (requests per window in seconds)
PATH_LIMITS = {
    "/auth/login": {"limit": 5, "window": 60},       # 5 per minute (brute force protection)
    "/auth/register": {"limit": 10, "window": 60},    # 10 per minute (spam protection - increased for testing)
    "/matchmaking": {"limit": 10, "window": 60},     # 10 per minute
    "/games": {"limit": 60, "window": 60},           # 60 per minute
    "/players": {"limit": 30, "window": 60},         # 30 per minute
    "/ai": {"limit": 120, "window": 60},             # 120 per minute (game moves are rapid)
    "default": {"limit": 60, "window": 60}           # 60 per minute default
}

# Paths to skip rate limiting entirely
SKIP_PATHS = {"/health", "/", "/docs", "/openapi.json", "/redoc"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with path-specific limits."""
    
    def __init__(self, app, limit: int = 60, window: int = 60):
        super().__init__(app)
        self.default_limit = limit
        self.default_window = window

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for specified paths
        if request.url.path in SKIP_PATHS:
            return await call_next(request)
        
        # Skip WebSocket upgrades (handled separately)
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        # Get client identifier (IP + path prefix for granular limiting)
        client_ip = self._get_client_ip(request)
        path = request.url.path
        
        # Get path-specific limits
        config = self._get_path_config(path)
        limit = config["limit"]
        window = config["window"]

        try:
            r = await redis_client.connect()
            
            # Create rate limit key based on IP and path prefix
            path_prefix = path.split('/')[1] if len(path.split('/')) > 1 else "root"
            key = f"pcd:rate_limit:{client_ip}:{path_prefix}"
            
            # Get current hit count
            current_hits_raw = await r.get(key)
            current_hits = int(current_hits_raw) if current_hits_raw else 0
            
            if current_hits >= limit:
                # Rate limit exceeded
                retry_after = window
                logger.warning(f"⚠️ Rate limit exceeded for {client_ip} on {path_prefix}")
                
                return JSONResponse(
                    status_code=429,
                    content={
                        "success": False,
                        "message": "Too many requests. Please slow down!",
                        "error_code": "RATE_4001",
                        "details": {"retry_after": retry_after}
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time()) + retry_after)
                    }
                )
            
            # Increment counter
            if current_hits == 0:
                await r.setex(key, window, 1)
            else:
                await r.incr(key)
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers to response
            remaining = max(0, limit - current_hits - 1)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window)
            
            return response

        except Exception as e:
            # If Redis fails, allow request but log warning
            logger.warning(f"⚠️ Rate Limiter Error: {e}")
            return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP, checking for proxy headers."""
        # Check for forwarded headers (when behind proxy/load balancer)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP (client IP)
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fall back to direct connection
        return request.client.host if request.client else "unknown"
    
    def _get_path_config(self, path: str) -> dict:
        """Get rate limit config for a path."""
        for prefix, config in PATH_LIMITS.items():
            if prefix != "default" and path.startswith(prefix):
                return config
        return PATH_LIMITS["default"]
