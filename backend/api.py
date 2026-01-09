from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth, game, matchmaking, users, general, ai
from middleware.rate_limit import RateLimitMiddleware

app = FastAPI(title="Poisoned Candy Duel API", version="1.0.0")

# Add Rate Limiting (60 req/min default)
app.add_middleware(RateLimitMiddleware, limit=60, window=60)

# Add CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(general.router)
app.include_router(auth.router)
app.include_router(game.router)
app.include_router(matchmaking.router)
app.include_router(users.router)
# app.include_router(signaling.router) # Obsolete
app.include_router(ai.router)

from fastapi.responses import JSONResponse
import logging

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logging.error(f"❌ Global Error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "The arena had a little tumble, but we're getting it back on its feet!",
            "error_code": "INTERNAL_SERVER_ERROR"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)