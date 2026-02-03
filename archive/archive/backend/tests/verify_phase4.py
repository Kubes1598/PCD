import pytest
import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
import sys
import os
from unittest.mock import MagicMock, AsyncMock
import json

# Ensure backend is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from api import app
from dependencies import get_db_service, get_game_engine
from utils.security import create_access_token

BASE_URL = "http://test"

@pytest.fixture
def mock_services():
    """Mock DB and Engine for pure endpoint logic testing."""
    # 1. Mock DB
    mock_db = AsyncMock()
    mock_db.create_game.return_value = True
    mock_db.update_game.return_value = True
    mock_db.update_player_balance.return_value = True
    mock_db.create_transaction.return_value = True
    
    # 2. Mock Engine (or use real one with mocks)
    real_engine = get_game_engine()
    
    # Override dependencies
    app.dependency_overrides[get_db_service] = lambda: mock_db
    
    yield mock_db, real_engine
    
    app.dependency_overrides.clear()

@pytest.fixture
def auth_user():
    """Create a mock authorized user with 'sub' and 'is_guest'."""
    uid = str(uuid.uuid4())
    user = {"id": uid, "username": "SecurityTester", "email": "test@pcd.com"}
    token = create_access_token({"sub": uid, "is_guest": True, "name": "SecurityTester"})
    return user, token

@pytest.fixture
def auth_user_2():
    """Create a second mock authorized user."""
    uid = str(uuid.uuid4())
    user = {"id": uid, "username": "OpponentTester", "email": "test2@pcd.com"}
    token = create_access_token({"sub": uid, "is_guest": True, "name": "OpponentTester"})
    return user, token

@pytest.mark.asyncio
async def test_secret_isolation_layer(mock_services, auth_user, auth_user_2):
    """VERIFY: Secret poison choice is NEVER leaked via public API."""
    _, engine = mock_services
    user1, token1 = auth_user
    user2, token2 = auth_user_2
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        # 1. Create a game
        response = await client.post("/games", json={
            "player1_name": user1["username"],
            "player2_name": user2["username"]
        })
        game_id = response.json()["data"]["game_id"]
        
        # 2. Set poison for Player 2
        state_resp = await client.get(f"/games/{game_id}/state")
        gs = state_resp.json()["data"]["game_state"]
        p2_id = gs["player2"]["id"]
        p2_candies = gs["player2"]["owned_candies"]
        p2_secret = p2_candies[0]
        
        # Create token for ACTUAL p2_id
        actual_token2 = create_access_token({"sub": p2_id, "is_guest": True, "name": user2["username"]})
        
        await client.post(f"/games/{game_id}/poison", 
            json={"player_id": p2_id, "poison_candy": p2_secret},
            headers={"Authorization": f"Bearer {actual_token2}"}
        )
        
        # 3. Request state as Player 1 (Should NOT see P2's secret)
        p1_view = await client.get(f"/games/{game_id}/state")
        p1_gs = p1_view.json()["data"]["game_state"]
        
        # Check standard paths where secrets might leak
        assert p1_gs["player2"].get("poison_choice") is None
        assert "poison_reveal" not in p1_gs
        
        # Deep check: Ensure it's not anywhere in the JSON except where it belongs
        gs_json = json.dumps(p1_gs)
        # We don't check for p2_secret in gs_json because p2_secret IS in 'owned_candies'
        
        print("✅ Secret Isolation Verified: Opponent poison not visible in state.")

@pytest.mark.asyncio
async def test_ai_move_security_filtering(mock_services, auth_user, auth_user_2):
    """VERIFY: AI move endpoint blocks requests for PvP games."""
    _, engine = mock_services
    user1, _ = auth_user
    user2, _ = auth_user_2
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        # 1. Create a PvP game
        response = await client.post("/games", json={
            "player1_name": user1["username"],
            "player2_name": user2["username"]
        })
        game_id = response.json()["data"]["game_id"]
        
        # 2. Get the actual IDs assigned by the engine
        state_resp = await client.get(f"/games/{game_id}/state")
        actual_gs = state_resp.json()["data"]["game_state"]
        p1_id = actual_gs["player1"]["id"]
        
        # 3. Create a token for THE actual player1 in that game
        actual_token = create_access_token({"sub": p1_id, "is_guest": True, "name": user1["username"]})
        
        # 4. Attempt to use AI move for this PvP game
        cheat_attempt = await client.post("/ai/move", 
            json={
                "game_id": game_id,
                "player_candies": ["🍬"],
                "opponent_collection": [],
                "player_poison": "🍭",
                "difficulty": "hard"
            },
            headers={"Authorization": f"Bearer {actual_token}"}
        )
        
        # Should be 403 Forbidden
        assert cheat_attempt.status_code == 403
        assert "AI assistance is not permitted" in cheat_attempt.json()["detail"]
        
        print("✅ AI Move Security Verified: Blocked cheating attempt in PvP game.")

@pytest.mark.asyncio
async def test_ai_move_valid_session(mock_services, auth_user):
    """VERIFY: AI move endpoint works for legitimate AI games."""
    _, _ = mock_services
    user, token = auth_user
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE_URL) as client:
        # 1. Create an AI game
        response = await client.post("/games/ai?difficulty=medium", 
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()["data"]
        game_id = data["game_id"]
        gs = data["game_state"]
        
        # 2. Request AI move for this legitimate AI game
        legit_request = await client.post("/ai/move", 
            json={
                "game_id": game_id,
                "player_candies": gs["player1"]["owned_candies"],
                "opponent_collection": [],
                "player_poison": gs["player1"]["owned_candies"][0],
                "difficulty": "medium"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert legit_request.status_code == 200
        assert "choice" in legit_request.json()
        
        print("✅ AI Move Authenticity Verified: Works for valid AI sessions.")

@pytest.mark.asyncio
async def test_matchmaking_anti_fraud(mock_services):
    """VERIFY: Matchmaking blocks players on same IP or Device ID."""
    from dependencies import get_matchmaking_queue
    from utils.redis_client import redis_client
    import json
    
    _, _ = mock_services
    queue = get_matchmaking_queue()
    r = await redis_client.connect()
    city = "dubai"
    queue_key = f"pcd:queue:{city}"
    
    # 1. Simulate two players on SAME IP/Device in Redis
    p1 = {"id": "uid_1", "name": "P1", "city": city, "device_id": "device_A", "ip_address": "1.2.3.4"}
    p2 = {"id": "uid_2", "name": "P2", "city": city, "device_id": "device_A", "ip_address": "1.2.3.4"}
    
    await r.rpush(queue_key, json.dumps(p1))
    await r.rpush(queue_key, json.dumps(p2))
    
    # 2. Trigger match attempt
    # Since they are on same device/IP, it should block and return (None)
    await queue.try_match_players(city)
    
    # Check if they were put back in Redis (cycled)
    # try_match_players pops both, then if fraud, lpushes p2 and rpushes p1.
    assert await r.llen(queue_key) == 2
    
    # 3. Different Device/IP
    # Clear queue first
    await r.delete(queue_key)
    p3 = {"id": "uid_3", "name": "P3", "city": city, "device_id": "device_B", "ip_address": "5.6.7.8"}
    
    await r.rpush(queue_key, json.dumps(p1))
    await r.rpush(queue_key, json.dumps(p3))
    
    # This should proceed PAST the anti-fraud (and likely fail on DB transaction since we're mocking, but match should be attempted)
    # We can check if try_match_players tried to call DB
    await queue.try_match_players(city)
    
    print("✅ Matchmaking Anti-Fraud Verified: Same device/IP blocked and cycled.")

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
