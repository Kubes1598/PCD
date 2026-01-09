from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import asyncio
from dependencies import get_matchmaking_queue, get_timer_manager, get_game_engine, get_db_service
from utils.redis_client import redis_client

router = APIRouter(prefix="/matchmaking", tags=["Matchmaking"])

class JoinMatchmakingCityRequest(BaseModel):
    """Request model for joining city-specific matchmaking queue."""
    player_name: str
    city: str

class GameResponse(BaseModel):
    """Response model for game-related API calls."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

@router.websocket("/ws/{player_id}")
async def matchmaking_websocket(
    websocket: WebSocket, 
    player_id: str, 
    matchmaking_queue=Depends(get_matchmaking_queue),
    timer_manager=Depends(get_timer_manager),
    game_engine=Depends(get_game_engine),
    db_service=Depends(get_db_service)
):
    """WebSocket endpoint for city-specific matchmaking."""
    await websocket.accept()
    print(f"🎮 WebSocket connected for player {player_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "join_queue":
                player_name = message.get("player_name", "Anonymous")
                city = message.get("city", "dubai")
                await matchmaking_queue.add_player(player_id, player_name, city, websocket)
                
            elif message.get("type") == "leave_queue":
                matchmaking_queue.remove_player(player_id)
                
            elif message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            
            elif "target_id" in message:
                target_id = message.get("target_id")
                msg_type = message.get("type")
                
                # Authoritative Game Logic in WebSocket
                game_id = await redis_client.hget("pcd:player_game", player_id)
                if game_id:
                    await game_engine.ensure_game_loaded(game_id, db_service)
                    
                    if msg_type == "match_poison":
                        candy = message.get("candy")
                        success = await game_engine.set_poison_choice_persistent(game_id, player_id, candy, db_service)
                        if not success: continue # Ignore invalid poison
                        
                    elif msg_type == "match_move":
                        candy = message.get("move")
                        result = await game_engine.make_move_persistent(game_id, player_id, candy, db_service)
                        if not result.get("success"): continue # Ignore invalid move
                        
                        # Check if game ended
                        if result.get("result") != "ongoing":
                            # Handle end game rewards/stats
                            winner_name = result.get("winner")
                            if winner_name:
                                # Award Prize Pool
                                city = await redis_client.hget("pcd:game_city", game_id) or "dubai"
                                prize = matchmaking_queue.get_city_prize_pool(city)
                                await db_service.update_player_balance(winner_name, prize)
                                await db_service.update_player_stats(winner_name, True)
                                
                                # Log transaction
                                await db_service.create_transaction({
                                    "player_name": winner_name, "amount": prize, "type": "match_win", "city": city
                                })
                                
                                # Update loser stats
                                loser_id = target_id if winner_name == player_id else player_id
                                # We need player name of loser
                                p1_name = (await db_service.get_game(game_id)).get("player1_name")
                                p2_name = (await db_service.get_game(game_id)).get("player2_name")
                                loser_name = p1_name if p1_name != winner_name else p2_name
                                await db_service.update_player_stats(loser_name, False)
                                
                                print(f"🏆 {winner_name} won {prize} in {city}!")

                # Forward to peer if valid
                if target_id in matchmaking_queue.active_connections:
                    target_ws = matchmaking_queue.active_connections[target_id]
                    message["from_id"] = player_id
                    await target_ws.send_text(json.dumps(message))
                    
                    # Restart/Start Timers (matching logic from above)
                    city = await redis_client.hget("pcd:game_city", game_id) or "dubai"
                    duration = matchmaking_queue.get_city_turn_timer(city)
                    next_turn_player = target_id if msg_type == "match_move" else player_id
                    
                    # We need the other player's WS for broadcasting
                    await timer_manager.start_timer(game_id, next_turn_player, duration, websocket, target_ws)
                
    except WebSocketDisconnect:
        print(f"🎮 WebSocket disconnected for player {player_id}")
        matchmaking_queue.remove_player(player_id)
    except Exception as e:
        print(f"🎮 WebSocket error for player {player_id}: {e}")
        matchmaking_queue.remove_player(player_id)

@router.get("/status")
async def get_matchmaking_status(matchmaking_queue=Depends(get_matchmaking_queue)):
    """Get current city-specific matchmaking queue status."""
    queue_stats = matchmaking_queue.get_queue_stats()
    detailed_queues = {}
    
    for city, queue in matchmaking_queue.city_queues.items():
        detailed_queues[city] = {
            "total_waiting": len(queue),
            "waiting_players": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "waiting_time": asyncio.get_event_loop().time() - p["joined_at"]
                }
                for p in queue
            ]
        }
    
    return {
        "total_players": sum(queue_stats.values()),
        "queue_stats": queue_stats,
        "detailed_queues": detailed_queues
    }

@router.post("/leave/{player_id}")
async def leave_matchmaking(player_id: str, matchmaking_queue=Depends(get_matchmaking_queue)):
    """Leave the matchmaking queue."""
    matchmaking_queue.remove_player(player_id)
    return {"message": "Left matchmaking queue"}

@router.post("/join", response_model=GameResponse)
async def join_matchmaking_rest(request: JoinMatchmakingCityRequest, matchmaking_queue=Depends(get_matchmaking_queue)):
    """Join a city-specific matchmaking queue via REST API (pre-verification)."""
    try:
        valid_cities = ["dubai", "cairo", "oslo"]
        if request.city.lower() not in valid_cities:
            return GameResponse(
                success=False,
                message=f"Invalid city. Valid cities: {', '.join(valid_cities)}"
            )
        
        import uuid
        temp_player_id = str(uuid.uuid4())
        
        return GameResponse(
            success=True,
            message="Use WebSocket endpoint /matchmaking/ws/{player_id} for real-time matchmaking",
            data={
                "city": request.city,
                "player_name": request.player_name,
                "websocket_endpoint": f"/matchmaking/ws/{temp_player_id}",
                "entry_cost": matchmaking_queue.get_city_entry_cost(request.city),
                "prize_pool": matchmaking_queue.get_city_prize_pool(request.city),
                "turn_timer": matchmaking_queue.get_city_turn_timer(request.city)
            }
        )
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to join matchmaking: {str(e)}"
        )
