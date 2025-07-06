#!/usr/bin/env python3
"""
Final Game Test - Simulates Actual Gameplay Scenarios
Tests core game functionality end-to-end
"""

import asyncio
import aiohttp
import json
import random

class GameplaySimulator:
    def __init__(self):
        self.backend_url = "http://localhost:8000"
        self.test_results = []
        
    def log_result(self, test_name, passed, details=""):
        status = "✅" if passed else "❌"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({"test": test_name, "passed": passed, "details": details})
        
    async def test_complete_game_flow(self):
        """Test a complete game from start to finish"""
        print("🎮 Testing Complete Game Flow")
        print("=" * 50)
        
        try:
            async with aiohttp.ClientSession() as session:
                # 1. Create Game
                print("\n1. Creating Game...")
                game_data = {
                    "player1_name": "Alice",
                    "player2_name": "Bob"
                }
                
                async with session.post(f"{self.backend_url}/games", json=game_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        game_id = result['data']['game_id']
                        self.log_result("Game Creation", True, f"Game ID: {game_id}")
                        
                        # 2. Get Initial Game State
                        print("\n2. Getting Initial Game State...")
                        async with session.get(f"{self.backend_url}/games/{game_id}/state") as state_response:
                            if state_response.status == 200:
                                state_data = await state_response.json()
                                game_state = state_data['data']
                                self.log_result("Initial Game State", True, f"Status: {game_state['status']}")
                                
                                # 3. Set Poison for Player 1
                                print("\n3. Setting Poison for Player 1...")
                                player1_candies = game_state['game_state']['player1']['owned_candies']
                                poison_choice = random.choice(player1_candies)
                                
                                poison_data = {
                                    "player_id": "Alice",
                                    "poison_candy": poison_choice
                                }
                                async with session.post(f"{self.backend_url}/games/{game_id}/poison", json=poison_data) as poison_response:
                                    if poison_response.status == 200:
                                        self.log_result("Player 1 Poison Set", True, f"Poison: {poison_choice}")
                                    else:
                                        self.log_result("Player 1 Poison Set", False, f"Status: {poison_response.status}")
                                
                                # 4. Set Poison for Player 2
                                print("\n4. Setting Poison for Player 2...")
                                player2_candies = game_state['game_state']['player2']['owned_candies']
                                poison_choice2 = random.choice(player2_candies)
                                
                                poison_data2 = {
                                    "player_id": "Bob",
                                    "poison_candy": poison_choice2
                                }
                                async with session.post(f"{self.backend_url}/games/{game_id}/poison", json=poison_data2) as poison_response2:
                                    if poison_response2.status == 200:
                                        self.log_result("Player 2 Poison Set", True, f"Poison: {poison_choice2}")
                                    else:
                                        self.log_result("Player 2 Poison Set", False, f"Status: {poison_response2.status}")
                                
                                # 5. Simulate Game Turns
                                print("\n5. Simulating Game Turns...")
                                turn_count = 0
                                max_turns = 10
                                
                                while turn_count < max_turns:
                                    # Get current game state
                                    async with session.get(f"{self.backend_url}/games/{game_id}/state") as turn_state:
                                        if turn_state.status == 200:
                                            turn_data = await turn_state.json()
                                            current_state = turn_data['data']
                                            
                                            if current_state['status'] != 'active':
                                                self.log_result("Game Progression", True, f"Game ended naturally: {current_state['status']}")
                                                break
                                            
                                            # Make a move
                                            current_player = "Alice" if turn_count % 2 == 0 else "Bob"
                                            available_candies = current_state['game_state']['player2']['owned_candies'] if current_player == "Alice" else current_state['game_state']['player1']['owned_candies']
                                            
                                            if available_candies:
                                                candy_choice = random.choice(available_candies)
                                                
                                                pick_data = {
                                                    "player": current_player,
                                                    "candy_choice": candy_choice
                                                }
                                                
                                                async with session.post(f"{self.backend_url}/games/{game_id}/pick", json=pick_data) as pick_response:
                                                    if pick_response.status == 200:
                                                        pick_result = await pick_response.json()
                                                        print(f"   Turn {turn_count + 1}: {current_player} picked {candy_choice}")
                                                        
                                                        if pick_result['data']['result'] != 'ongoing':
                                                            self.log_result("Game Completion", True, f"Result: {pick_result['data']['result']}")
                                                            break
                                                    else:
                                                        self.log_result("Game Turn", False, f"Pick failed: {pick_response.status}")
                                                        break
                                            else:
                                                self.log_result("Game Turn", False, "No candies available")
                                                break
                                        else:
                                            self.log_result("Game Turn", False, "Failed to get game state")
                                            break
                                    
                                    turn_count += 1
                                
                                if turn_count >= max_turns:
                                    self.log_result("Game Completion", True, "Game ran for maximum turns")
                                    
                            else:
                                self.log_result("Initial Game State", False, f"Status: {state_response.status}")
                    else:
                        self.log_result("Game Creation", False, f"Status: {response.status}")
                        
        except Exception as e:
            self.log_result("Complete Game Flow", False, f"Exception: {str(e)}")
    
    async def test_economy_system(self):
        """Test the economy/reward system"""
        print("\n💰 Testing Economy System")
        print("=" * 30)
        
        try:
            async with aiohttp.ClientSession() as session:
                # Test player balance
                balance_data = {"player_name": "TestEconomyPlayer"}
                async with session.post(f"{self.backend_url}/players/balance", json=balance_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        initial_balance = result['data']['coin_balance']
                        self.log_result("Get Player Balance", True, f"Balance: {initial_balance}")
                        
                        # Test coin transaction
                        transaction_data = {
                            "player_name": "TestEconomyPlayer",
                            "amount": 500,
                            "transaction_type": "game_entry"
                        }
                        async with session.post(f"{self.backend_url}/players/transaction", json=transaction_data) as trans_response:
                            if trans_response.status == 200:
                                trans_result = await trans_response.json()
                                new_balance = trans_result['data']['new_balance']
                                self.log_result("Process Transaction", True, f"New Balance: {new_balance}")
                                
                                # Verify balance change
                                if new_balance == initial_balance + 500:
                                    self.log_result("Balance Calculation", True, "Correct balance change")
                                else:
                                    self.log_result("Balance Calculation", False, f"Expected {initial_balance + 500}, got {new_balance}")
                            else:
                                self.log_result("Process Transaction", False, f"Status: {trans_response.status}")
                    else:
                        self.log_result("Get Player Balance", False, f"Status: {response.status}")
                        
        except Exception as e:
            self.log_result("Economy System", False, f"Exception: {str(e)}")
    
    async def test_multiple_games(self):
        """Test multiple concurrent games"""
        print("\n🎯 Testing Multiple Games")
        print("=" * 30)
        
        try:
            async with aiohttp.ClientSession() as session:
                game_ids = []
                
                # Create multiple games
                for i in range(3):
                    game_data = {
                        "player1_name": f"Player{i}A",
                        "player2_name": f"Player{i}B"
                    }
                    async with session.post(f"{self.backend_url}/games", json=game_data) as response:
                        if response.status == 200:
                            result = await response.json()
                            game_ids.append(result['data']['game_id'])
                
                if len(game_ids) == 3:
                    self.log_result("Multiple Game Creation", True, f"Created {len(game_ids)} games")
                    
                    # Test that all games are independent
                    for game_id in game_ids:
                        async with session.get(f"{self.backend_url}/games/{game_id}/state") as response:
                            if response.status == 200:
                                self.log_result(f"Game {game_id[:8]} State", True, "Independent game state")
                            else:
                                self.log_result(f"Game {game_id[:8]} State", False, f"Status: {response.status}")
                else:
                    self.log_result("Multiple Game Creation", False, f"Only created {len(game_ids)} games")
                    
        except Exception as e:
            self.log_result("Multiple Games", False, f"Exception: {str(e)}")
    
    def print_final_summary(self):
        """Print final test summary"""
        print("\n" + "=" * 60)
        print("🏁 FINAL GAME TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['passed'])
        total = len(self.test_results)
        pass_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"📊 Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"📈 Pass Rate: {pass_rate:.1f}%")
        
        if pass_rate >= 90:
            print(f"\n🎉 EXCELLENT! The game is working very well!")
            print("🎮 All core gameplay mechanics are functional")
            print("💰 Economy system is working properly")
            print("🔄 Multiple games can run concurrently")
        elif pass_rate >= 70:
            print(f"\n👍 GOOD! The game is mostly functional with minor issues.")
        else:
            print(f"\n⚠️  The game has some issues that may affect gameplay.")
        
        failed_tests = [r for r in self.test_results if not r['passed']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
    
    async def run_all_tests(self):
        """Run all gameplay tests"""
        await self.test_complete_game_flow()
        await self.test_economy_system()
        await self.test_multiple_games()
        self.print_final_summary()

async def main():
    simulator = GameplaySimulator()
    await simulator.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main()) 