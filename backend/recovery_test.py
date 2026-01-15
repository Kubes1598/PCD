import asyncio
import websockets
import json
import uuid

async def recovery_test():
    player_id = str(uuid.uuid4())
    opponent_id = str(uuid.uuid4())
    uri = f"ws://localhost:8000/matchmaking/ws/{player_id}"
    opponent_uri = f"ws://localhost:8000/matchmaking/ws/{opponent_id}"
    
    print("🚀 Starting Recovery Test...")
    
    async with websockets.connect(uri) as ws, websockets.connect(opponent_uri) as ws_opp:
        # 1. Join both to Dubai
        await ws.send(json.dumps({"type": "join_queue", "player_name": "Recoverer", "city": "Dubai"}))
        await ws_opp.send(json.dumps({"type": "join_queue", "player_name": "Opponent", "city": "Dubai"}))
        
        # 2. Match Found
        msg1 = json.loads(await ws.recv())
        msg2 = json.loads(await ws_opp.recv())
        print(f"⚔️ Match Found: {msg1['type']}")
        
        # 3. Simulate Disconnect of Recoverer
        print("🔌 Simulating Disconnect of Recoverer...")
        await ws.close()
        await asyncio.sleep(2) # Give server a moment to register disconnect
        
    # 4. Reconnect
    print("🔄 Reconnecting...")
    async with websockets.connect(uri) as ws_new:
        # On connect, the server should see him in self.player_games and send reconnected
        response = await ws_new.recv()
        data = json.loads(response)
        print(f"📡 Reconnect Response: {data['type']}")
        
        if data['type'] == 'reconnected':
            print("✅ STATE RECOVERY SUCCESSFUL!")
        else:
            print(f"❌ Recovery Failed. Received: {data['type']}")

if __name__ == "__main__":
    asyncio.run(recovery_test())
