import { BASE_URL } from './api';

export type MatchmakingMessage = {
    type: 'match_found' | 'queue_status' | 'matchmaking_timeout' | 'pong' | 'match_move' | 'match_poison' | 'opponent_disconnected';
    game_id?: string;
    game_state?: any;
    your_role?: 'player1' | 'player2';
    opponent?: { name: string; id: string };
    opponent_id?: string;
    target_id?: string;
    move?: string;
    candy?: string;
    position?: number;
    total_waiting?: number;
    message?: string;
};

class WebSocketService {
    private socket: WebSocket | null = null;
    private onMessageCallback: ((data: MatchmakingMessage) => void) | null = null;
    private onStatusChange: ((connected: boolean) => void) | null = null;
    private isManuallyClosed = false;

    connect(playerId: string, onMessage: (data: MatchmakingMessage) => void, onStatusChange?: (connected: boolean) => void) {
        this.onMessageCallback = onMessage;
        this.onStatusChange = onStatusChange || null;
        this.isManuallyClosed = false;

        // Convert http://... to ws://...
        const wsBase = BASE_URL.replace('http', 'ws');
        const wsUrl = `${wsBase}/matchmaking/ws/${playerId}`;

        console.log('🔌 Connecting to WebSocket:', wsUrl);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('✅ WebSocket Connected');
            this.onStatusChange?.(true);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // console.log('📥 WS Received:', data.type);
                this.onMessageCallback?.(data);
            } catch (e) {
                console.error('❌ Error parsing message:', e);
            }
        };

        this.socket.onclose = () => {
            console.log('🔌 WebSocket Disconnected');
            this.onStatusChange?.(false);

            // Auto-reconnect if not manual
            if (!this.isManuallyClosed) {
                console.log('🔄 Attempting reconnection in 2s...');
                setTimeout(() => this.connect(playerId, onMessage, onStatusChange), 2000);
            }
        };

        this.socket.onerror = (e) => {
            console.error('❌ WebSocket Error:', e);
        };
    }

    sendMessage(message: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ WebSocket not open. Message not sent:', message.type);
        }
    }

    disconnect() {
        this.isManuallyClosed = true;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const webSocketService = new WebSocketService();
