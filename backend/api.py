from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional, Any
import json
import asyncio
import hashlib
import secrets
import time
from game_engine import PoisonedCandyDuel, GameState, GameResult
from database import db_service
from config import settings

# In-memory user storage (replace with database in production)
users_db: Dict[str, dict] = {}
tokens_db: Dict[str, str] = {}  # token -> user_id

security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt."""
    salt = "pcd_salt_v1"  # In production, use unique salt per user
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash."""
    return hash_password(password) == hashed

def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)

def get_user_from_token(token: str) -> Optional[dict]:
    """Get user data from token."""
    user_id = tokens_db.get(token)
    if user_id and user_id in users_db:
        return users_db[user_id]
    return None

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

# City-specific matchmaking system
class CityMatchmakingQueue:
    """Manages city-specific matchmaking queues for online players."""
    
    def __init__(self):
        # Separate queues for each city
        self.city_queues = {
            "dubai": [],
            "cairo": [],
            "oslo": []
        }
        self.active_connections: Dict[str, WebSocket] = {}
        self.player_cities: Dict[str, str] = {}  # Track which city each player is in
        self.player_timers: Dict[str, Any] = {}  # Track timeout timers for each player
    
    async def add_player(self, player_id: str, player_name: str, city: str, websocket: WebSocket):
        """Add a player to a city's matchmaking queue."""
        city_lower = city.lower()
        if city_lower not in self.city_queues:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Invalid city: {city}. Valid cities: Dubai, Cairo, Oslo"
            }))
            return
        
        # Check player balance before adding to queue
        try:
            player_data = await db_service.get_player(player_name)
            current_balance = player_data["coin_balance"] if player_data else 10000
            entry_cost = self.get_city_entry_cost(city_lower)
            
            if current_balance < entry_cost:
                await websocket.send_text(json.dumps({
                    "type": "matchmaking_error",
                    "message": f"Insufficient balance. {city.title()} requires {entry_cost} coins (you have {current_balance})."
                }))
                return
        except Exception as e:
            print(f"Error checking balance for {player_name}: {e}")

        player = {
            "id": player_id,
            "name": player_name,
            "city": city_lower,
            "joined_at": asyncio.get_event_loop().time(),
            "websocket": websocket
        }
        
        self.city_queues[city_lower].append(player)
        self.active_connections[player_id] = websocket
        self.player_cities[player_id] = city_lower
        
        print(f"🎮 Player {player_name} joined {city} matchmaking queue. Queue size: {len(self.city_queues[city_lower])}")
        
        # Set up 30-second timeout
        loop = asyncio.get_event_loop()
        timer = loop.call_later(30.0, lambda: asyncio.create_task(self.handle_matchmaking_timeout(player_id, city_lower)))
        self.player_timers[player_id] = timer
        
        # Try to match players immediately within the same city
        await self.try_match_players(city_lower)

    
    def remove_player(self, player_id: str):
        """Remove a player from their city's matchmaking queue."""
        if player_id in self.player_cities:
            city = self.player_cities[player_id]
            self.city_queues[city] = [p for p in self.city_queues[city] if p["id"] != player_id]
            del self.player_cities[player_id]
            print(f"🎮 Player {player_id} left {city} matchmaking queue. Queue size: {len(self.city_queues[city])}")
        
        if player_id in self.active_connections:
            del self.active_connections[player_id]
            
        # Cancel timeout timer
        if player_id in self.player_timers:
            self.player_timers[player_id].cancel()
            del self.player_timers[player_id]
    
    async def handle_matchmaking_timeout(self, player_id: str, city: str):
        """Handle 30-second matchmaking timeout."""
        print(f"⏰ Matchmaking timeout for player {player_id} in {city}")
        
        if player_id in self.active_connections:
            try:
                # Send timeout message
                await self.active_connections[player_id].send_text(json.dumps({
                    "type": "matchmaking_timeout",
                    "message": f"No players found in {city.title()}. Try again or select another city.",
                    "city": city
                }))
            except Exception as e:
                print(f"Error sending timeout message: {e}")
            
            # Remove player from queue
            self.remove_player(player_id)
    
    async def try_match_players(self, city: str):
        """Try to match players in a specific city's queue."""
        if len(self.city_queues[city]) >= 2:
            # Get first two players from the city queue
            player1 = self.city_queues[city].pop(0)
            player2 = self.city_queues[city].pop(0)
            
            # Cancel their timeout timers since they found a match
            for player in [player1, player2]:
                if player["id"] in self.player_timers:
                    self.player_timers[player["id"]].cancel()
                    del self.player_timers[player["id"]]
            
            # Keep them in active connections for signaling, but remove from city queues
            if player1["id"] in self.player_cities:
                del self.player_cities[player1["id"]]
            if player2["id"] in self.player_cities:
                del self.player_cities[player2["id"]]
            
            # Deduct entry fees
            entry_cost = self.get_city_entry_cost(city)
            for p in [player1, player2]:
                try:
                    await db_service.update_player_balance(p["name"], -entry_cost, 0)
                    await db_service.create_transaction({
                        "player_name": p["name"],
                        "game_id": game_id,
                        "transaction_type": "game_entry",
                        "amount": -entry_cost,
                        "description": f"Entry fee for {city.title()} Arena",
                        "arena_type": city
                    })
                except Exception as e:
                    print(f"Error deducting entry fee for {p['name']}: {e}")
            
            # Notify both players
            match_data = {
                "type": "match_found",
                "game_id": game_id,
                "game_state": game_state,
                "city": city,
                "opponent": {
                    "name": player2["name"] if player1 else player1["name"]
                }
            }
            
            try:
                await player1["websocket"].send_text(json.dumps({
                    **match_data,
                    "your_role": "player1",
                    "opponent": {"name": player2["name"], "id": player2["id"]},
                    "opponent_id": player2["id"]
                }))
                await player2["websocket"].send_text(json.dumps({
                    **match_data,
                    "your_role": "player2", 
                    "opponent": {"name": player1["name"], "id": player1["id"]},
                    "opponent_id": player1["id"]
                }))
            except Exception as e:
                print(f"Error notifying players of match: {e}")
            
            # Save game to database with city information
            try:
                await db_service.create_game({
                    "id": game_id,
                    "player1_name": player1["name"],
                    "player2_name": player2["name"],
                    "game_state": game_state,
                    "status": "waiting_for_candy_selection",
                    "city": city
                })
            except Exception as e:
                print(f"Database error creating matched game: {e}")
    
    def get_city_entry_cost(self, city: str) -> int:
        """Get entry cost for a specific city."""
        costs = {"dubai": 500, "cairo": 1000, "oslo": 5000}
        return costs.get(city.lower(), 500)
    
    def get_city_prize_pool(self, city: str) -> int:
        """Get prize pool for a specific city."""
        prizes = {"dubai": 950, "cairo": 1900, "oslo": 9500}
        return prizes.get(city.lower(), 950)
    
    def get_city_turn_timer(self, city: str) -> int:
        """Get turn timer for a specific city."""
        timers = {"dubai": 30, "cairo": 20, "oslo": 10}
        return timers.get(city.lower(), 30)
    
    async def notify_queue_status(self, player_id: str):
        """Notify a player about their queue status."""
        if player_id in self.active_connections and player_id in self.player_cities:
            city = self.player_cities[player_id]
            try:
                position = next((i for i, p in enumerate(self.city_queues[city]) if p["id"] == player_id), -1) + 1
                await self.active_connections[player_id].send_text(json.dumps({
                    "type": "queue_status",
                    "city": city,
                    "position": position,
                    "total_waiting": len(self.city_queues[city])
                }))
            except Exception as e:
                print(f"Error sending queue status: {e}")
    
    def get_queue_stats(self) -> Dict[str, int]:
        """Get statistics for all city queues."""
        return {city: len(queue) for city, queue in self.city_queues.items()}

# Global city-specific matchmaking queue
matchmaking_queue = CityMatchmakingQueue()

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

class AddFriendRequest(BaseModel):
    player_name: str
    friend_profile_id: str

class ProfileRequest(BaseModel):
    profile_id: str

class ClaimQuestRequest(BaseModel):
    player_name: str
    quest_id: str

class ArenaStatsUpdate(BaseModel):
    arena_type: str
    entry_fee: int
    prize_amount: int
    service_fee: int

class CandySelectionRequest(BaseModel):
    """Request model for candy selection."""
    player_id: str
    candy_id: str
    game_id: str

class GameStartRequest(BaseModel):
    """Request model for game start synchronization."""
    game_id: str
    player_id: str

class JoinMatchmakingCityRequest(BaseModel):
    """Request model for joining city-specific matchmaking queue."""
    player_name: str
    city: str

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

# PRD: Timer synchronization endpoint
@app.get("/api/time")
async def get_server_time():
    """PRD: Get precise server timestamp for synchronization."""
    import time
    return {
        "timestamp": int(time.time() * 1000),  # Milliseconds
        "timezone": "UTC",
        "server_id": "pcd-game-server-1"
    }

# ===== AUTHENTICATION ENDPOINTS =====

class RegisterRequest(BaseModel):
    """Request model for user registration."""
    email: str
    password: str
    username: str

class LoginRequest(BaseModel):
    """Request model for user login."""
    email: str
    password: str

@app.post("/auth/register")
async def register_user(request: RegisterRequest):
    """Register a new user with email and password."""
    # Validate email format
    if "@" not in request.email or "." not in request.email:
        return {"success": False, "message": "Invalid email format"}
    
    # Check if email already exists
    for user_id, user in users_db.items():
        if user["email"] == request.email.lower():
            return {"success": False, "message": "Email already registered"}
    
    # Check if username already exists
    for user_id, user in users_db.items():
        if user["username"].lower() == request.username.lower():
            return {"success": False, "message": "Username already taken"}
    
    # Validate password length
    if len(request.password) < 6:
        return {"success": False, "message": "Password must be at least 6 characters"}
    
    # Create user
    user_id = f"U_{secrets.token_hex(8)}"
    user = {
        "id": user_id,
        "email": request.email.lower(),
        "username": request.username,
        "password_hash": hash_password(request.password),
        "created_at": int(time.time()),
        "coin_balance": 10000,
        "diamonds_balance": 500,
        "total_games": 0,
        "wins": 0,
        "losses": 0
    }
    
    users_db[user_id] = user
    
    # Create player profile in database
    try:
        await db_service.update_player_balance(request.username, 0, 0)
    except Exception as e:
        print(f"⚠️ Failed to create player profile for {request.username}: {e}")
    
    # Generate token
    token = generate_token()
    tokens_db[token] = user_id
    
    print(f"👤 New user registered: {request.username} ({user_id})")
    
    # Return user data without password
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "success": True,
        "message": "Registration successful",
        "data": {
            "token": token,
            "user": user_public
        }
    }

@app.post("/auth/login")
async def login_user(request: LoginRequest):
    """Login with email and password."""
    email = request.email.lower()
    
    # Find user by email
    user = None
    user_id = None
    for uid, u in users_db.items():
        if u["email"] == email:
            user = u
            user_id = uid
            break
    
    if not user:
        return {"success": False, "message": "Invalid email or password"}
    
    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        return {"success": False, "message": "Invalid email or password"}
    
    # Generate new token
    token = generate_token()
    tokens_db[token] = user_id
    
    print(f"👤 User logged in: {user['username']} ({user_id})")
    
    # Return user data without password
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "token": token,
            "user": user_public
        }
    }

@app.get("/auth/me")
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    user = get_user_from_token(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Return user data without password
    user_public = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "success": True,
        "data": {"user": user_public}
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
    
    print(f"✅ Move successful, game result: {game_result}")
    
    # Process rewards if game ended
    if game_result == "win":
        winner_name = updated_game_state.get("winner", None)
        if winner_name:
            prize_pool = updated_game_state.get("prize_pool", 950)
            city = updated_game_state.get("city", "dubai")
            
            print(f"🏆 Game ended, paying prize {prize_pool} to {winner_name}")
            try:
                await db_service.update_player_balance(winner_name, prize_pool, 0)
                await db_service.create_transaction({
                    "player_name": winner_name,
                    "game_id": game_id,
                    "transaction_type": "prize_payout",
                    "amount": prize_pool,
                    "description": f"Prize for winning in {city.title()} Arena",
                    "arena_type": city
                })
            except Exception as e:
                print(f"Error paying prize to {winner_name}: {e}")
    
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
    """WebSocket endpoint for city-specific matchmaking."""
    await websocket.accept()
    print(f"🎮 WebSocket connected for player {player_id}")
    
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "join_queue":
                player_name = message.get("player_name", "Anonymous")
                city = message.get("city", "dubai")  # Default to Dubai if not specified
                await matchmaking_queue.add_player(player_id, player_name, city, websocket)
                
            elif message.get("type") == "leave_queue":
                matchmaking_queue.remove_player(player_id)
                
            elif message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            
            # Signaling: Forward moves or poison selection to opponent
            elif "target_id" in message:
                target_id = message.get("target_id")
                if target_id in matchmaking_queue.active_connections:
                    target_ws = matchmaking_queue.active_connections[target_id]
                    # Inject sender info
                    message["from_id"] = player_id
                    await target_ws.send_text(json.dumps(message))
                
    except WebSocketDisconnect:
        print(f"🎮 WebSocket disconnected for player {player_id}")
        matchmaking_queue.remove_player(player_id)
    except Exception as e:
        print(f"🎮 WebSocket error for player {player_id}: {e}")
        matchmaking_queue.remove_player(player_id)

@app.get("/matchmaking/status")
async def get_matchmaking_status():
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
        player = await db_service.get_player(request.player_name)
        
        if player:
            return GameResponse(
                success=True,
                message="Balance retrieved",
                data={
                    "player_name": request.player_name,
                    "coin_balance": player["coin_balance"],
                    "diamonds_balance": player["diamonds_balance"]
                }
            )
        
        # Return default balance if player not found
        return GameResponse(
            success=True,
            message="Default balance (new player)",
            data={
                "player_name": request.player_name,
                "coin_balance": 10000,
                "diamonds_balance": 500  # PRD: 500 diamonds for new players
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
        # Get current balance
        player = await db_service.get_player(request.player_name)
        current_balance = player["coin_balance"] if player else 10000
        
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
        success = await db_service.update_player_balance(request.player_name, request.amount, 0)
        
        if not success:
            raise Exception("Failed to update player balance")
            
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
        
        await db_service.create_transaction(transaction_data)
        
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

# ===== FRIENDS & PROFILE ENDPOINTS =====

@app.get("/players/profile/{profile_id}")
async def get_player_by_profile_id(profile_id: str):
    """Find a player by their short Profile ID."""
    try:
        player = await db_service.get_player_by_profile_id(profile_id)
        if player:
            return {
                "success": True,
                "data": {
                    "username": player["name"],
                    "profile_id": player.get("profile_id"),
                    "games_played": player.get("games_played", 0),
                    "games_won": player.get("games_won", 0),
                    "coin_balance": player.get("coin_balance", 0)
                }
            }
        raise HTTPException(status_code=404, detail="Player not found")
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/players/{player_name}/friends")
async def get_player_friends(player_name: str):
    """Get list of friends for a player."""
    try:
        player = await db_service.get_player(player_name)
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        friends_list = []
        for friend_name in player.get("friends", []):
            friend_data = await db_service.get_player(friend_name)
            if friend_data:
                friends_list.append({
                    "username": friend_data["name"],
                    "profile_id": friend_data.get("profile_id"),
                    "games_won": friend_data.get("games_won", 0),
                    "status": "online" # Mock status
                })
        
        return {"success": True, "data": friends_list}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/players/friends/add")
async def add_friend(request: AddFriendRequest):
    """Add a friend by their Profile ID."""
    try:
        friend = await db_service.get_player_by_profile_id(request.friend_profile_id)
        if not friend:
            return {"success": False, "message": "Player with this ID not found"}
        
        if friend["name"] == request.player_name:
            return {"success": False, "message": "You cannot add yourself as a friend"}
            
        success = await db_service.add_friend(request.player_name, friend["name"])
        if success:
            # Also add reciprocally for simplicity in MVP
            await db_service.add_friend(friend["name"], request.player_name)
            return {"success": True, "message": f"Added {friend['name']} as a friend"}
        else:
            return {"success": False, "message": "Already in your friends list or error"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/players/{player_name}/stats")
async def get_player_full_stats(player_name: str):
    """Get full statistics for a player."""
    try:
        player = await db_service.get_player(player_name)
        if player:
            return {
                "success": True,
                "data": {
                    "username": player["name"],
                    "profile_id": player.get("profile_id"),
                    "games_played": player.get("games_played", 0),
                    "games_won": player.get("games_won", 0),
                    "coin_balance": player.get("coin_balance", 0),
                    "diamonds_balance": player.get("diamonds_balance", 0),
                    "total_coins_earned": player.get("total_coins_earned", 0),
                    "last_active": player.get("last_active")
                }
            }
        raise HTTPException(status_code=404, detail="Player not found")
    except Exception as e:
        return {"success": False, "message": str(e)}

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

# ===== LEADERBOARD ENDPOINTS =====

@app.get("/leaderboard/{sort_by}")
async def get_leaderboard(sort_by: str = "wins", limit: int = 10):
    """Get leaderboard sorted by specified field.
    
    Args:
        sort_by: One of 'wins', 'winrate', 'coins', 'games'
        limit: Maximum number of players to return (default 10)
    """
    try:
        valid_sort_options = ["wins", "winrate", "coins", "games"]
        if sort_by not in valid_sort_options:
            return {
                "success": False,
                "message": f"Invalid sort option. Valid options: {', '.join(valid_sort_options)}"
            }
        
        players = await db_service.get_leaderboard(sort_by, limit)
        
        # Format response with calculated win rates
        leaderboard = []
        for i, player in enumerate(players):
            games = player.get("games_played", 0)
            wins = player.get("games_won", 0)
            winrate = round((wins / games * 100) if games > 0 else 0, 1)
            
            leaderboard.append({
                "rank": i + 1,
                "name": player.get("name", "Anonymous"),
                "wins": wins,
                "games": games,
                "winrate": winrate,
                "coins": player.get("coin_balance", 0)
            })
        
        return {
            "success": True,
            "data": {
                "sort_by": sort_by,
                "leaderboard": leaderboard
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get leaderboard: {str(e)}"
        }

class PlayerStatsUpdate(BaseModel):
    """Request model for updating player stats."""
    player_name: str
    won: bool

@app.post("/players/stats/update", response_model=GameResponse)
async def update_player_stats(request: PlayerStatsUpdate):
    """Update player statistics after a game."""
    try:
        success = await db_service.update_player_stats(request.player_name, request.won)
        
        if success:
            return GameResponse(
                success=True,
                message=f"Stats updated for {request.player_name}"
            )
        else:
            return GameResponse(
                success=False,
                message="Failed to update player stats"
            )
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Error updating stats: {str(e)}"
        )


@app.post("/matchmaking/join", response_model=GameResponse)
async def join_matchmaking_queue(request: JoinMatchmakingCityRequest):
    """Join a city-specific matchmaking queue via REST API."""
    try:
        # Validate city
        valid_cities = ["dubai", "cairo", "oslo"]
        if request.city.lower() not in valid_cities:
            return GameResponse(
                success=False,
                message=f"Invalid city. Valid cities: {', '.join(valid_cities)}"
            )
        
        # Generate a temporary player ID for REST API users
        import uuid
        temp_player_id = str(uuid.uuid4())
        
        # Note: This would typically require a WebSocket connection for real-time updates
        # For now, we'll return success with instructions to use WebSocket
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

@app.post("/candy/select", response_model=GameResponse)
async def select_candy(request: CandySelectionRequest):
    """Submit candy selection for confirmation."""
    try:
        game_state = game_engine.get_game_state(request.game_id)
        if not game_state:
            return GameResponse(
                success=False,
                message="Game not found"
            )
        
        # Update game state with candy selection
        if request.player_id == game_state.get("player1", {}).get("id"):
            game_state["player1"]["selected_candy"] = request.candy_id
            game_state["player1"]["candy_confirmed"] = True
        elif request.player_id == game_state.get("player2", {}).get("id"):
            game_state["player2"]["selected_candy"] = request.candy_id
            game_state["player2"]["candy_confirmed"] = True
        else:
            return GameResponse(
                success=False,
                message="Player not found in game"
            )
        
        # Update game status
        game_engine.update_game_state(request.game_id, game_state)
        
        # Check if both players have confirmed their candy selection
        both_confirmed = (
            game_state.get("player1", {}).get("candy_confirmed", False) and
            game_state.get("player2", {}).get("candy_confirmed", False)
        )
        
        if both_confirmed:
            game_state["status"] = "ready_for_game_start"
            game_engine.update_game_state(request.game_id, game_state)
        
        return GameResponse(
            success=True,
            message="Candy selection confirmed",
            data={
                "game_id": request.game_id,
                "player_id": request.player_id,
                "candy_id": request.candy_id,
                "both_players_ready": both_confirmed,
                "game_status": game_state.get("status", "waiting_for_candy_selection")
            }
        )
        
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to select candy: {str(e)}"
        )

@app.get("/game/status/{game_id}")
async def get_game_status(game_id: str):
    """Check game status including opponent's readiness."""
    try:
        game_state = game_engine.get_game_state(game_id)
        if not game_state:
            return GameResponse(
                success=False,
                message="Game not found"
            )
        
        # Get player statuses
        player1_status = {
            "id": game_state.get("player1", {}).get("id"),
            "name": game_state.get("player1", {}).get("name"),
            "candy_confirmed": game_state.get("player1", {}).get("candy_confirmed", False),
            "on_gameplay_screen": game_state.get("player1", {}).get("on_gameplay_screen", False),
            "ready_for_game_start": game_state.get("player1", {}).get("ready_for_game_start", False)
        }
        
        player2_status = {
            "id": game_state.get("player2", {}).get("id"),
            "name": game_state.get("player2", {}).get("name"),
            "candy_confirmed": game_state.get("player2", {}).get("candy_confirmed", False),
            "on_gameplay_screen": game_state.get("player2", {}).get("on_gameplay_screen", False),
            "ready_for_game_start": game_state.get("player2", {}).get("ready_for_game_start", False)
        }
        
        return GameResponse(
            success=True,
            message="Game status retrieved",
            data={
                "game_id": game_id,
                "status": game_state.get("status", "unknown"),
                "city": game_state.get("city", "dubai"),
                "player1": player1_status,
                "player2": player2_status,
                "game_started": game_state.get("game_started", False),
                "timer_started": game_state.get("timer_started", False)
            }
        )
        
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to get game status: {str(e)}"
        )

@app.post("/game/start", response_model=GameResponse)
async def start_game(request: GameStartRequest):
    """Signal game start and timer initialization."""
    try:
        game_state = game_engine.get_game_state(request.game_id)
        if not game_state:
            return GameResponse(
                success=False,
                message="Game not found"
            )
        
        # Verify player is in the game
        player_in_game = (
            request.player_id == game_state.get("player1", {}).get("id") or
            request.player_id == game_state.get("player2", {}).get("id")
        )
        
        if not player_in_game:
            return GameResponse(
                success=False,
                message="Player not in this game"
            )
        
        # Mark player as ready for game start
        if request.player_id == game_state.get("player1", {}).get("id"):
            game_state["player1"]["ready_for_game_start"] = True
        elif request.player_id == game_state.get("player2", {}).get("id"):
            game_state["player2"]["ready_for_game_start"] = True
        
        # Check if both players are ready
        both_ready = (
            game_state.get("player1", {}).get("ready_for_game_start", False) and
            game_state.get("player2", {}).get("ready_for_game_start", False)
        )
        
        if both_ready and not game_state.get("game_started", False):
            # Start the game with synchronized timer
            import time
            game_state["game_started"] = True
            game_state["timer_started"] = True
            game_state["game_start_time"] = time.time()
            game_state["status"] = "active"
            
            # Set turn timer based on city
            city = game_state.get("city", "dubai")
            game_state["turn_timer_seconds"] = matchmaking_queue.get_city_turn_timer(city)
            
            print(f"🎮 Game {request.game_id} started with synchronized timer for city {city}")
        
        # Update game state
        game_engine.update_game_state(request.game_id, game_state)
        
        return GameResponse(
            success=True,
            message="Game start signal processed",
            data={
                "game_id": request.game_id,
                "player_ready": True,
                "both_players_ready": both_ready,
                "game_started": game_state.get("game_started", False),
                "timer_started": game_state.get("timer_started", False),
                "game_start_time": game_state.get("game_start_time"),
                "turn_timer_seconds": game_state.get("turn_timer_seconds")
            }
        )
        
    except Exception as e:
        return GameResponse(
            success=False,
            message=f"Failed to start game: {str(e)}"
        )

# PRD: WebSocket signaling endpoint for P2P connections
@app.websocket("/signaling/{player_id}")
async def websocket_signaling(websocket: WebSocket, player_id: str):
    """WebSocket endpoint for P2P signaling (WebRTC)."""
    await websocket.accept()
    print(f"🔗 P2P signaling connected for player {player_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different signaling message types
            message_type = message.get("type")
            
            if message_type == "find-peer":
                # Player requesting peer in specific city
                city = message.get("city", "dubai").lower()
                player_name = message.get("player_name", "Anonymous")
                
                # Try to find another player in the same city
                await handle_p2p_matchmaking(player_id, player_name, city, websocket)
                
            elif message_type in ["offer", "answer", "ice-candidate"]:
                # Forward P2P signaling messages to target peer
                target_id = message.get("to")
                if target_id:
                    await forward_signaling_message(target_id, message)
                
            elif message_type == "reconnect-request":
                # Handle reconnection requests
                remote_peer_id = message.get("remotePeerId")
                if remote_peer_id:
                    await handle_p2p_reconnection(player_id, remote_peer_id, websocket)
                
    except WebSocketDisconnect:
        print(f"🔗 P2P signaling disconnected for player {player_id}")
        await cleanup_p2p_connection(player_id)

# P2P matchmaking storage
p2p_waiting_players = {}  # city -> list of players
p2p_signaling_connections = {}  # player_id -> websocket

async def handle_p2p_matchmaking(player_id: str, player_name: str, city: str, websocket: WebSocket):
    """Handle P2P matchmaking for a specific city."""
    global p2p_waiting_players, p2p_signaling_connections
    
    p2p_signaling_connections[player_id] = websocket
    
    if city not in p2p_waiting_players:
        p2p_waiting_players[city] = []
    
    # Check if there's another player waiting in this city
    if p2p_waiting_players[city]:
        # Match with waiting player
        waiting_player = p2p_waiting_players[city].pop(0)
        
        # Notify both players they found each other
        await websocket.send_text(json.dumps({
            "type": "peer-found",
            "peerId": waiting_player["id"],
            "isHost": False,
            "city": city
        }))
        
        if waiting_player["id"] in p2p_signaling_connections:
            await p2p_signaling_connections[waiting_player["id"]].send_text(json.dumps({
                "type": "peer-found",
                "peerId": player_id,
                "isHost": True,
                "city": city
            }))
        
        print(f"🔗 P2P matched in {city}: {waiting_player['name']} vs {player_name}")
        
    else:
        # Add to waiting list
        p2p_waiting_players[city].append({
            "id": player_id,
            "name": player_name,
            "websocket": websocket,
            "city": city
        })
        print(f"🔗 Player {player_name} waiting for P2P match in {city}")

async def forward_signaling_message(target_id: str, message: dict):
    """Forward signaling message to target peer."""
    if target_id in p2p_signaling_connections:
        try:
            await p2p_signaling_connections[target_id].send_text(json.dumps(message))
        except Exception as e:
            print(f"Failed to forward signaling to {target_id}: {e}")

async def handle_p2p_reconnection(player_id: str, remote_peer_id: str, websocket: WebSocket):
    """Handle P2P reconnection requests."""
    # Notify remote peer about reconnection attempt
    if remote_peer_id in p2p_signaling_connections:
        try:
            await p2p_signaling_connections[remote_peer_id].send_text(json.dumps({
                "type": "reconnect-attempt",
                "from": player_id,
                "message": "Peer attempting to reconnect"
            }))
        except Exception as e:
            print(f"Failed to notify reconnection to {remote_peer_id}: {e}")

async def cleanup_p2p_connection(player_id: str):
    """Clean up P2P connection data."""
    global p2p_waiting_players, p2p_signaling_connections
    
    # Remove from signaling connections
    if player_id in p2p_signaling_connections:
        del p2p_signaling_connections[player_id]
    
    # Remove from waiting players
    for city, players in p2p_waiting_players.items():
        p2p_waiting_players[city] = [p for p in players if p["id"] != player_id]

# ===== DAILY REWARD ENDPOINTS =====

@app.post("/players/daily-reward", response_model=GameResponse)
async def claim_daily_reward(request: PlayerBalanceRequest):
    """Claim daily coin reward (once every 24 hours)."""
    try:
        player = await db_service.get_player(request.player_name)
        if not player:
            return GameResponse(success=False, message="Player not found")
            
        last_reward = player.get("last_daily_reward")
        now = datetime.now(timezone.utc)
        
        if last_reward:
            # Parse last reward time
            if isinstance(last_reward, str):
                last_reward_time = datetime.fromisoformat(last_reward.replace('Z', '+00:00'))
            else:
                last_reward_time = last_reward
                
            # Check if 24 hours have passed
            time_diff = now - last_reward_time
            if time_diff.total_seconds() < 24 * 3600:
                seconds_remaining = (24 * 3600) - time_diff.total_seconds()
                hours = int(seconds_remaining // 3600)
                minutes = int((seconds_remaining % 3600) // 60)
                
                return GameResponse(
                    success=False,
                    message=f"Daily reward is on cooldown. Next claim available in {hours}h {minutes}m.",
                    data={"cooldown_seconds_remaining": int(seconds_remaining)}
                )
        
        # Grant reward
        reward_amount = 1000
        await db_service.update_player_balance(request.player_name, reward_amount, 0)
        
        # Update last_daily_reward timestamp
        update_data = {"last_daily_reward": now.isoformat()}
        if hasattr(db_service, 'supabase'):
            db_service.supabase.table("players").update(update_data).eq("name", request.player_name).execute()
        else:
            # For in-memory, we already updated balance, now update the dict manually
            if request.player_name in db_service.players:
                db_service.players[request.player_name]["last_daily_reward"] = now.isoformat()
        
        # Record transaction
        await db_service.create_transaction({
            "player_name": request.player_name,
            "transaction_type": "reward",
            "amount": reward_amount,
            "description": "Daily login reward"
        })
        
        # Get updated balance
        updated_player = await db_service.get_player(request.player_name)
        
        return GameResponse(
            success=True,
            message=f"Successfully claimed {reward_amount} coins!",
            data={
                "reward_amount": reward_amount,
                "new_balance": updated_player["coin_balance"]
            }
        )
        
    except Exception as e:
        print(f"Error in claim_daily_reward: {e}")
        return GameResponse(success=False, message=f"Failed to claim reward: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 