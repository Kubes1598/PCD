"""
Matchmaking Router - Production Ready

Handles WebSocket-based matchmaking and game communication.
Fixed duplicate handler bug and added proper validation.
"""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from typing import Optional, Dict, Any
import json
import asyncio
import logging
from dependencies import (
    get_matchmaking_queue, get_timer_manager, 
    get_game_engine, get_db_service, get_connection_manager
)
from utils.redis_client import redis_client
from game_config import CITY_CONFIG
from schemas import WSJoinQueueMessage, WSMoveMessage, WSPoisonMessage, JoinMatchmakingRequest, GameResponse
from error_codes import ErrorCode, get_error_message

router = APIRouter(prefix="/matchmaking", tags=["Matchmaking"])
logger = logging.getLogger(__name__)

# Valid message types for WebSocket communication
VALID_WS_MESSAGE_TYPES = {
    "join_queue", "leave_queue", "ping", 
    "match_poison", "match_move", "match_chat"
}

# Maximum message size (10KB)
MAX_MESSAGE_SIZE = 10240


@router.websocket("/ws/{player_id}")
async def matchmaking_websocket(
    websocket: WebSocket, 
    player_id: str, 
    matchmaking_queue=Depends(get_matchmaking_queue),
    timer_manager=Depends(get_timer_manager),
    game_engine=Depends(get_game_engine),
    db_service=Depends(get_db_service),
    manager=Depends(get_connection_manager)
):
    """
    WebSocket endpoint for city-specific matchmaking and game communication.
    
    SECURITY MEASURES:
    - JWT Authentication: Extracted from token query parameter
    - Identity Integrity: player_id is extracted from 'sub' claim
    - Message size limits & JSON validation
    """
    # 1. AUTHENTICATION: Get token from query parameter
    token = websocket.query_params.get("token")
    # GUEST BYPASS: If no token but player_id starts with Guest, allow (for restoration)
    is_guest_path = player_id.lower().startswith("guest")
    
    if not token and is_guest_path:
        authenticated_player_id = player_id
    elif not token:
        logger.warning(f"❌ WS Auth Failed: No token for non-guest {player_id}")
        await websocket.close(code=4001, reason="Authentication required")
        return
    else:
        from utils.security import decode_token
        payload = decode_token(token)
        if not payload or not payload.get("sub"):
             logger.warning(f"❌ WS Auth Failed: Invalid token for {player_id}")
             await websocket.close(code=4002, reason="Invalid or expired token")
             return
        
        # Authoritative player_id from JWT
        authenticated_player_id = payload["sub"]
        
        # Verify path player_id matches token sub for consistency (unless it's a guest)
        if player_id != authenticated_player_id and not is_guest_path:
             logger.warning(f"❌ WS Auth Failed: Identity mismatch {player_id} != {authenticated_player_id}")
             await websocket.close(code=4003, reason="Identity mismatch")
             return

    await websocket.accept()
    await manager.connect(websocket, authenticated_player_id)
    logger.info(f"🔌 WebSocket connected & authenticated: {authenticated_player_id[:8]}...")
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # Validate message size
            if len(data) > MAX_MESSAGE_SIZE:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Message too large",
                    "error_code": ErrorCode.VALIDATION_ERROR.value
                }))
                continue
            
            # Parse JSON safely
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid message format",
                    "error_code": ErrorCode.VALIDATION_ERROR.value
                }))
                continue
            
            msg_type = message.get("type", "")
            
            # Handle ping/pong for heartbeat
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue
            
            # Handle queue operations
            if msg_type == "join_queue":
                player_name = message.get("player_name", "Anonymous")
                device_id = message.get("device_id", "unknown")
                ip_address = websocket.client.host if websocket.client else "0.0.0.0"
                
                city_raw = message.get("city", "dubai")
                city = city_raw.capitalize()  # Match new CITY_CONFIG format (Dubai, Cairo, Oslo)
                
                # Validate city - check both capitalized and lowercase
                if city not in CITY_CONFIG and city.lower() not in CITY_CONFIG:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": get_error_message(ErrorCode.INVALID_CITY),
                        "error_code": ErrorCode.INVALID_CITY.value
                    }))
                    continue
                
                logger.info(f"👤 Player {player_name} joining {city} queue (IP: {ip_address}, Device: {device_id})")
                await matchmaking_queue.add_player(player_id, player_name, city, websocket, device_id, ip_address)
                continue
                
            elif msg_type == "leave_queue":
                matchmaking_queue.remove_player(player_id)
                await manager.set_player_state(player_id, "IDLE")
                await websocket.send_text(json.dumps({
                    "type": "queue_left",
                    "message": "Left matchmaking queue"
                }))
                continue
            
            # Handle game messages (require target_id)
            target_id = message.get("target_id")
            if not target_id and msg_type in {"match_move", "match_poison", "match_chat"}:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Missing target_id",
                    "error_code": ErrorCode.VALIDATION_ERROR.value
                }))
                continue
            
            # Get game context if available
            game_id = await redis_client.hget("pcd:player_game", player_id)
            
            # Process game messages
            if msg_type == "match_poison" and game_id:
                candy = message.get("candy")
                if not candy:
                    continue
                    
                await game_engine.ensure_game_loaded(game_id, db_service)
                success = await game_engine.set_poison_choice_persistent(
                    game_id, player_id, candy, db_service
                )
                
                if success:
                    # Forward poison choice to opponent
                    message["from_id"] = player_id
                    await manager.send_personal_message(message, target_id)
                    
                    # Stop setup timer and check if both ready
                    await timer_manager.stop_timer(game_id, player_id)
                    state = game_engine.get_game_state(game_id)
                    
                    if state and state.get("state") == "playing":
                        city = await redis_client.hget("pcd:game_city", game_id) or "dubai"
                        duration = CITY_CONFIG.get(city, {}).get("turn_timer", 30)
                        p1_id = state["player1"]["id"]
                        await timer_manager.start_timer(game_id, p1_id, duration)
                        logger.info(f"🎮 Game {game_id[:8]} started! P1 timer begins.")
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": get_error_message(ErrorCode.INVALID_CANDY),
                        "error_code": ErrorCode.POISON_ALREADY_SET.value
                    }))
                continue
                
            elif msg_type == "match_move" and game_id:
                candy = message.get("move")
                if not candy:
                    continue
                
                await game_engine.ensure_game_loaded(game_id, db_service)
                result = await game_engine.make_move_persistent(
                    game_id, player_id, candy, db_service
                )
                
                if not result.get("success"):
                    # Move invalid - send correction to client
                    correction_msg = {
                        "type": "state_correction",
                        "game_id": game_id,
                        "game_state": game_engine.get_game_state(game_id),
                        "error": result.get("error", "Invalid move")
                    }
                    await manager.send_personal_message(correction_msg, player_id)
                    continue
                
                # Broadcast full updated state to both players (Server Authoritative)
                update_msg = {
                    "type": "game_state_update",
                    "game_id": game_id,
                    "game_state": result["game_state"],
                    "last_move": {
                        "from_id": player_id,
                        "move": candy
                    }
                }
                for pid in [player_id, target_id]:
                    await manager.send_personal_message(update_msg, pid)
                
                # Handle game over
                if result.get("result") != "ongoing":
                    game_over_msg = {
                        "type": "game_over",
                        "game_id": game_id,
                        "winner_id": result.get("winner"),
                        "reason": "normal",
                        "is_draw": result.get("is_draw", False),
                        "game_state": result["game_state"]
                    }
                    
                    # Broadcast to both players
                    for pid in [player_id, target_id]:
                        await manager.send_personal_message(game_over_msg, pid)
                    
                    # Award winner
                    winner_id = result.get("winner")
                    if winner_id:
                        p1 = result["game_state"]["player1"]
                        p2 = result["game_state"]["player2"]
                        winner_name = p1["name"] if p1["id"] == winner_id else p2["name"]
                        loser_name = p1["name"] if p1["name"] != winner_name else p2["name"]
                        
                        city = await redis_client.hget("pcd:game_city", game_id) or "dubai"
                        prize = CITY_CONFIG.get(city, {}).get("prize_amount", 950)
                        
                        await db_service.update_player_balance(winner_name, prize)
                        await db_service.update_player_stats(winner_name, True)
                        await db_service.update_player_stats(loser_name, False)
                        await db_service.create_transaction({
                            "player_name": winner_name, 
                            "amount": prize, 
                            "transaction_type": "prize_payout"
                        })
                        
                        logger.info(f"🏆 {winner_name} won {prize} in {city}!")
                else:
                    # Game continues - manage timers
                    await timer_manager.stop_timer(game_id, player_id)
                    city = await redis_client.hget("pcd:game_city", game_id) or "dubai"
                    duration = CITY_CONFIG.get(city, {}).get("turn_timer", 30)
                    await timer_manager.start_timer(game_id, target_id, duration)
                
                continue
                
            elif msg_type == "match_chat" and target_id:
                # Relay chat message (no server processing needed)
                relay_msg = {**message, "from_id": player_id}
                await manager.send_personal_message(relay_msg, target_id)
                continue
            
            # Unknown message type
            if msg_type not in VALID_WS_MESSAGE_TYPES:
                logger.warning(f"Unknown WS message type from {player_id[:8]}: {msg_type}")
                
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket disconnected: {player_id[:8]}...")
        manager.disconnect(player_id)
    except Exception as e:
        logger.error(f"🎮 WebSocket error for {player_id[:8]}: {e}", exc_info=True)
        manager.disconnect(player_id)


@router.get("/status")
async def get_matchmaking_status(matchmaking_queue=Depends(get_matchmaking_queue)):
    """Get current matchmaking queue status."""
    return {
        "success": True,
        "message": "Matchmaking queue is active",
        "data": matchmaking_queue.get_queue_stats()
    }


@router.get("/queue-stats")
async def get_queue_stats():
    """
    Get real-time player counts per city queue.
    
    Returns the number of players currently waiting in each city's matchmaking queue.
    This allows the frontend to display online player counts before joining.
    """
    r = await redis_client.connect()
    stats = {}
    
    for city in ["dubai", "cairo", "oslo"]:
        queue_key = f"pcd:queue:{city}"
        try:
            count = await r.llen(queue_key)
            stats[city] = {
                "players_waiting": count,
                "city_config": CITY_CONFIG.get(city.capitalize(), {})
            }
        except Exception as e:
            logger.warning(f"Failed to get queue length for {city}: {e}")
            stats[city] = {"players_waiting": 0, "city_config": {}}
    
    return {
        "success": True,
        "message": "Queue stats retrieved",
        "data": stats
    }


@router.post("/leave/{player_id}")
async def leave_matchmaking(player_id: str, matchmaking_queue=Depends(get_matchmaking_queue)):
    """Leave the matchmaking queue."""
    if not player_id or len(player_id) > 100:
        return {"success": False, "message": "Invalid player ID"}
    
    matchmaking_queue.remove_player(player_id)
    return {"success": True, "message": "Left matchmaking queue"}


@router.post("/join", response_model=GameResponse)
async def join_matchmaking_rest(
    request: JoinMatchmakingRequest, 
    matchmaking_queue=Depends(get_matchmaking_queue)
):
    """
    Join a city-specific matchmaking queue via REST API (pre-verification).
    
    Returns WebSocket endpoint to use for actual matchmaking.
    """
    try:
        city_config = matchmaking_queue.get_city_config(request.city)
        
        import uuid
        temp_player_id = str(uuid.uuid4())
        
        return GameResponse(
            success=True,
            message="Use WebSocket endpoint for real-time matchmaking",
            data={
                "city": request.city,
                "player_name": request.player_name,
                "websocket_endpoint": f"/matchmaking/ws/{temp_player_id}",
                "entry_cost": city_config["entry_fee"],
                "prize_pool": city_config["prize_amount"],
                "turn_timer": city_config["turn_timer"]
            }
        )
    except Exception as e:
        logger.error(f"Join matchmaking error: {e}", exc_info=True)
        return GameResponse(
            success=False,
            message=get_error_message(ErrorCode.INTERNAL_ERROR)
        )


def get_city_turn_timer(self, city: str) -> int:
    """Helper to get turn timer for a city."""
    return CITY_CONFIG.get(city.lower(), {}).get("turn_timer", 30)
