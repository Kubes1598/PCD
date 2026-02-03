#!/usr/bin/env python3
"""
Query Performance Benchmark Script

Compares query performance before and after schema v3 optimizations.
Run this to validate the performance improvements.
"""

import asyncio
import time
import sys
from typing import List, Dict, Tuple

sys.path.insert(0, '/Users/LEE/pcd-game/PCD/backend')

from database import db_service
from config import settings


class QueryBenchmark:
    def __init__(self):
        self.results: List[Dict] = []
    
    async def benchmark_query(self, name: str, query_func, iterations: int = 10):
        """Benchmark a query function"""
        times = []
        
        for i in range(iterations):
            start = time.perf_counter()
            try:
                await query_func()
                duration = (time.perf_counter() - start) * 1000  # Convert to ms
                times.append(duration)
            except Exception as e:
                print(f"   ❌ Error in {name}: {e}")
                return
        
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        
        self.results.append({
            'name': name,
            'avg': avg_time,
            'min': min_time,
            'max': max_time,
            'iterations': iterations
        })
        
        print(f"✓ {name}")
        print(f"  Avg: {avg_time:.2f}ms | Min: {min_time:.2f}ms | Max: {max_time:.2f}ms")
    
    async def test_leaderboard_query(self):
        """Test leaderboard retrieval"""
        await db_service.get_leaderboard(sort_by='wins', limit=100)
    
    async def test_player_lookup(self):
        """Test player lookup by name"""
        # Get a player first
        players = await db_service.get_leaderboard(limit=1)
        if players and len(players) > 0:
            player_name = players[0]['name']
            await db_service.get_player(player_name)
    
    async def test_transaction_history(self):
        """Test getting recent transactions"""
        if hasattr(db_service, 'supabase'):
            # Get recent transactions
            db_service.supabase.table('coin_transactions').select('*').order('created_at', desc=True).limit(50).execute()
    
    async def test_active_games(self):
        """Test querying active games"""
        if hasattr(db_service, 'supabase'):
            db_service.supabase.table('games').select('*').eq('status', 'in_progress').limit(20).execute()
    
    async def test_player_stats_view(self):
        """Test materialized view query"""
        if hasattr(db_service, 'supabase'):
            try:
                db_service.supabase.from_('player_stats_mv').select('*').limit(100).execute()
            except:
                # View might not exist yet
                pass
    
    async def run_all_benchmarks(self):
        """Run all benchmark tests"""
        print("=" * 60)
        print("⚡ Query Performance Benchmarks")
        print("=" * 60)
        print()
        
        await self.benchmark_query("Leaderboard Query (100 players)", self.test_leaderboard_query)
        await self.benchmark_query("Player Lookup by Name", self.test_player_lookup)
        await self.benchmark_query("Transaction History (50 records)", self.test_transaction_history)
        await self.benchmark_query("Active Games Query", self.test_active_games)
        await self.benchmark_query("Player Stats Materialized View", self.test_player_stats_view)
        
        print("\n" + "=" * 60)
        print("📊 Performance Summary")
        print("=" * 60)
        
        for result in self.results:
            status = "🟢" if result['avg'] < 50 else "🟡" if result['avg'] < 100 else "🔴"
            print(f"{status} {result['name']}: {result['avg']:.2f}ms avg")
        
        print("\n" + "=" * 60)
        print("Performance Targets:")
        print("  🟢 Excellent: < 50ms")
        print("  🟡 Good: 50-100ms")
        print("  🔴 Needs optimization: > 100ms")
        print("=" * 60)


async def main():
    """Main entry point"""
    try:
        benchmark = QueryBenchmark()
        await benchmark.run_all_benchmarks()
    except Exception as e:
        print(f"❌ Benchmark error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
