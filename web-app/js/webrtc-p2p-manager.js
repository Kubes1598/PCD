// ===== WEBRTC P2P MANAGER - PRD COMPLIANT =====
// Implements true peer-to-peer connections as specified in PRD requirements

class WebRTCP2PManager {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isHost = false;
        this.peerId = null;
        this.remotePeerId = null;
        this.connectionState = 'disconnected';
        this.signaling = null;
        this.reconnectionTimer = null;
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 3;
        this.reconnectionWindow = 15000; // PRD: 15 seconds
        this.lastSync = null;
        this.syncOffset = 0;
        
        // PRD: STUN/TURN server configuration
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            // TURN servers would be added in production
            // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
        ];
        
        this.setupPeerId();
        console.log('🔗 WebRTC P2P Manager initialized');
    }
    
    // Setup unique peer ID
    setupPeerId() {
        this.peerId = localStorage.getItem('pcd_peer_id');
        if (!this.peerId) {
            this.peerId = 'peer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('pcd_peer_id', this.peerId);
        }
        console.log('🆔 Peer ID:', this.peerId);
    }
    
    // PRD: Initialize P2P connection with ICE servers
    async initializePeerConnection() {
        console.log('🔗 Initializing WebRTC peer connection...');
        
        const configuration = {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10,
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Set up event handlers
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 ICE candidate found:', event.candidate);
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    from: this.peerId,
                    to: this.remotePeerId
                });
            }
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', this.peerConnection.connectionState);
            this.connectionState = this.peerConnection.connectionState;
            this.handleConnectionStateChange();
        };
        
        this.peerConnection.ondatachannel = (event) => {
            console.log('📡 Data channel received');
            this.setupDataChannel(event.channel);
        };
        
        // PRD: Create data channel for game communication
        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('gameData', {
                ordered: true
            });
            this.setupDataChannel(this.dataChannel);
        }
        
        console.log('✅ Peer connection initialized');
    }
    
    // Setup data channel for game communication
    setupDataChannel(channel) {
        this.dataChannel = channel;
        
        this.dataChannel.onopen = () => {
            console.log('📡 Data channel opened');
            this.connectionState = 'connected';
            this.startTimerSynchronization();
            this.onConnectionEstablished();
        };
        
        this.dataChannel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleGameMessage(message);
            } catch (error) {
                console.error('❌ Error parsing game message:', error);
            }
        };
        
        this.dataChannel.onclose = () => {
            console.log('📡 Data channel closed');
            this.connectionState = 'disconnected';
            this.handleDisconnection();
        };
        
        this.dataChannel.onerror = (error) => {
            console.error('❌ Data channel error:', error);
            this.handleConnectionError();
        };
    }
    
    // PRD: Connect to signaling server for peer discovery
    async connectToSignaling() {
        try {
            const wsUrl = `ws://localhost:8000/signaling/${this.peerId}`;
            console.log('📡 Connecting to signaling server:', wsUrl);
            
            this.signaling = new WebSocket(wsUrl);
            
            this.signaling.onopen = () => {
                console.log('✅ Connected to signaling server');
            };
            
            this.signaling.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleSignalingMessage(message);
            };
            
            this.signaling.onclose = () => {
                console.log('📡 Signaling connection closed');
            };
            
            this.signaling.onerror = (error) => {
                console.error('❌ Signaling error:', error);
            };
            
        } catch (error) {
            console.error('❌ Failed to connect to signaling server:', error);
            throw error;
        }
    }
    
    // Handle signaling messages
    async handleSignalingMessage(message) {
        console.log('📡 Signaling message:', message.type);
        
        switch (message.type) {
            case 'peer-found':
                await this.handlePeerFound(message);
                break;
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
            case 'peer-disconnected':
                this.handlePeerDisconnected(message);
                break;
            default:
                console.log('Unknown signaling message type:', message.type);
        }
    }
    
    // PRD: Start matchmaking and peer discovery
    async startMatchmaking(city) {
        console.log(`🎮 Starting P2P matchmaking for ${city}...`);
        
        try {
            await this.connectToSignaling();
            await this.initializePeerConnection();
            
            // Request peer in specific city
            this.sendSignalingMessage({
                type: 'find-peer',
                city: city,
                peerId: this.peerId
            });
            
            console.log('🔍 Searching for peer in', city);
            
        } catch (error) {
            console.error('❌ Failed to start matchmaking:', error);
            throw error;
        }
    }
    
    // Handle peer found
    async handlePeerFound(message) {
        console.log('🎯 Peer found:', message.peerId);
        this.remotePeerId = message.peerId;
        this.isHost = message.isHost;
        
        if (this.isHost) {
            await this.createOffer();
        }
    }
    
    // Create WebRTC offer
    async createOffer() {
        console.log('📞 Creating offer...');
        
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.sendSignalingMessage({
                type: 'offer',
                offer: offer,
                from: this.peerId,
                to: this.remotePeerId
            });
            
            console.log('📞 Offer sent');
        } catch (error) {
            console.error('❌ Failed to create offer:', error);
        }
    }
    
    // Handle incoming offer
    async handleOffer(message) {
        console.log('📞 Received offer');
        this.remotePeerId = message.from;
        
        try {
            await this.peerConnection.setRemoteDescription(message.offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.sendSignalingMessage({
                type: 'answer',
                answer: answer,
                from: this.peerId,
                to: this.remotePeerId
            });
            
            console.log('📞 Answer sent');
        } catch (error) {
            console.error('❌ Failed to handle offer:', error);
        }
    }
    
    // Handle incoming answer
    async handleAnswer(message) {
        console.log('📞 Received answer');
        
        try {
            await this.peerConnection.setRemoteDescription(message.answer);
            console.log('✅ Answer processed');
        } catch (error) {
            console.error('❌ Failed to handle answer:', error);
        }
    }
    
    // Handle ICE candidate
    async handleIceCandidate(message) {
        try {
            await this.peerConnection.addIceCandidate(message.candidate);
            console.log('🧊 ICE candidate added');
        } catch (error) {
            console.error('❌ Failed to add ICE candidate:', error);
        }
    }
    
    // PRD: Timer synchronization within 100ms
    async startTimerSynchronization() {
        console.log('⏰ Starting timer synchronization...');
        
        // Send sync request to peer
        const syncRequest = {
            type: 'sync-request',
            timestamp: Date.now(),
            requestId: Math.random().toString(36).substr(2, 9)
        };
        
        this.sendGameMessage(syncRequest);
        
        // Periodic sync every 30 seconds
        setInterval(() => {
            if (this.connectionState === 'connected') {
                this.sendGameMessage({
                    type: 'sync-request',
                    timestamp: Date.now(),
                    requestId: Math.random().toString(36).substr(2, 9)
                });
            }
        }, 30000);
    }
    
    // Get synchronized timestamp
    getSynchronizedTime() {
        return Date.now() + this.syncOffset;
    }
    
    // PRD: Handle disconnection with 15-second reconnection window
    handleDisconnection() {
        console.log('💔 P2P connection lost, starting reconnection timer...');
        
        if (typeof gameState !== 'undefined' && gameState.gameStarted && !gameState.gameEnded) {
            // PRD: Pause game timer and attempt reconnection
            if (typeof pauseGameTimer === 'function') {
                pauseGameTimer();
            }
            
            this.startReconnectionTimer();
            
            if (typeof showNotification === 'function') {
                showNotification('🔌 Connection lost. Attempting to reconnect...', 'warning', 5000);
            }
        }
    }
    
    // PRD: 15-second reconnection timer
    startReconnectionTimer() {
        this.reconnectionTimer = setTimeout(() => {
            console.log('⏰ Reconnection window expired (15 seconds)');
            this.handleReconnectionTimeout();
        }, this.reconnectionWindow);
        
        // Attempt immediate reconnection
        this.attemptReconnection();
    }
    
    async attemptReconnection() {
        if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
            console.log('❌ Max reconnection attempts reached');
            return;
        }
        
        this.reconnectionAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}`);
        
        try {
            await this.initializePeerConnection();
            
            // Request reconnection through signaling
            this.sendSignalingMessage({
                type: 'reconnect-request',
                peerId: this.peerId,
                remotePeerId: this.remotePeerId
            });
            
        } catch (error) {
            console.error('❌ Reconnection failed:', error);
            
            // Retry after delay
            setTimeout(() => {
                this.attemptReconnection();
            }, 2000);
        }
    }
    
    // Handle reconnection timeout
    handleReconnectionTimeout() {
        console.log('⏰ PRD: Reconnection failed within 15 seconds, ending game');
        
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
        
        // Notify opponent of disconnection
        if (typeof gameState !== 'undefined' && !gameState.gameEnded) {
            if (typeof showNotification === 'function') {
                showNotification('🏆 Opponent disconnected. You win!', 'success', 5000);
            }
            
            if (typeof endGame === 'function') {
                endGame(true, '🏆 You won! Opponent disconnected.');
            }
        }
    }
    
    // Send game message through data channel
    sendGameMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ Cannot send message: data channel not open');
        }
    }
    
    // Send signaling message
    sendSignalingMessage(message) {
        if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
            this.signaling.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ Cannot send signaling message: not connected');
        }
    }
    
    // Handle incoming game messages
    handleGameMessage(message) {
        switch (message.type) {
            case 'sync-request':
                this.handleSyncRequest(message);
                break;
            case 'sync-response':
                this.handleSyncResponse(message);
                break;
            case 'candy-pick':
                this.handleRemoteCandyPick(message);
                break;
            case 'poison-selection':
                this.handleRemotePoisonSelection(message);
                break;
            case 'game-state-update':
                this.handleGameStateUpdate(message);
                break;
            case 'player-ready':
                this.handlePlayerReady(message);
                break;
            case 'game-start':
                this.handleGameStart(message);
                break;
            default:
                console.log('Unknown game message type:', message.type);
        }
    }
    
    // Handle sync request
    handleSyncRequest(message) {
        const response = {
            type: 'sync-response',
            originalTimestamp: message.timestamp,
            responseTimestamp: Date.now(),
            requestId: message.requestId
        };
        this.sendGameMessage(response);
    }
    
    // Handle sync response
    handleSyncResponse(message) {
        const now = Date.now();
        const roundTripTime = now - message.originalTimestamp;
        const networkDelay = roundTripTime / 2;
        const serverTime = message.responseTimestamp + networkDelay;
        
        this.syncOffset = serverTime - now;
        this.lastSync = now;
        
        console.log(`⏰ Timer sync: offset ${this.syncOffset}ms, RTT ${roundTripTime}ms`);
        
        // PRD: Ensure sync within 100ms variance
        if (Math.abs(this.syncOffset) > 100) {
            console.warn('⚠️ Timer sync exceeds 100ms variance:', this.syncOffset);
        }
    }
    
    // Connection state change handler
    handleConnectionStateChange() {
        switch (this.connectionState) {
            case 'connected':
                console.log('✅ P2P connection established');
                this.reconnectionAttempts = 0;
                if (this.reconnectionTimer) {
                    clearTimeout(this.reconnectionTimer);
                    this.reconnectionTimer = null;
                }
                break;
            case 'disconnected':
            case 'failed':
                console.log('💔 P2P connection lost');
                this.handleDisconnection();
                break;
            case 'connecting':
                console.log('🔄 P2P connection in progress...');
                break;
        }
    }
    
    // Connection established callback
    onConnectionEstablished() {
        console.log('🎮 P2P connection ready for gaming');
        
        if (typeof showNotification === 'function') {
            showNotification('🔗 P2P connection established!', 'success', 3000);
        }
        
        // Notify game system that P2P is ready
        if (typeof gameState !== 'undefined') {
            gameState.p2pConnected = true;
            gameState.connectionType = 'p2p';
        }
        
        // Trigger callback if set
        if (this.onConnectionReady) {
            this.onConnectionReady();
        }
    }
    
    // PRD: Handle various game-specific messages
    handleRemoteCandyPick(message) {
        console.log('🍭 Remote candy pick:', message.candy);
        
        if (typeof gameState !== 'undefined' && typeof handleOpponentCandyPick === 'function') {
            handleOpponentCandyPick(message.candy, message.index);
        }
    }
    
    handleRemotePoisonSelection(message) {
        console.log('☠️ Remote poison selection:', message.poison);
        
        if (typeof gameState !== 'undefined') {
            gameState.opponentPoison = message.poison;
        }
    }
    
    handleGameStateUpdate(message) {
        console.log('🎮 Game state update from peer');
        
        if (typeof gameState !== 'undefined' && typeof updateFromRemoteGameState === 'function') {
            updateFromRemoteGameState(message.gameState);
        }
    }
    
    handlePlayerReady(message) {
        console.log('✅ Remote player ready');
        
        if (typeof gameState !== 'undefined') {
            gameState.opponentReady = true;
        }
    }
    
    // PRD: Synchronized game start
    handleGameStart(message) {
        console.log('🎮 Synchronized game start received');
        
        const syncedStartTime = message.startTime + this.syncOffset;
        const delay = syncedStartTime - Date.now();
        
        if (delay > 0) {
            setTimeout(() => {
                this.startSynchronizedGame();
            }, delay);
        } else {
            this.startSynchronizedGame();
        }
    }
    
    // Start synchronized game
    startSynchronizedGame() {
        console.log('🎮 Starting synchronized game');
        
        if (typeof gameState !== 'undefined') {
            gameState.gameStarted = true;
        }
        
        if (typeof startGameTimer === 'function') {
            startGameTimer();
        }
        
        if (typeof showNotification === 'function') {
            showNotification('🎮 Game started!', 'success', 2000);
        }
    }
    
    // Disconnect from peer
    disconnect() {
        console.log('🔌 Disconnecting P2P connection...');
        
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        if (this.signaling) {
            this.signaling.close();
        }
        
        this.connectionState = 'disconnected';
        console.log('✅ P2P disconnection complete');
    }
    
    // Get connection status
    getConnectionStatus() {
        return {
            state: this.connectionState,
            peerId: this.peerId,
            remotePeerId: this.remotePeerId,
            isHost: this.isHost,
            syncOffset: this.syncOffset,
            lastSync: this.lastSync
        };
    }
}

// Global P2P manager instance
let webrtcP2PManager = null;

// Initialize P2P manager
function initializeP2PManager() {
    if (!webrtcP2PManager) {
        webrtcP2PManager = new WebRTCP2PManager();
        console.log('✅ WebRTC P2P Manager initialized');
    }
    return webrtcP2PManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebRTCP2PManager, initializeP2PManager };
} 