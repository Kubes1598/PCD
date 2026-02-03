from fastapi import APIRouter, Depends
import time
from dependencies import get_game_engine, get_db_service
from game_config import CITY_CONFIG, AI_CONFIG, WIN_THRESHOLD, CANDY_COUNT, INITIAL_BALANCE, DAILY_REWARDS, RANK_THRESHOLDS

router = APIRouter(tags=["General"])

@router.get("/")
async def root():
    return {"message": "Poisoned Candy Duel API", "version": "1.0.0"}

@router.get("/health")
async def health_check(game_engine=Depends(get_game_engine), db_service=Depends(get_db_service)):
    try:
        stats = await db_service.get_game_stats()
        return {
            "status": "healthy", 
            "active_games": len(game_engine.games),
            "database_stats": stats,
            "supabase_connected": True
        }
    except Exception as e:
        # Don't expose error details in production
        return {
            "status": "degraded",
            "active_games": len(game_engine.games),
            "supabase_connected": False
        }

@router.get("/api/time")
async def get_server_time():
    return {
        "timestamp": int(time.time() * 1000),
        "timezone": "UTC",
        "server_id": "pcd-game-server-1"
    }

@router.get("/api/config")
async def get_game_config():
    return {
        "win_threshold": WIN_THRESHOLD,
        "candy_count": CANDY_COUNT,
        "city_config": CITY_CONFIG,
        "ai_config": AI_CONFIG,
        "initial_balance": INITIAL_BALANCE,
        "rank_thresholds": RANK_THRESHOLDS,
    }
