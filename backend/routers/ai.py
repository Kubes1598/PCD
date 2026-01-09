import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/ai", tags=["AI"])

class AIMoveRequest(BaseModel):
    player_candies: List[str]
    opponent_collection: List[str]
    player_poison: str
    difficulty: str = "medium"

class AIMoveResponse(BaseModel):
    choice: str

@router.post("/move", response_model=AIMoveResponse)
async def get_ai_move(request: AIMoveRequest):
    """Calculate the best move for the AI opponent."""
    try:
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
