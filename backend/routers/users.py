from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from dependencies import get_db_service
from utils.security import get_current_user

router = APIRouter(prefix="/players", tags=["Players & Social"])

# Models
class PlayerBalanceRequest(BaseModel):
    player_name: str

class PlayerStatsRequest(BaseModel):
    player_name: str
    won: bool

class AddFriendRequest(BaseModel):
    player_name: str
    friend_profile_id: str

class ClaimQuestRequest(BaseModel):
    player_name: str
    quest_id: str

class GameResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@router.get("/profile/{profile_id}")
async def get_player_by_profile_id(profile_id: str, db_service=Depends(get_db_service)):
    """Find a player by their short Profile ID."""
    try:
        player = await db_service.get_player_by_profile_id(profile_id)
        if player:
            return {"success": True, "data": {
                "username": player["name"], "profile_id": player.get("profile_id"),
                "games_played": player.get("games_played", 0), "games_won": player.get("games_won", 0),
                "coin_balance": player.get("coin_balance", 0)
            }}
        raise HTTPException(status_code=404, detail="Player not found")
    except Exception as e: return {"success": False, "message": str(e)}

@router.get("/{player_name}/friends")
async def get_player_friends(player_name: str, db_service=Depends(get_db_service)):
    """Get list of friends for a player."""
    try:
        player = await db_service.get_player(player_name)
        if not player: raise HTTPException(status_code=404, detail="Player not found")
        
        friends_list = []
        for friend_name in player.get("friends", []):
            friend_data = await db_service.get_player(friend_name)
            if friend_data:
                friends_list.append({
                    "username": friend_data["name"], "profile_id": friend_data.get("profile_id"),
                    "games_won": friend_data.get("games_won", 0), "status": "online"
                })
        return {"success": True, "data": friends_list}
    except Exception as e: return {"success": False, "message": str(e)}

@router.post("/friends/add")
async def add_friend(request: AddFriendRequest, db_service=Depends(get_db_service)):
    """Add a friend by their Profile ID."""
    try:
        friend = await db_service.get_player_by_profile_id(request.friend_profile_id)
        if not friend: return {"success": False, "message": "Player not found"}
        if friend["name"] == request.player_name: return {"success": False, "message": "Cannot add yourself"}
            
        success = await db_service.add_friend(request.player_name, friend["name"])
        if success:
            await db_service.add_friend(friend["name"], request.player_name)
            return {"success": True, "message": f"Added {friend['name']} as a friend"}
        return {"success": False, "message": "Already friends or error"}
    except Exception as e: return {"success": False, "message": str(e)}

@router.get("/{player_name}/stats")
async def get_player_stats(player_name: str, db_service=Depends(get_db_service)):
    """Get full statistics for a player."""
    try:
        player = await db_service.get_player(player_name)
        if player:
            return {"success": True, "data": {
                "username": player["name"], "profile_id": player.get("profile_id"),
                "games_played": player.get("games_played", 0), "games_won": player.get("games_won", 0),
                "coin_balance": player.get("coin_balance", 0), "diamonds_balance": player.get("diamonds_balance", 0),
                "rank": player.get("rank", "Amateur"), "tier": player.get("tier", ""), "stars": player.get("stars", 0)
            }}
        raise HTTPException(status_code=404, detail="Player not found")
    except Exception as e: return {"success": False, "message": str(e)}

@router.get("/leaderboard/{sort_by}")
async def get_leaderboard(sort_by: str = "wins", limit: int = 10, db_service=Depends(get_db_service)):
    """Get leaderboard sorted by specified field."""
    try:
        players = await db_service.get_leaderboard(sort_by, limit)
        leaderboard = []
        for i, p in enumerate(players):
            games = p.get("games_played", 0)
            wins = p.get("games_won", 0)
            winrate = round((wins / games * 100) if games > 0 else 0, 1)
            leaderboard.append({
                "rank": i + 1, "name": p.get("name", "Anonymous"), "wins": wins, "games": games,
                "winrate": winrate, "coins": p.get("coin_balance", 0)
            })
        return {"success": True, "data": {"sort_by": sort_by, "leaderboard": leaderboard}}
    except Exception as e: return {"success": False, "message": str(e)}

# Quests & Rewards (from bottom of api.py)
@router.get("/{player_name}/quests")
async def get_player_quests(player_name: str, db_service=Depends(get_db_service)):
    """Get quests for a player."""
    try:
        player = await db_service.get_player(player_name)
        if not player: return {"success": False, "message": "Player not found"}
        claimed = player.get("claimed_quests", [])
        # Hardcoded quests logic here (simplified)
        return {"success": True, "data": []}
    except Exception as e: return {"success": False, "message": str(e)}

@router.post("/balance")
async def get_player_balance(request: PlayerBalanceRequest, db_service=Depends(get_db_service)):
    """Get balance for a player."""
    try:
        player = await db_service.get_player(request.player_name)
        if player:
            return {"success": True, "data": {
                "coin_balance": player.get("coin_balance", 0),
                "diamonds_balance": player.get("diamonds_balance", 0)
            }}
        raise HTTPException(status_code=404, detail="Player not found")
    except Exception as e: return {"success": False, "message": str(e)}

@router.post("/stats")
async def update_player_game_stats(request: PlayerStatsRequest, db_service=Depends(get_db_service)):
    """Update stats after a game (Win or Loss)."""
    try:
        success = await db_service.update_player_stats(request.player_name, request.won)
        if success:
            return {"success": True, "message": "Stats updated successfully"}
        return {"success": False, "message": "Failed to update stats"}
    except Exception as e: return {"success": False, "message": str(e)}

@router.post("/quests/claim")
async def claim_quest_reward(request: ClaimQuestRequest, db_service=Depends(get_db_service)):
    """Claim reward for a completed quest."""
    try:
        success = await db_service.claim_quest(request.player_name, request.quest_id)
        if success: return {"success": True, "message": "Reward claimed"}
        return {"success": False, "message": "Failed to claim"}
    except Exception as e: return {"success": False, "message": str(e)}
