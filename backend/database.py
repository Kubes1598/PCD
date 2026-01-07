from typing import Dict, List, Optional, Any
import json
from datetime import datetime, timezone
from config import settings
import uuid
import secrets

# Try to import Supabase, but don't fail if it's not configured
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)
except ImportError:
    SUPABASE_AVAILABLE = False

class InMemoryDatabaseService:
    """Simple in-memory database service for local development."""
    
    def __init__(self):
        """Initialize in-memory storage."""
        self.games: Dict[str, Dict[str, Any]] = {}
        self.players: Dict[str, Dict[str, Any]] = {}
        self.transactions: List[Dict[str, Any]] = []
        print("🟡 Using in-memory database for local development")
    
    async def create_game(self, game_data: Dict[str, Any]) -> str:
        """Create a new game in memory."""
        try:
            game_id = game_data["id"]
            self.games[game_id] = {
                "id": game_id,
                "player1_name": game_data["player1_name"],
                "player2_name": game_data["player2_name"],
                "game_state": game_data["game_state"],
                "status": game_data.get("status", "waiting_for_poison"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            print(f"✅ Created game {game_id}")
            return game_id
        except Exception as e:
            print(f"❌ Error creating game: {e}")
            raise e
    
    async def get_game(self, game_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a game from memory."""
        return self.games.get(game_id)
    
    async def update_game(self, game_id: str, game_data: Dict[str, Any]) -> bool:
        """Update a game in memory."""
        try:
            if game_id in self.games:
                self.games[game_id]["game_state"] = game_data["game_state"]
                self.games[game_id]["status"] = game_data.get("status", "in_progress")
                self.games[game_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                print(f"✅ Updated game {game_id}")
                return True
            return False
        except Exception as e:
            print(f"❌ Error updating game: {e}")
            return False
    
    async def delete_game(self, game_id: str) -> bool:
        """Delete a game from memory."""
        try:
            if game_id in self.games:
                del self.games[game_id]
                return True
            return False
        except Exception as e:
            print(f"❌ Error deleting game: {e}")
            return False
    
    async def get_player_games(self, player_name: str) -> List[Dict[str, Any]]:
        """Get all games for a specific player."""
        try:
            player_games = []
            for game in self.games.values():
                if game["player1_name"] == player_name or game["player2_name"] == player_name:
                    player_games.append(game)
            return sorted(player_games, key=lambda x: x["created_at"], reverse=True)
        except Exception as e:
            print(f"❌ Error retrieving player games: {e}")
            return []
    
    async def cleanup_old_games(self, expiry_hours: int = 24) -> int:
        """Clean up games older than specified hours."""
        try:
            cutoff_time = datetime.now(timezone.utc).replace(
                hour=datetime.now(timezone.utc).hour - expiry_hours
            )
            
            old_games = []
            for game_id, game in self.games.items():
                created_at = datetime.fromisoformat(game["created_at"].replace('Z', '+00:00'))
                if created_at < cutoff_time:
                    old_games.append(game_id)
            
            for game_id in old_games:
                del self.games[game_id]
            
            return len(old_games)
        except Exception as e:
            print(f"❌ Error cleaning up games: {e}")
            return 0
    
    async def get_game_stats(self) -> Dict[str, Any]:
        """Get overall game statistics."""
        try:
            total_games = len(self.games)
            active_games = sum(1 for game in self.games.values() if game["status"] != "finished")
            
            status_counts = {}
            for game in self.games.values():
                status = game["status"]
                status_counts[status] = status_counts.get(status, 0) + 1
            
            return {
                "total_games": total_games,
                "active_games": active_games,
                "status_breakdown": status_counts
            }
        except Exception as e:
            print(f"❌ Error retrieving game stats: {e}")
            return {"total_games": 0, "active_games": 0, "status_breakdown": {}}

    async def get_player(self, player_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve a player from memory."""
        return self.players.get(player_name)

    async def update_player_balance(self, player_name: str, coin_delta: int = 0, diamond_delta: int = 0) -> bool:
        """Update a player's balance in memory."""
        try:
            if player_name not in self.players:
                self.players[player_name] = {
                    "name": player_name,
                    "coin_balance": 10000,
                    "diamonds_balance": 500,
                    "total_coins_earned": 0,
                    "total_coins_spent": 0,
                    "games_played": 0,
                    "games_won": 0,
                    "last_active": datetime.now(timezone.utc).isoformat(),
                    "last_daily_reward": None,
                    "profile_id": f"PCD-{secrets.token_hex(4).upper()}",
                    "friends": [],
                    "claimed_quests": []
                }
            
            player = self.players[player_name]
            player["coin_balance"] += coin_delta
            player["diamonds_balance"] += diamond_delta
            
            if coin_delta > 0:
                player["total_coins_earned"] += coin_delta
            elif coin_delta < 0:
                player["total_coins_spent"] += abs(coin_delta)
                
            player["last_active"] = datetime.now(timezone.utc).isoformat()
            return True
        except Exception as e:
            print(f"❌ Error updating player balance: {e}")
            return False

    async def create_transaction(self, transaction_data: Dict[str, Any]) -> str:
        """Create a new transaction in memory."""
        try:
            transaction_id = str(uuid.uuid4())
            transaction = {
                "id": transaction_id,
                **transaction_data,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.transactions.append(transaction)
            return transaction_id
        except Exception as e:
            print(f"❌ Error creating transaction: {e}")
            raise e

    async def update_player_stats(self, player_name: str, won: bool) -> bool:
        """Update player's game statistics after a game."""
        try:
            if player_name not in self.players:
                self.players[player_name] = {
                    "name": player_name,
                    "coin_balance": 10000,
                    "diamonds_balance": 500,
                    "total_coins_earned": 0,
                    "total_coins_spent": 0,
                    "games_played": 0,
                    "games_won": 0,
                    "last_active": datetime.now(timezone.utc).isoformat(),
                    "last_daily_reward": None,
                    "profile_id": f"PCD-{secrets.token_hex(4).upper()}",
                    "friends": [],
                    "claimed_quests": []
                }
            
            player = self.players[player_name]
            player["games_played"] += 1
            if won:
                player["games_won"] += 1
            player["last_active"] = datetime.now(timezone.utc).isoformat()
            return True
        except Exception as e:
            print(f"❌ Error updating player stats: {e}")
            return False

    async def get_player_by_profile_id(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Find a player by their unique profile ID."""
        for player in self.players.values():
            if player.get("profile_id") == profile_id:
                return player
        return None

    async def add_friend(self, player_name: str, friend_name: str) -> bool:
        """Add a friend to a player's friends list."""
        try:
            player = await self.get_player(player_name)
            friend = await self.get_player(friend_name)
            if not player or not friend:
                return False
            
            if "friends" not in player: player["friends"] = []
            if friend_name not in player["friends"]:
                player["friends"].append(friend_name)
                return True
            return False
        except Exception as e:
            print(f"❌ Error adding friend: {e}")
            return False

    async def claim_quest(self, player_name: str, quest_id: str) -> bool:
        """Mark a quest as claimed for a player."""
        try:
            player = await self.get_player(player_name)
            if not player: return False
            if "claimed_quests" not in player: player["claimed_quests"] = []
            if quest_id not in player["claimed_quests"]:
                player["claimed_quests"].append(quest_id)
                return True
            return False
        except Exception as e:
            print(f"❌ Error claiming quest: {e}")
            return False

    async def get_leaderboard(self, sort_by: str = "wins", limit: int = 10) -> List[Dict[str, Any]]:
        """Get leaderboard sorted by specified field."""
        try:
            players_list = list(self.players.values())
            
            if sort_by == "wins":
                players_list.sort(key=lambda p: p.get("games_won", 0), reverse=True)
            elif sort_by == "winrate":
                # Filter players with at least 5 games for meaningful winrate
                players_list = [p for p in players_list if p.get("games_played", 0) >= 5]
                players_list.sort(
                    key=lambda p: p.get("games_won", 0) / max(p.get("games_played", 1), 1),
                    reverse=True
                )
            elif sort_by == "coins":
                players_list.sort(key=lambda p: p.get("coin_balance", 0), reverse=True)
            elif sort_by == "games":
                players_list.sort(key=lambda p: p.get("games_played", 0), reverse=True)
            
            return players_list[:limit]
        except Exception as e:
            print(f"❌ Error getting leaderboard: {e}")
            return []

class SupabaseService:
    """Service class for Supabase database operations."""
    
    def __init__(self):
        """Initialize Supabase client."""
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase URL and Key must be provided in environment variables")
        
        self.supabase: Client = create_client(
            settings.SUPABASE_URL, 
            settings.SUPABASE_KEY
        )
        print("🟢 Using Supabase database")
    
    async def create_game(self, game_data: Dict[str, Any]) -> str:
        """Create a new game in the database."""
        try:
            # Prepare game data for insertion
            db_game_data = {
                "id": game_data["id"],
                "player1_name": game_data["player1_name"],
                "player2_name": game_data["player2_name"],
                "game_state": json.dumps(game_data["game_state"]),
                "status": game_data.get("status", "waiting_for_poison"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.supabase.table("games").insert(db_game_data).execute()
            
            if result.data:
                return result.data[0]["id"]
            else:
                raise Exception("Failed to create game in database")
                
        except Exception as e:
            print(f"Error creating game in database: {e}")
            raise e
    
    async def get_game(self, game_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a game from the database."""
        try:
            result = self.supabase.table("games").select("*").eq("id", game_id).execute()
            
            if result.data and len(result.data) > 0:
                game_row = result.data[0]
                return {
                    "id": game_row["id"],
                    "player1_name": game_row["player1_name"],
                    "player2_name": game_row["player2_name"],
                    "game_state": json.loads(game_row["game_state"]),
                    "status": game_row["status"],
                    "created_at": game_row["created_at"],
                    "updated_at": game_row["updated_at"]
                }
            return None
            
        except Exception as e:
            print(f"Error retrieving game from database: {e}")
            return None
    
    async def update_game(self, game_id: str, game_data: Dict[str, Any]) -> bool:
        """Update a game in the database."""
        try:
            update_data = {
                "game_state": json.dumps(game_data["game_state"]),
                "status": game_data.get("status", "in_progress"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.supabase.table("games").update(update_data).eq("id", game_id).execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            print(f"Error updating game in database: {e}")
            return False
    
    async def delete_game(self, game_id: str) -> bool:
        """Delete a game from the database."""
        try:
            result = self.supabase.table("games").delete().eq("id", game_id).execute()
            return len(result.data) > 0
            
        except Exception as e:
            print(f"Error deleting game from database: {e}")
            return False
    
    async def get_player_games(self, player_name: str) -> List[Dict[str, Any]]:
        """Get all games for a specific player."""
        try:
            result = self.supabase.table("games").select("*").or_(
                f"player1_name.eq.{player_name},player2_name.eq.{player_name}"
            ).order("created_at", desc=True).execute()
            
            games = []
            for game_row in result.data:
                games.append({
                    "id": game_row["id"],
                    "player1_name": game_row["player1_name"],
                    "player2_name": game_row["player2_name"],
                    "game_state": json.loads(game_row["game_state"]),
                    "status": game_row["status"],
                    "created_at": game_row["created_at"],
                    "updated_at": game_row["updated_at"]
                })
            
            return games
            
        except Exception as e:
            print(f"Error retrieving player games from database: {e}")
            return []
    
    async def cleanup_old_games(self, expiry_hours: int = 24) -> int:
        """Clean up games older than specified hours."""
        try:
            cutoff_time = datetime.now(timezone.utc).replace(
                hour=datetime.now(timezone.utc).hour - expiry_hours
            ).isoformat()
            
            result = self.supabase.table("games").delete().lt("updated_at", cutoff_time).execute()
            
            return len(result.data) if result.data else 0
            
        except Exception as e:
            print(f"Error cleaning up old games: {e}")
            return 0
    
    async def get_game_stats(self) -> Dict[str, Any]:
        """Get overall game statistics."""
        try:
            # Total games
            total_result = self.supabase.table("games").select("id", count="exact").execute()
            total_games = total_result.count if total_result.count else 0
            
            # Active games (not finished)
            active_result = self.supabase.table("games").select("id", count="exact").neq("status", "finished").execute()
            active_games = active_result.count if active_result.count else 0
            
            # Games by status
            status_result = self.supabase.table("games").select("status").execute()
            status_counts = {}
            if status_result.data:
                for game in status_result.data:
                    status = game["status"]
                    status_counts[status] = status_counts.get(status, 0) + 1
            
            return {
                "total_games": total_games,
                "active_games": active_games,
                "status_breakdown": status_counts
            }
            
        except Exception as e:
            print(f"Error retrieving game stats: {e}")
            return {"total_games": 0, "active_games": 0, "status_breakdown": {}}

    async def get_player(self, player_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve a player from Supabase."""
        try:
            result = self.supabase.table("players").select("*").eq("name", player_name).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            print(f"Error retrieving player from database: {e}")
            return None

    async def update_player_balance(self, player_name: str, coin_delta: int = 0, diamond_delta: int = 0) -> bool:
        """Update a player's balance in Supabase."""
        try:
            player = await self.get_player(player_name)
            if not player:
                # Create player with default starting values + delta
                new_player = {
                    "name": player_name,
                    "coin_balance": 10000 + coin_delta,
                    "diamonds_balance": 500 + diamond_delta,
                    "total_coins_earned": max(0, coin_delta),
                    "total_coins_spent": abs(min(0, coin_delta)),
                    "last_active": datetime.now(timezone.utc).isoformat(),
                    "profile_id": f"PCD-{secrets.token_hex(4).upper()}",
                    "friends": [],
                    "claimed_quests": []
                }
                result = self.supabase.table("players").insert(new_player).execute()
                return len(result.data) > 0
            
            # Update existing player
            update_data = {
                "coin_balance": player["coin_balance"] + coin_delta,
                "diamonds_balance": player["diamonds_balance"] + diamond_delta,
                "last_active": datetime.now(timezone.utc).isoformat()
            }
            
            if coin_delta > 0:
                update_data["total_coins_earned"] = player.get("total_coins_earned", 0) + coin_delta
            elif coin_delta < 0:
                update_data["total_coins_spent"] = player.get("total_coins_spent", 0) + abs(coin_delta)
                
            result = self.supabase.table("players").update(update_data).eq("name", player_name).execute()
            return len(result.data) > 0
            
        except Exception as e:
            print(f"Error updating player balance in database: {e}")
            return False

    async def create_transaction(self, transaction_data: Dict[str, Any]) -> str:
        """Create a new transaction in Supabase."""
        try:
            # Ensure balance_after is calculated if not provided
            if "balance_after" not in transaction_data:
                player = await self.get_player(transaction_data["player_name"])
                transaction_data["balance_after"] = player["coin_balance"] if player else 0
                
            result = self.supabase.table("coin_transactions").insert(transaction_data).execute()
            if result.data:
                return result.data[0]["id"]
            else:
                raise Exception("Failed to create transaction in database")
        except Exception as e:
            print(f"Error creating transaction in database: {e}")
            raise e

    async def update_player_stats(self, player_name: str, won: bool) -> bool:
        """Update player's game statistics in Supabase."""
        try:
            player = await self.get_player(player_name)
            if not player:
                # Create player with initial stats
                new_player = {
                    "name": player_name,
                    "coin_balance": 10000,
                    "diamonds_balance": 500,
                    "games_played": 1,
                    "games_won": 1 if won else 0,
                    "last_active": datetime.now(timezone.utc).isoformat(),
                    "profile_id": f"PCD-{secrets.token_hex(4).upper()}",
                    "friends": [],
                    "claimed_quests": []
                }
                self.supabase.table("players").insert(new_player).execute()
                return True
            
            update_data = {
                "games_played": player.get("games_played", 0) + 1,
                "games_won": player.get("games_won", 0) + (1 if won else 0),
                "last_active": datetime.now(timezone.utc).isoformat()
            }
            self.supabase.table("players").update(update_data).eq("name", player_name).execute()
            return True
        except Exception as e:
            print(f"Error updating player stats in database: {e}")
            return False

    async def get_player_by_profile_id(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Find a player by their unique profile ID in Supabase."""
        try:
            result = self.supabase.table("players").select("*").eq("profile_id", profile_id).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            print(f"Error retrieving player by profile ID from database: {e}")
            return None

    async def add_friend(self, player_name: str, friend_name: str) -> bool:
        """Add a friend to a player's friends list in Supabase."""
        try:
            player = await self.get_player(player_name)
            friend = await self.get_player(friend_name)
            if not player or not friend:
                return False
            
            friends = player.get("friends", [])
            if friend_name not in friends:
                friends.append(friend_name)
                self.supabase.table("players").update({"friends": friends}).eq("name", player_name).execute()
                return True
            return False
        except Exception as e:
            print(f"Error adding friend in database: {e}")
            return False

    async def claim_quest(self, player_name: str, quest_id: str) -> bool:
        """Mark a quest as claimed for a player in Supabase."""
        try:
            player = await self.get_player(player_name)
            if not player: return False
            
            claimed = player.get("claimed_quests", [])
            if quest_id not in claimed:
                claimed.append(quest_id)
                self.supabase.table("players").update({"claimed_quests": claimed}).eq("name", player_name).execute()
                return True
            return False
        except Exception as e:
            print(f"Error claiming quest in database: {e}")
            return False

    async def get_leaderboard(self, sort_by: str = "wins", limit: int = 10) -> List[Dict[str, Any]]:
        """Get leaderboard sorted by specified field from Supabase."""
        try:
            if sort_by == "wins":
                result = self.supabase.table("players").select("*").order("games_won", desc=True).limit(limit).execute()
            elif sort_by == "coins":
                result = self.supabase.table("players").select("*").order("coin_balance", desc=True).limit(limit).execute()
            elif sort_by == "games":
                result = self.supabase.table("players").select("*").order("games_played", desc=True).limit(limit).execute()
            elif sort_by == "winrate":
                # Get all players with at least 5 games and calculate winrate
                result = self.supabase.table("players").select("*").gte("games_played", 5).execute()
                if result.data:
                    # Sort by win rate in Python
                    players = result.data
                    players.sort(
                        key=lambda p: p.get("games_won", 0) / max(p.get("games_played", 1), 1),
                        reverse=True
                    )
                    return players[:limit]
                return []
            else:
                result = self.supabase.table("players").select("*").order("games_won", desc=True).limit(limit).execute()
            
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting leaderboard from database: {e}")
            return []

# Global database service instance - use in-memory if Supabase not available
if SUPABASE_AVAILABLE:
    try:
        db_service = SupabaseService()
    except Exception as e:
        print(f"⚠️  Failed to initialize Supabase: {e}")
        print("🟡 Falling back to in-memory database")
        db_service = InMemoryDatabaseService()
else:
    print("⚠️  Supabase configuration not found")
    db_service = InMemoryDatabaseService()