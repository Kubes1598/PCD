import asyncio
import json
import websockets
import uuid

async def test_timeout_strikes():
    uri = "ws://localhost:8000/matchmaking/ws"
    p1_id = str(uuid.uuid4())
    p2_id = str(uuid.uuid4())

    async with websockets.connect(f"{uri}/{p1_id}") as ws1, \
               websockets.connect(f"{uri}/{p2_id}") as ws2:
        
        # Join queue
        await ws1.send(json.dumps({"type": "join_queue", "player_name": "Striker", "city": "dubai_test_v1"}))
        await asyncio.sleep(1.0)
        await ws2.send(json.dumps({"type": "join_queue", "player_name": "Victim", "city": "dubai_test_v1"}))

        # Wait for match_found
        p1_match = None
        while not p1_match:
            msg = json.loads(await ws1.recv())
            print(f"📩 P1 Matchmaking Recv: {msg.get('type')}")
            if msg.get("type") == "match_found": p1_match = msg
        
        p2_match = None
        while not p2_match:
            msg = json.loads(await ws2.recv())
            print(f"📩 P2 Matchmaking Recv: {msg.get('type')}")
            if msg.get("type") == "match_found": p2_match = msg
            
        print(f"✅ Match found: {p1_match['game_id']}")
        game_id = p1_match['game_id']

        # Both set poison
        candies1 = p1_match['game_state']['player1']['owned_candies']
        candies2 = p2_match['game_state']['player2']['owned_candies']
        
        await ws1.send(json.dumps({"type": "match_poison", "target_id": p2_id, "candy": candies1[0]}))
        await ws2.send(json.dumps({"type": "match_poison", "target_id": p1_id, "candy": candies2[0]}))

    async def listen(ws, name):
        nonlocal strikes
        try:
            async for raw_msg in ws:
                msg = json.loads(raw_msg)
                print(f"📩 {name} Recv: {msg.get('type')}")
                if msg.get("type") == "timer_expired":
                    print(f"⏰ STRIKE detected for {msg.get('timed_out_player')}")
                elif msg.get("type") == "game_over":
                    print(f"💀 GAME OVER: {msg.get('reason')} | Winner: {msg.get('winner_id')}")
                    if msg.get("reason") == "timeout":
                        print("✅ SUCCESS: Verified Instant Single-Turn Forfeit!")
                    return
        except Exception as e:
            print(f"❌ {name} Error: {e}")

    strikes = 0
    print("⏳ Waiting for SINGLE timeout from Player 1...")
    await asyncio.gather(
        listen(ws1, "P1"),
        listen(ws2, "P2")
    )

if __name__ == "__main__":
    asyncio.run(test_timeout_strikes())
