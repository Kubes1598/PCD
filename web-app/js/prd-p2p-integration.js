// ===== PRD-COMPLIANT P2P INTEGRATION =====
// This file integrates the WebRTC P2P system with the existing PCD game
// Implements all PRD requirements for peer-to-peer online play

// Global P2P state
let p2pGameState = {
    isP2PMode: false,
    connectionEstablished: false,
    currentCity: null,
    entryCost: 0,
    opponentId: null,
    isHost: false,
    gameReady: false,
    syncedStartTime: null
};

// ===== P2P GAME INITIALIZATION =====

// PRD: Initialize P2P connection for online games
async function initializeP2PConnection(city) {
    console.log('🔗 Initializing PRD-compliant P2P connection for', city);
    
    p2pGameState.isP2PMode = true;
    p2pGameState.currentCity = city;
    
    try {
        // Initialize WebRTC P2P Manager
        if (typeof initializeP2PManager === 'function') {
            webrtcP2PManager = initializeP2PManager();
            console.log('✅ WebRTC P2P Manager initialized');
        } else {
            throw new Error('WebRTC P2P Manager not available');
        }
        
        // Initialize timer synchronization
        try {
            if (typeof initializeTimerSync === 'function') {
                timerSyncManager = await initializeTimerSync();
                console.log('✅ Timer synchronization initialized');
            }
        } catch (error) {
            console.warn('⚠️ Timer sync failed, using local time:', error);
        }
        
        // Set up P2P connection callbacks
        setupP2PCallbacks();
        
        // Start P2P matchmaking
        await webrtcP2PManager.startMatchmaking(city.toLowerCase());
        
        // Show P2P matchmaking screen
        showP2PMatchmakingScreen(city);
        
    } catch (error) {
        console.error('❌ Failed to initialize P2P connection:', error);
        showNotification('❌ Failed to connect. Please try again.', 'error');
        resetP2PState();
        if (typeof showScreen === 'function') {
            showScreen('page2'); // Return to city selection
        }
    }
}

// Setup P2P connection callbacks
function setupP2PCallbacks() {
    if (!webrtcP2PManager) return;
    
    // Connection established
    webrtcP2PManager.onConnectionEstablished = () => {
        console.log('✅ P2P connection established');
        p2pGameState.connectionEstablished = true;
        
        closeP2PMatchmakingModal();
        showNotification('🔗 Connected to opponent!', 'success', 3000);
        
        // Proceed to candy selection
        setTimeout(() => {
            if (typeof showScreen === 'function') {
                showScreen('page4');
            }
            if (typeof initializePoisonSelection === 'function') {
                initializePoisonSelection();
            }
        }, 1000);
    };
    
    // Handle incoming game messages
    webrtcP2PManager.handleGameMessage = (message) => {
        handleP2PGameMessage(message);
    };
    
    // Handle disconnection
    webrtcP2PManager.onDisconnection = () => {
        handleP2PDisconnection();
    };
}

// ===== P2P MATCHMAKING UI =====

// PRD: Show P2P matchmaking screen
function showP2PMatchmakingScreen(city) {
    console.log('🔍 Showing P2P matchmaking screen for', city);
    
    // Remove existing modal
    const existingModal = document.getElementById('p2p-matchmaking-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'p2p-matchmaking-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
            <div style="font-size: 4rem; margin-bottom: 20px;">🔗</div>
            <h2 style="color: #2563eb; margin-bottom: 15px; font-family: Arial;">Connecting to P2P Network</h2>
            <p style="color: #6b7280; margin-bottom: 20px;">Searching for players in ${city}...</p>
            
            <div style="
                width: 60px;
                height: 60px;
                border: 4px solid #e5e7eb;
                border-top: 4px solid #2563eb;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            "></div>
            
            <div style="background: #eff6ff; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <p style="color: #1d4ed8; font-size: 0.9rem; margin: 0;">
                    🔐 Secure peer-to-peer connection<br>
                    ⚡ Low latency gaming<br>
                    🌍 Global matchmaking
                </p>
            </div>
            
            <div id="p2p-matchmaking-timer" style="color: #6b7280; font-size: 0.9rem; margin: 15px 0;">
                Time elapsed: <span id="p2p-elapsed-time">0</span>s / 30s
            </div>
            
            <button onclick="cancelP2PMatchmaking()" style="
                background: #ef4444;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
                margin-top: 10px;
            ">Cancel Search</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Start 30-second timer (PRD requirement)
    startP2PMatchmakingTimer(city);
}

// Start P2P matchmaking timer
function startP2PMatchmakingTimer(city) {
    let elapsedTime = 0;
    const maxTime = 30; // PRD: 30-second timeout
    
    const timer = setInterval(() => {
        elapsedTime++;
        
        const timerElement = document.getElementById('p2p-elapsed-time');
        if (timerElement) {
            timerElement.textContent = elapsedTime;
        }
        
        // PRD: Handle 30-second timeout
        if (elapsedTime >= maxTime) {
            clearInterval(timer);
            handleP2PMatchmakingTimeout(city);
        }
    }, 1000);
    
    // Store timer reference for cleanup
    const modal = document.getElementById('p2p-matchmaking-modal');
    if (modal) {
        modal.setAttribute('data-timer-id', timer);
    }
}

// PRD: Handle P2P matchmaking timeout (30 seconds)
function handleP2PMatchmakingTimeout(city) {
    console.log('⏰ P2P matchmaking timeout after 30 seconds');
    
    // Clean up P2P connection
    if (webrtcP2PManager) {
        webrtcP2PManager.disconnect();
    }
    
    closeP2PMatchmakingModal();
    resetP2PState();
    
    // PRD: Show timeout message
    if (typeof createModal === 'function') {
        createModal(
            '⏰ No Players Found',
            `<div class="text-center">
                <div class="text-6xl mb-4">🔍</div>
                <h3 class="text-xl font-bold mb-4">No players found in ${city}</h3>
                <p class="text-gray-600 mb-4">We couldn't find another player in the ${city} arena within 30 seconds.</p>
                <div class="bg-blue-50 rounded-lg p-4 mb-4">
                    <p class="text-sm text-blue-700">💡 <strong>Suggestions:</strong></p>
                    <ul class="text-sm text-blue-700 text-left mt-2">
                        <li>• Try again in a few minutes</li>
                        <li>• Select another city (Cairo or Oslo)</li>
                        <li>• Play offline mode against AI</li>
                    </ul>
                </div>
            </div>`,
            [
                { text: 'Try Again', action: () => { closeModal(); initializeP2PConnection(city); }, class: 'btn-primary' },
                { text: 'Select Another City', action: () => { closeModal(); showScreen('page2'); }, class: 'btn-secondary' },
                { text: 'Play Offline', action: () => { closeModal(); showScreen('page7'); }, class: 'btn-outline' }
            ]
        );
    } else {
        alert(`No players found in ${city}. Try again or select another city.`);
        if (typeof showScreen === 'function') {
            showScreen('page2');
        }
    }
}

// PRD: Cancel P2P matchmaking
function cancelP2PMatchmaking() {
    console.log('🔌 Cancelling P2P matchmaking...');
    
    // Clean up P2P connection
    if (webrtcP2PManager) {
        webrtcP2PManager.disconnect();
    }
    
    // Clean up timer sync
    if (timerSyncManager) {
        timerSyncManager.stop();
    }
    
    closeP2PMatchmakingModal();
    resetP2PState();
    
    // Return to city selection
    if (typeof showScreen === 'function') {
        showScreen('page2');
    }
    
    if (typeof showNotification === 'function') {
        showNotification('🔌 Matchmaking cancelled', 'info');
    }
}

// Close P2P matchmaking modal
function closeP2PMatchmakingModal() {
    const modal = document.getElementById('p2p-matchmaking-modal');
    if (modal) {
        const timerId = modal.getAttribute('data-timer-id');
        if (timerId) {
            clearInterval(parseInt(timerId));
        }
        modal.remove();
    }
}

// ===== P2P GAME MESSAGING =====

// Handle P2P game messages
function handleP2PGameMessage(message) {
    console.log('📡 P2P game message received:', message.type);
    
    switch (message.type) {
        case 'candy-pick':
            handleP2PCandyPick(message);
            break;
        case 'poison-selection':
            handleP2PPoisonSelection(message);
            break;
        case 'game-state-update':
            handleP2PGameStateUpdate(message);
            break;
        case 'player-ready':
            handleP2PPlayerReady(message);
            break;
        case 'game-start':
            handleP2PSynchronizedStart(message);
            break;
        case 'player-disconnected':
            handleP2PPlayerDisconnected(message);
            break;
        default:
            console.log('Unknown P2P message type:', message.type);
    }
}

// Handle P2P candy pick
function handleP2PCandyPick(message) {
    console.log('🍭 P2P candy pick:', message.candy);
    
    if (typeof gameState !== 'undefined' && typeof handleOpponentCandyPick === 'function') {
        handleOpponentCandyPick(message.candy, message.index);
    }
}

// Handle P2P poison selection
function handleP2PPoisonSelection(message) {
    console.log('☠️ P2P poison selection:', message.poison);
    
    if (typeof gameState !== 'undefined') {
        gameState.opponentPoison = message.poison;
        gameState.opponentReady = true;
        
        // Check if both players are ready to start
        if (gameState.selectedPoison && gameState.opponentPoison) {
            startP2PSynchronizedGame();
        }
    }
}

// Handle P2P game state update
function handleP2PGameStateUpdate(message) {
    console.log('🎮 P2P game state update');
    
    if (typeof gameState !== 'undefined' && typeof updateFromRemoteGameState === 'function') {
        updateFromRemoteGameState(message.gameState);
    }
}

// Handle P2P player ready
function handleP2PPlayerReady(message) {
    console.log('✅ P2P player ready');
    
    if (typeof gameState !== 'undefined') {
        gameState.opponentReady = true;
    }
}

// PRD: Handle synchronized game start
function handleP2PSynchronizedStart(message) {
    console.log('🎮 P2P synchronized game start');
    
    p2pGameState.syncedStartTime = message.startTime;
    
    // Use timer sync if available
    let delay = 0;
    if (timerSyncManager) {
        const syncedTime = timerSyncManager.getSynchronizedTime();
        delay = Math.max(0, message.startTime - syncedTime);
    } else {
        delay = Math.max(0, message.startTime - Date.now());
    }
    
    if (delay > 0) {
        console.log(`⏰ Synchronized start in ${delay}ms`);
        setTimeout(() => {
            startP2PSynchronizedGame();
        }, delay);
    } else {
        startP2PSynchronizedGame();
    }
}

// Handle P2P player disconnection
function handleP2PPlayerDisconnected(message) {
    console.log('💔 P2P player disconnected');
    handleP2PDisconnection();
}

// ===== P2P GAME CONTROL =====

// Start P2P synchronized game
function startP2PSynchronizedGame() {
    console.log('🎮 Starting P2P synchronized game');
    
    p2pGameState.gameReady = true;
    
    if (typeof gameState !== 'undefined') {
        gameState.gameStarted = true;
        gameState.gameMode = 'p2p-online';
        gameState.isPlayerTurn = p2pGameState.isHost; // Host goes first
    }
    
    // Start game timer if available
    if (typeof startGameTimer === 'function') {
        startGameTimer();
    }
    
    // Show game screen
    if (typeof showScreen === 'function') {
        showScreen('page3'); // Game screen
    }
    
    if (typeof showNotification === 'function') {
        showNotification('🎮 Game started! (P2P Synchronized)', 'success', 2000);
    }
    
    // Initialize game board if needed
    if (typeof initializeGameBoard === 'function') {
        initializeGameBoard();
    }
}

// Send P2P candy pick
function sendP2PCandyPick(candy, index) {
    if (webrtcP2PManager && p2pGameState.connectionEstablished) {
        webrtcP2PManager.sendGameMessage({
            type: 'candy-pick',
            candy: candy,
            index: index,
            timestamp: timerSyncManager ? timerSyncManager.getSynchronizedTime() : Date.now()
        });
    }
}

// Send P2P poison selection
function sendP2PPoisonSelection(poison) {
    if (webrtcP2PManager && p2pGameState.connectionEstablished) {
        webrtcP2PManager.sendGameMessage({
            type: 'poison-selection',
            poison: poison,
            timestamp: timerSyncManager ? timerSyncManager.getSynchronizedTime() : Date.now()
        });
    }
}

// Send P2P game state update
function sendP2PGameStateUpdate(gameState) {
    if (webrtcP2PManager && p2pGameState.connectionEstablished) {
        webrtcP2PManager.sendGameMessage({
            type: 'game-state-update',
            gameState: gameState,
            timestamp: timerSyncManager ? timerSyncManager.getSynchronizedTime() : Date.now()
        });
    }
}

// ===== P2P DISCONNECTION HANDLING =====

// PRD: Handle P2P disconnection with 15-second reconnection window
function handleP2PDisconnection() {
    console.log('💔 P2P connection lost');
    
    if (!p2pGameState.gameReady) {
        // Game hasn't started yet, return to matchmaking
        if (typeof showNotification === 'function') {
            showNotification('🔌 Connection lost during matchmaking', 'error');
        }
        resetP2PState();
        if (typeof showScreen === 'function') {
            showScreen('page2');
        }
        return;
    }
    
    // Game is in progress, show reconnection UI
    if (typeof showNotification === 'function') {
        showNotification('🔌 Connection lost. Attempting to reconnect...', 'warning', 5000);
    }
    
    // PRD: Show reconnection modal
    showP2PReconnectionModal();
    
    // Start 15-second reconnection timer
    setTimeout(() => {
        if (!p2pGameState.connectionEstablished) {
            handleP2PReconnectionTimeout();
        }
    }, 15000); // PRD: 15-second window
}

// Show P2P reconnection modal
function showP2PReconnectionModal() {
    const modal = document.createElement('div');
    modal.id = 'p2p-reconnection-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 400px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">🔌</div>
            <h3 style="color: #dc2626; margin-bottom: 15px;">Connection Lost</h3>
            <p style="color: #6b7280; margin-bottom: 20px;">Attempting to reconnect...</p>
            <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top: 3px solid #dc2626; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="color: #6b7280; margin-top: 15px; font-size: 0.9rem;">Reconnection window: 15 seconds</p>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// PRD: Handle reconnection timeout (15 seconds)
function handleP2PReconnectionTimeout() {
    console.log('⏰ P2P reconnection timeout after 15 seconds');
    
    // Close reconnection modal
    const modal = document.getElementById('p2p-reconnection-modal');
    if (modal) {
        modal.remove();
    }
    
    // Award win to remaining player
    if (typeof showNotification === 'function') {
        showNotification('🏆 Opponent disconnected. You win!', 'success', 5000);
    }
    
    // End game with win
    if (typeof endGame === 'function') {
        endGame(true, '🏆 You won! Opponent disconnected.');
    }
    
    resetP2PState();
}

// ===== P2P STATE MANAGEMENT =====

// Reset P2P state
function resetP2PState() {
    p2pGameState = {
        isP2PMode: false,
        connectionEstablished: false,
        currentCity: null,
        entryCost: 0,
        opponentId: null,
        isHost: false,
        gameReady: false,
        syncedStartTime: null
    };
    
    if (typeof gameState !== 'undefined') {
        gameState.gameMode = 'offline';
        gameState.connectionType = 'none';
        gameState.p2pConnected = false;
    }
}

// Check if in P2P mode
function isP2PMode() {
    return p2pGameState.isP2PMode && p2pGameState.connectionEstablished;
}

// ===== P2P INTEGRATION HOOKS =====

// Hook into existing poison confirmation
const originalConfirmPoison = typeof confirmPoison !== 'undefined' ? confirmPoison : null;

if (originalConfirmPoison && typeof window !== 'undefined') {
    window.confirmPoison = function() {
        console.log('🔗 P2P poison confirmation hook');
        
        if (isP2PMode()) {
            // Send poison selection to peer
            if (typeof gameState !== 'undefined' && gameState.selectedPoison) {
                sendP2PPoisonSelection(gameState.selectedPoison);
            }
        }
        
        // Call original function
        return originalConfirmPoison.apply(this, arguments);
    };
}

// Hook into candy picking
const originalPickCandy = typeof pickCandy !== 'undefined' ? pickCandy : null;

if (originalPickCandy && typeof window !== 'undefined') {
    window.pickCandy = function(candy, index, element) {
        console.log('🔗 P2P candy pick hook');
        
        if (isP2PMode()) {
            // Send candy pick to peer
            sendP2PCandyPick(candy, index);
        }
        
        // Call original function
        return originalPickCandy.apply(this, arguments);
    };
}

// ===== INITIALIZATION =====

console.log('✅ PRD-compliant P2P integration loaded');

// Add CSS for spinning animation
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Export functions for global use
if (typeof window !== 'undefined') {
    window.initializeP2PConnection = initializeP2PConnection;
    window.cancelP2PMatchmaking = cancelP2PMatchmaking;
    window.isP2PMode = isP2PMode;
    window.sendP2PCandyPick = sendP2PCandyPick;
    window.sendP2PPoisonSelection = sendP2PPoisonSelection;
    window.p2pGameState = p2pGameState;
} 