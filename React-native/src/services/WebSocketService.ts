import { BASE_URL } from './api';

export type MatchmakingMessage = {
    type: 'match_found' | 'queue_status' | 'matchmaking_timeout' | 'pong' | 'match_move' | 'match_poison' | 'opponent_disconnected' | 'timer_sync' | 'timer_expired' | 'game_over' | 'reconnected' | 'matchmaking_error' | 'game_cancelled' | 'game_state_update' | 'city_stats_update';
    game_id?: string;
    game_state?: any;
    your_role?: 'player1' | 'player2';
    opponent?: { name: string; id: string };
    opponent_id?: string;
    player_id?: string;
    target_id?: string;
    move?: string;
    candy?: string;
    position?: number;
    total_waiting?: number;
    message?: string;
    seconds?: number;
    winner_id?: string;
    winner_name?: string;
    reason?: 'timeout' | 'disconnect' | 'normal';
    prize?: number;
    timed_out_player?: string;
    is_draw?: boolean;
    // City stats update fields
    city?: string;
    players_waiting?: number;
    players_online?: number;
    entry_fee?: number;
    prize_pool?: number;
};

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type OutgoingMessage =
    | { type: 'ping' }
    | { type: 'select_city'; city: string }
    | { type: 'join_queue'; city: string; player_name: string; player_id?: string }
    | { type: 'leave_queue' }
    | { type: 'match_move'; target_id: string; candy?: string; move?: string }
    | { type: 'match_poison'; target_id: string; candy: string };

class WebSocketService {
    private socket: WebSocket | null = null;
    private onMessageCallback: ((data: MatchmakingMessage) => void) | null = null;
    private onStatusChange: ((state: ConnectionState) => void) | null = null;
    private isManuallyClosed = false;

    // Reconnection with exponential backoff
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private baseDelay = 1000; // 1 second

    // Heartbeat
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
    private heartbeatIntervalMs = 15000; // 15 seconds
    private heartbeatTimeoutMs = 5000; // 5 seconds to wait for pong

    // Stored for reconnection
    private playerId: string = '';

    private buildWebSocketUrl(playerId: string, token: string): string {
        const parsedBaseUrl = new URL(BASE_URL);
        parsedBaseUrl.protocol = parsedBaseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        parsedBaseUrl.pathname = `/matchmaking/ws/${encodeURIComponent(playerId)}`;
        parsedBaseUrl.search = '';
        parsedBaseUrl.searchParams.set('token', token);
        return parsedBaseUrl.toString();
    }

    get connectionState(): ConnectionState {
        if (!this.socket) return 'disconnected';
        if (this.socket.readyState === WebSocket.CONNECTING) return 'connecting';
        if (this.socket.readyState === WebSocket.OPEN) return 'connected';
        return 'disconnected';
    }

    connect(playerId: string, token: string, onMessage: (data: MatchmakingMessage) => void, onStatusChange?: (state: ConnectionState) => void) {
        this.playerId = playerId;
        this.onMessageCallback = onMessage;
        this.onStatusChange = onStatusChange || null;
        this.isManuallyClosed = false;

        // SECURITY: Append JWT token as query parameter
        const wsUrl = this.buildWebSocketUrl(playerId, token);

        console.log('🔌 Connecting to WebSocket (Secure):', wsUrl.replace(token, 'REDACTED'));
        this.onStatusChange?.('connecting');
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('✅ WebSocket Connected');
            this.reconnectAttempts = 0; // Reset backoff on successful connection
            this.onStatusChange?.('connected');
            this.startHeartbeat();
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle pong response
                if (data.type === 'pong') {
                    this.clearHeartbeatTimeout();
                    return;
                }

                this.onMessageCallback?.(data);
            } catch (e) {
                console.error('❌ Error parsing message:', e);
            }
        };

        this.socket.onclose = (event) => {
            console.log(`🔌 WebSocket Disconnected (code=${event.code}, reason=${event.reason || 'none'})`);
            this.stopHeartbeat();
            this.onStatusChange?.('disconnected');

            // Auto-reconnect with exponential backoff
            if (!this.isManuallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
                this.reconnectAttempts++;
                console.log(`🔄 Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                // Get fresh token for reconnection
                const authState = require('../store/authStore').useAuthStore.getState();
                const freshToken = authState.token || '';
                setTimeout(() => this.connect(this.playerId, freshToken, onMessage, onStatusChange), delay);
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('❌ Max reconnection attempts reached.');
            }
        };

        this.socket.onerror = (e) => {
            console.error('❌ WebSocket Error:', e);
            const { useErrorStore } = require('../store/errorStore');
            useErrorStore.getState().showError('The arena connection is a bit wobbly. Trying to stabilize...', 'warning');
        };
    }

    private startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing intervals
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.sendMessage({ type: 'ping' });
                this.heartbeatTimeout = setTimeout(() => {
                    console.warn('⚠️ Heartbeat timeout. Closing stale connection.');
                    this.socket?.close();
                }, this.heartbeatTimeoutMs);
            }
        }, this.heartbeatIntervalMs);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.clearHeartbeatTimeout();
    }

    private clearHeartbeatTimeout() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    sendMessage(message: OutgoingMessage) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ WebSocket not open. Message not sent:', message.type);
        }
    }

    disconnect() {
        this.isManuallyClosed = true;
        this.stopHeartbeat();
        this.reconnectAttempts = 0;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const webSocketService = new WebSocketService();
