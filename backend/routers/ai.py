from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import logging
from dependencies import get_game_engine, get_db_service
from utils.security import get_current_user
from fastapi import APIRouter, HTTPException, Depends

router = APIRouter(prefix="/ai", tags=["AI"])

import random
logger = logging.getLogger(__name__)

class AIMoveRequest(BaseModel):
    player_candies: List[str]
    opponent_collection: List[str]
    player_poison: str
    difficulty: str = "medium"
    game_id: Optional[str] = None

class AIMoveResponse(BaseModel):
    choice: str

@router.post("/move", response_model=AIMoveResponse)
async def get_ai_move(
    request: AIMoveRequest, 
    user: dict = Depends(get_current_user),
    game_engine=Depends(get_game_engine),
    db_service=Depends(get_db_service)
):
    """Calculate the best move for the AI opponent."""
    try:
        # SECURITY: If game_id is provided, verify it's an AI session
        if request.game_id:
            await game_engine.ensure_game_loaded(request.game_id, db_service)
            game = game_engine.games.get(request.game_id)
            if not game:
                raise HTTPException(status_code=404, detail="Game session not found")
            
            # Verify user is in this game
            if user.get("id") not in [game.player1.id, game.player2.id]:
                raise HTTPException(status_code=403, detail="Not authorized for this game session")
            
            # Verify it's actually an AI game (Player 2 is 'computer_ai')
            if game.player2.id != "computer_ai":
                 # Log attempt to use AI route for p2p game
                 logger.warning(f"⚠️ User {user.get('id')} attempted AI move simulation for P2P game {request.game_id}")
                 raise HTTPException(status_code=403, detail="AI assistance is not permitted in PvP duels")

        # Available candies in the player's pool (that the AI can pick)
        avail = [c for c in request.player_candies if c not in request.opponent_collection]
        
        if not avail:
            raise HTTPException(status_code=400, detail="No candies available to pick")
            
        # Candies that are NOT the player's poison
        non_poison = [c for c in avail if c != request.player_poison]
        
        # Difficulty probability
        prob_map = {"hard": 1.0, "medium": 0.9, "easy": 0.7}
        prob = prob_map.get(request.difficulty.lower(), 0.9)
        
        # AI decision logic
        if non_poison and random.random() < prob:
            choice = random.choice(non_poison)
        else:
            choice = random.choice(avail)
            
        return AIMoveResponse(choice=choice)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"AI Move calculation error: {e}")
        raise HTTPException(status_code=500, detail="Internal AI error")
