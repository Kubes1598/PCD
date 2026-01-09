import json
import asyncio
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from game_config import CITY_CONFIG
from utils.redis_client import redis_client

class ConnectionManager:
    """Manages WebSocket connections with reconnection support."""
    
    def __init__(self):
        self.game_connections: Dict[str, Dict[str, WebSocket]] = {} # game_id -> {player_id: websocket}
        self.disconnected_players: Dict[str, asyncio.TimerHandle] = {} # player_id -> timer
    
    async def connect(self, websocket: WebSocket, game_id: str, player_id: str):
        if game_id not in self.game_connections:
            self.game_connections[game_id] = {}
        
        self.game_connections[game_id][player_id] = websocket
        
        # Clear any disconnection timer
        if player_id in self.disconnected_players:
            print(f"🔄 Player {player_id} reconnected to game {game_id}")
            self.disconnected_players[player_id].cancel()
            del self.disconnected_players[player_id]
    
    def disconnect(self, player_id: str, game_id: str):
        if game_id in self.game_connections:
            if player_id in self.game_connections[game_id]:
                del self.game_connections[game_id][player_id]
            
            # Start grace period timer
            loop = asyncio.get_event_loop()
            self.disconnected_players[player_id] = loop.call_later(
                60.0, # 60 seconds grace period
                lambda: asyncio.create_task(self.handle_grace_period_expiry(player_id, game_id))
            )
            print(f"⏳ Player {player_id} disconnected. 60s grace period started.")

    async def handle_grace_period_expiry(self, player_id: str, game_id: str):
        if player_id in self.disconnected_players:
            print(f"⏰ Grace period expired for player {player_id} in {game_id}")
            # Here we could trigger a forfeit or cleanup
            # For now, just cleanup the dictionary
            if player_id in self.disconnected_players:
                del self.disconnected_players[player_id]
            
            if game_id in self.game_connections and not self.game_connections[game_id]:
                del self.game_connections[game_id]

    async def broadcast_to_game(self, game_id: str, message: dict):
        if game_id in self.game_connections:
            for player_id, ws in self.game_connections[game_id].items():
                try: await ws.send_text(json.dumps(message))
                except: pass

class CityMatchmakingQueue:
    """Manages city-specific matchmaking queues for online players using Redis."""
    
    def __init__(self, game_engine, db_service):
        self.game_engine = game_engine
        self.db_service = db_service
        self.active_connections: Dict[str, WebSocket] = {} # Local instance only
        self.player_timers: Dict[str, Any] = {} # Local instance only
    
    def get_city_entry_cost(self, city: str) -> int:
        city_lower = city.lower()
        return CITY_CONFIG.get(city_lower, {}).get("entry_fee", 500)
    
    def get_city_prize_pool(self, city: str) -> int:
        city_lower = city.lower()
        return CITY_CONFIG.get(city_lower, {}).get("prize_amount", 950)
    
    def get_city_turn_timer(self, city: str) -> int:
        city_lower = city.lower()
        return CITY_CONFIG.get(city_lower, {}).get("turn_timer", 30)

    async def add_player(self, player_id: str, player_name: str, city: str, websocket: WebSocket):
        city_lower = city.lower()
        r = await redis_client.connect()
        
        # Check balance
        player_data = await self.db_service.get_player(player_name)
        current_balance = player_data["coin_balance"] if player_data else 10000
        entry_cost = self.get_city_entry_cost(city_lower)
        if current_balance < entry_cost:
            await websocket.send_text(json.dumps({"type": "matchmaking_error", "message": f"Shortfall: {entry_cost - current_balance} coins"}))
            return

        player = {"id": player_id, "name": player_name, "city": city_lower}
        await r.rpush(f"pcd:queue:{city_lower}", json.dumps(player))
        await r.hset("pcd:player_city", player_id, city_lower)
        
        self.active_connections[player_id] = websocket
        loop = asyncio.get_event_loop()
        self.player_timers[player_id] = loop.call_later(30.0, lambda: asyncio.create_task(self.handle_matchmaking_timeout(player_id, city_lower)))
        
        await self.try_match_players(city_lower)

    async def try_match_players(self, city: str):
        r = await redis_client.connect()
        queue_key = f"pcd:queue:{city}"
        
        if await r.llen(queue_key) >= 2:
            p1_raw = await r.lpop(queue_key)
            p2_raw = await r.lpop(queue_key)
            if not p1_raw or not p2_raw: return
            
            p1, p2 = json.loads(p1_raw), json.loads(p2_raw)
            entry_cost = self.get_city_entry_cost(city)
            
            # Atomic Deduction (Backend Authoritative)
            try:
                # Deduct from both players
                success1 = await self.db_service.update_player_balance(p1["name"], -entry_cost)
                success2 = await self.db_service.update_player_balance(p2["name"], -entry_cost)
                
                if not success1 or not success2:
                    # Basic rollback logic - if one failed, try to refund the other
                    if success1: await self.db_service.update_player_balance(p1["name"], entry_cost)
                    if success2: await self.db_service.update_player_balance(p2["name"], entry_cost)
                    print(f"💰 Matchmaking failed for {p1['name']}/{p2['name']} due to balance error")
                    return
                
                # Log transaction
                await self.db_service.create_transaction({
                    "player_name": p1["name"], "amount": -entry_cost, "type": "entry_fee", "city": city
                })
                await self.db_service.create_transaction({
                    "player_name": p2["name"], "amount": -entry_cost, "type": "entry_fee", "city": city
                })
            except Exception as e:
                print(f"💰 Balance deduction failed: {e}")
                return

            game_id = self.game_engine.create_game(p1["name"], p2["name"])
            game_state = self.game_engine.get_game_state(game_id)
            
            # Persist the initial game state immediately
            await self.db_service.create_game({
                "id": game_id,
                "player1_name": p1["name"],
                "player2_name": p2["name"],
                "game_state": game_state,
                "status": "waiting_for_poison",
                "city": city
            })
            
            # Map players to the game in Redis
            await r.hset("pcd:player_game", p1["id"], game_id)
            await r.hset("pcd:player_game", p2["id"], game_id)
            await r.hset("pcd:game_city", game_id, city)
            
            # Notify websockets
            for p in [p1, p2]:
                if p["id"] in self.player_timers: self.player_timers[p["id"]].cancel()
                if p["id"] in self.active_connections:
                    ws = self.active_connections[p["id"]]
                    await ws.send_text(json.dumps({
                        "type": "match_found", 
                        "game_id": game_id, 
                        "game_state": game_state,
                        "opponent_id": p2["id"] if p["id"] == p1["id"] else p1["id"]
                    }))

    def remove_player(self, player_id: str):
        # Implementation to remove from Redis queue is more complex (needs LREM)
        # For Phase 3, we'll implement it and cleanup local timers.
        if player_id in self.player_timers:
            self.player_timers[player_id].cancel()
            del self.player_timers[player_id]
        if player_id in self.active_connections:
            del self.active_connections[player_id]

    async def handle_matchmaking_timeout(self, player_id: str, city: str):
        if player_id in self.active_connections:
            try: await self.active_connections[player_id].send_text(json.dumps({"type": "matchmaking_timeout", "city": city}))
            except: pass
            self.remove_player(player_id)

class GameTimerManager:
    """Manages turn timers using Redis for persistence."""
    
    def __init__(self, matchmaking_queue, game_engine, db_service):
        self.matchmaking_queue = matchmaking_queue
        self.game_engine = game_engine
        self.db_service = db_service
        self.active_tasks: Dict[str, asyncio.Task] = {}
    
    async def start_timer(self, game_id: str, player_id: str, duration: int, ws1: WebSocket, ws2: WebSocket):
        r = await redis_client.connect()
        deadline = asyncio.get_event_loop().time() + duration
        await r.hset("pcd:timer:deadline", game_id, deadline)
        await r.hset("pcd:timer:player", game_id, player_id)
        
        if game_id in self.active_tasks: self.active_tasks[game_id].cancel()
        self.active_tasks[game_id] = asyncio.create_task(self._timer_loop(game_id, ws1, ws2))

    async def _timer_loop(self, game_id: str, ws1: WebSocket, ws2: WebSocket):
        try:
            r = await redis_client.connect()
            while True:
                deadline = float(await r.hget("pcd:timer:deadline", game_id) or 0)
                now = asyncio.get_event_loop().time()
                remaining = int(max(0, deadline - now))
                
                if remaining <= 0: break
                
                msg = json.dumps({"type": "timer_sync", "game_id": game_id, "seconds": remaining})
                for ws in [ws1, ws2]:
                    try: await ws.send_text(msg)
                    except: pass
                await asyncio.sleep(1.0)
            
            # Timeout logic... (Same as v1)
        except asyncio.CancelledError: pass
        finally:
            if game_id in self.active_tasks: del self.active_tasks[game_id]
