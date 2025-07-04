// ===== GAME INITIALIZER - UNIFIED GAME STARTUP SYSTEM =====

class GameInitializer {
    constructor() {
        this.isInitializing = false;
        this.initializationPromise = null;
        this.backendAvailable = null; // Cache backend status
    }

    // ===== MAIN ENTRY POINT =====
    async start(mode, options = {}) {
        console.log(`🎮 GameInitializer.start() called with mode: ${mode}`, options);
        
        // Prevent multiple simultaneous initializations
        if (this.isInitializing) {
            console.log('⚠️ Game initialization already in progress, waiting...');
            return await this.initializationPromise;
        }

        this.isInitializing = true;
        this.initializationPromise = this._doInitialization(mode, options);
        
        try {
            const result = await this.initializationPromise;
            console.log('✅ Game initialization completed successfully');
            return result;
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            throw error;
        } finally {
            this.isInitializing = false;
            this.initializationPromise = null;
        }
    }

    // ===== INTERNAL INITIALIZATION LOGIC =====
    async _doInitialization(mode, options) {
        try {
            // Step 1: Validate inputs
            this._validateGameMode(mode);
            
            // Step 2: Initialize game state
            this._ensureGameState();
            
            // Step 3: Reset previous game state
            this._resetGameState();
            
            // Step 4: Mode-specific initialization
            switch (mode) {
                case 'offline':
                case 'ai':
                    return await this._initializeOfflineMode(options);
                case 'online':
                    return await this._initializeOnlineMode(options);
                case 'friends':
                    return await this._initializeFriendsMode(options);
                default:
                    throw new Error(`Unknown game mode: ${mode}`);
            }
        } catch (error) {
            return this._handleInitializationError(error, mode, options);
        }
    }

    // ===== VALIDATION =====
    _validateGameMode(mode) {
        const validModes = ['offline', 'ai', 'online', 'friends'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid game mode: ${mode}. Valid modes are: ${validModes.join(', ')}`);
        }
    }

    _ensureGameState() {
        if (!window.gameState || typeof window.gameState.updateStats !== 'function') {
            console.log('🔄 Initializing game state...');
            window.gameState = new GameState();
        }
    }

    _resetGameState() {
        console.log('🧹 Resetting game state...');
        gameState.gameId = null;
        gameState.playerId = null;
        gameState.opponentId = null;
        gameState.currentGameState = null;
        gameState.selectedPoison = null;
        gameState.opponentPoison = null;
        gameState.playerCandies = [];
        gameState.opponentCandies = [];
        gameState.playerCollection = [];
        gameState.opponentCollection = [];
        gameState.isPlayerTurn = true;
        gameState.gameStarted = false;
        gameState.gameEnded = false;
        gameState.playerScore = 0;
        gameState.opponentScore = 0;
        
        // Clear timers
        if (gameState.turnTimer) {
            clearInterval(gameState.turnTimer);
            gameState.turnTimer = null;
        }
        if (gameState.gameTimer) {
            clearInterval(gameState.gameTimer);
            gameState.gameTimer = null;
        }
    }

    // ===== OFFLINE/AI MODE INITIALIZATION =====
    async _initializeOfflineMode(options) {
        console.log('🤖 Initializing offline/AI mode...');
        
        // Set game mode
        gameState.gameMode = options.mode || 'offline';
        gameState.aiDifficulty = options.difficulty || 'easy';
        gameState.playerName = options.playerName || 'Player';
        
        // Generate random candies
        gameState.playerCandies = this._generateRandomCandies(12);
        gameState.opponentCandies = this._generateRandomCandies(12);
        
        // Set AI poison (opponent poison)
        gameState.opponentPoison = gameState.opponentCandies[0];
        
        console.log('✅ Offline game initialized:', {
            mode: gameState.gameMode,
            difficulty: gameState.aiDifficulty,
            playerCandies: gameState.playerCandies.length,
            opponentCandies: gameState.opponentCandies.length
        });
        
        // Navigate to poison selection
        if (typeof showScreen === 'function') {
            showScreen('page4');
        }
        if (typeof initializePoisonSelection === 'function') {
            initializePoisonSelection();
        }
        
        return {
            success: true,
            mode: gameState.gameMode,
            requiresPoisonSelection: true
        };
    }

    // ===== ONLINE MODE INITIALIZATION =====
    async _initializeOnlineMode(options) {
        console.log('🌐 Initializing online mode...');
        
        // Check backend availability
        const backendAvailable = await this._checkBackendAvailability();
        if (!backendAvailable) {
            return this._handleBackendUnavailable('online', options);
        }
        
        // Set game mode
        gameState.gameMode = 'online';
        gameState.selectedCity = options.city || 'Dubai';
        gameState.gameCost = options.cost || 100;
        gameState.playerName = options.playerName || 'Player';
        
        // Create online game via API
        const gameData = await this._createOnlineGame();
        
        // Update game state from API response
        gameState.gameId = gameData.game_id;
        gameState.playerId = gameData.game_state.player1.id;
        gameState.opponentId = gameData.game_state.player2.id;
        gameState.currentGameState = gameData.game_state;
        gameState.playerCandies = Array.from(gameData.game_state.player1.owned_candies);
        gameState.opponentCandies = Array.from(gameData.game_state.player2.owned_candies);
        
        console.log('✅ Online game initialized:', {
            gameId: gameState.gameId,
            city: gameState.selectedCity,
            cost: gameState.gameCost
        });
        
        // Navigate to poison selection
        if (typeof showScreen === 'function') {
            showScreen('page4');
        }
        if (typeof initializePoisonSelection === 'function') {
            initializePoisonSelection();
        }
        
        return {
            success: true,
            mode: 'online',
            gameId: gameState.gameId,
            requiresPoisonSelection: true
        };
    }

    // ===== FRIENDS MODE INITIALIZATION =====
    async _initializeFriendsMode(options) {
        console.log('👥 Initializing friends mode...');
        
        // Check backend availability
        const backendAvailable = await this._checkBackendAvailability();
        if (!backendAvailable) {
            return this._handleBackendUnavailable('friends', options);
        }
        
        // Set game mode
        gameState.gameMode = 'friends';
        gameState.roomCode = options.roomCode || null;
        gameState.playerName = options.playerName || 'Player';
        
        // For friends mode, we can also work offline
        if (options.offline || !backendAvailable) {
            return this._initializeFriendsOfflineMode(options);
        }
        
        // Create friends game via API
        const gameData = await this._createFriendsGame();
        
        // Update game state from API response
        gameState.gameId = gameData.game_id;
        gameState.playerId = gameData.game_state.player1.id;
        gameState.opponentId = gameData.game_state.player2.id;
        gameState.currentGameState = gameData.game_state;
        gameState.playerCandies = Array.from(gameData.game_state.player1.owned_candies);
        gameState.opponentCandies = Array.from(gameData.game_state.player2.owned_candies);
        
        console.log('✅ Friends game initialized:', {
            gameId: gameState.gameId,
            roomCode: gameState.roomCode
        });
        
        // Navigate to poison selection
        if (typeof showScreen === 'function') {
            showScreen('page4');
        }
        if (typeof initializePoisonSelection === 'function') {
            initializePoisonSelection();
        }
        
        return {
            success: true,
            mode: 'friends',
            gameId: gameState.gameId,
            requiresPoisonSelection: true
        };
    }

    // ===== FRIENDS OFFLINE MODE =====
    async _initializeFriendsOfflineMode(options) {
        console.log('👥 Initializing friends offline mode...');
        
        // Set game mode
        gameState.gameMode = 'friends';
        gameState.roomCode = options.roomCode || this._generateRoomCode();
        gameState.playerName = options.playerName || 'Player';
        
        // Generate random candies
        gameState.playerCandies = this._generateRandomCandies(12);
        gameState.opponentCandies = this._generateRandomCandies(12);
        
        // Set friend poison (will be set by friend)
        gameState.opponentPoison = gameState.opponentCandies[0];
        
        console.log('✅ Friends offline game initialized:', {
            roomCode: gameState.roomCode,
            playerCandies: gameState.playerCandies.length,
            opponentCandies: gameState.opponentCandies.length
        });
        
        // Navigate to poison selection
        if (typeof showScreen === 'function') {
            showScreen('page4');
        }
        if (typeof initializePoisonSelection === 'function') {
            initializePoisonSelection();
        }
        
        return {
            success: true,
            mode: 'friends',
            roomCode: gameState.roomCode,
            offline: true,
            requiresPoisonSelection: true
        };
    }

    // ===== BACKEND CONNECTIVITY =====
    async _checkBackendAvailability() {
        if (this.backendAvailable !== null) {
            return this.backendAvailable;
        }
        
        try {
            console.log('🔍 Checking backend availability...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('http://localhost:8000/health', {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            this.backendAvailable = response.ok;
            console.log(`🌐 Backend availability: ${this.backendAvailable ? 'Available' : 'Unavailable'}`);
            return this.backendAvailable;
        } catch (error) {
            console.log('🌐 Backend unavailable:', error.message);
            this.backendAvailable = false;
            return false;
        }
    }

    // ===== API CALLS =====
    async _createOnlineGame() {
        const response = await fetch('http://localhost:8000/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player1_name: gameState.playerName,
                player2_name: 'Online Opponent'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create online game: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to create online game');
        }
        
        return result.data;
    }

    async _createFriendsGame() {
        const response = await fetch('http://localhost:8000/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player1_name: gameState.playerName,
                player2_name: 'Friend'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create friends game: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to create friends game');
        }
        
        return result.data;
    }

    // ===== FALLBACK HANDLING =====
    _handleBackendUnavailable(mode, options) {
        console.log(`⚠️ Backend unavailable for ${mode} mode, offering fallback...`);
        
        return new Promise((resolve) => {
            if (typeof createModal === 'function') {
                createModal(
                    '🌐 Connection Issue',
                    `<div class="text-center">
                        <div class="text-6xl mb-4">🔌</div>
                        <p class="text-lg mb-4">Unable to connect to game servers</p>
                        <p class="text-gray-600 mb-4">Would you like to play offline instead?</p>
                        <div class="bg-info bg-opacity-10 rounded-lg p-4">
                            <p class="text-info">Offline mode includes AI opponent and full game features</p>
                        </div>
                    </div>`,
                    [
                        {
                            text: 'Play Offline',
                            action: async () => {
                                if (typeof closeModal === 'function') closeModal();
                                const result = await this._initializeOfflineMode({
                                    ...options,
                                    mode: 'offline'
                                });
                                resolve(result);
                            },
                            class: 'btn-primary'
                        },
                        {
                            text: 'Try Again',
                            action: async () => {
                                if (typeof closeModal === 'function') closeModal();
                                // Reset backend availability cache
                                this.backendAvailable = null;
                                const result = await this.start(mode, options);
                                resolve(result);
                            },
                            class: 'btn-secondary'
                        },
                        {
                            text: 'Cancel',
                            action: () => {
                                if (typeof closeModal === 'function') closeModal();
                                resolve({ success: false, cancelled: true });
                            },
                            class: 'btn-secondary'
                        }
                    ]
                );
            } else {
                // Fallback if modal system not available
                resolve(this._initializeOfflineMode({ ...options, mode: 'offline' }));
            }
        });
    }

    // ===== ERROR HANDLING =====
    _handleInitializationError(error, mode, options) {
        console.error(`❌ Initialization error for ${mode} mode:`, error);
        
        return new Promise((resolve) => {
            if (typeof createModal === 'function') {
                createModal(
                    '❌ Game Start Error',
                    `<div class="text-center">
                        <div class="text-6xl mb-4">⚠️</div>
                        <p class="text-lg mb-4">Failed to start ${mode} game</p>
                        <p class="text-gray-600 mb-4">${error.message}</p>
                        <div class="bg-error bg-opacity-10 rounded-lg p-4">
                            <p class="text-error">Please try again or contact support if the issue persists</p>
                        </div>
                    </div>`,
                    [
                        {
                            text: 'Try Again',
                            action: async () => {
                                if (typeof closeModal === 'function') closeModal();
                                const result = await this.start(mode, options);
                                resolve(result);
                            },
                            class: 'btn-primary'
                        },
                        {
                            text: 'Play Offline',
                            action: async () => {
                                if (typeof closeModal === 'function') closeModal();
                                const result = await this._initializeOfflineMode({
                                    ...options,
                                    mode: 'offline'
                                });
                                resolve(result);
                            },
                            class: 'btn-secondary'
                        },
                        {
                            text: 'Main Menu',
                            action: () => {
                                if (typeof closeModal === 'function') closeModal();
                                if (typeof showScreen === 'function') showScreen('page1');
                                resolve({ success: false, cancelled: true });
                            },
                            class: 'btn-secondary'
                        }
                    ]
                );
            } else {
                // Fallback if modal system not available
                console.error('Modal system not available, falling back to offline mode');
                resolve(this._initializeOfflineMode({ ...options, mode: 'offline' }));
            }
        });
    }

    // ===== UTILITY METHODS =====
    _generateRandomCandies(count) {
        // Use the same candy types as main game
        const candyTypes = [
            '🍏', '🍋', '🍇', '🍒', '🍎', '🍓', '🍑', '🍐', '🍌', '🫐', 
            '🥭', '🍊', '🍉', '🍈', '🍍', '🥥', '🥑', '🥒', '🥕', '🥝', 
            '🫛', '🌶️', '🫒', '🍅', '🥦', '🫑', '🧄', '🍆', '🥬', '🌽', 
            '🧅', '🥔', '🫜', '🍠', '🥖', '🍞', '🥚', '🧇', '🧀', '🥞', 
            '🧈', '🍖', '🍗', '🌭', '🥩', '🌮', '🌯', '🥙', '🥗', '🧆', 
            '🍕', '🫔', '🦴', '🍝', '🍜', '🍥', '🍰', '🍬', '🍭', '🍪', 
            '🍩', '🌰', '🍫', '🍵'
        ];
        
        // Ensure no duplicates by shuffling and slicing
        const shuffled = [...candyTypes].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, candyTypes.length));
    }

    _generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}

// ===== GLOBAL INSTANCE =====
window.gameInitializer = new GameInitializer();

// ===== CONVENIENCE FUNCTIONS =====
async function startOfflineGame(options = {}) {
    return await gameInitializer.start('offline', options);
}

async function startAIGame(difficulty = 'easy', options = {}) {
    return await gameInitializer.start('ai', { difficulty, ...options });
}

async function startOnlineGame(city = 'Dubai', cost = 100, options = {}) {
    return await gameInitializer.start('online', { city, cost, ...options });
}

async function startFriendsGame(roomCode = null, options = {}) {
    return await gameInitializer.start('friends', { roomCode, ...options });
}

// ===== NEW WRAPPER FUNCTIONS FOR BUTTON INTEGRATION =====

// AI Game Wrapper
async function startAIGameNew(difficulty) {
    console.log(`🤖 Starting AI game with difficulty: ${difficulty}`);
    return await gameInitializer.start('ai', { difficulty });
}

// Online Game Wrapper
async function startOnlineGameNew(city, cost) {
    console.log(`🌍 Starting online game in ${city} for ${cost} coins`);
    return await gameInitializer.start('online', { city, cost });
}

// Friends Game Wrapper
async function startFriendsGameNew(gameId = null) {
    console.log('👥 Starting friends game');
    return await gameInitializer.start('friends', { gameId });
}

// New Game Wrapper (handles restart)
async function startNewGameNew() {
    console.log('🔄 Starting new game');
    
    // Determine current game mode and restart appropriately
    if (typeof gameState !== 'undefined' && gameState && gameState.gameMode) {
        if (gameState.gameMode === 'ai' || gameState.gameMode === 'offline') {
            return await gameInitializer.start('ai', { difficulty: gameState.aiDifficulty || 'easy' });
        } else if (gameState.gameMode === 'online') {
            return await gameInitializer.start('online', { 
                city: gameState.selectedCity || 'dubai', 
                cost: gameState.gameCost || 500 
            });
        } else if (gameState.gameMode === 'friends') {
            return await gameInitializer.start('friends', {});
        }
    }
    
    // Default to easy AI if no current game
    return await gameInitializer.start('ai', { difficulty: 'easy' });
}

// Export wrapper functions globally
window.startAIGameNew = startAIGameNew;
window.startOnlineGameNew = startOnlineGameNew;
window.startFriendsGameNew = startFriendsGameNew;
window.startNewGameNew = startNewGameNew;

console.log('✅ GameInitializer loaded successfully'); 