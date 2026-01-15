import asyncio
import websockets
import json
import uuid

async def matchmaking_bot(name, city):
    uri = f"ws://localhost:8000/matchmaking/ws/{uuid.uuid4()}"
    async with websockets.connect(uri) as websocket:
        print(f"[{name}] Connected to {uri}")
        
        # 1. Join Queue
        join_msg = {
            "type": "join_queue",
            "player_name": name,
            "city": city
        }
        await websocket.send(json.dumps(join_msg))
        print(f"[{name}] Sent join_queue for {city}")
        
        # 2. Listen for messages
        try:
            while True:
                response = await websocket.recv()
                data = json.loads(response)
                print(f"[{name}] Received: {data['type']}")
                
                if data['type'] == 'match_found':
                    print(f"[{name}] ⚔️ MATCH FOUND! Game ID: {data['game_id']}")
                    game_id = data['game_id']
                    opponent = data['opponent']['name']
                    
                    # 3. Handle Game Logic (e.g., set poison)
                    poison_msg = {
                        "type": "match_poison",
                        "target_id": data['opponent']['id'],
                        "candy": "🍇"
                    }
                    await websocket.send(json.dumps(poison_msg))
                    print(f"[{name}] Sent match_poison")
                    
                    # Stay connected for a bit and then exit
                    await asyncio.sleep(5)
                    break
        except Exception as e:
            print(f"[{name}] Error: {e}")

async def main():
    # Run two bots to match each other
    await asyncio.gather(
        matchmaking_bot("Bot_Alice", "Dubai"),
        matchmaking_bot("Bot_Bob", "Dubai")
    )

if __name__ == "__main__":
    asyncio.run(main())
