"""
Poisoned Candy Duel API - Production Ready

Main FastAPI application with proper error handling and middleware.
"""

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from config import settings
from routers import auth, game, matchmaking, users, general, ai, oauth
from middleware.rate_limit import RateLimitMiddleware
from middleware.request_tracking import (
    RequestTrackingMiddleware, 
    CacheHeadersMiddleware, 
    SecurityHeadersMiddleware
)
from error_codes import ErrorCode, ERROR_MESSAGES, get_error_message
from dependencies import get_db_service
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Poisoned Candy Duel API",
    version="1.0.0",
    description="Backend API for Poisoned Candy Duel game"
)

# Add Rate Limiting (Temporarily disabled for WebSocket compatibility)
# app.add_middleware(RateLimitMiddleware, limit=60, window=60)

# Add Request Tracking (Temporarily disabled for WebSocket compatibility)
# app.add_middleware(RequestTrackingMiddleware)

# Add Cache Headers
app.add_middleware(CacheHeadersMiddleware)

# Add Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# Add CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(general.router)
app.include_router(auth.router)
app.include_router(oauth.router)  # OAuth (Google, Apple, Guest)
app.include_router(game.router)
app.include_router(matchmaking.router)
app.include_router(users.router)
app.include_router(ai.router)


# =============================================================================
# STARTUP / SHUTDOWN EVENTS
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """
    Application startup handler.
    
    Performs cache warming by pre-fetching frequently accessed data:
    - Leaderboard data
    - Arena stats
    - Game configuration
    """
    logger.info("🚀 Starting Poisoned Candy Duel API...")
    
    # Cache warming
    try:
        from utils.redis_client import redis_client
        from dependencies import get_db_service
        import json
        
        db_service = get_db_service()
        r = await redis_client.connect()
        
        # Warm leaderboard cache
        logger.info("📦 Warming cache: leaderboard...")
        leaderboard = await db_service.get_leaderboard(limit=100)
        if leaderboard:
            await r.setex("pcd:leaderboard:wins", 300, json.dumps(leaderboard))
            logger.info(f"   ✅ Cached {len(leaderboard)} leaderboard entries")
        
        # Warm arena stats cache
        logger.info("📦 Warming cache: arena stats...")
        try:
            arena_stats = await db_service.get_arena_stats()
            if arena_stats:
                await r.setex("pcd:arena_stats", 300, json.dumps(arena_stats))
                logger.info(f"   ✅ Cached arena stats")
        except Exception:
            pass  # Arena stats may not exist yet
        
        logger.info("🟢 Cache warming complete")
        
    except Exception as e:
        logger.warning(f"⚠️ Cache warming failed (Redis may not be available): {e}")
        # Non-fatal - app continues without cache

    logger.info("✅ API startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown handler."""
    logger.info("🔴 Shutting down Poisoned Candy Duel API...")


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with user-friendly messages."""
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    
    # Extract field name and message
    loc = first_error.get("loc", [])
    field = loc[-1] if loc else "input"
    msg = first_error.get("msg", "Invalid input")
    
    # Log the full validation error for debugging
    logger.warning(f"Validation error on {request.url.path}: {field} - {msg}")
    
    # Create user-friendly message
    if "email" in str(field).lower():
        user_message = "Please enter a valid email address."
    elif "password" in str(field).lower():
        user_message = "Password must be at least 8 characters with uppercase, lowercase, and numbers."
    elif "username" in str(field).lower():
        user_message = "Username must be 3-20 characters, starting with a letter."
    else:
        user_message = f"Invalid {field}: {msg}"
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": user_message,
            "error_code": ErrorCode.VALIDATION_ERROR.value,
            "details": None  # Never expose validation details in production
        }
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle value errors with user-friendly messages."""
    logger.warning(f"Value error on {request.url.path}: {str(exc)}")
    
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": str(exc) if len(str(exc)) < 200 else "Invalid input provided.",
            "error_code": ErrorCode.INVALID_INPUT.value
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler.
    CRITICAL: Never expose internal error details to clients!
    """
    # Log full error internally for debugging
    logger.error(f"❌ Unhandled Error on {request.url.path}: {str(exc)}", exc_info=True)
    
    # Return sanitized message to client
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": get_error_message(ErrorCode.INTERNAL_ERROR),
            "error_code": ErrorCode.INTERNAL_ERROR.value
        }
    )


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/health/db")
async def database_health_check(db_service=Depends(get_db_service)):
    """
    Database health check endpoint.
    
    Verifies database connectivity by performing a simple query.
    Returns 503 if database is unreachable.
    """
    try:
        # Try to fetch a small amount of data to verify connectivity
        await db_service.get_leaderboard(limit=1)
        return {
            "status": "healthy",
            "database": "connected",
            "message": "Database connection verified"
        }
    except Exception as e:
        logger.error(f"❌ Database health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "message": "Database connection failed"
            }
        )


@app.get("/health/redis")
async def redis_health_check():
    """
    Redis health check endpoint.
    
    Verifies Redis connectivity for caching and rate limiting.
    Returns 503 if Redis is unreachable.
    """
    try:
        from utils.redis_client import redis_client
        r = await redis_client.connect()
        await r.ping()
        return {
            "status": "healthy",
            "redis": "connected",
            "message": "Redis connection verified"
        }
    except Exception as e:
        logger.warning(f"⚠️ Redis health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "redis": "disconnected",
                "message": "Redis connection failed (app may still work with reduced performance)"
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)