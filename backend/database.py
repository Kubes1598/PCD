from supabase import create_client, Client
from typing import Dict, List, Optional, Any
import json
from datetime import datetime, timezone
from config import settings

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

# Global database service instance
db_service = SupabaseService() 