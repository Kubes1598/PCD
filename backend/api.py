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

# Matchmaking system
class MatchmakingQueue:
    """Manages the automatic matchmaking queue for online players."""
    
    def __init__(self):
        self.waiting_players: List[Dict[str, Any]] = []
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def add_player(self, player_id: str, player_name: str, websocket: WebSocket):
        """Add a player to the matchmaking queue."""
        player = {
            "id": player_id,
            "name": player_name,
            "joined_at": asyncio.get_event_loop().time(),
            "websocket": websocket
        }
        
        self.waiting_players.append(player)
        self.active_connections[player_id] = websocket
        
        print(f"🎮 Player {player_name} joined matchmaking queue. Queue size: {len(self.waiting_players)}")
        
        # Try to match players immediately
        await self.try_match_players()
    
    def remove_player(self, player_id: str):
        """Remove a player from the matchmaking queue."""
        self.waiting_players = [p for p in self.waiting_players if p["id"] != player_id]
        if player_id in self.active_connections:
            del self.active_connections[player_id]
        print(f"🎮 Player {player_id} left matchmaking queue. Queue size: {len(self.waiting_players)}")
    
    async def try_match_players(self):
        """Try to match players in the queue."""
        if len(self.waiting_players) >= 2:
            # Get first two players
            player1 = self.waiting_players.pop(0)
            player2 = self.waiting_players.pop(0)
            
            # Remove from active connections
            if player1["id"] in self.active_connections:
                del self.active_connections[player1["id"]]
            if player2["id"] in self.active_connections:
                del self.active_connections[player2["id"]]
            
            # Create game
            game_id = game_engine.create_game(player1["name"], player2["name"])
            game_state = game_engine.get_game_state(game_id)
            
            print(f"🎮 Matched players: {player1['name']} vs {player2['name']} (Game: {game_id})")
            
            # Notify both players
            match_data = {
                "type": "match_found",
                "game_id": game_id,
                "game_state": game_state,
                "opponent": {
                    "name": player2["name"] if player1 else player1["name"]
                }
            }
            
            try:
                await player1["websocket"].send_text(json.dumps({
                    **match_data,
                    "your_role": "player1",
                    "opponent": {"name": player2["name"]}
                }))
                await player2["websocket"].send_text(json.dumps({
                    **match_data,
                    "your_role": "player2", 
                    "opponent": {"name": player1["name"]}
                }))
            except Exception as e:
                print(f"Error notifying players of match: {e}")
            
            # Save game to database
            try:
                await db_service.create_game({
                    "id": game_id,
                    "player1_name": player1["name"],
                    "player2_name": player2["name"],
                    "game_state": game_state,
                    "status": "waiting_for_poison"
                })
            except Exception as e:
                print(f"Database error creating matched game: {e}")
    
    async def notify_queue_status(self, player_id: str):
        """Notify a player about their queue status."""
        if player_id in self.active_connections:
            try:
                await self.active_connections[player_id].send_text(json.dumps({
                    "type": "queue_status",
                    "position": next((i for i, p in enumerate(self.waiting_players) if p["id"] == player_id), -1) + 1,
                    "total_waiting": len(self.waiting_players)
                }))
            except Exception as e:
                print(f"Error sending queue status: {e}")

# Global matchmaking queue
matchmaking_queue = MatchmakingQueue()

# Pydantic models for API requests
class CreateGameRequest(BaseModel):
    """Request model for creating a new game."""
    player1_name: str
    player2_name: str

class JoinMatchmakingRequest(BaseModel):
    """Request model for joining matchmaking queue."""
    player_name: str

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

class MatchmakingRequest(BaseModel):
    player_name: str
    arena_type: str  # 'dubai', 'cairo', 'oslo'

class CoinTransactionRequest(BaseModel):
    player_name: str
    amount: int  # Positive for earning, negative for spending
    transaction_type: str  # 'game_entry', 'prize_payout', 'purchase', 'reward', 'refund'
    description: Optional[str] = None
    arena_type: Optional[str] = None  # For arena-specific transactions
    game_id: Optional[str] = None

class PlayerBalanceRequest(BaseModel):
    player_name: str

class ArenaStatsUpdate(BaseModel):
    arena_type: str
    entry_fee: int
    prize_amount: int
    service_fee: int

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
        ai_names = ["AI Assistant", "AI Opponent", "AI", "Computer", "Online Opponent", "Opponent", "Friend"]
        
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

# Matchmaking endpoints
@app.websocket("/matchmaking/ws/{player_id}")
async def matchmaking_websocket(websocket: WebSocket, player_id: str):
    """WebSocket endpoint for matchmaking."""
    await websocket.accept()
    print(f"🎮 WebSocket connected for player {player_id}")
    
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "join_queue":
                player_name = message.get("player_name", "Anonymous")
                await matchmaking_queue.add_player(player_id, player_name, websocket)
                
            elif message.get("type") == "leave_queue":
                matchmaking_queue.remove_player(player_id)
                
            elif message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                
    except WebSocketDisconnect:
        print(f"🎮 WebSocket disconnected for player {player_id}")
        matchmaking_queue.remove_player(player_id)
    except Exception as e:
        print(f"🎮 WebSocket error for player {player_id}: {e}")
        matchmaking_queue.remove_player(player_id)

@app.get("/matchmaking/status")
async def get_matchmaking_status():
    """Get current matchmaking queue status."""
    return {
        "queue_size": len(matchmaking_queue.waiting_players),
        "waiting_players": [
            {
                "id": p["id"],
                "name": p["name"],
                "waiting_time": asyncio.get_event_loop().time() - p["joined_at"]
            }
            for p in matchmaking_queue.waiting_players
        ]
    }

@app.post("/matchmaking/leave/{player_id}")
async def leave_matchmaking(player_id: str):
    """Leave the matchmaking queue."""
    matchmaking_queue.remove_player(player_id)
    return {"message": "Left matchmaking queue"}

@app.get("/games/{game_id}/state", response_model=GameResponse)
async def get_game_state(game_id: str):
    """Get current game state."""
    game_state = game_engine.get_game_state(game_id)
    
    if not game_state:
        return GameResponse(
            success=False,
            message="Game not found"
        )
    
    return GameResponse(
        success=True,
        message="Game state retrieved",
        data={"game_state": game_state}
    )

# ===== COIN TRANSACTION ENDPOINTS =====

@app.post("/players/balance", response_model=GameResponse)
async def get_player_balance(request: PlayerBalanceRequest):
    """Get player's current coin and diamond balance."""
    try:
        # First try to get from database
        if hasattr(db_service, 'supabase'):
            result = db_service.supabase.table("players").select("coin_balance, diamonds_balance").eq("name", request.player_name).execute()
            
            if result.data:
                return GameResponse(
                    success=True,
                    message="Balance retrieved",
                    data={
                        "player_name": request.player_name,
                        "coin_balance": result.data[0]["coin_balance"],
                        "diamonds_balance": result.data[0]["diamonds_balance"]
                    }
                )
        
        # Return default balance if player not found
        return GameResponse(
            success=True,
            message="Default balance (new player)",
            data={
                "player_name": request.player_name,
                "coin_balance": 10000,
                "diamonds_balance": 50
            }
        )
        
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to get balance: {str(e)}"
        )

@app.post("/players/transaction", response_model=GameResponse)
async def process_coin_transaction(request: CoinTransactionRequest):
    """Process a coin transaction (debit or credit)."""
    try:
        # Get current balance or create player if not exists
        current_balance = 10000  # Default
        current_diamonds = 50    # Default
        
        if hasattr(db_service, 'supabase'):
            # Check if player exists
            player_result = db_service.supabase.table("players").select("*").eq("name", request.player_name).execute()
            
            if player_result.data:
                # Player exists, get current balance
                player = player_result.data[0]
                current_balance = player["coin_balance"]
                current_diamonds = player["diamonds_balance"]
            else:
                # Create new player
                new_player = {
                    "name": request.player_name,
                    "coin_balance": 10000,
                    "diamonds_balance": 50,
                    "total_coins_earned": 0,
                    "total_coins_spent": 0
                }
                db_service.supabase.table("players").insert(new_player).execute()
            
            # Calculate new balance
            new_balance = current_balance + request.amount
            
            # Validate sufficient funds for negative transactions
            if new_balance < 0:
                return GameResponse(
                    success=False,
                    message="Insufficient funds",
                    data={
                        "current_balance": current_balance,
                        "requested_amount": request.amount,
                        "shortfall": abs(new_balance)
                    }
                )
            
            # Update player balance
            update_data = {
                "coin_balance": new_balance,
                "last_active": "NOW()"
            }
            
            # Update lifetime stats
            if request.amount > 0:
                update_data["total_coins_earned"] = player.get("total_coins_earned", 0) + request.amount
            else:
                update_data["total_coins_spent"] = player.get("total_coins_spent", 0) + abs(request.amount)
            
            db_service.supabase.table("players").update(update_data).eq("name", request.player_name).execute()
            
            # Record transaction
            transaction_data = {
                "player_name": request.player_name,
                "game_id": request.game_id,
                "transaction_type": request.transaction_type,
                "amount": request.amount,
                "balance_after": new_balance,
                "description": request.description,
                "arena_type": request.arena_type
            }
            
            db_service.supabase.table("coin_transactions").insert(transaction_data).execute()
            
            return GameResponse(
                success=True,
                message="Transaction processed successfully",
                data={
                    "player_name": request.player_name,
                    "transaction_amount": request.amount,
                    "previous_balance": current_balance,
                    "new_balance": new_balance,
                    "transaction_type": request.transaction_type
                }
            )
        
        # Fallback for in-memory mode
        return GameResponse(
            success=True,
            message="Transaction processed (in-memory mode)",
            data={
                "player_name": request.player_name,
                "transaction_amount": request.amount,
                "new_balance": max(0, current_balance + request.amount)
            }
        )
        
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Transaction failed: {str(e)}"
        )

@app.post("/arena/stats/update", response_model=GameResponse)
async def update_arena_stats(request: ArenaStatsUpdate):
    """Update arena statistics after a game."""
    try:
        if hasattr(db_service, 'supabase'):
            # Get today's stats or create new entry
            today = "CURRENT_DATE"
            
            # Try to get existing stats for today
            existing_stats = db_service.supabase.table("arena_stats").select("*").eq("arena_type", request.arena_type).eq("created_date", today).execute()
            
            if existing_stats.data:
                # Update existing stats
                stats = existing_stats.data[0]
                update_data = {
                    "total_games": stats["total_games"] + 1,
                    "total_entry_fees": stats["total_entry_fees"] + request.entry_fee,
                    "total_prizes_paid": stats["total_prizes_paid"] + request.prize_amount,
                    "service_fees_collected": stats["service_fees_collected"] + request.service_fee
                }
                
                db_service.supabase.table("arena_stats").update(update_data).eq("id", stats["id"]).execute()
            else:
                # Create new stats entry
                new_stats = {
                    "arena_type": request.arena_type,
                    "total_games": 1,
                    "total_entry_fees": request.entry_fee,
                    "total_prizes_paid": request.prize_amount,
                    "service_fees_collected": request.service_fee
                }
                
                db_service.supabase.table("arena_stats").insert(new_stats).execute()
            
            return GameResponse(
                success=True,
                message="Arena stats updated successfully"
            )
        
        # Fallback for in-memory mode
        return GameResponse(
            success=True,
            message="Arena stats updated (in-memory mode)"
        )
        
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to update arena stats: {str(e)}"
        )

@app.get("/players/{player_name}/transactions")
async def get_player_transactions(player_name: str, limit: int = 50):
    """Get recent transactions for a player."""
    try:
        if hasattr(db_service, 'supabase'):
            result = db_service.supabase.table("coin_transactions").select("*").eq("player_name", player_name).order("created_at", desc=True).limit(limit).execute()
            
            return {
                "success": True,
                "data": {
                    "player_name": player_name,
                    "transactions": result.data
                }
            }
        
        return {
            "success": True,
            "data": {
                "player_name": player_name,
                "transactions": []
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get transactions: {str(e)}"
        }

@app.get("/arena/economics")
async def get_arena_economics():
    """Get arena economics summary."""
    try:
        if hasattr(db_service, 'supabase'):
            result = db_service.supabase.table("arena_economics").select("*").execute()
            
            return {
                "success": True,
                "data": {
                    "arena_economics": result.data
                }
            }
        
        return {
            "success": True,
            "data": {
                "arena_economics": []
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get arena economics: {str(e)}"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 