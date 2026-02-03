#!/usr/bin/env python3
"""
PCD Backend Stress Test - Direct API Testing
Tests the backend with 1000+ games across all endpoints
"""

import asyncio
import aiohttp
import time
import random
import json
from typing import Dict, List, Any
import statistics

class BackendStressTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = {
            'games_created': 0,
            'games_completed': 0,
            'poison_moves': 0,
            'pick_moves': 0,
            'errors': 0,
            'response_times': []
        }
        self.errors = []
        
    async def log(self, message: str, level: str = "INFO"):
        timestamp = time.strftime("%H:%M:%S")
        colors = {
            'INFO': '\033[94m',
            'SUCCESS': '\033[92m', 
            'ERROR': '\033[91m',
            'WARN': '\033[93m'
        }
        print(f"{colors.get(level, '')}{timestamp} [{level}] {message}\033[0m")

    async def make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make HTTP request and track response time"""
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}{endpoint}"
                
                if method.upper() == 'GET':
                    async with session.get(url) as response:
                        result = await response.json()
                elif method.upper() == 'POST':
                    async with session.post(url, json=data) as response:
                        result = await response.json()
                elif method.upper() == 'DELETE':
                    async with session.delete(url) as response:
                        result = await response.json()
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                response_time = (time.time() - start_time) * 1000
                self.results['response_times'].append(response_time)
                
                return result
                
        except Exception as e:
            self.errors.append({
                'endpoint': endpoint,
                'method': method,
                'error': str(e),
                'timestamp': time.time()
            })
            self.results['errors'] += 1
            await self.log(f"Request failed: {endpoint} - {str(e)}", "ERROR")
            return {}

    async def test_health_check(self):
        """Test the health endpoint"""
        await self.log("Testing health endpoint...", "INFO")
        result = await self.make_request('GET', '/health')
        if result.get('status') == 'healthy':
            await self.log("✅ Health check passed", "SUCCESS")
            return True
        else:
            await self.log("❌ Health check failed", "ERROR")
            return False

    async def play_single_game(self, game_num: int) -> bool:
        """Play a complete game through the API"""
        try:
            # Create game
            game_data = await self.make_request('POST', '/games', {})
            if not game_data or 'game_id' not in game_data:
                await self.log(f"Game {game_num}: Failed to create game", "ERROR")
                return False
            
            game_id = game_data['game_id']
            self.results['games_created'] += 1
            
            # Set poison (random candy index 0-11)
            poison_index = random.randint(0, 11)
            poison_result = await self.make_request('POST', f'/games/{game_id}/poison', {
                'candy_index': poison_index
            })
            
            if poison_result:
                self.results['poison_moves'] += 1
                await self.log(f"Game {game_num}: Poison set at index {poison_index}", "INFO")
            
            # Play multiple rounds with random picks
            max_picks = random.randint(5, 12)  # Random game length
            
            for pick_num in range(max_picks):
                # Get current game state
                game_state = await self.make_request('GET', f'/games/{game_id}')
                if not game_state:
                    break
                
                # Check if game is over
                if game_state.get('status') == 'completed':
                    break
                
                # Make random pick (different from poison)
                available_indices = [i for i in range(12) if i != poison_index]
                if not available_indices:
                    break
                    
                pick_index = random.choice(available_indices)
                
                pick_result = await self.make_request('POST', f'/games/{game_id}/pick', {
                    'candy_index': pick_index
                })
                
                if pick_result:
                    self.results['pick_moves'] += 1
                    
                    # Check if we hit poison or won
                    if pick_result.get('hit_poison'):
                        await self.log(f"Game {game_num}: Hit poison! Game over.", "WARN")
                        break
                    elif pick_result.get('winner'):
                        await self.log(f"Game {game_num}: Player won!", "SUCCESS")
                        break
                
                # Small delay between picks
                await asyncio.sleep(0.1)
            
            # Clean up game
            await self.make_request('DELETE', f'/games/{game_id}')
            self.results['games_completed'] += 1
            
            return True
            
        except Exception as e:
            await self.log(f"Game {game_num}: Exception - {str(e)}", "ERROR")
            self.results['errors'] += 1
            return False

    async def run_stress_test(self, target_games: int = 1000, concurrent_games: int = 10):
        """Run the main stress test"""
        await self.log(f"🚀 Starting backend stress test with {target_games} games", "INFO")
        await self.log(f"⚡ Concurrent games: {concurrent_games}", "INFO")
        
        # Test health first
        if not await self.test_health_check():
            await self.log("Health check failed, aborting test", "ERROR")
            return
        
        start_time = time.time()
        
        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(concurrent_games)
        
        async def play_game_with_semaphore(game_num):
            async with semaphore:
                return await self.play_single_game(game_num)
        
        # Run games in batches
        batch_size = concurrent_games * 2
        for batch_start in range(0, target_games, batch_size):
            batch_end = min(batch_start + batch_size, target_games)
            batch_games = range(batch_start + 1, batch_end + 1)
            
            await self.log(f"🎮 Running games {batch_start + 1}-{batch_end}...", "INFO")
            
            # Run batch of games concurrently
            tasks = [play_game_with_semaphore(game_num) for game_num in batch_games]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Count successful games in this batch
            successful = sum(1 for r in results if r is True)
            await self.log(f"✅ Batch completed: {successful}/{len(batch_games)} successful", "SUCCESS")
            
            # Progress report every 100 games
            if batch_end % 100 == 0 or batch_end == target_games:
                progress = (batch_end / target_games) * 100
                await self.log(f"📊 Progress: {batch_end}/{target_games} ({progress:.1f}%)", "INFO")
                await self.generate_progress_report()
        
        total_time = time.time() - start_time
        await self.generate_final_report(total_time)

    async def generate_progress_report(self):
        """Generate a progress report"""
        results = self.results
        await self.log("📈 PROGRESS REPORT:", "INFO")
        await self.log(f"   Games Created: {results['games_created']}", "INFO")
        await self.log(f"   Games Completed: {results['games_completed']}", "INFO")
        await self.log(f"   Poison Moves: {results['poison_moves']}", "INFO")
        await self.log(f"   Pick Moves: {results['pick_moves']}", "INFO")
        await self.log(f"   Errors: {results['errors']}", "ERROR" if results['errors'] > 0 else "INFO")

    async def generate_final_report(self, total_time: float):
        """Generate the final comprehensive report"""
        results = self.results
        response_times = results['response_times']
        
        await self.log("", "INFO")
        await self.log("🎉 BACKEND STRESS TEST COMPLETED!", "SUCCESS")
        await self.log("=" * 60, "INFO")
        
        # Time and throughput stats
        await self.log(f"⏱️  Total Duration: {total_time:.1f}s", "INFO")
        await self.log(f"🎮 Games Created: {results['games_created']}", "INFO")
        await self.log(f"✅ Games Completed: {results['games_completed']}", "INFO")
        await self.log(f"⚡ Games/second: {results['games_completed'] / total_time:.2f}", "INFO")
        await self.log(f"🎯 Completion Rate: {results['games_completed'] / max(results['games_created'], 1) * 100:.1f}%", "INFO")
        
        # Move statistics
        await self.log(f"🧪 Poison Moves: {results['poison_moves']}", "INFO")
        await self.log(f"🍬 Pick Moves: {results['pick_moves']}", "INFO")
        await self.log(f"📊 Total API Calls: {len(response_times)}", "INFO")
        
        # Performance statistics
        if response_times:
            avg_response = statistics.mean(response_times)
            median_response = statistics.median(response_times)
            p95_response = sorted(response_times)[int(len(response_times) * 0.95)]
            
            await self.log(f"📈 Avg Response Time: {avg_response:.1f}ms", "INFO")
            await self.log(f"📊 Median Response Time: {median_response:.1f}ms", "INFO")
            await self.log(f"⚡ 95th Percentile: {p95_response:.1f}ms", "INFO")
        
        # Error statistics
        await self.log(f"❌ Total Errors: {results['errors']}", "ERROR" if results['errors'] > 0 else "SUCCESS")
        
        if self.errors:
            error_types = {}
            for error in self.errors:
                key = error['error'][:50]
                error_types[key] = error_types.get(key, 0) + 1
            
            await self.log("🔍 Top Error Types:", "WARN")
            for error_type, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True)[:3]:
                await self.log(f"   {count}x: {error_type}", "WARN")
        
        # Success rate
        success_rate = (results['games_completed'] / max(results['games_created'], 1)) * 100
        if success_rate >= 95:
            await self.log(f"🎉 EXCELLENT! Success Rate: {success_rate:.1f}%", "SUCCESS")
        elif success_rate >= 80:
            await self.log(f"⚠️  GOOD! Success Rate: {success_rate:.1f}%", "WARN")
        else:
            await self.log(f"❌ NEEDS ATTENTION! Success Rate: {success_rate:.1f}%", "ERROR")

async def main():
    tester = BackendStressTester()
    
    # Test with 1000+ games
    await tester.run_stress_test(target_games=1000, concurrent_games=20)

if __name__ == "__main__":
    asyncio.run(main()) 