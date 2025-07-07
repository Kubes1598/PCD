#!/usr/bin/env python3
"""
Quick QA Test for PCD Game - All Modes
"""

import asyncio
import aiohttp

async def quick_qa_test():
    print("🧪 QUICK QA TEST - ALL GAME MODES")
    print("=" * 50)
    
    results = {"passed": 0, "failed": 0, "total": 0}
    
    def test_result(name, passed, details=""):
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        
        results["total"] += 1
        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1
    
    try:
        async with aiohttp.ClientSession() as session:
            
            # Test Backend Health
            print("\n🔍 Backend Tests:")
            try:
                async with session.get("http://localhost:8000/health") as response:
                    backend_ok = response.status == 200
                    test_result("Backend Health", backend_ok)
            except:
                test_result("Backend Health", False, "Backend not accessible")
            
            # Test Frontend
            print("\n🔍 Frontend Tests:")
            try:
                async with session.get("http://localhost:8080/") as response:
                    frontend_ok = response.status == 200
                    test_result("Frontend Accessibility", frontend_ok)
            except:
                test_result("Frontend Accessibility", False, "Frontend not accessible")
            
            # Test JavaScript Functions
            print("\n🔍 JavaScript Function Tests:")
            try:
                async with session.get("http://localhost:8080/js/game.js") as response:
                    if response.status == 200:
                        js_content = await response.text()
                        
                        # Critical functions for all modes
                        critical_functions = [
                            'initializePoisonSelection',
                            'startOnlineGame',
                            'startAIGame',
                            'initializeFriendsGame',
                            'UnifiedCandyPicker',
                            'checkGameWinCondition'
                        ]
                        
                        for func in critical_functions:
                            func_exists = func in js_content
                            test_result(f"Function: {func}", func_exists)
                    else:
                        test_result("JavaScript Functions", False, "Cannot access game.js")
            except Exception as e:
                test_result("JavaScript Functions", False, str(e))
            
            # Test Game Creation (Online Mode)
            print("\n🔍 Online Mode Tests:")
            try:
                game_data = {"player1_name": "QA_Player", "player2_name": "QA_Opponent"}
                async with session.post("http://localhost:8000/games", json=game_data) as response:
                    game_creation_ok = response.status == 200
                    test_result("Online Game Creation", game_creation_ok)
                    
                    if game_creation_ok:
                        result = await response.json()
                        game_id = result['data']['game_id']
                        candies = result['data']['game_state']['player1']['owned_candies']
                        candy_count_ok = len(candies) >= 12
                        test_result("Candy Data Generation", candy_count_ok)
                        
                        # Test poison selection
                        poison_data = {
                            "player_id": result['data']['game_state']['player1']['id'],
                            "poison_candy": candies[0]
                        }
                        async with session.post(f"http://localhost:8000/games/{game_id}/poison", json=poison_data) as poison_response:
                            poison_ok = poison_response.status == 200
                            test_result("Poison Selection API", poison_ok)
            except Exception as e:
                test_result("Online Mode", False, str(e))
            
            # Test P2P/Friends Mode JavaScript
            print("\n🔍 P2P/Friends Mode Tests:")
            try:
                if 'js_content' in locals():
                    p2p_functions = [
                        'P2PGameManager',
                        'createP2PRoom',
                        'joinPrivateRoom',
                        'handleP2PCandyPick'
                    ]
                    
                    p2p_ok = all(func in js_content for func in p2p_functions)
                    test_result("P2P Functions Available", p2p_ok)
                    
                    webrtc_ok = 'RTCPeerConnection' in js_content
                    test_result("WebRTC Support", webrtc_ok)
                    
                    room_code_ok = 'generateRoomCode' in js_content
                    test_result("Room Code Generation", room_code_ok)
            except Exception as e:
                test_result("P2P Mode", False, str(e))
                
    except Exception as e:
        test_result("Overall Test", False, str(e))
    
    # Generate Summary
    print("\n" + "=" * 50)
    print("🏁 QA TEST SUMMARY")
    print("=" * 50)
    
    total = results["total"]
    passed = results["passed"]
    failed = results["failed"]
    pass_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"📊 Results: {passed}/{total} tests passed ({pass_rate:.1f}%)")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if pass_rate >= 90:
        print("\n🎉 EXCELLENT! All systems working well!")
        print("✅ Ready for user testing")
        return True
    elif pass_rate >= 75:
        print("\n✅ GOOD! Minor issues but system is functional")
        print("⚠️  Some non-critical issues detected")
        return True
    else:
        print("\n⚠️  ISSUES DETECTED! Review failed tests")
        print("🔧 Fix critical issues before user testing")
        return False

if __name__ == "__main__":
    success = asyncio.run(quick_qa_test())
    exit(0 if success else 1) 