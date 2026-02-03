#!/usr/bin/env python3
"""
Simple PCD Backend Stress Test
"""
import asyncio
import aiohttp
import time

async def test_game_creation():
    """Test creating games with correct API format"""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing single game creation...")
    
    async with aiohttp.ClientSession() as session:
        # Create a game
        create_data = {
            'player1_name': 'StressTest_Player1',
            'player2_name': 'StressTest_Player2'
        }
        
        async with session.post(f"{base_url}/games", json=create_data) as response:
            result = await response.json()
            print(f"📝 Create Game Response: {result}")
            
            if result.get('success'):
                game_id = result['data']['game_id']
                print(f"✅ Game created successfully: {game_id}")
                
                # Test poison setting
                poison_data = {
                    'player_id': 'StressTest_Player1',
                    'poison_candy': '🍇'  # Use emoji instead of index
                }
                
                async with session.post(f"{base_url}/games/{game_id}/poison", json=poison_data) as poison_response:
                    poison_result = await poison_response.json()
                    print(f"🧪 Poison Response: {poison_result}")
                
                # Test candy picking
                pick_data = {
                    'player': 'StressTest_Player1',
                    'candy_choice': '🍌'  # Use emoji instead of index
                }
                
                async with session.post(f"{base_url}/games/{game_id}/pick", json=pick_data) as pick_response:
                    pick_result = await pick_response.json()
                    print(f"🍬 Pick Response: {pick_result}")
                
                # Clean up
                async with session.delete(f"{base_url}/games/{game_id}") as delete_response:
                    delete_result = await delete_response.json()
                    print(f"🗑️ Delete Response: {delete_result}")
            else:
                print(f"❌ Game creation failed: {result}")

async def run_stress_test(num_games=10):
    """Run multiple games for stress testing"""
    print(f"🚀 Running stress test with {num_games} games...")
    
    start_time = time.time()
    successful_games = 0
    
    for i in range(num_games):
        try:
            print(f"\n🎮 Game {i+1}/{num_games}")
            await test_game_creation()
            successful_games += 1
        except Exception as e:
            print(f"❌ Game {i+1} failed: {e}")
    
    total_time = time.time() - start_time
    
    print(f"\n📊 STRESS TEST RESULTS:")
    print(f"⏱️  Total Duration: {total_time:.1f}s") 
    print(f"✅ Successful Games: {successful_games}/{num_games}")
    print(f"🎯 Success Rate: {(successful_games/num_games)*100:.1f}%")

if __name__ == "__main__":
    print("🎮 PCD Simple Stress Test Starting...")
    asyncio.run(run_stress_test(5)) 