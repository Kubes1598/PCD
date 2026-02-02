import asyncio
import websockets
import json
import uuid
import sys

# Use machine IP or localhost depending on where it's run
# Since it runs on the same machine as the backend, localhost is fine.
BASE_URL = "ws://localhost:8000/matchmaking/ws"

async def run_bot(city="dubai"):
    while True:
        player_id = f"bot_{uuid.uuid4().hex[:8]}"
        url = f"{BASE_URL}/{player_id}"
        
        try:
            async with websockets.connect(url) as websocket:
                print(f"🤖 Bot connected as {player_id}")
                
                # Join queue
                join_msg = {
                    "type": "join_queue",
                    "player_name": f"Bot_{player_id[-4:]}",
                    "city": city
                }
                await websocket.send(json.dumps(join_msg))
                print(f"📡 Bot joined queue for {city}. Waiting for opponent...")
                
                # Listen for messages
                while True:
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        data = json.loads(response)
                        
                        if data.get("type") == "match_found":
                            print(f"⚔️  BOT MATCHED! Game ID: {data.get('game_id')}")
                            # Stay connected for a while to keep the match alive, then reset
                            await asyncio.sleep(60) 
                            break
                        
                        if data.get("type") == "matchmaking_timeout":
                            print(f"⏰ Bot timed out. Rejoining...")
                            break
                            
                    except asyncio.TimeoutError:
                        # Keep connection alive
                        await websocket.send(json.dumps({"type": "ping"}))
                        continue
                        
        except Exception as e:
            print(f"❌ Bot Error: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    city = sys.argv[1] if len(sys.argv) > 1 else "dubai"
    print(f"🚀 Starting continuous matchmaking bot for city: {city}")
    try:
        asyncio.run(run_bot(city))
    except KeyboardInterrupt:
        print("\n🛑 Bot stopped.")
