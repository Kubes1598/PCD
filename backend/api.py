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

class SetPoisonRequest(BaseModel):
    """Request model for setting poison choice."""
    player_id: str
    poison_candy: str

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
    
    # Get updated game state
    game_state = game_engine.get_game_state(game_id)
    
    if game_state:
        # Check if opponent is AI and hasn't set poison yet
        player1 = game_state["player1"]
        player2 = game_state["player2"]
        
        # Check if any player is AI and hasn't set poison (support multiple AI names)
        ai_names = ["AI Assistant", "AI Opponent", "AI", "Computer"]
        
        # If player2 is AI and hasn't set poison, set it automatically
        if (player2["name"] in ai_names and not player2["has_set_poison"]):
            import random
            ai_candies = list(player2["owned_candies"])
            ai_poison = random.choice(ai_candies)
            print(f"🤖 Setting AI poison automatically for {player2['name']}: {ai_poison}")
            game_engine.set_poison_choice(game_id, player2["id"], ai_poison)
            game_state = game_engine.get_game_state(game_id)  # Refresh state
        
        # If player1 is AI and hasn't set poison, set it automatically
        elif (player1["name"] in ai_names and not player1["has_set_poison"]):
            import random
            ai_candies = list(player1["owned_candies"])
            ai_poison = random.choice(ai_candies)
            print(f"🤖 Setting AI poison automatically for {player1['name']}: {ai_poison}")
            game_engine.set_poison_choice(game_id, player1["id"], ai_poison)
            game_state = game_engine.get_game_state(game_id)  # Refresh state
    
    # Update in Supabase
    try:
        await db_service.update_game(game_id, {
            "game_state": game_state,
            "status": "in_progress" if game_state.get("state") == "playing" else "waiting_for_poison"
        })
    except Exception as e:
        print(f"Database update error: {e}")
    
    return GameResponse(
        success=True,
        message="Poison choice set successfully",
        data={"game_state": game_state}
    )

@app.post("/games/{game_id}/pick", response_model=GameResponse)
async def pick_candy(game_id: str, request: PickCandyRequest):
    """Pick a candy from opponent's pool (frontend compatibility)."""
    print(f"🍬 Pick candy request: game_id={game_id}, player={request.player}, candy={request.candy_choice}")
    
    # Try to get game state first
    game_state = game_engine.get_game_state(game_id)
    if not game_state:
        print(f"❌ Game {game_id} not found")
        return GameResponse(
            success=False,
            message="Game not found"
        )
    
    # Handle both player ID formats (actual UUID vs 'player1'/'player2')
    player_id = request.player
    if request.player == 'player1':
        player_id = game_state["player1"]["id"]
    elif request.player == 'player2':
        player_id = game_state["player2"]["id"]
    
    print(f"🎯 Resolved player ID: {player_id}")
    
    # Make the move using the game engine
    result = game_engine.make_move(game_id, player_id, request.candy_choice)
    
    if not result.get("success", False):
        print(f"❌ Move failed: {result.get('error', 'Unknown error')}")
        return GameResponse(
            success=False,
            message=result.get("error", "Failed to make move")
        )
    
    # Get updated game state
    updated_game_state = game_engine.get_game_state(game_id)
    
    # Determine game result
    game_result = result.get("result", "ongoing")
    
    print(f"✅ Move successful, game result: {game_result}")
    
    return GameResponse(
        success=True,
        message="Move successful",
        data={
            "game_state": updated_game_state,
            "result": game_result,
            "picked_poison": result.get("picked_poison", False)
        }
    )

@app.delete("/games/{game_id}")
async def delete_game(game_id: str):
    """Delete a game."""
    if game_id in game_engine.games:
        del game_engine.games[game_id]
        return {"message": "Game deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Game not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 