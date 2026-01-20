from typing import Dict, List, Optional, Any
import json
from datetime import datetime, timezone
import uuid
import secrets
import logging
from abc import ABC, abstractmethod
from config import settings
from utils.redis_client import redis_client

# Try to import Supabase, but don't fail if it's not configured
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)
except ImportError:
    SUPABASE_AVAILABLE = False

logger = logging.getLogger(__name__)

def calculate_rank_info(wins: int, stars: int = 0) -> Dict[str, Any]:
    """Calculate rank title and tier based on wins and champion stars."""
    if wins >= 200:
        clamped_stars = min(stars, 50)
        return {"rank": "Champion", "tier": "", "stars": clamped_stars, "display": f"Champion {clamped_stars}★"}
    if wins >= 175: return {"rank": "Legendary", "tier": "V", "stars": 0, "display": "Legendary V"}
    if wins >= 150: return {"rank": "Legendary", "tier": "IV", "stars": 0, "display": "Legendary IV"}
    if wins >= 130: return {"rank": "Legendary", "tier": "III", "stars": 0, "display": "Legendary III"}
    if wins >= 110: return {"rank": "Legendary", "tier": "II", "stars": 0, "display": "Legendary II"}
    if wins >= 90: return {"rank": "Legendary", "tier": "I", "stars": 0, "display": "Legendary I"}
    if wins >= 70: return {"rank": "World Class", "tier": "III", "stars": 0, "display": "World Class III"}
    if wins >= 55: return {"rank": "World Class", "tier": "II", "stars": 0, "display": "World Class II"}
    if wins >= 40: return {"rank": "World Class", "tier": "I", "stars": 0, "display": "World Class I"}
    if wins >= 30: return {"rank": "Pro", "tier": "III", "stars": 0, "display": "Pro III"}
    if wins >= 20: return {"rank": "Pro", "tier": "II", "stars": 0, "display": "Pro II"}
    if wins >= 10: return {"rank": "Pro", "tier": "I", "stars": 0, "display": "Pro I"}
    return {"rank": "Amateur", "tier": "", "stars": 0, "display": "Amateur"}

class BaseDatabaseService(ABC):
    @abstractmethod
    async def create_game(self, game_data: Dict[str, Any]) -> str: pass
    @abstractmethod
    async def get_game(self, game_id: str) -> Optional[Dict[str, Any]]: pass
    @abstractmethod
    async def update_game(self, game_id: str, game_data: Dict[str, Any]) -> bool: pass
    @abstractmethod
    async def delete_game(self, game_id: str) -> bool: pass
    @abstractmethod
    async def get_player(self, player_name: str) -> Optional[Dict[str, Any]]: pass
    @abstractmethod
    async def update_player_balance(self, player_name: str, coin_delta: int = 0, diamond_delta: int = 0) -> bool: pass
    @abstractmethod
    async def update_player_stats(self, player_name: str, won: bool) -> bool: pass
    @abstractmethod
    async def get_leaderboard(self, sort_by: str = "wins", limit: int = 10) -> List[Dict[str, Any]]: pass
    @abstractmethod
    async def create_user(self, user_data: Dict[str, Any]) -> str: pass
    @abstractmethod
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]: pass
    @abstractmethod
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]: pass
    @abstractmethod
    async def initiate_duel_atomic(
        self,
        p1_id: str,
        p1_name: str,
        p2_id: str,
        p2_name: str,
        city: str,
        fee: int,
        game_id: str,
        initial_state: Dict[str, Any]
    ) -> Dict[str, Any]: pass

class InMemoryDatabaseService(BaseDatabaseService):
    def __init__(self):
        self.games: Dict[str, Dict[str, Any]] = {}
        self.players: Dict[str, Dict[str, Any]] = {}
        self.transactions: List[Dict[str, Any]] = []
        logger.info("🟡 Using in-memory database")

    async def create_game(self, game_data: Dict[str, Any]) -> str:
        gid = game_data["id"]
        self.games[gid] = {**game_data, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
        return gid

    async def get_game(self, game_id: str) -> Optional[Dict[str, Any]]: return self.games.get(game_id)

    async def update_game(self, game_id: str, game_data: Dict[str, Any]) -> bool:
        if game_id in self.games:
            self.games[game_id].update({**game_data, "updated_at": datetime.now(timezone.utc).isoformat()})
            return True
        return False

    async def delete_game(self, game_id: str) -> bool:
        if game_id in self.games: del self.games[game_id]; return True
        return False

    async def get_player(self, player_name: str) -> Optional[Dict[str, Any]]: return self.players.get(player_name)

    async def update_player_balance(self, player_name: str, coin_delta: int = 0, diamond_delta: int = 0) -> bool:
        if player_name not in self.players:
            self.players[player_name] = {"name": player_name, "coin_balance": 1000, "diamonds_balance": 5, "games_played": 0, "games_won": 0, "friends": [], "profile_id": secrets.token_hex(4).upper()}
        self.players[player_name]["coin_balance"] += coin_delta
        self.players[player_name]["diamonds_balance"] += diamond_delta
        return True

    async def update_player_stats(self, player_name: str, won: bool) -> bool:
        if player_name in self.players:
            p = self.players[player_name]
            p["games_played"] += 1
            if won: p["games_won"] += 1
            rank = calculate_rank_info(p["games_won"], p.get("stars", 0))
            p.update({"rank": rank["rank"], "tier": rank["tier"]})
            return True
        return False
    
    async def get_leaderboard(self, sort_by: str = "wins", limit: int = 10) -> List[Dict[str, Any]]:
        plist = list(self.players.values())
        plist.sort(key=lambda p: p.get("games_won" if sort_by == "wins" else "coin_balance", 0), reverse=True)
        return plist[:limit]

    async def get_game_stats(self): return {"total_games": len(self.games)}
    async def create_transaction(self, data): self.transactions.append(data); return str(uuid.uuid4())
    async def get_player_by_profile_id(self, pid): return next((p for p in self.players.values() if p.get("profile_id") == pid), None)
    async def add_friend(self, p, f): 
        if p in self.players and f in self.players:
            if f not in self.players[p]["friends"]: self.players[p]["friends"].append(f); return True
        return False
    async def claim_quest(self, p, q): return True
    
    async def create_user(self, user_data: Dict[str, Any]) -> str:
        uid = user_data["id"]
        self.players[user_data["name"]] = user_data  # Using name as key (matches auth.py)
        return uid
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return next((u for u in self.players.values() if u.get("email") == email), None)

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        return next((u for u in self.players.values() if u.get("id") == user_id), None)

    async def initiate_duel_atomic(self, p1_id, p1_name, p2_id, p2_name, city, fee, game_id, initial_state):
        p1 = self.players.get(p1_name)
        p2 = self.players.get(p2_name)
        if not p1 or not p2: return {"success": False, "error": "Player not found"}
        if p1.get("coin_balance", 0) < fee: return {"success": False, "error": "P1 insufficient funds"}
        if p2.get("coin_balance", 0) < fee: return {"success": False, "error": "P2 insufficient funds"}
        p1["coin_balance"] -= fee
        p2["coin_balance"] -= fee
        self.games[game_id] = {"id": game_id, "game_state": initial_state, "status": "waiting_for_poison"}
        return {"success": True, "game_id": game_id}

class SupabaseService(BaseDatabaseService):
    def __init__(self):
        # Public client (anon key) - respects RLS policies
        self.supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        
        # Admin client (service key) - for trusted operations that need to bypass RLS
        # Used for: balance updates, transaction logging, admin operations
        if settings.SUPABASE_SERVICE_KEY:
            self.supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
            logger.info("🟢 Using Supabase database (dual-client mode)")
        else:
            self.supabase_admin = self.supabase
            logger.info("🟡 Using Supabase database (single-client mode - service key not configured)")

    async def create_game(self, game_data: Dict[str, Any]) -> str:
        # Strip columns that might be missing in older schemas
        clean_data = {k: v for k, v in game_data.items() if k != "city"}
        # Use admin client to bypass RLS for game creation
        res = self.supabase_admin.table("games").insert({**clean_data, "game_state": json.dumps(game_data["game_state"])}).execute()
        return res.data[0]["id"]

    async def get_game(self, game_id: str) -> Optional[Dict[str, Any]]:
        res = self.supabase.table("games").select("*").eq("id", game_id).execute()
        if res.data:
            g = res.data[0]
            g["game_state"] = json.loads(g["game_state"])
            return g
        return None

    async def update_game(self, game_id: str, game_data: Dict[str, Any]) -> bool:
        # Strip columns that might be missing in older schemas
        clean_data = {k: v for k, v in game_data.items() if k != "city"}
        payload = {**clean_data}
        if "game_state" in game_data:
            payload["game_state"] = json.dumps(game_data["game_state"])
            
        res = self.supabase.table("games").update(payload).eq("id", game_id).execute()
        return len(res.data) > 0

    async def delete_game(self, game_id: str, soft_delete: bool = True) -> bool:
        """
        Delete a game, either soft delete (set deleted_at) or hard delete.
        
        Args:
            game_id: The game ID to delete
            soft_delete: If True, marks deleted_at instead of removing (default: True)
            
        Returns:
            bool: True if successful
        """
        if soft_delete:
            # Soft delete - just mark as deleted
            res = self.supabase_admin.table("games").update({
                "deleted_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", game_id).execute()
        else:
            # Hard delete - actually remove from database
            res = self.supabase_admin.table("games").delete().eq("id", game_id).execute()
        return len(res.data) > 0

    async def get_player(self, player_name: str) -> Optional[Dict[str, Any]]:
        # Use admin client for authentication checks to ensure bypass of RLS
        res = self.supabase_admin.table("players").select("*").eq("name", player_name).execute()
        return res.data[0] if res.data else None

    async def update_player_balance(
        self, 
        player_name: str, 
        coin_delta: int = 0, 
        diamond_delta: int = 0,
        transaction_type: str = "game_entry",
        game_id: str = None,
        arena_type: str = None,
        description: str = None
    ) -> bool:
        """
        Atomic balance update using Postgres SECURITY DEFINER function.
        
        This prevents race conditions by:
        1. Locking the player row with FOR UPDATE
        2. Validating balance constraints in a transaction
        3. Creating transaction record atomically
        
        Args:
            player_name: The player's username
            coin_delta: Amount to add/subtract from coin balance
            diamond_delta: Amount to add/subtract from diamond balance  
            transaction_type: Type of transaction (game_entry, prize_payout, etc.)
            game_id: Optional game ID for reference
            arena_type: Optional arena type (dubai, cairo, oslo)
            description: Optional transaction description
            
        Returns:
            bool: True if update succeeded, False otherwise
        """
        try:
            # Clear cache before update
            try:
                r = await redis_client.connect()
                await r.delete(f"pcd:player_cache:{player_name}")
            except: 
                pass

            # First, get player ID (we need UUID for the function)
            player = await self.get_player(player_name)
            if not player:
                # Create player if doesn't exist (first-time user)
                try:
                    self.supabase_admin.table("players").insert({
                        "name": player_name, 
                        "coin_balance": 10000 + coin_delta, 
                        "diamonds_balance": 500 + diamond_delta
                    }).execute()
                    logger.info(f"✅ Created new player: {player_name}")
                    return True
                except Exception as e:
                    logger.info(f"❌ Failed to create player {player_name}: {e}")
                    return False
            
            player_id = player.get("id")
            if not player_id:
                logger.info(f"❌ Player {player_name} has no ID")
                return False
            
            # Call atomic balance update function via service client
            result = self.supabase_admin.rpc("update_player_balance_atomic", {
                "p_player_id": player_id,
                "p_coin_delta": coin_delta,
                "p_diamond_delta": diamond_delta,
                "p_transaction_type": transaction_type,
                "p_game_id": game_id,
                "p_arena_type": arena_type,
                "p_description": description
            }).execute()
            
            if result.data and result.data.get("success"):
                logger.info(f"✅ Balance updated for {player_name}: {coin_delta:+d} coins, {diamond_delta:+d} diamonds")
                return True
            else:
                error = result.data.get("error", "Unknown error") if result.data else "No response"
                logger.info(f"❌ Balance update failed for {player_name}: {error}")
                return False
                
        except Exception as e:
            logger.info(f"❌ Database error updating balance for {player_name}: {e}")
            # Fallback to legacy method if RPC not available
            return await self._legacy_balance_update(player_name, coin_delta, diamond_delta)
    
    async def _legacy_balance_update(self, player_name: str, coin_delta: int, diamond_delta: int) -> bool:
        """Fallback balance update for when atomic function is not available."""
        try:
            p = await self.get_player(player_name)
            if not p:
                return False
                
            new_coins = p["coin_balance"] + coin_delta
            new_diamonds = p["diamonds_balance"] + diamond_delta
            
            if new_coins < 0:
                logger.info(f"❌ Legacy balance update denied: {player_name} would have negative balance")
                return False

            res = self.supabase_admin.table("players").update({
                "coin_balance": new_coins, 
                "diamonds_balance": new_diamonds
            }).eq("name", player_name).execute()
            
            return len(res.data) > 0
        except Exception as e:
            logger.info(f"❌ Legacy balance update failed for {player_name}: {e}")
            return False

    async def update_player_stats(self, player_name: str, won: bool) -> bool:
        try:
            p = await self.get_player(player_name)
            if p:
                wins = p["games_won"] + (1 if won else 0)
                rank = calculate_rank_info(wins, p.get("stars", 0))
                self.supabase.table("players").update({
                    "games_played": p["games_played"] + 1, 
                    "games_won": wins, 
                    "rank": rank["rank"], 
                    "tier": rank["tier"]
                }).eq("name", player_name).execute()
                return True
            return False
        except Exception as e:
            logger.info(f"❌ Database error updating stats for {player_name}: {e}")
            return False

    async def get_leaderboard(self, sort_by: str = "wins", limit: int = 10) -> List[Dict[str, Any]]:
        # Check Cache
        cache_key = f"pcd:leaderboard_cache:{sort_by}:{limit}"
        try:
            r = await redis_client.connect()
            cached = await r.get(cache_key)
            if cached: return json.loads(cached)
        except: pass

        res = self.supabase.table("players").select("*").order("games_won" if sort_by == "wins" else "coin_balance", desc=True).limit(limit).execute()
        
        # Cache for 300 seconds (5 mins)
        try:
            r = await redis_client.connect()
            await r.setex(cache_key, 300, json.dumps(res.data))
        except: pass
        
        return res.data

    # Additional methods for compatibility
    async def get_game_stats(self): return {"total_games": 0}
    async def create_transaction(self, data: Dict[str, Any]) -> str:
        # Map 'type' to 'transaction_type' for database column
        clean_data = {k: v for k, v in data.items() if k not in ["city"]}
        if "type" in clean_data:
            clean_data["transaction_type"] = clean_data.pop("type")
        try:
            res = self.supabase_admin.table("coin_transactions").insert(clean_data).execute()
            return res.data[0]["id"] if res.data else str(uuid.uuid4())
        except Exception as e:
            logger.info(f"⚠️ Transaction log failed: {e}")
            return str(uuid.uuid4())
    async def get_player_by_profile_id(self, pid):
        res = self.supabase.table("players").select("*").eq("profile_id", pid).execute()
        return res.data[0] if res.data else None
    async def add_friend(self, p, f):
        res = self.supabase.table("players").select("friends").eq("name", p).execute()
        if res.data:
            friends = res.data[0].get("friends", [])
            if f not in friends: friends.append(f); self.supabase.table("players").update({"friends": friends}).eq("name", p).execute(); return True
        return False
    async def claim_quest(self, p, q): return True

    async def create_user(self, user_data: Dict[str, Any]) -> str:
        # Note: In production Supabase, users are usually in auth.users, but for 
        # this game's public profile, we store meta in public.players
        res = self.supabase_admin.table("players").upsert(user_data).execute()
        return res.data[0]["id"]

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        # Check Cache
        try:
            r = await redis_client.connect()
            cached = await r.get(f"pcd:user:email:{email}")
            if cached: return json.loads(cached)
        except: pass

        # Fallback to Supabase Admin for auth checks
        res = self.supabase_admin.table("players").select("*").eq("email", email).execute()
        if res.data:
            user = res.data[0]
            # Cache for 10 mins
            try:
                r = await redis_client.connect()
                await r.setex(f"pcd:user:email:{email}", 600, json.dumps(user))
            except: pass
            return user
        return None

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        # Check Cache
        try:
            r = await redis_client.connect()
            cached = await r.get(f"pcd:user:id:{user_id}")
            if cached: return json.loads(cached)
        except: pass

        # Fallback to Supabase Admin for auth checks
        res = self.supabase_admin.table("players").select("*").eq("id", user_id).execute()
        if res.data:
            user = res.data[0]
            # Cache for 10 mins
            try:
                r = await redis_client.connect()
                await r.setex(f"pcd:user:id:{user_id}", 600, json.dumps(user))
            except: pass
            return user
        return None

    async def initiate_duel_atomic(
        self,
        p1_id: str,
        p1_name: str,
        p2_id: str,
        p2_name: str,
        city: str,
        fee: int,
        game_id: str,
        initial_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call the SECURE atomic initiation RPC."""
        try:
            result = self.supabase_admin.rpc("initiate_duel_atomic", {
                "p_p1_id": p1_id,
                "p_p1_name": p1_name,
                "p_p2_id": p2_id,
                "p_p2_name": p2_name,
                "p_city": city.lower(),
                "p_fee": fee,
                "p_game_id": game_id,
                "p_initial_state": initial_state
            }).execute()
            
            if result.data and result.data.get("success"):
                return {"success": True, "game_id": result.data.get("game_id")}
            else:
                return {"success": False, "error": result.data.get("error") if result.data else "No response"}
        except Exception as e:
            logger.info(f"❌ Failed atomic duel initiation: {e}")
            return {"success": False, "error": str(e)}

# Initialize global DB service
if SUPABASE_AVAILABLE:
    try: db_service = SupabaseService()
    except Exception: db_service = InMemoryDatabaseService()
else: db_service = InMemoryDatabaseService()