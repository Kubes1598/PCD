import asyncio
import websockets
import json
import uuid

BASE_URL = "ws://localhost:8000/matchmaking/ws"

async def simulate_player(player_name, city="dubai"):
    player_id = f"test_player_{uuid.uuid4().hex[:8]}"
    url = f"{BASE_URL}/{player_id}"
    
    try:
        async with websockets.connect(url) as websocket:
            print(f"✅ {player_name} connected as {player_id}")
            
            # Join queue
            join_msg = {
                "type": "join_queue",
                "player_name": player_name,
                "city": city
            }
            await websocket.send(json.dumps(join_msg))
            print(f"📤 {player_name} joined queue for {city}")
            
            # Listen for messages
            while True:
                response = await websocket.recv()
                data = json.loads(response)
                print(f"📥 {player_name} received: {data.get('type')} - {data.get('message', '')}")
                
                if data.get("type") == "match_found":
                    print(f"🏁 {player_name} MATCH FOUND! Game ID: {data.get('game_id')}")
                    # Keep connection open for a bit to simulate game
                    await asyncio.sleep(5)
                    break
                
                if data.get("type") == "matchmaking_timeout":
                    print(f"⏰ {player_name} TIMEOUT")
                    break
                    
    except Exception as e:
        print(f"❌ {player_name} Error: {e}")

async def run_simulation():
    print("🚀 Starting Matchmaking Simulation...")
    # Run two players in parallel
    await asyncio.gather(
        simulate_player("AlphaPlayer"),
        simulate_player("BetaPlayer")
    )

if __name__ == "__main__":
    asyncio.run(run_simulation())
