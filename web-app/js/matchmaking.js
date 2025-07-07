// ===== AUTOMATIC MATCHMAKING SYSTEM =====
class AutomaticMatchmakingManager {
    constructor() {
        this.websocket = null;
        this.playerId = null;
        this.playerName = null;
        this.isSearching = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.matchFoundCallback = null;
        this.setupPlayerId();
    }
    
    setupPlayerId() {
        // Generate unique player ID if not exists
        this.playerId = localStorage.getItem('pcd_player_id');
        if (!this.playerId) {
            this.playerId = this.generatePlayerId();
            localStorage.setItem('pcd_player_id', this.playerId);
        }
        console.log('🎮 Player ID:', this.playerId);
    }
    
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async connectToMatchmaking() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            console.log('🎮 Already connected to matchmaking');
            return;
        }
        
        try {
            // Use the backend server URL
            const wsUrl = `ws://localhost:8000/matchmaking/ws/${this.playerId}`;
            console.log('🎮 Connecting to matchmaking:', wsUrl);
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🎮 Connected to matchmaking server');
                this.reconnectAttempts = 0;
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMatchmakingMessage(data);
                } catch (error) {
                    console.error('🎮 Error parsing matchmaking message:', error);
                }
            };
            
            this.websocket.onclose = () => {
                console.log('🎮 Disconnected from matchmaking server');
                this.handleDisconnection();
            };
            
            this.websocket.onerror = (error) => {
                console.error('🎮 Matchmaking WebSocket error:', error);
                this.handleConnectionError();
            };
            
        } catch (error) {
            console.error('🎮 Failed to connect to matchmaking:', error);
            this.handleConnectionError();
        }
    }
    
    handleMatchmakingMessage(data) {
        console.log('🎮 Matchmaking message:', data);
        
        switch (data.type) {
            case 'match_found':
                this.handleMatchFound(data);
                break;
            case 'queue_status':
                this.updateQueueStatus(data);
                break;
            case 'matchmaking_timeout':
                this.handleMatchmakingTimeout(data);
                break;
            case 'pong':
                // Keep-alive response
                break;
            default:
                console.log('🎮 Unknown matchmaking message type:', data.type);
        }
    }
    
    handleMatchFound(data) {
        console.log('🎮 Match found!', data);
        this.isSearching = false;
        this.updateMatchmakingUI('found');
        
        // Store complete game information
        if (typeof gameState !== 'undefined') {
            gameState.gameId = data.game_id;
            gameState.gameMode = 'online';
            gameState.currentGame = data.game_state;
            gameState.currentGameState = data.game_state; // Ensure both properties are set
            
            // Set player IDs and data based on role
            if (data.your_role === 'player1') {
                gameState.playerId = data.game_state.player1.id;
                gameState.opponentId = data.game_state.player2.id;
                gameState.playerName = data.game_state.player1.name;
                gameState.playerCandies = Array.from(data.game_state.player1.owned_candies || []);
                gameState.opponentCandies = Array.from(data.game_state.player2.owned_candies || []);
            } else {
                gameState.playerId = data.game_state.player2.id;
                gameState.opponentId = data.game_state.player1.id;
                gameState.playerName = data.game_state.player2.name;
                gameState.playerCandies = Array.from(data.game_state.player2.owned_candies || []);
                gameState.opponentCandies = Array.from(data.game_state.player1.owned_candies || []);
            }
            
            // Initialize collections
            gameState.playerCollection = [];
            gameState.opponentCollection = [];
            gameState.isPlayerTurn = (data.your_role === 'player1'); // Player 1 typically starts
            gameState.gameStarted = false; // Will be set after poison selection
            
            console.log('✅ Match game state initialized:', {
                gameId: gameState.gameId,
                playerId: gameState.playerId,
                opponentId: gameState.opponentId,
                role: data.your_role,
                playerCandies: gameState.playerCandies.length,
                opponentCandies: gameState.opponentCandies.length
            });
        }
        
        // Show success message and navigate to game
        setTimeout(() => {
            if (typeof showNotification === 'function') {
                showNotification(`Player found! Starting game vs ${data.opponent.name}`, 'success');
            }
            this.startMatchedGame(data);
        }, 1000);
    }
    
    startMatchedGame(matchData) {
        console.log('🎮 Starting matched game:', matchData);
        
        // Set a flag to indicate this is a matchmaking game
        if (typeof gameState !== 'undefined') {
            gameState.isMatchmakingGame = true;
            gameState.matchData = matchData;
            gameState.city = matchData.city || 'dubai'; // Store city from match data
            gameState.opponentName = matchData.opponent.name;
        }
        
        // For PRD compliance: Go to candy selection confirmation first
        if (typeof showScreen === 'function') {
            showScreen('page4b');
        }
        
        // Initialize candy selection confirmation
        if (typeof initializeCandySelectionConfirmation === 'function') {
            initializeCandySelectionConfirmation(matchData);
        }
        
        console.log('✅ Matchmaking game ready for candy selection confirmation');
    }
    
    async startSearch() {
        if (this.isSearching) {
            console.log('🎮 Already searching for match');
            return;
        }
        
        this.playerName = (typeof gameState !== 'undefined' && gameState.playerName) ? gameState.playerName : 'Anonymous';
        
        try {
            await this.connectToMatchmaking();
            
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.isSearching = true;
                this.updateMatchmakingUI('searching');
                
                const message = {
                    type: 'join_queue',
                    player_name: this.playerName
                };
                
                this.websocket.send(JSON.stringify(message));
                console.log('🎮 Joined matchmaking queue');
                
                // Start queue position updates
                this.startQueueUpdates();
            } else {
                throw new Error('WebSocket not connected');
            }
        } catch (error) {
            console.error('🎮 Failed to start matchmaking search:', error);
            this.handleConnectionError();
        }
    }
    
    cancelSearch() {
        if (!this.isSearching) {
            console.log('🎮 Not currently searching');
            return;
        }
        
        this.isSearching = false;
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'leave_queue'
            };
            this.websocket.send(JSON.stringify(message));
            console.log('🎮 Left matchmaking queue');
        }
        
        this.updateMatchmakingUI('idle');
        this.stopQueueUpdates();
    }
    
    startQueueUpdates() {
        // Send periodic updates to get queue position
        this.queueUpdateInterval = setInterval(() => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN && this.isSearching) {
                this.websocket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 2000);
    }
    
    stopQueueUpdates() {
        if (this.queueUpdateInterval) {
            clearInterval(this.queueUpdateInterval);
            this.queueUpdateInterval = null;
        }
    }
    
    updateQueueStatus(data) {
        const queueInfo = document.getElementById('queue-info');
        const queuePosition = document.getElementById('queue-position');
        
        if (queueInfo && queuePosition) {
            queueInfo.style.display = 'block';
            queuePosition.textContent = `Position in queue: ${data.position} (${data.total_waiting} waiting)`;
        }
    }
    
    updateMatchmakingUI(status) {
        const idleElement = document.getElementById('matchmaking-idle');
        const searchingElement = document.getElementById('matchmaking-searching');
        const foundElement = document.getElementById('matchmaking-found');
        const findBtn = document.getElementById('find-player-btn');
        const cancelBtn = document.getElementById('cancel-matchmaking-btn');
        const queueInfo = document.getElementById('queue-info');
        
        // Hide all status elements
        if (idleElement) idleElement.style.display = 'none';
        if (searchingElement) searchingElement.style.display = 'none';
        if (foundElement) foundElement.style.display = 'none';
        if (queueInfo) queueInfo.style.display = 'none';
        
        switch (status) {
            case 'idle':
                if (idleElement) idleElement.style.display = 'block';
                if (findBtn) {
                    findBtn.style.display = 'block';
                    findBtn.disabled = false;
                }
                if (cancelBtn) cancelBtn.style.display = 'none';
                break;
                
            case 'searching':
                if (searchingElement) searchingElement.style.display = 'block';
                if (queueInfo) queueInfo.style.display = 'block';
                if (findBtn) findBtn.style.display = 'none';
                if (cancelBtn) cancelBtn.style.display = 'block';
                break;
                
            case 'found':
                if (foundElement) foundElement.style.display = 'block';
                if (findBtn) findBtn.style.display = 'none';
                if (cancelBtn) cancelBtn.style.display = 'none';
                break;
        }
    }
    
    handleDisconnection() {
        console.log('🎮 WebSocket disconnected');
        
        if (this.isSearching && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`🎮 Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.reconnectAttempts++;
            
            // Show reconnection attempt notification
            if (typeof showNotification === 'function') {
                showNotification(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info', 2000);
            }
            
            setTimeout(() => this.connectToMatchmaking(), 2000);
        } else {
            this.isSearching = false;
            this.updateMatchmakingUI('idle');
            this.stopQueueUpdates();
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.log('❌ Max reconnection attempts reached');
                if (typeof showNotification === 'function') {
                    showNotification('Lost connection to matchmaking server. Please try again.', 'error');
                }
                
                // Reset for next attempt
                this.reconnectAttempts = 0;
            }
        }
    }
    
    handleConnectionError() {
        console.log('❌ WebSocket connection error');
        
        this.isSearching = false;
        this.updateMatchmakingUI('idle');
        this.stopQueueUpdates();
        
        if (typeof showNotification === 'function') {
            showNotification('Unable to connect to matchmaking server. Please check your connection and try again.', 'error');
        }
        
        // Update city matchmaking UI if applicable
        const cityStatusElement = document.getElementById('city-matchmaking-status');
        if (cityStatusElement) {
            cityStatusElement.innerHTML = `
                <div class="text-danger mb-4">
                    <div class="text-4xl mb-2">❌</div>
                    <div class="font-bold">Connection Failed</div>
                    <div class="text-sm">Please check your internet connection</div>
                </div>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            `;
        }
    }
    
    handleMatchmakingTimeout(data) {
        console.log('⏰ Matchmaking timeout received:', data);
        
        this.isSearching = false;
        this.updateMatchmakingUI('idle');
        this.stopQueueUpdates();
        
        // Show timeout message with city-specific text
        if (typeof showNotification === 'function') {
            showNotification(data.message || 'No players found. Try again or select another city.', 'warning', 5000);
        }
        
        // Update city matchmaking UI if on city matchmaking screen
        const cityStatusElement = document.getElementById('city-matchmaking-status');
        if (cityStatusElement) {
            cityStatusElement.innerHTML = `
                <div class="text-warning mb-4">
                    <div class="text-4xl mb-2">⏰</div>
                    <div class="font-bold">No Players Found</div>
                    <div class="text-sm">Try again or select another city</div>
                </div>
                <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
            `;
        }
        
        console.log('✅ Matchmaking timeout handled');
    }
    
    disconnect() {
        this.cancelSearch();
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.stopQueueUpdates();
    }
}

// Global matchmaking manager instance
let matchmakingManager = null;

// Initialize matchmaking when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    matchmakingManager = new AutomaticMatchmakingManager();
});

// Matchmaking functions for UI interaction
async function findRandomPlayer() {
    console.log('🎮 Find random player clicked');
    
    if (!matchmakingManager) {
        matchmakingManager = new AutomaticMatchmakingManager();
    }
    
    try {
        await matchmakingManager.startSearch();
        updateOnlineStats();
    } catch (error) {
        console.error('🎮 Failed to start matchmaking:', error);
        if (typeof showNotification === 'function') {
            showNotification('Failed to start matchmaking. Please try again.', 'error');
        }
    }
}

function cancelMatchmaking() {
    console.log('🎮 Cancel matchmaking clicked');
    
    if (matchmakingManager) {
        matchmakingManager.cancelSearch();
    }
}

// Update online statistics
async function updateOnlineStats() {
    try {
        const response = await fetch('http://localhost:8000/matchmaking/status');
        const data = await response.json();
        
        const onlinePlayersElement = document.getElementById('online-players-count');
        const gamesTodayElement = document.getElementById('games-today-count');
        
        if (onlinePlayersElement) {
            onlinePlayersElement.textContent = data.queue_size || 0;
        }
        
        if (gamesTodayElement) {
            // This would need to be tracked in the backend
            gamesTodayElement.textContent = Math.floor(Math.random() * 100) + 50;
        }
    } catch (error) {
        console.error('🎮 Failed to update online stats:', error);
    }
}

// Update stats periodically
setInterval(updateOnlineStats, 5000); 