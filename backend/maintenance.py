import asyncio
import os
import sys
from datetime import datetime, timezone

# Add parent directory to sys.path to allow imports from sibling files
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_service, calculate_rank_info

async def perform_monthly_reset():
    """
    Perform monthly rank reset.
    - Champions and high Legendary (V) players are demoted to Legendary IV.
    - Mid Legendary (III, IV) are demoted to Legendary III.
    - All other ranks remain or are adjusted according to monthly rules.
    """
    print(f"🔄 [{datetime.now().isoformat()}] Starting Monthly Rank Reset...")
    
    # Thresholds:
    # Legendary IV = 150 wins
    # Legendary III = 130 wins
    
    if hasattr(db_service, 'players'): # InMemoryDatabaseService
        reset_count = 0
        for player_name, player in db_service.players.items():
            wins = player.get("games_won", 0)
            stars = player.get("stars", 0)
            
            if wins >= 200 or wins >= 175: # Champion or Legendary V
                player["games_won"] = 150 # Reset to Legendary IV
                player["stars"] = 0
                reset_count += 1
            elif wins >= 130: # Legendary III or IV
                player["games_won"] = 130 # Reset to Legendary III
                player["stars"] = 0
                reset_count += 1
            
            # Recalculate rank info
            info = calculate_rank_info(player["games_won"], player.get("stars", 0))
            player["rank"] = info["rank"]
            player["tier"] = info["tier"]
            
        print(f"✅ Reset complete for {reset_count} in-memory players.")

    # Note: For Supabase, we would run a batch update query here.
    if hasattr(db_service, 'supabase') and db_service.supabase:
        print("🌐 Supabase reset logic triggered (Simulated)...")
        # Example query:
        # db_service.supabase.table("players").update({"games_won": 150, "stars": 0}).gte("games_won", 175).execute()
        # db_service.supabase.table("players").update({"games_won": 130, "stars": 0}).range("games_won", 130, 174).execute()
    
    print("✨ Maintenance task finished.")

if __name__ == "__main__":
    asyncio.run(perform_monthly_reset())
