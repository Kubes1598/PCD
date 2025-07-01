from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import json
import asyncio
from game_engine import PoisonedCandyDuel, GameState, GameResult
from database import db_service
from config import settings

app = FastAPI(title="Poisoned Candy Duel API", version="1.0.0")

# Add CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Game engine instance
game_engine = PoisonedCandyDuel()

# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time game updates."""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, game_id: str):
        """Connect a WebSocket to a game room."""
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, game_id: str):
        """Disconnect a WebSocket from a game room."""
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
    
    async def broadcast_to_game(self, game_id: str, message: dict):
        """Broadcast a message to all connections in a game room."""
        if game_id in self.active_connections:
            connections_to_remove = []
            for connection in self.active_connections[game_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    print(f"Error sending message to connection: {e}")
                    connections_to_remove.append(connection)
            
            # Remove broken connections
            for connection in connections_to_remove:
                if connection in self.active_connections[game_id]:
                    self.active_connections[game_id].remove(connection)

manager = ConnectionManager()

# Pydantic models for API requests
class CreateGameRequest(BaseModel):
    """Request model for creating a new game."""
    player1_name: str
    player2_name: str

class JoinGameRequest(BaseModel):
    player_name: str

class SetPoisonRequest(BaseModel):
    """Request model for setting poison choice."""
    player_id: str
    poison_candy: str

class MakeMoveRequest(BaseModel):
    """Request model for making a move."""
    player_id: str
    candy: str

class PickCandyRequest(BaseModel):
    """Request model for picking a candy (frontend compatibility)."""
    player: str
    candy_choice: str

class GameResponse(BaseModel):
    """Response model for game-related API calls."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# API Endpoints

@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return {"message": "Poisoned Candy Duel API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Test database connection
        stats = await db_service.get_game_stats()
        return {
            "status": "healthy", 
            "active_games": len(game_engine.games),
            "database_stats": stats,
            "supabase_connected": True
        }
    except Exception as e:
        return {
            "status": "degraded",
            "active_games": len(game_engine.games),
            "supabase_connected": False,
            "error": str(e)
        }

@app.post("/games", response_model=GameResponse)
async def create_game(request: CreateGameRequest):
    """Create a new game."""
    try:
        # Create game in memory first
        game_id = game_engine.create_game(
            request.player1_name, 
            request.player2_name
        )
        game_state = game_engine.get_game_state(game_id)
        
        # Save to Supabase
        await db_service.create_game({
            "id": game_id,
            "player1_name": request.player1_name,
            "player2_name": request.player2_name,
            "game_state": game_state,
            "status": "waiting_for_poison"
        })
        
        return GameResponse(
            success=True,
            message="Game created successfully",
            data={
                "game_id": game_id,
                "game_state": game_state
            }
        )
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to create game: {str(e)}"
        )

@app.get("/games/{game_id}", response_model=GameResponse)
async def get_game(game_id: str):
    """Get game state."""
    # Try to get from memory first
    game_state = game_engine.get_game_state(game_id)
    
    # If not in memory, try to load from Supabase
    if not game_state:
        db_game = await db_service.get_game(game_id)
        if db_game:
            # Reconstruct game in memory from database
            game_engine.load_game_from_data(db_game)
            game_state = db_game["game_state"]
    
    if not game_state:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return GameResponse(
        success=True,
        message="Game state retrieved",
        data={"game_state": game_state}
    )

@app.post("/games/{game_id}/poison", response_model=GameResponse)
async def set_poison(game_id: str, request: SetPoisonRequest):
    """Set poison choice for a player."""
    success = game_engine.set_poison_choice(
        game_id, 
        request.player_id, 
        request.poison_candy
    )
    
    if not success:
        return GameResponse(
            success=False,
            message="Failed to set poison choice"
        )
    
    # Check if this is an AI game and automatically set AI poison
    game_state = game_engine.get_game_state(game_id)
    if game_state:
        # Check if opponent is AI and hasn't set poison yet
        player1 = game_state["player1"]
        player2 = game_state["player2"]
        
        # If player2 is AI and hasn't set poison, set it automatically
        if (player2["name"] == "AI Opponent" and not player2["has_set_poison"]):
            import random
            ai_candies = player2["owned_candies"]
            ai_poison = random.choice(ai_candies)
            game_engine.set_poison_choice(game_id, player2["id"], ai_poison)
            game_state = game_engine.get_game_state(game_id)  # Refresh state
        
        # If player1 is AI and hasn't set poison, set it automatically
        elif (player1["name"] == "AI Opponent" and not player1["has_set_poison"]):
            import random
            ai_candies = player1["owned_candies"]
            ai_poison = random.choice(ai_candies)
            game_engine.set_poison_choice(game_id, player1["id"], ai_poison)
            game_state = game_engine.get_game_state(game_id)  # Refresh state
    
    # Update in Supabase
    await db_service.update_game(game_id, {
        "game_state": game_state,
        "status": "in_progress" if game_state.get("state") == "playing" else "waiting_for_poison"
    })
    
    # Broadcast game state update to all connected clients
    await manager.broadcast_to_game(game_id, {
        "type": "game_update",
        "game_state": game_state
    })
    
    return GameResponse(
        success=True,
        message="Poison choice set successfully",
        data={"game_state": game_state}
    )

@app.post("/games/{game_id}/move", response_model=GameResponse)
async def make_move(game_id: str, request: MakeMoveRequest):
    """Make a move (pick a candy)."""
    result = game_engine.make_move(
        game_id, 
        request.player_id, 
        request.candy
    )
    
    if not result["success"]:
        return GameResponse(
            success=False,
            message=result["error"]
        )
    
    # Update in Supabase
    game_status = "finished" if result["result"] != "ongoing" else "in_progress"
    await db_service.update_game(game_id, {
        "game_state": result["game_state"],
        "status": game_status
    })
    
    # Broadcast move to all connected clients
    await manager.broadcast_to_game(game_id, {
        "type": "move_made",
        "player_id": request.player_id,
        "candy": request.candy,
        "game_state": result["game_state"],
        "result": result["result"]
    })
    
    return GameResponse(
        success=True,
        message="Move made successfully",
        data=result
    )

@app.post("/games/{game_id}/pick", response_model=GameResponse)
async def pick_candy(game_id: str, request: PickCandyRequest):
    """Pick a candy (frontend compatibility endpoint)."""
    # Convert frontend player format to player_id
    game_state = game_engine.get_game_state(game_id)
    if not game_state:
        return GameResponse(
            success=False,
            message="Game not found"
        )
    
    # Map player string to player_id
    if request.player == "player1":
        player_id = game_state["player1"]["id"]
    elif request.player == "player2":
        player_id = game_state["player2"]["id"]
    else:
        return GameResponse(
            success=False,
            message="Invalid player"
        )
    
    # Make the move
    result = game_engine.make_move(
        game_id, 
        player_id, 
        request.candy_choice
    )
    
    if not result["success"]:
        return GameResponse(
            success=False,
            message=result["error"]
        )
    
    # Update in Supabase
    game_status = "finished" if result["result"] != "ongoing" else "in_progress"
    await db_service.update_game(game_id, {
        "game_state": result["game_state"],
        "status": game_status
    })
    
    # Broadcast move to all connected clients
    await manager.broadcast_to_game(game_id, {
        "type": "move_made",
        "player_id": player_id,
        "candy": request.candy_choice,
        "game_state": result["game_state"],
        "result": result["result"]
    })
    
    # Check if opponent is AI and make AI move if needed
    if game_status == "in_progress":
        updated_game_state = result["game_state"]
        current_player_id = updated_game_state["current_player"]
        
        # Check if it's AI's turn
        if ((updated_game_state["player1"]["name"] == "AI Opponent" and 
             current_player_id == updated_game_state["player1"]["id"]) or
            (updated_game_state["player2"]["name"] == "AI Opponent" and 
             current_player_id == updated_game_state["player2"]["id"])):
            
            # Make AI move after a short delay
            import asyncio
            import random
            
            async def make_ai_move():
                await asyncio.sleep(1)  # Short delay for realism
                
                # Get current game state
                current_state = game_engine.get_game_state(game_id)
                if not current_state or current_state["state"] != "playing":
                    return
                
                # Determine AI player and available candies
                if current_state["player1"]["name"] == "AI Opponent":
                    ai_player = current_state["player1"]
                    opponent_player = current_state["player2"]
                else:
                    ai_player = current_state["player2"]
                    opponent_player = current_state["player1"]
                
                available_candies = ai_player["available_to_pick"]
                if available_candies:
                    ai_candy_choice = random.choice(available_candies)
                    
                    # Make AI move
                    ai_result = game_engine.make_move(
                        game_id,
                        ai_player["id"],
                        ai_candy_choice
                    )
                    
                    if ai_result["success"]:
                        # Update database
                        ai_game_status = "finished" if ai_result["result"] != "ongoing" else "in_progress"
                        await db_service.update_game(game_id, {
                            "game_state": ai_result["game_state"],
                            "status": ai_game_status
                        })
                        
                        # Broadcast AI move
                        await manager.broadcast_to_game(game_id, {
                            "type": "ai_move_made",
                            "player_id": ai_player["id"],
                            "candy": ai_candy_choice,
                            "game_state": ai_result["game_state"],
                            "result": ai_result["result"]
                        })
            
            # Schedule AI move
            asyncio.create_task(make_ai_move())
    
    return GameResponse(
        success=True,
        message="Move made successfully",
        data=result
    )

@app.get("/games/{game_id}/state")
async def get_game_state_endpoint(game_id: str):
    """Get current game state."""
    game_state = game_engine.get_game_state(game_id)
    
    if not game_state:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return game_state

@app.get("/players/{player_name}/games")
async def get_player_games(player_name: str):
    """Get all games for a player."""
    # Get from Supabase instead of memory
    games = await db_service.get_player_games(player_name)
    return {"games": games}

@app.delete("/games/{game_id}")
async def delete_game(game_id: str):
    """Delete a game."""
    # Delete from both memory and Supabase
    deleted_from_db = await db_service.delete_game(game_id)
    
    if game_id in game_engine.games:
        del game_engine.games[game_id]
    
    if deleted_from_db:
        return {"message": "Game deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Game not found")

@app.get("/stats")
async def get_stats():
    """Get overall game statistics."""
    try:
        stats = await db_service.get_game_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# WebSocket endpoint for real-time updates
@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for real-time game updates."""
    await manager.connect(websocket, game_id)
    
    try:
        # Send initial game state
        game_state = game_engine.get_game_state(game_id)
        if game_state:
            await websocket.send_text(json.dumps({
                "type": "game_state",
                "game_state": game_state
            }))
        
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "request_update":
                current_game_state = game_engine.get_game_state(game_id)
                if current_game_state:
                    await websocket.send_text(json.dumps({
                        "type": "game_state",
                        "game_state": current_game_state
                    }))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        manager.disconnect(websocket, game_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, game_id)

# Background task to cleanup old games
@app.on_event("startup")
async def startup_event():
    """Startup event to initialize background tasks."""
    asyncio.create_task(cleanup_old_games())

async def cleanup_old_games():
    """Background task to cleanup old games periodically."""
    while True:
        try:
            removed = game_engine.cleanup_old_games(max_age_hours=24)
            if removed > 0:
                print(f"Cleaned up {removed} old games")
        except Exception as e:
            print(f"Error cleaning up games: {e}")
        
        # Run cleanup every hour
        await asyncio.sleep(3600)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 