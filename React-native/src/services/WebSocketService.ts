import { BASE_URL } from './api';

export type MatchmakingMessage = {
    type: 'match_found' | 'queue_status' | 'matchmaking_timeout' | 'pong';
    game_id?: string;
    game_state?: any;
    your_role?: 'player1' | 'player2';
    opponent?: { name: string };
    position?: number;
    total_waiting?: number;
    message?: string;
};

class WebSocketService {
    private socket: WebSocket | null = null;
    private onMessageCallback: ((data: MatchmakingMessage) => void) | null = null;
    private onStatusChange: ((connected: boolean) => void) | null = null;

    connect(playerId: string, onMessage: (data: MatchmakingMessage) => void, onStatusChange?: (connected: boolean) => void) {
        this.onMessageCallback = onMessage;
        this.onStatusChange = onStatusChange || null;

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
                this.onMessageCallback?.(data);
            } catch (e) {
                console.error('❌ Error parsing bit:', e);
            }
        };

        this.socket.onclose = () => {
            console.log('🔌 WebSocket Disconnected');
            this.onStatusChange?.(false);
        };

        this.socket.onerror = (e) => {
            console.error('❌ WebSocket Error:', e);
        };
    }

    sendMessage(message: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const webSocketService = new WebSocketService();
