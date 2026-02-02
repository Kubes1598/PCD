"""
Players & Social Router - Production Ready

Handles player profiles, friends, leaderboards, and quests.
Uses proper validation and never exposes internal errors.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
import logging
from dependencies import get_db_service
from utils.security import get_current_user, get_optional_user
from schemas import (
    PlayerBalanceRequest, PlayerStatsRequest, 
    AddFriendRequest, ClaimQuestRequest, GameResponse
)
from error_codes import ErrorCode, get_error_message

router = APIRouter(prefix="/players", tags=["Players & Social"])
logger = logging.getLogger(__name__)


def require_authenticated_user(user: Optional[dict]) -> dict:
    """
    Helper to ensure user is authenticated and NOT a guest.
    
    Raises:
        HTTPException: 401 if not authenticated or is a guest
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in or sign up.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is a guest
    if user.get("is_guest", False) or str(user.get("id", "")).startswith("guest_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This feature is not available for guest users. Please sign up to access quests!",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


@router.get("/profile/{profile_id}")
async def get_player_by_profile_id(
    profile_id: str, 
    db_service=Depends(get_db_service)
):
    """Find a player by their short Profile ID."""
    try:
        # Validate profile_id format
        if not profile_id or len(profile_id) > 20:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Invalid profile ID format",
                    "error_code": ErrorCode.VALIDATION_ERROR.value
                }
            )
        
        player = await db_service.get_player_by_profile_id(profile_id.upper())
        if player:
            return {
                "success": True,
                "data": {
                    "username": player.get("name"),
                    "profile_id": player.get("profile_id"),
                    "games_played": player.get("games_played", 0),
                    "games_won": player.get("games_won", 0),
                    "coin_balance": player.get("coin_balance", 0),
                    "rank": player.get("rank", "Amateur"),
                    "tier": player.get("tier", "")
                }
            }
        
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Player not found",
                "error_code": ErrorCode.GAME_NOT_FOUND.value
            }
        )
    except Exception as e:
        logger.error(f"Get player by profile ID error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.get("/{player_name}/friends")
async def get_player_friends(
    player_name: str, 
    db_service=Depends(get_db_service)
):
    """Get list of friends for a player."""
    try:
        # Validate player_name
        if not player_name or len(player_name) > 50:
            return {"success": False, "message": "Invalid player name"}
        
        player = await db_service.get_player(player_name)
        if not player:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Player not found"}
            )
        
        friends_list = []
        for friend_name in player.get("friends", []):
            friend_data = await db_service.get_player(friend_name)
            if friend_data:
                friends_list.append({
                    "username": friend_data.get("name"),
                    "profile_id": friend_data.get("profile_id"),
                    "games_won": friend_data.get("games_won", 0),
                    "rank": friend_data.get("rank", "Amateur"),
                    "status": "online"  # Placeholder - would need proper presence tracking
                })
        
        return {"success": True, "data": friends_list}
        
    except Exception as e:
        logger.error(f"Get friends error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.post("/friends/add")
async def add_friend(
    request: AddFriendRequest, 
    db_service=Depends(get_db_service),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Add a friend by their Profile ID.
    
    NOTE: This endpoint requires authentication.
    Guest users will receive a 401 error prompting them to sign up.
    """
    # Require authenticated (non-guest) user for friends feature
    require_authenticated_user(current_user)
    try:
        friend = await db_service.get_player_by_profile_id(request.friend_profile_id)
        if not friend:
            return {"success": False, "message": "Player not found with that Profile ID"}
        
        if friend["name"] == request.player_name:
            return {"success": False, "message": "You can't add yourself as a friend!"}
        
        # Add friend both ways (mutual friendship)
        success = await db_service.add_friend(request.player_name, friend["name"])
        if success:
            await db_service.add_friend(friend["name"], request.player_name)
            logger.info(f"👥 {request.player_name} added {friend['name']} as friend")
            return {"success": True, "message": f"Added {friend['name']} as a friend!"}
        
        return {"success": False, "message": "Already friends or could not add friend"}
        
    except Exception as e:
        logger.error(f"Add friend error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.get("/{player_name}/stats")
async def get_player_stats(
    player_name: str, 
    db_service=Depends(get_db_service)
):
    """Get full statistics for a player."""
    try:
        if not player_name or len(player_name) > 50:
            return {"success": False, "message": "Invalid player name"}
        
        player = await db_service.get_player(player_name)
        if player:
            games_played = player.get("games_played", 0)
            games_won = player.get("games_won", 0)
            win_rate = round((games_won / games_played * 100) if games_played > 0 else 0, 1)
            
            return {
                "success": True,
                "data": {
                    "username": player.get("name"),
                    "profile_id": player.get("profile_id"),
                    "games_played": games_played,
                    "games_won": games_won,
                    "win_rate": win_rate,
                    "coin_balance": player.get("coin_balance", 0),
                    "diamonds_balance": player.get("diamonds_balance", 0),
                    "rank": player.get("rank", "Amateur"),
                    "tier": player.get("tier", ""),
                    "stars": player.get("stars", 0)
                }
            }
        
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Player not found"}
        )
        
    except Exception as e:
        logger.error(f"Get player stats error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.get("/leaderboard/{sort_by}")
async def get_leaderboard(
    sort_by: str = "wins", 
    limit: int = 10, 
    db_service=Depends(get_db_service)
):
    """Get leaderboard sorted by specified field."""
    try:
        # Validate sort_by
        valid_sort = {"wins", "coins", "games"}
        if sort_by not in valid_sort:
            sort_by = "wins"
        
        # Limit the limit to prevent abuse
        limit = min(max(1, limit), 100)
        
        players = await db_service.get_leaderboard(sort_by, limit)
        leaderboard = []
        
        for i, p in enumerate(players):
            games = p.get("games_played", 0)
            wins = p.get("games_won", 0)
            winrate = round((wins / games * 100) if games > 0 else 0, 1)
            
            leaderboard.append({
                "rank": i + 1,
                "name": p.get("name", "Anonymous"),
                "wins": wins,
                "games": games,
                "winrate": winrate,
                "coins": p.get("coin_balance", 0),
                "player_rank": p.get("rank", "Amateur"),
                "tier": p.get("tier", "")
            })
        
        return {
            "success": True,
            "data": {
                "sort_by": sort_by,
                "leaderboard": leaderboard
            }
        }
        
    except Exception as e:
        logger.error(f"Get leaderboard error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.get("/{player_name}/quests")
async def get_player_quests(
    player_name: str, 
    db_service=Depends(get_db_service),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Get quests for a player.
    
    NOTE: This endpoint requires authentication.
    Guest users will receive a 401 error prompting them to sign up.
    """
    # Require authenticated (non-guest) user for quests
    require_authenticated_user(current_user)
    try:
        if not player_name or len(player_name) > 50:
            return {"success": False, "message": "Invalid player name"}
        
        player = await db_service.get_player(player_name)
        if not player:
            return {"success": False, "message": "Player not found"}
        
        # Simplified quest system - could be expanded
        claimed = player.get("claimed_quests", [])
        
        # Example quests
        quests = [
            {
                "id": "daily_play",
                "title": "Daily Player",
                "description": "Play 3 games today",
                "reward": {"coins": 100},
                "claimed": "daily_play" in claimed
            },
            {
                "id": "first_win",
                "title": "First Victory",
                "description": "Win your first game",
                "reward": {"coins": 200},
                "claimed": "first_win" in claimed
            }
        ]
        
        return {"success": True, "data": quests}
        
    except Exception as e:
        logger.error(f"Get quests error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.post("/balance")
async def get_player_balance(
    request: PlayerBalanceRequest, 
    db_service=Depends(get_db_service)
):
    """Get balance for a player."""
    try:
        player = await db_service.get_player(request.player_name)
        if player:
            return {
                "success": True,
                "data": {
                    "coin_balance": player.get("coin_balance", 0),
                    "diamonds_balance": player.get("diamonds_balance", 0)
                }
            }
        
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Player not found"}
        )
        
    except Exception as e:
        logger.error(f"Get balance error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.post("/stats")
async def update_player_game_stats(
    request: PlayerStatsRequest, 
    db_service=Depends(get_db_service)
):
    """Update stats after a game (Win or Loss)."""
    try:
        success = await db_service.update_player_stats(request.player_name, request.won)
        if success:
            result = "victory" if request.won else "loss"
            logger.info(f"📊 Stats updated for {request.player_name}: {result}")
            return {"success": True, "message": "Stats updated successfully"}
        
        return {"success": False, "message": "Failed to update stats"}
        
    except Exception as e:
        logger.error(f"Update stats error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )


@router.post("/quests/claim")
async def claim_quest_reward(
    request: ClaimQuestRequest, 
    db_service=Depends(get_db_service),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Claim reward for a completed quest.
    
    NOTE: This endpoint requires authentication.
    Guest users will receive a 401 error prompting them to sign up.
    """
    # Require authenticated (non-guest) user for quests
    require_authenticated_user(current_user)
    try:
        success = await db_service.claim_quest(request.player_name, request.quest_id)
        if success:
            logger.info(f"🎁 Quest claimed: {request.quest_id} by {request.player_name}")
            return {"success": True, "message": "Reward claimed!"}
        
        return {"success": False, "message": "Could not claim reward"}
        
    except Exception as e:
        logger.error(f"Claim quest error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.INTERNAL_ERROR),
                "error_code": ErrorCode.INTERNAL_ERROR.value
            }
        )
