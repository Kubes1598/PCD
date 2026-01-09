from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
from dependencies import get_game_engine, get_db_service, get_matchmaking_queue
from utils.security import get_current_user

router = APIRouter(prefix="/games", tags=["Gameplay"])

# Models
class CreateGameRequest(BaseModel):
    player1_name: str
    player2_name: str

class SetPoisonRequest(BaseModel):
    player_id: str
    poison_candy: str

class PickCandyRequest(BaseModel):
    player: str
    candy_choice: str

class CandySelectionRequest(BaseModel):
    player_id: str
    candy_id: str
    game_id: str

class GameStartRequest(BaseModel):
    game_id: str
    player_id: str

class GameResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# Endpoints
@router.post("", response_model=GameResponse)
async def create_game(request: CreateGameRequest, game_engine=Depends(get_game_engine), db_service=Depends(get_db_service)):
    """Create a new game."""
    try:
        game_id = game_engine.create_game(request.player1_name, request.player2_name)
        game_state = game_engine.get_game_state(game_id)
        
        await db_service.create_game({
            "id": game_id,
            "player1_name": request.player1_name,
            "player2_name": request.player2_name,
            "game_state": game_state,
            "status": "waiting_for_poison"
        })
        
        return GameResponse(success=True, message="Game created successfully", data={"game_id": game_id, "game_state": game_state})
    except Exception as e:
        return GameResponse(success=False, message=f"Failed to create game: {str(e)}")

@router.post("/{game_id}/poison", response_model=GameResponse)
async def set_poison(game_id: str, request: SetPoisonRequest, game_engine=Depends(get_game_engine), db_service=Depends(get_db_service)):
    """Set poison choice for a player."""
    await game_engine.ensure_game_loaded(game_id, db_service)
    success = await game_engine.set_poison_choice_persistent(game_id, request.player_id, request.poison_candy, db_service)
    if not success:
        return GameResponse(success=False, message="Failed to set poison choice")
    
    game_state = game_engine.get_game_state(game_id)
    if game_state:
        # AI Handling (Simplified for Phase 1)
        ai_names = ["AI Assistant", "AI Opponent", "AI", "Computer", "Online Opponent", "Opponent", "Friend"]
        for p in ["player1", "player2"]:
            player = game_state[p]
            if player["name"] in ai_names and not player["has_set_poison"]:
                import random
                ai_poison = random.choice(list(player["owned_candies"]))
                await game_engine.set_poison_choice_persistent(game_id, player["id"], ai_poison, db_service)
        game_state = game_engine.get_game_state(game_id)
        
        # Persistence handled by engine
        pass
    
    return GameResponse(success=True, message="Poison choice set successfully", data={"game_state": game_state})

@router.post("/{game_id}/pick", response_model=GameResponse)
async def pick_candy(game_id: str, request: PickCandyRequest, game_engine=Depends(get_game_engine), db_service=Depends(get_db_service)):
    """Pick a candy from opponent's pool."""
    game_state = game_engine.get_game_state(game_id)
    if not game_state:
        return GameResponse(success=False, message="Game not found")
    
    player_id = request.player
    if request.player == 'player1': player_id = game_state["player1"]["id"]
    elif request.player == 'player2': player_id = game_state["player2"]["id"]
    
    await game_engine.ensure_game_loaded(game_id, db_service)
    result = await game_engine.make_move_persistent(game_id, player_id, request.candy_choice, db_service)
    if not result.get("success", False):
        return GameResponse(success=False, message=result.get("error", "Failed to make move"))
    
    updated_state = game_engine.get_game_state(game_id)
    game_result = result.get("game_result", "ongoing")
    
    if game_result == "win":
        winner_name = updated_state.get("winner")
        if winner_name:
            prize = updated_state.get("prize_pool", 950)
            city = updated_state.get("city", "dubai")
            try:
                await db_service.update_player_balance(winner_name, prize, 0)
                await db_service.create_transaction({
                    "player_name": winner_name, "game_id": game_id, "transaction_type": "prize_payout",
                    "amount": prize, "description": f"Victory in {city.title()}", "arena_type": city
                })
            except Exception as e: print(f"Error: {e}")
            
    return GameResponse(success=True, message="Move successful", data={"game_state": updated_state, "result": game_result, "picked_poison": result.get("picked_poison", False)})

@router.get("/{game_id}/state", response_model=GameResponse)
async def get_game_state_endpoint(game_id: str, game_engine=Depends(get_game_engine), db_service=Depends(get_db_service)):
    """Get current game state."""
    await game_engine.ensure_game_loaded(game_id, db_service)
    state = game_engine.get_game_state(game_id)
    if not state:
        return GameResponse(success=False, message="Game not found")
    return GameResponse(success=True, message="Game state retrieved", data={"game_state": state})

@router.delete("/{game_id}")
async def delete_game(game_id: str, game_engine=Depends(get_game_engine)):
    """Delete a game."""
    if game_id in game_engine.games:
        del game_engine.games[game_id]
        return {"message": "Game deleted successfully"}
    raise HTTPException(status_code=404, detail="Game not found")

# Additional game endpoints from bottom of api.py
@router.post("/candy/select", response_model=GameResponse)
async def select_candy(request: CandySelectionRequest, game_engine=Depends(get_game_engine)):
    """Submit candy selection for confirmation."""
    game_state = game_engine.get_game_state(request.game_id)
    if not game_state: return GameResponse(success=False, message="Game not found")
    
    if request.player_id == game_state.get("player1", {}).get("id"):
        game_state["player1"]["selected_candy"] = request.candy_id
        game_state["player1"]["candy_confirmed"] = True
    elif request.player_id == game_state.get("player2", {}).get("id"):
        game_state["player2"]["selected_candy"] = request.candy_id
        game_state["player2"]["candy_confirmed"] = True
    else: return GameResponse(success=False, message="Player not found in game")
    
    game_engine.update_game_state(request.game_id, game_state)
    both_confirmed = game_state.get("player1", {}).get("candy_confirmed") and game_state.get("player2", {}).get("candy_confirmed")
    if both_confirmed:
        game_state["status"] = "ready_for_game_start"
        game_engine.update_game_state(request.game_id, game_state)
        
    return GameResponse(success=True, message="Candy selection confirmed", data={"game_id": request.game_id, "both_players_ready": both_confirmed})

@router.get("/status/{game_id}")
async def get_status_endpoint(game_id: str, game_engine=Depends(get_game_engine)):
    """Check game status including opponent's readiness."""
    state = game_engine.get_game_state(game_id)
    if not state: return GameResponse(success=False, message="Game not found")
    
    return GameResponse(success=True, message="Status retrieved", data={
        "game_id": game_id, "status": state.get("status", "unknown"),
        "player1": state.get("player1"), "player2": state.get("player2"),
        "game_started": state.get("game_started", False)
    })

@router.post("/start", response_model=GameResponse)
async def start_game(request: GameStartRequest, game_engine=Depends(get_game_engine), matchmaking_queue=Depends(get_matchmaking_queue)):
    """Signal game start and timer initialization."""
    state = game_engine.get_game_state(request.game_id)
    if not state: return GameResponse(success=False, message="Game not found")
    
    if request.player_id == state.get("player1", {}).get("id"): state["player1"]["ready_for_game_start"] = True
    elif request.player_id == state.get("player2", {}).get("id"): state["player2"]["ready_for_game_start"] = True
    else: return GameResponse(success=False, message="Player not in game")
    
    both_ready = state.get("player1", {}).get("ready_for_game_start") and state.get("player2", {}).get("ready_for_game_start")
    if both_ready and not state.get("game_started", False):
        state["game_started"] = True
        state["timer_started"] = True
        state["game_start_time"] = time.time()
        state["status"] = "active"
        city = state.get("city", "dubai")
        state["turn_timer_seconds"] = matchmaking_queue.get_city_turn_timer(city)
        
    game_engine.update_game_state(request.game_id, state)
    return GameResponse(success=True, message="Signal processed", data={"game_id": request.game_id, "game_started": state.get("game_started", False)})
