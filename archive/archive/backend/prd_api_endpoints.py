# ===== PRD-COMPLIANT API ENDPOINTS =====
# Implements API endpoints as specified in P2P Integration Guide

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import time
import json
import asyncio
import uuid
from datetime import datetime, timezone

# Request/Response Models
class MatchmakingJoinRequest(BaseModel):
    city: str  # dubai, cairo, oslo
    player_name: str
    player_id: Optional[str] = None

class CandySelectRequest(BaseModel):
    player_id: str
    candy_id: str
    game_id: str

class GameStartRequest(BaseModel):
    game_id: str
    players: List[str]
    start_time: Optional[int] = None

class TimeResponse(BaseModel):
    timestamp: int
    timezone: str
    server_id: str

class MatchmakingResponse(BaseModel):
    success: bool
    message: str
    queue_position: Optional[int] = None
    estimated_wait: Optional[int] = None

class GameStatusResponse(BaseModel):
    game_id: str
    status: str
    players: Dict
    ready_players: List[str]
    all_ready: bool

# PRD-Compliant API Server
class PRDApiServer:
    def __init__(self):
        self.app = FastAPI(title="PCD Game API - PRD Compliant")
        
        # Add CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # In-memory storage (would be replaced with proper database)
        self.matchmaking_queues = {
            "dubai": [],
            "cairo": [],
            "oslo": []
        }
        self.active_games = {}
        self.player_status = {}
        self.websocket_connections = {}
        
        self.setup_routes()
        print("✅ PRD-compliant API server initialized")
    
    def setup_routes(self):
        """Setup all PRD-specified routes"""
        
        # ===== TIMER SYNCHRONIZATION =====
        @self.app.get("/api/time", response_model=TimeResponse)
        async def get_server_time():
            """PRD: Get precise server timestamp for synchronization"""
            return TimeResponse(
                timestamp=int(time.time() * 1000),  # Milliseconds
                timezone="UTC",
                server_id="pcd-game-server-1"
            )
        
        # ===== MATCHMAKING ENDPOINTS =====
        @self.app.post("/matchmaking/join", response_model=MatchmakingResponse)
        async def join_matchmaking(request: MatchmakingJoinRequest):
            """PRD: Join city-specific matchmaking queue"""
            
            if request.city.lower() not in self.matchmaking_queues:
                raise HTTPException(status_code=400, detail=f"Invalid city: {request.city}")
            
            city = request.city.lower()
            player_id = request.player_id or str(uuid.uuid4())
            
            # Add player to queue
            player_data = {
                "id": player_id,
                "name": request.player_name,
                "city": city,
                "joined_at": time.time(),
                "status": "waiting"
            }
            
            self.matchmaking_queues[city].append(player_data)
            self.player_status[player_id] = player_data
            
            queue_position = len(self.matchmaking_queues[city])
            estimated_wait = max(0, (queue_position - 1) * 15)  # Estimate 15s per player ahead
            
            print(f"🎮 Player {request.player_name} joined {city} queue (position: {queue_position})")
            
            # Try to match immediately
            asyncio.create_task(self.try_match_players(city))
            
            return MatchmakingResponse(
                success=True,
                message=f"Joined {city.title()} matchmaking queue",
                queue_position=queue_position,
                estimated_wait=estimated_wait
            )
        
        @self.app.delete("/matchmaking/leave/{player_id}")
        async def leave_matchmaking(player_id: str):
            """PRD: Leave matchmaking queue"""
            
            if player_id not in self.player_status:
                raise HTTPException(status_code=404, detail="Player not found")
            
            player_data = self.player_status[player_id]
            city = player_data["city"]
            
            # Remove from queue
            self.matchmaking_queues[city] = [
                p for p in self.matchmaking_queues[city] 
                if p["id"] != player_id
            ]
            
            del self.player_status[player_id]
            
            print(f"🎮 Player {player_id} left {city} queue")
            
            return {"success": True, "message": "Left matchmaking queue"}
        
        @self.app.get("/matchmaking/status/{player_id}")
        async def get_matchmaking_status(player_id: str):
            """PRD: Get current matchmaking status"""
            
            if player_id not in self.player_status:
                return {"status": "not_in_queue", "message": "Player not in any queue"}
            
            player_data = self.player_status[player_id]
            city = player_data["city"]
            queue = self.matchmaking_queues[city]
            
            try:
                position = next(i for i, p in enumerate(queue) if p["id"] == player_id) + 1
            except StopIteration:
                position = 0
            
            return {
                "status": player_data["status"],
                "city": city,
                "queue_position": position,
                "queue_size": len(queue),
                "wait_time": int(time.time() - player_data["joined_at"])
            }
        
        # ===== CANDY SELECTION =====
        @self.app.post("/candy/select")
        async def select_candy(request: CandySelectRequest):
            """PRD: Submit candy selection"""
            
            if request.game_id not in self.active_games:
                raise HTTPException(status_code=404, detail="Game not found")
            
            game = self.active_games[request.game_id]
            
            # Update player's candy selection
            for player in game["players"]:
                if player["id"] == request.player_id:
                    player["selected_candy"] = request.candy_id
                    player["selection_time"] = time.time()
                    break
            else:
                raise HTTPException(status_code=404, detail="Player not in game")
            
            # Check if all players have selected
            all_selected = all(
                "selected_candy" in player 
                for player in game["players"]
            )
            
            if all_selected:
                game["status"] = "candy_selection_complete"
                game["ready_for_game"] = True
            
            print(f"🍭 Player {request.player_id} selected candy in game {request.game_id}")
            
            return {
                "success": True,
                "message": "Candy selection recorded",
                "all_selected": all_selected,
                "game_status": game["status"]
            }
        
        # ===== GAME STATUS =====
        @self.app.get("/game/status/{game_id}", response_model=GameStatusResponse)
        async def get_game_status(game_id: str):
            """PRD: Check opponent's status and game state"""
            
            if game_id not in self.active_games:
                raise HTTPException(status_code=404, detail="Game not found")
            
            game = self.active_games[game_id]
            
            # Build player status
            players = {}
            ready_players = []
            
            for player in game["players"]:
                player_id = player["id"]
                players[player_id] = {
                    "name": player["name"],
                    "status": player.get("status", "waiting"),
                    "ready": player.get("ready", False),
                    "candy_selected": "selected_candy" in player,
                    "on_gameplay_screen": player.get("on_gameplay_screen", False)
                }
                
                if player.get("ready", False):
                    ready_players.append(player_id)
            
            all_ready = len(ready_players) == len(game["players"])
            
            return GameStatusResponse(
                game_id=game_id,
                status=game["status"],
                players=players,
                ready_players=ready_players,
                all_ready=all_ready
            )
        
        # ===== GAME START =====
        @self.app.post("/game/start")
        async def start_game(request: GameStartRequest):
            """PRD: Signal synchronized game start"""
            
            if request.game_id not in self.active_games:
                raise HTTPException(status_code=404, detail="Game not found")
            
            game = self.active_games[request.game_id]
            
            # Verify all players are ready
            all_on_gameplay = all(
                player.get("on_gameplay_screen", False) 
                for player in game["players"]
            )
            
            if not all_on_gameplay:
                raise HTTPException(
                    status_code=400, 
                    detail="All players must be on gameplay screen before starting"
                )
            
            # Set synchronized start time
            start_time = request.start_time or int(time.time() * 1000) + 3000  # 3 second delay
            
            game["status"] = "starting"
            game["start_time"] = start_time
            game["started_at"] = time.time()
            
            print(f"🎮 Game {request.game_id} starting at synchronized time {start_time}")
            
            # Notify all players via WebSocket (if connected)
            start_message = {
                "type": "game_start",
                "game_id": request.game_id,
                "start_time": start_time,
                "synchronized": True
            }
            
            for player in game["players"]:
                player_id = player["id"]
                if player_id in self.websocket_connections:
                    try:
                        await self.websocket_connections[player_id].send_text(
                            json.dumps(start_message)
                        )
                    except Exception as e:
                        print(f"Failed to notify player {player_id}: {e}")
            
            return {
                "success": True,
                "message": "Game starting",
                "start_time": start_time,
                "synchronized": True
            }
        
        # ===== PLAYER STATUS UPDATES =====
        @self.app.post("/player/{player_id}/status")
        async def update_player_status(player_id: str, status_data: Dict):
            """Update player status (ready, on_gameplay_screen, etc.)"""
            
            # Find player's game
            game_id = None
            for gid, game in self.active_games.items():
                for player in game["players"]:
                    if player["id"] == player_id:
                        game_id = gid
                        # Update player status
                        player.update(status_data)
                        break
                if game_id:
                    break
            
            if not game_id:
                raise HTTPException(status_code=404, detail="Player not found in any active game")
            
            print(f"📊 Player {player_id} status updated: {status_data}")
            
            return {
                "success": True,
                "message": "Player status updated",
                "game_id": game_id
            }
        
        # ===== WEBSOCKET FOR SIGNALING =====
        @self.app.websocket("/signaling/{player_id}")
        async def websocket_signaling(websocket: WebSocket, player_id: str):
            """WebSocket endpoint for P2P signaling"""
            await websocket.accept()
            self.websocket_connections[player_id] = websocket
            
            try:
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    await self.handle_signaling_message(player_id, message)
                    
            except WebSocketDisconnect:
                print(f"🔌 Player {player_id} disconnected from signaling")
                if player_id in self.websocket_connections:
                    del self.websocket_connections[player_id]
        
        # ===== HEALTH CHECK =====
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {
                "status": "healthy",
                "timestamp": int(time.time() * 1000),
                "active_games": len(self.active_games),
                "total_queue_size": sum(len(q) for q in self.matchmaking_queues.values())
            }
    
    async def try_match_players(self, city: str):
        """Try to match players in city queue"""
        queue = self.matchmaking_queues[city]
        
        if len(queue) >= 2:
            # Match first two players
            player1 = queue.pop(0)
            player2 = queue.pop(0)
            
            # Create game
            game_id = str(uuid.uuid4())
            game = {
                "id": game_id,
                "city": city,
                "status": "matched",
                "created_at": time.time(),
                "players": [
                    {
                        "id": player1["id"],
                        "name": player1["name"],
                        "role": "player1",
                        "ready": False
                    },
                    {
                        "id": player2["id"],
                        "name": player2["name"],
                        "role": "player2",
                        "ready": False
                    }
                ]
            }
            
            self.active_games[game_id] = game
            
            # Update player status
            player1["status"] = "matched"
            player1["game_id"] = game_id
            player2["status"] = "matched"
            player2["game_id"] = game_id
            
            print(f"🎮 Matched players in {city}: {player1['name']} vs {player2['name']}")
            
            # Notify players via WebSocket
            match_message1 = {
                "type": "match_found",
                "game_id": game_id,
                "opponent": {"name": player2["name"], "id": player2["id"]},
                "your_role": "player1",
                "city": city
            }
            
            match_message2 = {
                "type": "match_found",
                "game_id": game_id,
                "opponent": {"name": player1["name"], "id": player1["id"]},
                "your_role": "player2",
                "city": city
            }
            
            # Send notifications
            for player_id, message in [(player1["id"], match_message1), (player2["id"], match_message2)]:
                if player_id in self.websocket_connections:
                    try:
                        await self.websocket_connections[player_id].send_text(json.dumps(message))
                    except Exception as e:
                        print(f"Failed to notify player {player_id}: {e}")
    
    async def handle_signaling_message(self, player_id: str, message: Dict):
        """Handle P2P signaling messages"""
        message_type = message.get("type")
        
        if message_type == "find-peer":
            # Player requesting peer in specific city
            city = message.get("city", "dubai").lower()
            await self.try_match_players(city)
            
        elif message_type in ["offer", "answer", "ice-candidate"]:
            # Forward P2P signaling messages to target peer
            target_id = message.get("to")
            if target_id and target_id in self.websocket_connections:
                try:
                    await self.websocket_connections[target_id].send_text(json.dumps(message))
                except Exception as e:
                    print(f"Failed to forward signaling to {target_id}: {e}")

# Global server instance
prd_api_server = None

def create_prd_api_server():
    """Create PRD-compliant API server"""
    global prd_api_server
    if not prd_api_server:
        prd_api_server = PRDApiServer()
    return prd_api_server.app

# Export the FastAPI app
app = create_prd_api_server()

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting PRD-compliant API server...")
    uvicorn.run(app, host="0.0.0.0", port=8000) 