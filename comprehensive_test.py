#!/usr/bin/env python3
"""
Comprehensive Test Suite for PCD Game
Tests all aspects: backend, frontend, game logic, UI, and integration
"""

import asyncio
import aiohttp
import json
import time
import os
import sys
from typing import Dict, List, Any, Optional
import re
import subprocess

class ComprehensiveTestSuite:
    def __init__(self):
        self.backend_url = "http://localhost:8000"
        self.frontend_url = "http://localhost:8080"
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": [],
            "details": {}
        }
        
    async def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🧪 Starting Comprehensive PCD Game Test Suite")
        print("=" * 60)
        
        # Test categories
        await self.test_backend_health()
        await self.test_frontend_accessibility()
        await self.test_game_logic_validation()
        await self.test_backend_api_endpoints()
        await self.test_frontend_javascript_validation()
        await self.test_ui_structure()
        await self.test_database_operations()
        await self.test_integration_scenarios()
        
        # Print final results
        self.print_final_results()
        
    def log_test(self, test_name: str, passed: bool, message: str = "", details: Any = None):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
        if message:
            print(f"    {message}")
        if details:
            print(f"    Details: {details}")
        
        if passed:
            self.test_results["passed"] += 1
        else:
            self.test_results["failed"] += 1
            self.test_results["errors"].append({
                "test": test_name,
                "message": message,
                "details": details
            })
        
        self.test_results["details"][test_name] = {
            "passed": passed,
            "message": message,
            "details": details
        }
        
    async def test_backend_health(self):
        """Test backend server health and connectivity"""
        print("\n🔍 Testing Backend Health...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.backend_url}/health") as response:
                    if response.status == 200:
                        data = await response.json()
                        self.log_test("Backend Health Check", True, f"Status: {data.get('status')}")
                        self.log_test("Supabase Connection", data.get('supabase_connected', False))
                    else:
                        self.log_test("Backend Health Check", False, f"Status code: {response.status}")
        except Exception as e:
            self.log_test("Backend Health Check", False, f"Connection error: {str(e)}")
    
    async def test_frontend_accessibility(self):
        """Test frontend server accessibility"""
        print("\n🔍 Testing Frontend Accessibility...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.frontend_url}/") as response:
                    if response.status == 200:
                        html_content = await response.text()
                        self.log_test("Frontend Accessibility", True, "Frontend server responding")
                        
                        # Check for key HTML elements
                        key_elements = [
                            '<title>',
                            'id="page1"',
                            'id="page2"',
                            'id="page3"',
                            'game.js',
                            'main.css'
                        ]
                        
                        for element in key_elements:
                            if element in html_content:
                                self.log_test(f"HTML Element: {element}", True)
                            else:
                                self.log_test(f"HTML Element: {element}", False, "Missing from HTML")
                    else:
                        self.log_test("Frontend Accessibility", False, f"Status code: {response.status}")
        except Exception as e:
            self.log_test("Frontend Accessibility", False, f"Connection error: {str(e)}")
    
    async def test_game_logic_validation(self):
        """Test game logic by analyzing the JavaScript code"""
        print("\n🔍 Testing Game Logic Validation...")
        
        try:
            with open('web-app/js/game.js', 'r') as f:
                js_content = f.read()
            
            # Check for critical game logic functions
            critical_functions = [
                'checkGameWinCondition',
                'handleOfflineCandyPick',
                'handleOfflineAITurn',
                'initializePoisonSelection',
                'startOnlineGame',
                'UnifiedCandyPicker'
            ]
            
            for func in critical_functions:
                if func in js_content:
                    self.log_test(f"Function: {func}", True)
                else:
                    self.log_test(f"Function: {func}", False, "Missing critical function")
            
            # Check for proper win condition implementation
            win_condition_patterns = [
                r'checkGameWinCondition\(',
                r'gameState\.playerCollection\.length',
                r'gameState\.opponentCollection\.length',
                r'isDraw.*true',
                r'hasWinner.*true'
            ]
            
            for pattern in win_condition_patterns:
                if re.search(pattern, js_content):
                    self.log_test(f"Win Logic Pattern: {pattern}", True)
                else:
                    self.log_test(f"Win Logic Pattern: {pattern}", False, "Missing win condition logic")
            
            # Check for proper error handling
            error_patterns = [
                r'try\s*{',
                r'catch\s*\(',
                r'console\.error',
                r'showNotification.*error'
            ]
            
            for pattern in error_patterns:
                matches = len(re.findall(pattern, js_content))
                if matches > 0:
                    self.log_test(f"Error Handling: {pattern}", True, f"Found {matches} instances")
                else:
                    self.log_test(f"Error Handling: {pattern}", False, "Missing error handling")
                    
        except Exception as e:
            self.log_test("Game Logic Validation", False, f"Error reading file: {str(e)}")
    
    async def test_backend_api_endpoints(self):
        """Test all backend API endpoints"""
        print("\n🔍 Testing Backend API Endpoints...")
        
        test_endpoints = [
            ("/health", "GET"),
            ("/games", "POST"),
            ("/games/test-game/pick", "POST"),
            ("/games/test-game/status", "GET"),
            ("/player/balance", "GET"),
            ("/player/coins", "POST"),
        ]
        
        async with aiohttp.ClientSession() as session:
            for endpoint, method in test_endpoints:
                try:
                    url = f"{self.backend_url}{endpoint}"
                    
                    if method == "GET":
                        async with session.get(url) as response:
                            status_ok = response.status < 500  # Accept 4xx but not 5xx
                            self.log_test(f"API {method} {endpoint}", status_ok, f"Status: {response.status}")
                    
                    elif method == "POST":
                        # Use appropriate test data for different endpoints
                        test_data = {}
                        if "/games" in endpoint and not "/pick" in endpoint:
                            test_data = {"player1_id": "test-player", "player2_id": "ai"}
                        elif "/pick" in endpoint:
                            test_data = {"player": "test-player", "candy_choice": "🍭"}
                        elif "/coins" in endpoint:
                            test_data = {"amount": 100, "transaction_type": "add"}
                        
                        async with session.post(url, json=test_data) as response:
                            status_ok = response.status < 500
                            self.log_test(f"API {method} {endpoint}", status_ok, f"Status: {response.status}")
                            
                except Exception as e:
                    self.log_test(f"API {method} {endpoint}", False, f"Error: {str(e)}")
    
    async def test_frontend_javascript_validation(self):
        """Test frontend JavaScript syntax and structure"""
        print("\n🔍 Testing Frontend JavaScript Validation...")
        
        try:
            # Run Node.js syntax check
            result = subprocess.run(
                ['node', '-c', 'web-app/js/game.js'],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log_test("JavaScript Syntax Check", True, "No syntax errors")
            else:
                self.log_test("JavaScript Syntax Check", False, f"Syntax errors: {result.stderr}")
            
            # Check for common JavaScript issues
            with open('web-app/js/game.js', 'r') as f:
                js_content = f.read()
            
            # Check for undefined variables (basic check)
            common_issues = [
                (r'console\.log\(.*undefined', "Undefined variable logging"),
                (r'document\.getElementById\([\'"][\w-]+[\'"].*null', "Null element access"),
                (r'gameState\.[\w]+.*undefined', "Undefined gameState property"),
            ]
            
            for pattern, issue_name in common_issues:
                matches = re.findall(pattern, js_content)
                if not matches:
                    self.log_test(f"JS Issue Check: {issue_name}", True, "No issues found")
                else:
                    self.log_test(f"JS Issue Check: {issue_name}", False, f"Found {len(matches)} potential issues")
            
        except Exception as e:
            self.log_test("JavaScript Validation", False, f"Error: {str(e)}")
    
    async def test_ui_structure(self):
        """Test UI structure and elements"""
        print("\n🔍 Testing UI Structure...")
        
        try:
            with open('web-app/index.html', 'r') as f:
                html_content = f.read()
            
            # Check for essential UI elements
            essential_elements = [
                ('id="page1"', "Main Menu Page"),
                ('id="page2"', "Game Setup Page"),
                ('id="page3"', "Game Board Page"),
                ('class="btn"', "Button Elements"),
                ('onclick=', "Click Handlers"),
                ('game.js', "Game Script"),
                ('main.css', "Main Stylesheet"),
            ]
            
            for element, description in essential_elements:
                if element in html_content:
                    self.log_test(f"UI Element: {description}", True)
                else:
                    self.log_test(f"UI Element: {description}", False, f"Missing: {element}")
            
            # Check CSS file
            if os.path.exists('web-app/css/main.css'):
                with open('web-app/css/main.css', 'r') as f:
                    css_content = f.read()
                
                css_checks = [
                    ('.btn', "Button Styles"),
                    ('.card', "Card Styles"),
                    ('.game-board', "Game Board Styles"),
                    ('@media', "Responsive Design"),
                ]
                
                for selector, description in css_checks:
                    if selector in css_content:
                        self.log_test(f"CSS: {description}", True)
                    else:
                        self.log_test(f"CSS: {description}", False, f"Missing: {selector}")
            else:
                self.log_test("CSS File Exists", False, "main.css not found")
                
        except Exception as e:
            self.log_test("UI Structure Test", False, f"Error: {str(e)}")
    
    async def test_database_operations(self):
        """Test database operations through API"""
        print("\n🔍 Testing Database Operations...")
        
        try:
            async with aiohttp.ClientSession() as session:
                # Test game creation
                game_data = {
                    "player1_id": "test-player-1",
                    "player2_id": "test-player-2"
                }
                
                async with session.post(f"{self.backend_url}/games", json=game_data) as response:
                    if response.status == 201:
                        game_result = await response.json()
                        game_id = game_result.get('game_id')
                        self.log_test("Database: Game Creation", True, f"Created game: {game_id}")
                        
                        # Test game status retrieval
                        async with session.get(f"{self.backend_url}/games/{game_id}/status") as status_response:
                            if status_response.status == 200:
                                self.log_test("Database: Game Status Retrieval", True)
                            else:
                                self.log_test("Database: Game Status Retrieval", False, f"Status: {status_response.status}")
                        
                        # Test game pick
                        pick_data = {
                            "player": "test-player-1",
                            "candy_choice": "🍭"
                        }
                        async with session.post(f"{self.backend_url}/games/{game_id}/pick", json=pick_data) as pick_response:
                            if pick_response.status in [200, 400]:  # 400 is acceptable for invalid picks
                                self.log_test("Database: Game Pick", True, f"Status: {pick_response.status}")
                            else:
                                self.log_test("Database: Game Pick", False, f"Status: {pick_response.status}")
                    else:
                        self.log_test("Database: Game Creation", False, f"Status: {response.status}")
                        
        except Exception as e:
            self.log_test("Database Operations", False, f"Error: {str(e)}")
    
    async def test_integration_scenarios(self):
        """Test integration scenarios"""
        print("\n🔍 Testing Integration Scenarios...")
        
        # Test player balance operations
        try:
            async with aiohttp.ClientSession() as session:
                # Test balance retrieval
                async with session.get(f"{self.backend_url}/player/balance?player_name=TestPlayer") as response:
                    if response.status == 200:
                        balance_data = await response.json()
                        self.log_test("Integration: Balance Retrieval", True, f"Balance: {balance_data.get('balance', 0)}")
                    else:
                        self.log_test("Integration: Balance Retrieval", False, f"Status: {response.status}")
                
                # Test coin transaction
                coin_data = {
                    "amount": 100,
                    "transaction_type": "add",
                    "description": "Test transaction"
                }
                async with session.post(f"{self.backend_url}/player/coins", json=coin_data) as response:
                    if response.status == 200:
                        self.log_test("Integration: Coin Transaction", True)
                    else:
                        self.log_test("Integration: Coin Transaction", False, f"Status: {response.status}")
                        
        except Exception as e:
            self.log_test("Integration Scenarios", False, f"Error: {str(e)}")
    
    def print_final_results(self):
        """Print final test results"""
        print("\n" + "=" * 60)
        print("🏁 COMPREHENSIVE TEST RESULTS")
        print("=" * 60)
        
        total_tests = self.test_results["passed"] + self.test_results["failed"]
        pass_rate = (self.test_results["passed"] / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 Total Tests: {total_tests}")
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        print(f"📈 Pass Rate: {pass_rate:.1f}%")
        
        if self.test_results["failed"] > 0:
            print(f"\n❌ FAILED TESTS ({self.test_results['failed']}):")
            for i, error in enumerate(self.test_results["errors"][:10], 1):  # Show first 10 errors
                print(f"  {i}. {error['test']}")
                if error['message']:
                    print(f"     → {error['message']}")
        
        # Overall assessment
        if pass_rate >= 95:
            print(f"\n🎉 EXCELLENT! The game appears to be working very well.")
        elif pass_rate >= 80:
            print(f"\n👍 GOOD! The game is mostly working with minor issues.")
        elif pass_rate >= 60:
            print(f"\n⚠️  MODERATE! The game has some issues that need attention.")
        else:
            print(f"\n🚨 CRITICAL! The game has significant issues that need immediate attention.")
        
        return pass_rate >= 80  # Return True if 80% or more tests pass

async def main():
    """Run the comprehensive test suite"""
    suite = ComprehensiveTestSuite()
    await suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main()) 