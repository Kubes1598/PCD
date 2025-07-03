from typing import Dict, List, Optional, Any
import json
from datetime import datetime, timezone
from config import settings
import uuid

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