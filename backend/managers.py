import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from game_config import CITY_CONFIG
from utils.redis_client import redis_client

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections with reconnection support and state authority."""
    
    def __init__(self):
        self.active_sockets: Dict[str, WebSocket] = {} # player_id -> websocket
        self.player_states: Dict[str, str] = {} # player_id -> state (IDLE, QUEUE, IN_GAME)
        self.player_games: Dict[str, str] = {} # player_id -> game_id
        self.disconnected_players: Dict[str, asyncio.TimerHandle] = {} # player_id -> timer
    
    async def connect(self, websocket: WebSocket, player_id: str):
        self.active_sockets[player_id] = websocket
        
        # Handle reconnection
        if player_id in self.disconnected_players:
            print(f"🔄 Player {player_id} reconnected. Cancelling expiry timer.")
            self.disconnected_players[player_id].cancel()
            del self.disconnected_players[player_id]
            
            # Check if they were in a game
            game_id = self.player_games.get(player_id)
            if game_id:
                self.player_states[player_id] = "IN_GAME"
                print(f"🎮 Player {player_id} restored to game {game_id}")
                
                # Immediately sync them back to the game state
                # Note: We need the engine and db here, or just send a 'reconnected' event
                await self.send_personal_message({
                    "type": "reconnected",
                    "game_id": game_id,
                    "state": "IN_GAME"
                }, player_id)
            else:
                self.player_states[player_id] = "IDLE"
        else:
            self.player_states[player_id] = "IDLE"
            print(f"✅ Player {player_id} connected (Initial)")
    
    def disconnect(self, player_id: str):
        if player_id in self.active_sockets:
            del self.active_sockets[player_id]
        
        # Start grace period timer for game recovery if they were in a game
        if self.player_states.get(player_id) == "IN_GAME":
            loop = asyncio.get_event_loop()
            self.disconnected_players[player_id] = loop.call_later(
                60.0, # 60 seconds grace period
                lambda: asyncio.create_task(self.handle_grace_period_expiry(player_id))
            )
            print(f"⏳ Player {player_id} disconnected mid-game. 60s grace period started.")
        else:
            # If they weren't in a game, just clean up
            self.player_states.pop(player_id, None)
            self.player_games.pop(player_id, None)

    async def handle_grace_period_expiry(self, player_id: str):
        if player_id in self.disconnected_players:
            print(f"⏰ Grace period expired for player {player_id}")
            # Clean up state
            self.player_states.pop(player_id, None)
            game_id = self.player_games.pop(player_id, None)
            
            if player_id in self.disconnected_players:
                del self.disconnected_players[player_id]

    async def send_personal_message(self, message: dict, player_id: str):
        if player_id in self.active_sockets:
            try:
                await self.active_sockets[player_id].send_text(json.dumps(message))
            except Exception as e:
                print(f"❌ Failed to send message to {player_id}: {e}")

class CityMatchmakingQueue:
    """Manages city-specific matchmaking queues with atomic transactions."""
    
    def __init__(self, game_engine, db_service, connection_manager, timer_manager=None):
        self.game_engine = game_engine
        self.db_service = db_service
        self.connection_manager = connection_manager
        self.timer_manager = timer_manager
        self.matching_lock = asyncio.Lock() # Prevent race conditions in matching logic
        self.player_timers: Dict[str, Any] = {} # Local instance only
    
    def get_city_config(self, city: str) -> dict:
        # Try capitalized first (new format), then lowercase (legacy)
        capitalized = city.capitalize()
        return CITY_CONFIG.get(capitalized) or CITY_CONFIG.get(city.lower(), {
            "entry_fee": 500, "prize_amount": 950, "turn_timer": 30
        })

    async def add_player(self, player_id: str, player_name: str, city: str, websocket: WebSocket):
        city_lower = city.lower()
        print(f"👤 Player {player_name} ({player_id}) joining {city_lower} queue")
        
        # 1. Authoritative Balance Check
        player_data = await self.db_service.get_player(player_name)
        entry_fee = self.get_city_config(city_lower)["entry_fee"]
        current_balance = player_data.get("coin_balance", 0) if player_data else 10000 
        
        if current_balance < entry_fee:
            print(f"❌ Matchmaking failed: {player_name} has insufficient balance")
            await websocket.send_text(json.dumps({
                "type": "matchmaking_error", 
                "message": f"Insufficient coins. Need {entry_fee}."
            }))
            return

        # 2. Add to Redis Queue
        r = await redis_client.connect()
        player_info = {"id": player_id, "name": player_name, "city": city_lower}
        await r.rpush(f"pcd:queue:{city_lower}", json.dumps(player_info))
        
        self.connection_manager.player_states[player_id] = "QUEUE"
        
        # Start timeout timer
        loop = asyncio.get_event_loop()
        if player_id in self.player_timers: self.player_timers[player_id].cancel()
        self.player_timers[player_id] = loop.call_later(
            30.0, 
            lambda: asyncio.create_task(self.handle_matchmaking_timeout(player_id, city_lower))
        )
        
        # 3. Trigger Matching
        asyncio.create_task(self.try_match_players(city_lower))

    async def try_match_players(self, city: str):
        async with self.matching_lock:
            r = await redis_client.connect()
            queue_key = f"pcd:queue:{city}"
            
            if await r.llen(queue_key) < 2:
                return

            p1_raw = await r.lpop(queue_key)
            p2_raw = await r.lpop(queue_key)
            
            if not p1_raw or not p2_raw:
                if p1_raw: await r.lpush(queue_key, p1_raw)
                return

            p1, p2 = json.loads(p1_raw), json.loads(p2_raw)
            config = self.get_city_config(city)
            
            print(f"⚔️ Match found in {city}: {p1['name']} vs {p2['name']}")

            try:
                # Deduct Fees
                fee = config["entry_fee"]
                success1 = await self.db_service.update_player_balance(p1["name"], -fee)
                success2 = await self.db_service.update_player_balance(p2["name"], -fee)
                
                if not success1 or not success2:
                    if success1: await self.db_service.update_player_balance(p1["name"], fee)
                    if success2: await self.db_service.update_player_balance(p2["name"], fee)
                    print("❌ Transaction failed during matching. Returning players to queue.")
                    await r.lpush(queue_key, json.dumps(p2))
                    await r.lpush(queue_key, json.dumps(p1))
                    return

                await self.db_service.create_transaction({"player_name": p1["name"], "amount": -fee, "type": "entry_fee", "city": city})
                await self.db_service.create_transaction({"player_name": p2["name"], "amount": -fee, "type": "entry_fee", "city": city})

                game_id = self.game_engine.create_game(p1["name"], p2["name"], p1["id"], p2["id"])
                game_state = self.game_engine.get_game_state(game_id)
                
                await self.db_service.create_game({
                    "id": game_id,
                    "player1_name": p1["name"],
                    "player2_name": p2["name"],
                    "game_state": game_state,
                    "status": "waiting_for_poison",
                    "city": city
                })

                await r.hset("pcd:player_game", p1["id"], game_id)
                await r.hset("pcd:player_game", p2["id"], game_id)
                await r.hset("pcd:game_city", game_id, city)

                for p in [p1, p2]:
                    self.connection_manager.player_states[p["id"]] = "IN_GAME"
                    self.connection_manager.player_games[p["id"]] = game_id
                    if p["id"] in self.player_timers:
                        self.player_timers[p["id"]].cancel()
                        del self.player_timers[p["id"]]

                await self.connection_manager.send_personal_message({
                    "type": "match_found",
                    "game_id": game_id,
                    "your_role": "player1",
                    "opponent": {"name": p2["name"], "id": p2["id"]},
                    "game_state": game_state
                }, p1["id"])

                await self.connection_manager.send_personal_message({
                    "type": "match_found",
                    "game_id": game_id,
                    "your_role": "player2",
                    "opponent": {"name": p1["name"], "id": p1["id"]},
                    "game_state": game_state
                }, p2["id"])
                
                # START AUTHORITATIVE SETUP TIMERS (30s) after delay for UI transition
                if self.timer_manager:
                    # Wait 3 seconds for clients to transition from "Match Found!" to game screen
                    await asyncio.sleep(3)
                    setup_duration = 30 
                    await self.timer_manager.start_timer(game_id, p1["id"], setup_duration)
                    await self.timer_manager.start_timer(game_id, p2["id"], setup_duration)
                    print(f"⏱️ Setup timers started for {p1['name']} and {p2['name']}")

                print(f"🏁 Successfully notified {p1['name']} and {p2['name']}")

            except Exception as e:
                print(f"💥 Critical error during matching: {e}")
                await r.lpush(queue_key, json.dumps(p1))
                await r.lpush(queue_key, json.dumps(p2))

    def remove_player(self, player_id: str):
        if player_id in self.player_timers:
            self.player_timers[player_id].cancel()
            del self.player_timers[player_id]

    async def handle_matchmaking_timeout(self, player_id: str, city: str):
        if self.connection_manager.player_states.get(player_id) == "QUEUE":
            print(f"⏰ Matchmaking timeout for {player_id}")
            await self.connection_manager.send_personal_message({
                "type": "matchmaking_timeout", 
                "city": city
            }, player_id)
            self.remove_player(player_id)
            self.connection_manager.player_states[player_id] = "IDLE"

    def get_queue_stats(self) -> dict: 
        """Return queue statistics."""
        return {"active_queues": len(self.player_timers)}
    
    def get_city_turn_timer(self, city: str) -> int:
        """Get turn timer for a city."""
        return self.get_city_config(city).get("turn_timer", 30)

class GameTimerManager:
    """Manages turn timers using Redis for persistence and Server Authority."""
    
    def __init__(self, matchmaking_queue, game_engine, db_service, connection_manager):
        self.matchmaking_queue = matchmaking_queue
        self.game_engine = game_engine
        self.db_service = db_service
        self.connection_manager = connection_manager
        self.active_tasks: Dict[str, asyncio.Task] = {}
    
    async def start_timer(self, game_id: str, player_id: str, duration: int):
        r = await redis_client.connect()
        deadline = asyncio.get_event_loop().time() + duration
        await r.hset(f"pcd:timer:deadline:{player_id}", game_id, deadline)
        
        timer_key = f"{game_id}:{player_id}"
        if timer_key in self.active_tasks: 
            self.active_tasks[timer_key].cancel()
        
        self.active_tasks[timer_key] = asyncio.create_task(self._timer_loop(game_id, player_id))

    async def stop_timer(self, game_id: str, player_id: str):
        r = await redis_client.connect()
        await r.hdel(f"pcd:timer:deadline:{player_id}", game_id)
        
        timer_key = f"{game_id}:{player_id}"
        if timer_key in self.active_tasks: 
            self.active_tasks[timer_key].cancel()
            del self.active_tasks[timer_key]

    async def _timer_loop(self, game_id: str, player_id: str):
        try:
            r = await redis_client.connect()
            while True:
                deadline_raw = await r.hget(f"pcd:timer:deadline:{player_id}", game_id)
                if not deadline_raw: break
                
                deadline = float(deadline_raw)
                now = asyncio.get_event_loop().time()
                remaining = int(max(0, deadline - now))
                
                msg = {
                    "type": "timer_sync", 
                    "game_id": game_id, 
                    "player_id": player_id,
                    "seconds": remaining
                }
                players_in_game = [pid for pid, gid in self.connection_manager.player_games.items() if gid == game_id]
                for pid in players_in_game:
                    await self.connection_manager.send_personal_message(msg, pid)
                
                if remaining <= 0: break
                await asyncio.sleep(1.0)
            
            # AUTHORITATIVE TIMEOUT
            print(f"⏰ Timer expired for player {player_id} in {game_id}. Advancing turn/setup.")
            result = await self.game_engine.handle_timeout_persistent(game_id, player_id, self.db_service)
            
            if result.get("success"):
                game_state = result["game_state"]
                # Broadcast turn shift or forfeit to all players in game
                players_in_game = [pid for pid, gid in self.connection_manager.player_games.items() if gid == game_id]
                
                if result.get("type") == "timeout_forfeit":
                    # FORFEIT! Game over.
                    timeout_msg = {
                        "type": "game_over",
                        "game_id": game_id,
                        "winner_id": result["game_state"].get("winner"), # winner added in handle_timeout if state finished
                        "reason": "timeout",
                        "game_state": game_state
                    }
                    print(f"💀 Broadcast Game Over (Timeout Forfeit) for {game_id}")
                
                elif result.get("type") == "game_cancelled":
                    # BOTH TIMED OUT -> CANCEL & REFUND
                    city = await r.hget("pcd:game_city", game_id) or "dubai"
                    # Decode bytes if needed
                    if isinstance(city, bytes): city = city.decode('utf-8')
                    
                    config = self.matchmaking_queue.get_city_config(city)
                    refund_amount = config["entry_fee"]
                    
                    # Refund both players
                    for pid in players_in_game:
                        # We need player NAME to update balance. 
                        # We have ID. But player_games maps ID -> Game.
                        # connection_manager has active_sockets but maybe not names easily accessible?
                        # DB service needs name.
                        # Wait, db_service.update_player_balance takes NAME.
                        # We can look up name from game_state
                        p_name = None
                        if game_state["player1"]["id"] == pid: p_name = game_state["player1"]["name"]
                        elif game_state["player2"]["id"] == pid: p_name = game_state["player2"]["name"]
                        
                        if p_name:
                            await self.db_service.update_player_balance(p_name, refund_amount)
                            print(f"💰 Refunded {refund_amount} to {p_name}")

                    timeout_msg = {
                        "type": "game_cancelled",
                        "game_id": game_id,
                        "reason": "setup_timeout",
                        "message": "Game cancelled (No poison selected). Coins refunded."
                    }
                    print(f"🛑 Broadcast Game Cancelled for {game_id}")

                else:
                    timeout_msg = {
                        "type": "timer_expired",
                        "game_id": game_id,
                        "timed_out_player": player_id,
                        "next_turn": result.get("next_turn"),
                        "game_state": game_state
                    }
                
                for pid in players_in_game:
                    await self.connection_manager.send_personal_message(timeout_msg, pid)

                # START TIMER FOR NEXT PLAYER (only if we transitioned or moved turn and NOT finished)
                if result.get("type") != "timeout_forfeit" and result.get("type") != "game_cancelled" and result.get("next_turn") and game_state.get("state") == "playing":
                    next_player_id = result["next_turn"]
                    city = await r.hget("pcd:game_city", game_id) or "dubai"
                    if isinstance(city, bytes): city = city.decode('utf-8')
                    from game_config import CITY_CONFIG
                    duration = (CITY_CONFIG.get(city, {})).get("turn_timer", 30)
                    asyncio.create_task(self.start_timer(game_id, next_player_id, duration))

        except asyncio.CancelledError: pass
        finally:
            timer_key = f"{game_id}:{player_id}"
            if timer_key in self.active_tasks: 
                del self.active_tasks[timer_key]
