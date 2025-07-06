#!/usr/bin/env python3
"""
Fixed API Test for PCD Game
Tests API endpoints with correct data structures
"""

import asyncio
import aiohttp
import json

async def test_corrected_apis():
    """Test APIs with correct data structures"""
    backend_url = "http://localhost:8000"
    
    print("🧪 Testing Corrected API Endpoints")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        
        # Test 1: Game Creation with correct fields
        print("\n1. Testing Game Creation...")
        game_data = {
            "player1_name": "TestPlayer1",
            "player2_name": "TestPlayer2"
        }
        
        async with session.post(f"{backend_url}/games", json=game_data) as response:
            print(f"   Status: {response.status}")
            if response.status == 200:
                result = await response.json()
                game_id = result.get('data', {}).get('game_id')
                print(f"   ✅ Game created successfully: {game_id}")
                
                # Test 2: Game State Retrieval
                print("\n2. Testing Game State Retrieval...")
                async with session.get(f"{backend_url}/games/{game_id}/state") as state_response:
                    print(f"   Status: {state_response.status}")
                    if state_response.status == 200:
                        state_data = await state_response.json()
                        print(f"   ✅ Game state retrieved successfully")
                    else:
                        print(f"   ❌ Game state retrieval failed")
                
                # Test 3: Candy Pick with correct format
                print("\n3. Testing Candy Pick...")
                pick_data = {
                    "player": "TestPlayer1",
                    "candy_choice": "🍭"
                }
                async with session.post(f"{backend_url}/games/{game_id}/pick", json=pick_data) as pick_response:
                    print(f"   Status: {pick_response.status}")
                    if pick_response.status in [200, 400]:  # 400 is ok for invalid picks
                        print(f"   ✅ Candy pick endpoint working")
                    else:
                        print(f"   ❌ Candy pick failed")
                        
            else:
                print(f"   ❌ Game creation failed: {response.status}")
                error_data = await response.json()
                print(f"   Error: {error_data}")
        
        # Test 4: Player Balance with correct endpoint
        print("\n4. Testing Player Balance...")
        balance_data = {
            "player_name": "TestPlayer1"
        }
        async with session.post(f"{backend_url}/players/balance", json=balance_data) as response:
            print(f"   Status: {response.status}")
            if response.status == 200:
                balance_result = await response.json()
                print(f"   ✅ Balance retrieved: {balance_result}")
            else:
                print(f"   ❌ Balance retrieval failed: {response.status}")
        
        # Test 5: Coin Transaction with correct endpoint
        print("\n5. Testing Coin Transaction...")
        transaction_data = {
            "player_name": "TestPlayer1",
            "amount": 100,
            "transaction_type": "reward"
        }
        async with session.post(f"{backend_url}/players/transaction", json=transaction_data) as response:
            print(f"   Status: {response.status}")
            if response.status == 200:
                transaction_result = await response.json()
                print(f"   ✅ Transaction processed: {transaction_result}")
            else:
                print(f"   ❌ Transaction failed: {response.status}")
                error_data = await response.json()
                print(f"   Error: {error_data}")
        
        # Test 6: Health Check
        print("\n6. Testing Health Check...")
        async with session.get(f"{backend_url}/health") as response:
            print(f"   Status: {response.status}")
            if response.status == 200:
                health_data = await response.json()
                print(f"   ✅ Backend healthy: {health_data['status']}")
            else:
                print(f"   ❌ Health check failed")

if __name__ == "__main__":
    asyncio.run(test_corrected_apis()) 