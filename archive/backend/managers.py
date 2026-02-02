import json
import asyncio
import logging
import uuid
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from game_config import CITY_CONFIG
from utils.redis_client import redis_client

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections with reconnection support and state authority."""
    
    def __init__(self):
        self.active_sockets: Dict[str, WebSocket] = {} # player_id -> websocket (LOCAL ONLY)
        self.pubsub_tasks: Dict[str, asyncio.Task] = {} # player_id -> listening task
    
    async def get_player_state(self, player_id: str) -> str:
        r = await redis_client.connect()
        state = await r.hget("pcd:player_states", player_id)
        return state.decode('utf-8') if state else "IDLE"

    async def set_player_state(self, player_id: str, state: str):
        r = await redis_client.connect()
        await r.hset("pcd:player_states", player_id, state)

    async def get_player_game(self, player_id: str) -> Optional[str]:
        r = await redis_client.connect()
        game_id = await r.hget("pcd:player_games", player_id)
        return game_id.decode('utf-8') if game_id else None

    async def set_player_game(self, player_id: str, game_id: str):
        r = await redis_client.connect()
        await r.hset("pcd:player_games", player_id, game_id)
    
    async def connect(self, websocket: WebSocket, player_id: str):
        self.active_sockets[player_id] = websocket
        
        # Start Pub/Sub listener for this player
        self.pubsub_tasks[player_id] = asyncio.create_task(self._listen_for_messages(player_id))
        
        # Check if they were in a game (AUTH: Redis is source of truth)
        game_id = await self.get_player_game(player_id)
        if game_id:
            await self.set_player_state(player_id, "IN_GAME")
            logger.info(f"🎮 Player {player_id} restored to game {game_id}")
            
            await self.broadcast_to_player(player_id, {
                "type": "reconnected",
                "game_id": game_id,
                "state": "IN_GAME"
            })
        else:
            await self.set_player_state(player_id, "IDLE")
            logger.info(f"✅ Player {player_id} connected")
    
    async def _listen_for_messages(self, player_id: str):
        """Listen to Redis channel for messages intended for this specific player."""
        try:
            r = await redis_client.connect()
            pubsub = r.pubsub()
            channel_name = f"pcd:msg:{player_id}"
            await pubsub.subscribe(channel_name)
            
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    data = json.loads(message['data'])
                    ws = self.active_sockets.get(player_id)
                    if ws:
                        try:
                            await ws.send_text(json.dumps(data))
                        except Exception as e:
                            logger.error(f"Error sending WS to {player_id}: {e}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"PubSub error for {player_id}: {e}")
    
    async def broadcast_to_player(self, player_id: str, message: dict):
        """Global broadcast: Publish to Redis so any server instance can deliver it."""
        r = await redis_client.connect()
        await r.publish(f"pcd:msg:{player_id}", json.dumps(message))

    def disconnect(self, player_id: str):
        if player_id in self.active_sockets:
            del self.active_sockets[player_id]
        
        if player_id in self.pubsub_tasks:
            self.pubsub_tasks[player_id].cancel()
            del self.pubsub_tasks[player_id]
        
        # In a real distributed system, we might keep the Redis state for a bit 
        # to allow for reconnection on a DIFFERENT server.

    async def handle_grace_period_expiry(self, player_id: str):
        if player_id in self.disconnected_players:
            logger.info(f"⏰ Grace period expired for player {player_id}")
            # Clean up state
            self.player_states.pop(player_id, None)
            game_id = self.player_games.pop(player_id, None)
            
            if player_id in self.disconnected_players:
                del self.disconnected_players[player_id]

    async def send_personal_message(self, message: dict, player_id: str):
        # Legacy method redirected to new distributed broadcast
        await self.broadcast_to_player(player_id, message)

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

    async def add_player(self, player_id: str, player_name: str, city: str, websocket: WebSocket, device_id: str = "unknown", ip_address: str = "0.0.0.0"):
        city_lower = city.lower()
        logger.info(f"👤 Player {player_name} ({player_id}) joining {city_lower} queue (IP: {ip_address})")
        
        # 1. Authoritative Balance Check
        player_data = await self.db_service.get_player(player_name)
        entry_fee = self.get_city_config(city_lower)["entry_fee"]
        current_balance = player_data.get("coin_balance", 0) if player_data else 10000 
        
        if current_balance < entry_fee:
            logger.info(f"❌ Matchmaking failed: {player_name} has insufficient balance")
            await websocket.send_text(json.dumps({
                "type": "matchmaking_error", 
                "message": f"Insufficient coins. Need {entry_fee}."
            }))
            return

        # 2. Add to Redis Queue with Metadata for Anti-Fraud
        r = await redis_client.connect()
        player_info = {
            "id": player_id, 
            "name": player_name, 
            "city": city_lower,
            "device_id": device_id,
            "ip_address": ip_address
        }
        await r.rpush(f"pcd:queue:{city_lower}", json.dumps(player_info))
        
        await self.connection_manager.set_player_state(player_id, "QUEUE")
        
        # Use Redis for queue timeouts for distributed tracking
        await r.setex(f"pcd:queue_timeout:{player_id}", 31, city_lower)
        
        # Instance still starts the matching process
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
            
            logger.info(f"⚔️ Match found in {city}: {p1['name']} vs {p2['name']}")

            # ANTI-FRAUD: Check for IP or Device Match
            if p1['ip_address'] == p2['ip_address'] or p1['device_id'] == p2['device_id']:
                logger.warning(f"🚫 Anti-Fraud: Blocked match between {p1['name']} and {p2['name']} (Match: {p1['ip_address']})")
                await r.lpush(queue_key, json.dumps(p2))
                # Cycle P1 to the back to avoid immediate re-match loop
                await r.rpush(queue_key, json.dumps(p1))
                return

            # ANTI-FRAUD: Recent Opponent Cooldown (5 minutes)
            recent1 = await r.get(f"pcd:recent_opponent:{p1['id']}")
            recent2 = await r.get(f"pcd:recent_opponent:{p2['id']}")
            
            if (recent1 and recent1.decode() == p2['id']) or (recent2 and recent2.decode() == p1['id']):
                logger.info(f"⏳ Cooldown: Blocked immediate re-match for {p1['name']} and {p2['name']}")
                await r.lpush(queue_key, json.dumps(p2))
                await r.rpush(queue_key, json.dumps(p1))
                return

            try:
                # 3. ATOMIC TRANSACTION: Deduct fees AND create game record
                fee = config["entry_fee"]
                game_id = str(uuid.uuid4())
                initial_state = self.game_engine.generate_initial_state(p1["name"], p2["name"], p1["id"], p2["id"])

                result = await self.db_service.initiate_duel_atomic(
                    p1["id"], p1["name"], p2["id"], p2["name"], city, fee, game_id, initial_state
                )
                
                if not result.get("success"):
                    logger.error(f"❌ Atomic Initiation Failed: {result.get('error')}")
                    # Return players to queue - maybe they have enough now? or someone else will match
                    await r.lpush(queue_key, json.dumps(p2))
                    await r.lpush(queue_key, json.dumps(p1))
                    return

                # 4. Activate in Engine
                self.game_engine.load_game_from_data({
                    "id": game_id,
                    "game_state": initial_state
                })
                game_state = self.game_engine.get_game_state(game_id)

                await r.hset("pcd:player_game", p1["id"], game_id)
                await r.hset("pcd:player_game", p2["id"], game_id)
                await r.hset("pcd:game_city", game_id, city)

                for p in [p1, p2]:
                    await self.connection_manager.set_player_state(p["id"], "IN_GAME")
                    await self.connection_manager.set_player_game(p["id"], game_id)
                    # Cleanup the timeout key
                    await r.delete(f"pcd:queue_timeout:{p['id']}")
                
                # Set Cooldowns (5 mins)
                await r.setex(f"pcd:recent_opponent:{p1['id']}", 300, p2['id'])
                await r.setex(f"pcd:recent_opponent:{p2['id']}", 300, p1['id'])

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
                    logger.info(f"⏱️ Setup timers started for {p1['name']} and {p2['name']}")

                logger.info(f"🏁 Successfully notified {p1['name']} and {p2['name']}")

            except Exception as e:
                logger.info(f"💥 Critical error during matching: {e}")
                await r.lpush(queue_key, json.dumps(p1))
                await r.lpush(queue_key, json.dumps(p2))

    def remove_player(self, player_id: str):
        if player_id in self.player_timers:
            self.player_timers[player_id].cancel()
            del self.player_timers[player_id]

    async def handle_matchmaking_timeout(self, player_id: str, city: str):
        if self.connection_manager.player_states.get(player_id) == "QUEUE":
            logger.info(f"⏰ Matchmaking timeout for {player_id}")
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
            logger.info(f"⏰ Timer expired for player {player_id} in {game_id}. Advancing turn/setup.")
            result = await self.game_engine.handle_timeout_persistent(game_id, player_id, self.db_service)
            
            if result.get("success"):
                game_state = result["game_state"]
                # Broadcast turn shift or forfeit to all players in game
                players_in_game = [pid for pid, gid in self.connection_manager.player_games.items() if gid == game_id]
                
                if result.get("type") == "timeout_forfeit":
                    # FORFEIT! Game over - the player who timed out LOSES
                    # Winner is the OTHER player
                    timed_out_id = player_id
                    p1_id = game_state["player1"]["id"]
                    p2_id = game_state["player2"]["id"]
                    winner_id = p2_id if timed_out_id == p1_id else p1_id
                    
                    # AWARD PRIZE to winner
                    city = await r.hget("pcd:game_city", game_id) or "dubai"
                    if isinstance(city, bytes): city = city.decode('utf-8')
                    config = self.matchmaking_queue.get_city_config(city)
                    prize = config.get("prize_amount", 950)
                    
                    winner_name = game_state["player1"]["name"] if p1_id == winner_id else game_state["player2"]["name"]
                    await self.db_service.update_player_balance(winner_name, prize)
                    await self.db_service.update_player_stats(winner_name, True)
                    await self.db_service.create_transaction({
                        "player_name": winner_name, 
                        "amount": prize, 
                        "transaction_type": "prize_payout",
                        "description": f"Victory by timeout in {city.title()}"
                    })
                    
                    timeout_msg = {
                        "type": "game_over",
                        "game_id": game_id,
                        "winner_id": winner_id,
                        "reason": "timeout",
                        "is_draw": False,
                        "game_state": game_state
                    }
                    logger.info(f"💀 Broadcast Game Over (Timeout Forfeit) for {game_id}. Winner: {winner_name} (+{prize})")
                
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
                            logger.info(f"💰 Refunded {refund_amount} to {p_name}")

                    timeout_msg = {
                        "type": "game_cancelled",
                        "game_id": game_id,
                        "reason": "setup_timeout",
                        "message": "Game cancelled (No poison selected). Coins refunded."
                    }
                    logger.info(f"🛑 Broadcast Game Cancelled for {game_id}")

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
