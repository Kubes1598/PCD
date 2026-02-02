"""
Game Router - Production Ready

Handles game creation, poison selection, and candy picking.
Uses proper validation and never exposes internal errors.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import time
import logging
from dependencies import get_game_engine, get_db_service, get_matchmaking_queue
from utils.security import get_current_user
from schemas import (
    CreateGameRequest, SetPoisonRequest, PickCandyRequest,
    CandySelectionRequest, GameStartRequest, GameResponse,
    JoinMatchmakingRequest
)
from error_codes import ErrorCode, get_error_message
from game_config import AI_CONFIG
import uuid
import random
import logging

router = APIRouter(prefix="/games", tags=["Gameplay"])
logger = logging.getLogger(__name__)


@router.post("", response_model=GameResponse)
async def create_game(
    request: CreateGameRequest, 
    game_engine=Depends(get_game_engine), 
    db_service=Depends(get_db_service)
):
    """Create a new game between two players."""
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
        
        logger.info(f"🎮 Game created: {game_id[:8]}...")
        
        return GameResponse(
            success=True, 
            message="Game created successfully", 
            data={"game_id": game_id, "game_state": game_state}
        )
    except Exception as e:
        logger.error(f"Create game error: {e}", exc_info=True)
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.INTERNAL_ERROR)
        )


@router.post("/ai", response_model=GameResponse)
async def create_ai_game(
    difficulty: str = "easy",
    game_engine=Depends(get_game_engine), 
    db_service=Depends(get_db_service),
    user: dict = Depends(get_current_user)
):
    """Create a new game against the AI authoritatively."""
    try:
        # 1. Get AI config for fees
        diff_lower = difficulty.lower()
        config = AI_CONFIG.get(diff_lower, AI_CONFIG["easy"])
        fee = config.get("entry_fee", 0)
        
        # 2. Identity info
        player_name = user.get("username", user.get("name", "Player"))
        player_id = user.get("id")
        ai_id = "computer_ai" # Reserved ID for AI
        ai_name = "Computer"
        
        # 3. Generate engine state
        game_id = str(uuid.uuid4())
        initial_state = game_engine.generate_initial_state(player_name, ai_name, player_id, ai_id)
        
        # 3b. Authoritatively pre-select AI poison
        ai_pool = initial_state["player2"]["owned_candies"]
        ai_poison = random.choice(list(ai_pool))
        
        # 4. Atomic balance check & deduction (if fee > 0)
        if fee > 0:
            success = await db_service.update_player_balance(
                player_name, -fee, 
                transaction_type="game_entry", 
                arena_type=f"ai_{diff_lower}",
                game_id=game_id,
                description=f"AI Duel Entry ({difficulty})"
            )
            if not success:
                return GameResponse(success=False, message="Insufficient coins to start AI game.")

        # 5. Persist to Database
        await db_service.create_game({
            "id": game_id,
            "player1_id": player_id,
            "player2_id": ai_id,
            "player1_name": player_name,
            "player2_name": ai_name,
            "game_state": initial_state,
            "p2_poison": ai_poison, # Set secret column
            "status": "waiting_for_poison"
        })
        
        # 6. Load in Active Engine
        game_engine.load_game_from_data({
            "id": game_id,
            "game_state": initial_state,
            "p2_poison": ai_poison
        })
        
        # Sync the engine's internal state for Player 2
        game_engine.set_poison_choice(game_id, ai_id, ai_poison)

        logger.info(f"🤖 AI Game created: {game_id[:8]} for {player_name} (AI Poison: {ai_poison})")
        
        return GameResponse(
            success=True,
            message="AI Game created",
            data={
                "game_id": game_id, 
                "game_state": game_engine.get_game_state(game_id),
                "opponent_poison": ai_poison # Required for existing local AI logic
            }
        )
    except Exception as e:
        logger.error(f"AI Game creation error: {e}", exc_info=True)
        return GameResponse(success=False, message="Failed to initialize AI session.")
@router.post("/{game_id}/poison", response_model=GameResponse)
async def set_poison(
    game_id: str, 
    request: SetPoisonRequest, 
    game_engine=Depends(get_game_engine), 
    db_service=Depends(get_db_service),
    user: dict = Depends(get_current_user)
):
    """Set poison choice for a player."""
    try:
        # Validate game_id length
        if not game_id or len(game_id) > 100:
            return GameResponse(
                success=False, 
                message=get_error_message(ErrorCode.GAME_NOT_FOUND)
            )
        
        await game_engine.ensure_game_loaded(game_id, db_service)
        
        # Check if game exists
        game_state = game_engine.get_game_state(game_id)
        if not game_state:
            return GameResponse(
                success=False, 
                message=get_error_message(ErrorCode.GAME_NOT_FOUND)
            )
        
        # SECURITY: Verify player ID from JWT matches request and is in this game
        user_id = user.get("id")
        p1_id = game_state.get("player1", {}).get("id")
        p2_id = game_state.get("player2", {}).get("id")
        
        if user_id != request.player_id:
             return GameResponse(
                success=False,
                message="Operation not permitted: Identity mismatch."
            )

        if user_id not in [p1_id, p2_id]:
            return GameResponse(
                success=False,
                message=get_error_message(ErrorCode.PLAYER_NOT_IN_GAME)
            )
        
        success = await game_engine.set_poison_choice_persistent(
            game_id, user_id, request.poison_candy, db_service
        )
        
        if not success:
            return GameResponse(
                success=False, 
                message=get_error_message(ErrorCode.POISON_ALREADY_SET)
            )
        
        game_state = game_engine.get_game_state(game_id)
        
        # Handle AI opponent auto-selection
        if game_state:
            ai_names = ["AI Assistant", "AI Opponent", "AI", "Computer", "Online Opponent", "Opponent", "Friend"]
            for p in ["player1", "player2"]:
                player = game_state[p]
                if player["name"] in ai_names and not player.get("has_set_poison"):
                    ai_poison = random.choice(list(player["owned_candies"]))
                    await game_engine.set_poison_choice_persistent(
                        game_id, player["id"], ai_poison, db_service
                    )
            game_state = game_engine.get_game_state(game_id)
        
        return GameResponse(
            success=True, 
            message="Poison choice set successfully", 
            data={"game_state": game_state}
        )
        
    except Exception as e:
        logger.error(f"Set poison error: {e}", exc_info=True)
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.INTERNAL_ERROR)
        )


@router.post("/{game_id}/pick", response_model=GameResponse)
async def pick_candy(
    game_id: str, 
    request: PickCandyRequest, 
    game_engine=Depends(get_game_engine), 
    db_service=Depends(get_db_service),
    user: dict = Depends(get_current_user)
):
    """Pick a candy from opponent's pool."""
    try:
        game_state = game_engine.get_game_state(game_id)
        if not game_state:
            return GameResponse(
                success=False, 
                message=get_error_message(ErrorCode.GAME_NOT_FOUND)
            )
        
        # Resolve player ID and SECURITY check
        user_id = user.get("id")
        p1_id = game_state["player1"]["id"]
        p2_id = game_state["player2"]["id"]
        
        # Map convenience roles ('player1'/'player2') to actual IDs
        target_player_id = request.player
        if target_player_id == 'player1': target_player_id = p1_id
        elif target_player_id == 'player2': target_player_id = p2_id

        if user_id != target_player_id:
            return GameResponse(
                success=False,
                message="Operation not permitted: Identity mismatch."
            )

        if user_id not in [p1_id, p2_id]:
            return GameResponse(
                success=False,
                message=get_error_message(ErrorCode.PLAYER_NOT_IN_GAME)
            )
        
        await game_engine.ensure_game_loaded(game_id, db_service)
        result = await game_engine.make_move_persistent(
            game_id, user_id, request.candy_choice, db_service
        )
        
        if not result.get("success", False):
            error_msg = result.get("error", "")
            if "not your turn" in error_msg.lower():
                return GameResponse(
                    success=False, 
                    message=get_error_message(ErrorCode.NOT_YOUR_TURN)
                )
            elif "not available" in error_msg.lower():
                return GameResponse(
                    success=False,
                    message=get_error_message(ErrorCode.CANDY_NOT_AVAILABLE)
                )
            return GameResponse(
                success=False, 
                message=get_error_message(ErrorCode.INVALID_CANDY)
            )
        
        updated_state = game_engine.get_game_state(game_id)
        game_result = result.get("game_result", "ongoing")
        
        # Handle game end - award prizes
        if game_result == "win":
            winner_name = updated_state.get("winner")
            if winner_name:
                prize = updated_state.get("prize_pool", 950)
                city = updated_state.get("city", "dubai")
                try:
                    await db_service.update_player_balance(winner_name, prize, 0)
                    await db_service.create_transaction({
                        "player_name": winner_name,
                        "game_id": game_id,
                        "transaction_type": "prize_payout",
                        "amount": prize,
                        "description": f"Victory in {city.title()}"
                    })
                    await db_service.update_player_stats(winner_name, True)
                    logger.info(f"🏆 {winner_name} won {prize} coins!")
                except Exception as e:
                    logger.error(f"Prize award error: {e}", exc_info=True)
        
        return GameResponse(
            success=True, 
            message="Move successful", 
            data={
                "game_state": updated_state, 
                "result": game_result, 
                "picked_poison": result.get("picked_poison", False)
            }
        )
        
    except Exception as e:
        logger.error(f"Pick candy error: {e}", exc_info=True)
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.INTERNAL_ERROR)
        )


@router.get("/{game_id}/state", response_model=GameResponse)
async def get_game_state_endpoint(
    game_id: str, 
    game_engine=Depends(get_game_engine), 
    db_service=Depends(get_db_service)
):
    """Get current game state."""
    try:
        await game_engine.ensure_game_loaded(game_id, db_service)
        state = game_engine.get_game_state(game_id)
        
        if not state:
            return GameResponse(
                success=False, 
                message=get_error_message(ErrorCode.GAME_NOT_FOUND)
            )
        
        return GameResponse(
            success=True, 
            message="Game state retrieved", 
            data={"game_state": state}
        )
    except Exception as e:
        logger.error(f"Get game state error: {e}", exc_info=True)
        return GameResponse(
            success=False,
            message=get_error_message(ErrorCode.INTERNAL_ERROR)
        )


@router.delete("/{game_id}")
async def delete_game(
    game_id: str, 
    game_engine=Depends(get_game_engine),
    user: dict = Depends(get_current_user)
):
    """Delete a game (requires authentication)."""
    # Only allow deletion if user is a player in the game
    game_state = game_engine.get_game_state(game_id)
    if not game_state:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.GAME_NOT_FOUND),
                "error_code": ErrorCode.GAME_NOT_FOUND.value
            }
        )
    
    # Security check - user must be a player
    user_id = user.get("id")
    p1_id = game_state.get("player1", {}).get("id")
    p2_id = game_state.get("player2", {}).get("id")
    
    if user_id not in [p1_id, p2_id]:
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "message": get_error_message(ErrorCode.PLAYER_NOT_IN_GAME),
                "error_code": ErrorCode.PLAYER_NOT_IN_GAME.value
            }
        )
    
    if game_id in game_engine.games:
        del game_engine.games[game_id]
        logger.info(f"🗑️ Game deleted: {game_id[:8]}...")
        return {"success": True, "message": "Game deleted successfully"}
    
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "message": get_error_message(ErrorCode.GAME_NOT_FOUND),
            "error_code": ErrorCode.GAME_NOT_FOUND.value
        }
    )


@router.post("/candy/select", response_model=GameResponse)
async def select_candy(
    request: CandySelectionRequest, 
    game_engine=Depends(get_game_engine)
):
    """Submit candy selection for confirmation."""
    game_state = game_engine.get_game_state(request.game_id)
    if not game_state:
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.GAME_NOT_FOUND)
        )
    
    # Validate player is in game
    p1_id = game_state.get("player1", {}).get("id")
    p2_id = game_state.get("player2", {}).get("id")
    
    if request.player_id == p1_id:
        game_state["player1"]["selected_candy"] = request.candy_id
        game_state["player1"]["candy_confirmed"] = True
    elif request.player_id == p2_id:
        game_state["player2"]["selected_candy"] = request.candy_id
        game_state["player2"]["candy_confirmed"] = True
    else:
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.PLAYER_NOT_IN_GAME)
        )
    
    game_engine.update_game_state(request.game_id, game_state)
    
    both_confirmed = (
        game_state.get("player1", {}).get("candy_confirmed") and 
        game_state.get("player2", {}).get("candy_confirmed")
    )
    
    if both_confirmed:
        game_state["status"] = "ready_for_game_start"
        game_engine.update_game_state(request.game_id, game_state)
        
    return GameResponse(
        success=True, 
        message="Candy selection confirmed", 
        data={
            "game_id": request.game_id, 
            "both_players_ready": both_confirmed
        }
    )


@router.get("/status/{game_id}")
async def get_status_endpoint(
    game_id: str, 
    game_engine=Depends(get_game_engine)
):
    """Check game status including opponent's readiness."""
    state = game_engine.get_game_state(game_id)
    if not state:
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.GAME_NOT_FOUND)
        )
    
    return GameResponse(
        success=True, 
        message="Status retrieved", 
        data={
            "game_id": game_id,
            "status": state.get("status", "unknown"),
            "player1": state.get("player1"),
            "player2": state.get("player2"),
            "game_started": state.get("game_started", False)
        }
    )


@router.post("/start", response_model=GameResponse)
async def start_game(
    request: GameStartRequest, 
    game_engine=Depends(get_game_engine), 
    matchmaking_queue=Depends(get_matchmaking_queue)
):
    """Signal game start and timer initialization."""
    state = game_engine.get_game_state(request.game_id)
    if not state:
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.GAME_NOT_FOUND)
        )
    
    p1_id = state.get("player1", {}).get("id")
    p2_id = state.get("player2", {}).get("id")
    
    if request.player_id == p1_id:
        state["player1"]["ready_for_game_start"] = True
    elif request.player_id == p2_id:
        state["player2"]["ready_for_game_start"] = True
    else:
        return GameResponse(
            success=False, 
            message=get_error_message(ErrorCode.PLAYER_NOT_IN_GAME)
        )
    
    both_ready = (
        state.get("player1", {}).get("ready_for_game_start") and 
        state.get("player2", {}).get("ready_for_game_start")
    )
    
    if both_ready and not state.get("game_started", False):
        state["game_started"] = True
        state["timer_started"] = True
        state["game_start_time"] = time.time()
        state["status"] = "active"
        city = state.get("city", "dubai")
        state["turn_timer_seconds"] = matchmaking_queue.get_city_turn_timer(city)
        logger.info(f"🎮 Game started: {request.game_id[:8]}...")
        
    game_engine.update_game_state(request.game_id, state)
    
    return GameResponse(
        success=True, 
        message="Signal processed", 
        data={
            "game_id": request.game_id, 
            "game_started": state.get("game_started", False)
        }
    )
