"""
Request Tracking Middleware

Adds a unique request ID to each request for debugging and tracing.
This helps correlate logs across different services and track request flow.
"""

import uuid
import time
import logging
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds request tracking capabilities:
    - Unique request ID for each request
    - Request timing
    - Request logging
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID (short form for readability)
        request_id = str(uuid.uuid4())[:8]
        
        # Store in request state for access in handlers
        request.state.request_id = request_id
        request.state.start_time = time.time()
        
        # Get client IP (handle proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        request.state.client_ip = client_ip
        
        # Log incoming request
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"from {client_ip}"
        )
        
        try:
            response = await call_next(request)
            
            # Calculate request duration
            duration_ms = (time.time() - request.state.start_time) * 1000
            
            # Add tracking headers to response
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
            
            # Log completed request
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} "
                f"-> {response.status_code} ({duration_ms:.2f}ms)"
            )
            
            return response
            
        except Exception as e:
            # Log error with request ID for tracing
            duration_ms = (time.time() - request.state.start_time) * 1000
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} "
                f"-> ERROR: {str(e)} ({duration_ms:.2f}ms)"
            )
            raise


class CacheHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds appropriate cache headers to responses.
    """
    
    # Paths that should be cached (with cache duration in seconds)
    CACHEABLE_PATHS = {
        "/leaderboard": 300,  # 5 minutes
        "/stats": 300,        # 5 minutes
        "/arena-stats": 300,  # 5 minutes
    }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Only cache successful GET requests
        if request.method == "GET" and response.status_code == 200:
            # Check if path is cacheable
            for path, max_age in self.CACHEABLE_PATHS.items():
                if path in request.url.path:
                    response.headers["Cache-Control"] = f"public, max-age={max_age}"
                    break
            else:
                # Default: no cache for dynamic content
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds security headers to all responses.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Only in production - remove for development
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response
