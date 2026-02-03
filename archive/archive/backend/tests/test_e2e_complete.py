#!/usr/bin/env python3
"""
End-to-End System Test

Tests critical flows from authentication to game completion.
Run this against a live backend to verify everything works.
"""

import asyncio
import httpx
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"
TEST_TIMEOUT = 30


class E2ETestRunner:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=TEST_TIMEOUT)
        self.passed = 0
        self.failed = 0
        self.test_user1 = None
        self.test_user2 = None
        self.token1 = None
        self.token2 = None
    
    def log_test(self, name: str, passed: bool, details: str = ""):
        """Log test result"""
        if passed:
            print(f"✅ {name}")
            self.passed += 1
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
            self.failed += 1
    
    async def test_health(self):
        """Test backend is running"""
        try:
            response = await self.client.get("/health")
            self.log_test("Backend Health Check", response.status_code == 200)
        except Exception as e:
            self.log_test("Backend Health Check", False, f"Backend not reachable: {e}")
            return False
        return True
    
    async def test_guest_auth(self):
        """Test guest login"""
        try:
            response = await self.client.post("/auth/guest", json={})
            data = response.json()
            
            success = (
                response.status_code == 200 and
                data.get("success") and
                data.get("data", {}).get("token") and
                data.get("data", {}).get("user", {}).get("is_guest")
            )
            
            self.log_test("Guest Authentication", success)
            
            if success:
                # Verify guest can't access quests
                guest_token = data["data"]["token"]
                headers = {"Authorization": f"Bearer {guest_token}"}
                quest_response = await self.client.get(
                    "/players/Guest_1234/quests",
                    headers=headers
                )
                
                # Should get 401 or 403
                blocked = quest_response.status_code in [401, 403]
                self.log_test("Guest Quest Restriction", blocked)
            
        except Exception as e:
            self.log_test("Guest Authentication", False, str(e))
    
    async def test_registration(self):
        """Test user registration"""
        import random
        suffix = random.randint(1000, 9999)
        
        try:
            # Test User 1
            user1_data = {
                "email": f"test{suffix}@example.com",
                "password": "SecurePass123!",
                "username": f"TestPlayer{suffix}"
            }
            
            response = await self.client.post("/auth/register", json=user1_data)
            data = response.json()
            
            if response.status_code == 200 and data.get("success"):
                self.test_user1 = data["data"]["user"]
                self.token1 = data["data"]["token"]
                self.log_test("User Registration", True)
            else:
                self.log_test("User Registration", False, data.get("message", "Unknown error"))
                
        except Exception as e:
            self.log_test("User Registration", False, str(e))
    
    async def test_login(self):
        """Test user login"""
        if not self.test_user1:
            print("⏭️  Skipping login test (no registered user)")
            return
        
        try:
            login_data = {
                "email": self.test_user1["email"],
                "password": "SecurePass123!"
            }
            
            response = await self.client.post("/auth/login", json=login_data)
            data = response.json()
            
            success = response.status_code == 200 and data.get("success")
            self.log_test("User Login", success)
            
        except Exception as e:
            self.log_test("User Login", False, str(e))
    
    async def test_token_refresh(self):
        """Test token refresh"""
        if not self.test_user1:
            print("⏭️  Skipping token refresh test")
            return
        
        try:
            # Get refresh token from registration
            response = await self.client.post("/auth/register", json={
                "email": f"refresh_test_{asyncio.get_event_loop().time()}@example.com",
                "password": "TestPass123!",
                "username": f"RefreshTest{int(asyncio.get_event_loop().time())}"
            })
            
            if response.status_code == 200:
                data = response.json()
                refresh_token = data["data"].get("refresh_token")
                
                if refresh_token:
                    # Try to refresh
                    refresh_response = await self.client.post(
                        "/auth/refresh",
                        json={"refresh_token": refresh_token}
                    )
                    
                    refresh_data = refresh_response.json()
                    success = (
                        refresh_response.status_code == 200 and
                        refresh_data.get("success") and
                        refresh_data.get("data", {}).get("token")
                    )
                    
                    self.log_test("Token Refresh", success)
                else:
                    self.log_test("Token Refresh", False, "No refresh token received")
            else:
                self.log_test("Token Refresh", False, "Setup failed")
                
        except Exception as e:
            self.log_test("Token Refresh", False, str(e))
    
    async def test_leaderboard(self):
        """Test leaderboard endpoint"""
        try:
            response = await self.client.get("/players/leaderboard/wins?limit=10")
            data = response.json()
            
            success = (
                response.status_code == 200 and
                data.get("success") and
                isinstance(data.get("data", {}).get("leaderboard"), list)
            )
            
            self.log_test("Leaderboard Retrieval", success)
            
        except Exception as e:
            self.log_test("Leaderboard Retrieval", False, str(e))
    
    async def test_ai_game_creation(self):
        """Test AI game creation"""
        if not self.token1:
            print("⏭️  Skipping AI game test")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.token1}"}
            response = await self.client.post(
                "/games/ai?difficulty=easy",
                headers=headers
            )
            
            data = response.json()
            success = (
                response.status_code == 200 and
                data.get("success") and
                data.get("data", {}).get("game_id")
            )
            
            self.log_test("AI Game Creation", success)
            
        except Exception as e:
            self.log_test("AI Game Creation", False, str(e))
    
    async def test_queue_stats(self):
        """Test matchmaking queue stats"""
        try:
            response = await self.client.get("/matchmaking/queue-stats")
            data = response.json()
            
            success = (
                response.status_code == 200 and
                data.get("success") and
                "dubai" in data.get("data", {})
            )
            
            self.log_test("Queue Stats", success)
            
        except Exception as e:
            self.log_test("Queue Stats", False, str(e))
    
    async def run_all_tests(self):
        """Run all tests"""
        print("=" * 60)
        print("🧪 PCD Game - End-to-End System Test")
        print("=" * 60)
        print()
        
        # Check if backend is running
        if not await self.test_health():
            print("\n❌ Backend is not running. Please start the server first.")
            print("   Run: python3 backend/api.py")
            return
        
        print()
        
        # Authentication tests
        print("🔐 Authentication Tests")
        print("-" * 40)
        await self.test_guest_auth()
        await self.test_registration()
        await self.test_login()
        await self.test_token_refresh()
        print()
        
        # Game tests
        print("🎮 Game Tests")
        print("-" * 40)
        await self.test_ai_game_creation()
        await self.test_queue_stats()
        print()
        
        # Social tests
        print("👥 Social Tests")
        print("-" * 40)
        await self.test_leaderboard()
        print()
        
        # Summary
        print("=" * 60)
        print("📊 Test Results")
        print("=" * 60)
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"📈 Success Rate: {round(self.passed / (self.passed + self.failed) * 100, 1)}%")
        print("=" * 60)
        
        if self.failed == 0:
            print("\n🎉 All tests passed! System is ready.")
            return 0
        else:
            print(f"\n⚠️  {self.failed} test(s) failed. Please review.")
            return 1
        
    async def cleanup(self):
        """Cleanup resources"""
        await self.client.aclose()


async def main():
    runner = E2ETestRunner()
    try:
        exit_code = await runner.run_all_tests()
        sys.exit(exit_code)
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
