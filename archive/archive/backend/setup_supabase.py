#!/usr/bin/env python3
"""
Supabase Setup Script for Poisoned Candy Duel

This script helps you set up your Supabase database for the PCD game.
Run this after creating your Supabase project and setting up your .env file.
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_environment():
    """Check if all required environment variables are set."""
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_KEY",
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nPlease create a .env file with your Supabase credentials:")
        print("SUPABASE_URL=your_supabase_project_url")
        print("SUPABASE_KEY=your_supabase_anon_key")
        return False
    
    print("✅ Environment variables configured")
    return True

async def test_connection():
    """Test connection to Supabase."""
    try:
        from database import db_service
        
        # Test basic connection
        stats = await db_service.get_game_stats()
        print("✅ Successfully connected to Supabase")
        print(f"   Database stats: {stats}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        print("\nPlease check:")
        print("1. Your Supabase URL and key are correct")
        print("2. Your Supabase project is running")
        print("3. You've run the schema.sql in your Supabase SQL Editor")
        return False

def print_setup_instructions():
    """Print setup instructions for Supabase."""
    print("\n" + "="*60)
    print("SUPABASE SETUP INSTRUCTIONS")
    print("="*60)
    print("\n1. Create a Supabase project at https://supabase.com")
    print("\n2. Go to Settings > API in your Supabase dashboard")
    print("   Copy your Project URL and anon public key")
    print("\n3. Create a .env file in the backend directory:")
    print("   SUPABASE_URL=your_project_url")
    print("   SUPABASE_KEY=your_anon_key")
    print("\n4. Go to SQL Editor in your Supabase dashboard")
    print("   Copy and run the contents of schema.sql")
    print("\n5. Run this script again to test the connection")
    print("\n6. Start your API server:")
    print("   python -m uvicorn api:app --reload")

async def create_test_game():
    """Create a test game to verify everything works."""
    try:
        from database import db_service
        import uuid
        
        test_game_data = {
            "id": str(uuid.uuid4()),
            "player1_name": "TestPlayer1",
            "player2_name": "TestPlayer2",
            "game_state": {
                "state": "setup",
                "current_turn": 1,
                "result": "ongoing",
                "player1": {
                    "id": str(uuid.uuid4()),
                    "name": "TestPlayer1",
                    "owned_candies": [f"P1_C{i}" for i in range(1, 11)],
                    "collected_candies": [],
                    "poison_choice": None
                },
                "player2": {
                    "id": str(uuid.uuid4()),
                    "name": "TestPlayer2",
                    "owned_candies": [f"P2_C{i}" for i in range(1, 11)],
                    "collected_candies": [],
                    "poison_choice": None
                }
            },
            "status": "waiting_for_poison"
        }
        
        game_id = await db_service.create_game(test_game_data)
        print(f"✅ Created test game: {game_id}")
        
        # Clean up test game
        await db_service.delete_game(game_id)
        print("✅ Cleaned up test game")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to create test game: {e}")
        return False

async def main():
    """Main setup function."""
    print("🎮 Poisoned Candy Duel - Supabase Setup")
    print("="*50)
    
    # Check environment variables
    if not check_environment():
        print_setup_instructions()
        return
    
    # Test connection
    if not await test_connection():
        print_setup_instructions()
        return
    
    # Create test game
    if not await create_test_game():
        print("\n⚠️  Database connection works but game creation failed")
        print("Please check your schema.sql was run correctly")
        return
    
    print("\n🎉 Supabase setup complete!")
    print("\nYour PCD backend is ready to use with Supabase!")
    print("\nNext steps:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Start the server: python -m uvicorn api:app --reload")
    print("3. Test the API: curl http://localhost:8000/health")

if __name__ == "__main__":
    asyncio.run(main()) 