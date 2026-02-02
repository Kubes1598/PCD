from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
import json
from dependencies import get_signaling_manager

router = APIRouter(prefix="/signaling", tags=["Signaling"])

@router.websocket("/{player_id}")
async def websocket_signaling(
    websocket: WebSocket, 
    player_id: str, 
    signaling_manager=Depends(get_signaling_manager)
):
    """WebSocket endpoint for P2P signaling (WebRTC)."""
    await websocket.accept()
    print(f"🔗 P2P signaling connected for player {player_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            
            if message_type == "find-peer":
                city = message.get("city", "dubai")
                player_name = message.get("player_name", "Anonymous")
                await signaling_manager.handle_matchmaking(player_id, player_name, city, websocket)
                
            elif message_type in ["offer", "answer", "ice-candidate"]:
                target_id = message.get("to")
                if target_id:
                    await signaling_manager.forward_message(target_id, message)
                
            elif message_type == "reconnect-request":
                remote_peer_id = message.get("remotePeerId")
                if remote_peer_id:
                    # Generic notify for reconnection
                    await signaling_manager.forward_message(remote_peer_id, {
                        "type": "reconnect-attempt", "from": player_id, "message": "Peer attempting to reconnect"
                    })
                
    except WebSocketDisconnect:
        print(f"🔗 P2P signaling disconnected for player {player_id}")
        await signaling_manager.cleanup_connection(player_id)
    except Exception as e:
        print(f"🔗 Signaling error: {e}")
        await signaling_manager.cleanup_connection(player_id)
