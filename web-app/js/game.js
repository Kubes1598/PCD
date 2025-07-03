// ===== GAME STATE MANAGEMENT =====
class GameState {
    constructor() {
        this.currentScreen = 'loading-screen';
        this.gameId = null;
        this.playerName = '';
        this.gameMode = 'ai';
        this.difficulty = 'easy';
        this.currentGame = null;
        this.playerCandies = [];
        this.opponentCandies = [];
        this.playerCollection = [];
        this.opponentCollection = [];
        this.selectedPoison = null;
        this.opponentPoison = null;
        this.isPlayerTurn = true;
        this.gameStarted = false;
        this.gameEnded = false;
        
        // Score tracking properties
        this.playerScore = 0;
        this.opponentScore = 0;
        
        // Turn timer properties
        this.turnTimer = null;
        this.turnCountdown = null;
        this.turnTimeRemaining = 10;
        
        // Game statistics
        this.stats = {
            totalGames: parseInt(localStorage.getItem('pcd_total_games') || '0'),
            wins: parseInt(localStorage.getItem('pcd_wins') || '0'),
            losses: parseInt(localStorage.getItem('pcd_losses') || '0')
        };
        
        this.updateStats();
    }
    
    updateStats() {
        const winRate = this.stats.totalGames > 0 ? 
            Math.round((this.stats.wins / this.stats.totalGames) * 100) : 0;
        
        // Only update if elements exist (DOM is loaded)
        const totalGamesElement = document.getElementById('total-games');
        const winRateElement = document.getElementById('win-rate');
        
        if (totalGamesElement) {
            totalGamesElement.textContent = this.stats.totalGames;
        }
        if (winRateElement) {
            winRateElement.textContent = `${winRate}%`;
        }
    }
    
    saveStats() {
        localStorage.setItem('pcd_total_games', this.stats.totalGames.toString());
        localStorage.setItem('pcd_wins', this.stats.wins.toString());
        localStorage.setItem('pcd_losses', this.stats.losses.toString());
        this.updateStats();
    }
    
    recordGameResult(won) {
        this.stats.totalGames++;
        if (won) {
            this.stats.wins++;
        } else {
            this.stats.losses++;
        }
        this.saveStats();
    }
}

// ===== CANDY DEFINITIONS =====
const CANDY_TYPES = [
    '🍬', '🍭', '🍫', '🧁', '🍰', '🎂', '🍪', '🍩', '🍯', '🍮',
    '🧊', '🍓', '🍒', '🍑', '🥭', '🍍', '🥝', '🍇', '🫐', '🍉',
    '🍊', '🍋', '🍌', '🍈', '🍎', '🍏', '🥥', '🥕', '🌽', '🥜'
];

function getRandomCandies(count) {
    const candies = [];
    for (let i = 0; i < count; i++) {
        const randomCandy = CANDY_TYPES[Math.floor(Math.random() * CANDY_TYPES.length)];
        candies.push(randomCandy);
    }
    return candies;
}

// ===== GLOBAL GAME STATE =====
let gameState;

// ===== TURN TIMER FUNCTIONALITY =====
// Note: Turn timer properties will be added to gameState after initialization

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    console.log(`Switching to screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (!targetScreen) {
        console.error(`Screen ${screenId} not found`);
        return;
    }
    
        targetScreen.classList.add('active');
    
    // Only update gameState if it exists
    if (gameState && typeof gameState === 'object') {
        gameState.currentScreen = screenId;
    }
        
        // Handle screen-specific logic
        switch(screenId) {
        case 'page1':
            // Main menu - update stats
            if (gameState && gameState.updateStats) {
                gameState.updateStats();
            }
                break;
        case 'page2':
            // City selection - no special handling needed
                break;
        case 'page3':
            // Game board - initialize if needed
            if (gameState && gameState.gameStarted) {
                console.log('Initializing game board from showScreen');
                initializeGameBoardInPage();
                
                // Update the game status display
                const statusText = document.getElementById('game-status-text');
                if (statusText) {
                    if (gameState.isPlayerTurn) {
                        statusText.textContent = '🎯 Your Turn - Pick a candy!';
                    } else {
                        statusText.textContent = '⏳ Opponent Turn';
                    }
                }
            } else {
                console.log('Game not started yet, showing setup mode');
                
                // Update status for setup mode
                const statusText = document.getElementById('game-status-text');
                if (statusText) {
                    statusText.textContent = '⚙️ Game Setup - Select mode first';
                }
            }
            break;
        case 'page4':
            // Poison selection - initialize
            if (gameState) {
                initializePoisonSelection();
            }
                break;
        case 'page7':
            // Offline mode - no special handling needed
                break;
        default:
            console.log(`No special handling for screen: ${screenId}`);
                break;
    }
}

// ===== GAME SETUP =====
function initializeGameSetup() {
    // Set default player name
    const playerNameInput = document.getElementById('player-name');
    if (!playerNameInput.value) {
        playerNameInput.value = 'Player';
    }
}

// ===== ENHANCED START GAME BUTTON =====
async function startGame() {
    console.log('🎮 Enhanced Start Game - Checking current game state...');
    
    // 0. ENSURE GAME STATE IS INITIALIZED
    if (!gameState || typeof gameState.updateStats !== 'function') {
        console.log('⚠️ Game state not initialized, initializing now...');
        gameState = new GameState();
        showNotification('🎮 Game initializing...', 'info', 2000);
        
        // Give a moment for initialization
        setTimeout(() => {
            startGame();
        }, 100);
        return;
    }
    
    // Check if game is already started
    if (gameState.gameStarted && gameState.selectedPoison) {
        console.log('🎮 Game already started, redirecting to game board...');
        showNotification('🎮 Game already in progress! Continue playing.', 'info', 2000);
        showScreen('page3');
        initializeGameBoardInPage();
        return;
    }
    
    // 1. CHECK CANDY CHOICE (Poison Selection)
    if (!gameState.selectedPoison) {
        // Show feedback if no poison selected
        showNotification('⚠️ Please select your poison candy first!', 'error', 3000);
        showScreen('page4'); // Go to poison selection
        return;
    }
    
    // 2. SHOW FEEDBACK - Game Starting
    showNotification('🎮 Game Starting! Poison set to ' + gameState.selectedPoison, 'success', 2000);
    
    try {
        if (gameState.gameMode === 'ai') {
            // For AI games, create a game session
            const response = await fetch('http://localhost:8000/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player1_name: gameState.playerName || 'Player',
                    player2_name: 'AI Assistant'
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create AI game');
            }
            
            const result = await response.json();
            console.log('Game created:', result);
            
            if (result.success) {
                gameState.gameId = result.data.game_id;
                gameState.currentGameState = result.data.game_state;
                
                // Set player IDs correctly from backend response
                gameState.playerId = result.data.game_state.player1.id;
                gameState.opponentId = result.data.game_state.player2.id;
                
                // Initialize candies from backend
                gameState.playerCandies = Array.from(result.data.game_state.player1.owned_candies);
                gameState.opponentCandies = Array.from(result.data.game_state.player2.owned_candies);
                
                console.log('Player ID set to:', gameState.playerId);
                console.log('Player candies:', gameState.playerCandies);
                
                // 3. UPDATE SCORE (Initialize)
                gameState.playerScore = 0;
                gameState.opponentScore = 0;
                updateScoreDisplay();
                
                // 4. START 30-SECOND TIMER
                startGameTimer();
                
                // Start poison selection phase
                showScreen('page4');
                initializePoisonSelection();
            } else {
                throw new Error(result.message || 'Failed to create game');
            }
            
        } else if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
            // For online/friends games, create a game session 
            const response = await fetch('http://localhost:8000/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player1_name: gameState.playerName || 'Player',
                    player2_name: 'Opponent'
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create online game');
            }
            
            const result = await response.json();
            console.log('Online game created:', result);
            
            if (result.success) {
                gameState.gameId = result.data.game_id;
                gameState.currentGameState = result.data.game_state;
                
                // Set player IDs correctly from backend response
                gameState.playerId = result.data.game_state.player1.id;
                gameState.opponentId = result.data.game_state.player2.id;
                
                // Initialize candies from backend
                gameState.playerCandies = Array.from(result.data.game_state.player1.owned_candies);
                gameState.opponentCandies = Array.from(result.data.game_state.player2.owned_candies);
                
                // 3. UPDATE SCORE (Initialize)
                gameState.playerScore = 0;
                gameState.opponentScore = 0;
                updateScoreDisplay();
                
                // 4. START 30-SECOND TIMER
                startGameTimer();
                
                // Start poison selection phase
                showScreen('page4');
                initializePoisonSelection();
            } else {
                throw new Error(result.message || 'Failed to create game');
            }
        } else {
            // Fallback for offline mode or unknown mode
            console.log('Starting offline game mode');
            gameState.gameMode = 'offline';
            gameState.playerCandies = getRandomCandies(12);
            gameState.opponentCandies = getRandomCandies(12);
            gameState.playerCollection = [];
            gameState.opponentCollection = [];
            gameState.isPlayerTurn = true;
            gameState.gameStarted = false; // Will be set to true after poison selection
            
            // 3. UPDATE SCORE (Initialize)
            gameState.playerScore = 0;
            gameState.opponentScore = 0;
            updateScoreDisplay();
            
            // 4. START 30-SECOND TIMER
            startGameTimer();
            
            console.log('Player candies:', gameState.playerCandies);
            console.log('Opponent candies:', gameState.opponentCandies);
            
            // Start poison selection for offline mode - show the poison selection screen
            showScreen('page4');
            initializePoisonSelection();
        }
        
    } catch (error) {
        console.error('Error starting game:', error);
        showNotification('❌ Failed to start game: ' + error.message, 'error', 5000);
        createModal(
            '❌ Game Error',
            `<div class="text-center">
                <p class="text-lg mb-4">Failed to start game</p>
                <p class="text-gray-600">${error.message}</p>
            </div>`,
            [
                { text: 'Try Again', action: () => { closeModal(); startGame(); }, class: 'btn-primary' },
                { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
            ]
        );
    }
}

// ===== POISON SELECTION =====
function initializePoisonSelection() {
    console.log('Initializing poison selection...');
    
    const candyGrid = document.getElementById('poison-candy-grid');
    if (!candyGrid) {
        console.error('Poison candy grid not found - make sure you are on page4');
        return;
    }
    
    candyGrid.innerHTML = '';
    
    // Use player's owned candies for poison selection
    const playerCandies = gameState.playerCandies || [];
    console.log('Player candies for poison selection:', playerCandies);
    
    if (playerCandies.length === 0) {
        console.error('No player candies available for poison selection');
        return;
    }
    
    // Clear previous selection
    gameState.selectedPoison = null;
    
    // Reset confirm button
    const confirmBtn = document.getElementById('confirm-poison-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
    }
    
    // Clear selected poison display
    const poisonDisplay = document.getElementById('selected-poison-display');
    if (poisonDisplay) {
        poisonDisplay.innerHTML = '';
    }
    
    playerCandies.forEach((candy, index) => {
        const candyElement = document.createElement('div');
        candyElement.className = 'candy-item poison-option';
        candyElement.textContent = candy;
        candyElement.dataset.index = index;
        candyElement.dataset.candy = candy;
        candyElement.style.cursor = 'pointer';
        candyElement.style.padding = '12px';
        candyElement.style.margin = '4px';
        candyElement.style.border = '2px solid #ddd';
        candyElement.style.borderRadius = '8px';
        candyElement.style.fontSize = '20px';
        candyElement.style.textAlign = 'center';
        candyElement.style.backgroundColor = '#f8f9fa';
        candyElement.style.userSelect = 'none';
        candyElement.style.transition = 'all 0.3s ease';
        
        // Add hover effects
        candyElement.addEventListener('mouseenter', function() {
            if (!this.classList.contains('selected')) {
                this.style.backgroundColor = '#e9ecef';
                this.style.transform = 'scale(1.05)';
            }
        });
        
        candyElement.addEventListener('mouseleave', function() {
            if (!this.classList.contains('selected')) {
                this.style.backgroundColor = '#f8f9fa';
                this.style.transform = 'scale(1)';
            }
        });
        
        // CRITICAL FIX: Add click event listener properly
        candyElement.addEventListener('click', function() {
            console.log('Candy clicked:', candy);
            selectPoison(candy, index, this);
        });
        
        candyGrid.appendChild(candyElement);
    });
    
    console.log('Poison selection initialized with', playerCandies.length, 'candies');
}

function selectPoison(candy, index, element) {
    console.log('Selecting poison:', candy);
    
    // Remove previous selection
    document.querySelectorAll('#poison-candy-grid .poison-option').forEach(item => {
        item.classList.remove('selected');
        item.style.border = '2px solid #ddd';
        item.style.backgroundColor = '#f8f9fa';
    });
    
    // Select new poison
    element.classList.add('selected');
    element.style.border = '3px solid #28a745';
    element.style.backgroundColor = '#d4edda';
    element.style.boxShadow = '0 0 10px rgba(40, 167, 69, 0.5)';
    gameState.selectedPoison = candy;
    
    // Update display
    const poisonDisplay = document.getElementById('selected-poison-display');
    if (poisonDisplay) {
        poisonDisplay.innerHTML = `
            <div class="text-center">
                <p class="text-lg font-bold text-success">Selected Poison: ${candy}</p>
                <p class="text-sm text-gray-600">Your opponent will try to avoid this candy!</p>
            </div>
        `;
    }
    
    // Enable confirm button
    const confirmBtn = document.getElementById('confirm-poison-btn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
    }
    
    console.log('Poison selected successfully:', candy);
}

async function confirmPoison() {
    if (!gameState.selectedPoison) {
        createModal(
            '⚠️ No Poison Selected',
            '<div class="text-center"><p>Please select a candy to poison first.</p></div>',
            [{ text: 'OK', action: closeModal, class: 'btn-primary' }]
        );
        return;
    }
    
    try {
        console.log('Setting poison with player ID:', gameState.playerId);
        console.log('Selected poison:', gameState.selectedPoison);
        console.log('Game mode:', gameState.gameMode);
        
        // For true offline mode only (no backend connection)
        if (gameState.gameMode === 'offline' || gameState.gameMode === 'friends' || !gameState.gameId) {
            console.log('Offline/Friends mode - proceeding without API call');
            
            // For offline/friends mode, also set AI/opponent poison choice
            if (gameState.opponentCandies.length > 0) {
                gameState.opponentPoison = gameState.opponentCandies[Math.floor(Math.random() * gameState.opponentCandies.length)];
                console.log('Opponent poison set to:', gameState.opponentPoison);
            }
            
            gameState.isPlayerTurn = true;
            gameState.gameStarted = true;
            
            // Show quick success notification
            showNotification(`🎮 Game Starting! Your poison: ${gameState.selectedPoison}`, 'success', 2000);
            
            // Start the game immediately without modal
            console.log('🎮 Starting game automatically...');
            console.log('Current game state:', gameState);
            
            // Remove any existing game interface first
            const existingInterface = document.getElementById('offline-game-interface');
            if (existingInterface) {
                existingInterface.remove();
            }
            
            // Small delay for notification to show, then start game
            setTimeout(() => {
                // Go to the game screen
                showScreen('page3');
                
                // Use the existing beautiful page3 interface - just populate it with candies
                initializeGameBoardInPage();
                
                console.log('✅ Game is now playable!');
            }, 500);
            
            return;
        }
        
        // Validate we have required data for online/AI modes
        if (!gameState.playerId) {
            throw new Error('Player ID not set. Please restart the game.');
        }
        
        // Send poison choice to backend with correct field names
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/poison`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player_id: gameState.playerId,
                poison_candy: gameState.selectedPoison
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Poison API error:', errorData);
            throw new Error(errorData.detail || 'Failed to set poison');
        }
        
        const result = await response.json();
        console.log('Poison set result:', result);
        
        if (result.success) {
            // Update game state
            gameState.currentGameState = result.data.game_state;
            gameState.isPlayerTurn = true; // Player 1 typically starts
            
            // For AI games, set AI poison automatically
            if (gameState.gameMode === 'ai' && gameState.currentGameState.player2.poison_choice === null) {
                console.log('Setting AI poison automatically...');
                await setAIPoison();
            }
            
            // Show success notification and start game automatically 
            showNotification(`🎮 Game Starting! Your poison: ${gameState.selectedPoison}`, 'success', 2000);
            
            // Mark game as started
            gameState.gameStarted = true;
            
            // Start game automatically after brief delay
            setTimeout(() => {
                showScreen('page3'); // Show the Dubai game screen
                initializeGameBoardInPage(); // Initialize the game board properly
            
            // Start timer for online/friends modes
            if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
                startTurnTimer();
            }
            }, 500);
        } else {
            throw new Error(result.message || 'Failed to set poison');
        }
        
    } catch (error) {
        console.error('Error setting poison:', error);
        createModal(
            '❌ Poison Setting Failed',
            `<div class="text-center">
                <p class="text-lg mb-4">Failed to set poison choice</p>
                <p class="text-gray-600">${error.message}</p>
            </div>`,
            [
                { text: 'Try Again', action: closeModal, class: 'btn-primary' },
                { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
            ]
        );
    }
}

// Helper function to set AI poison automatically
async function setAIPoison() {
    try {
        const aiCandies = Array.from(gameState.currentGameState.player2.owned_candies);
        const randomAIPoison = aiCandies[Math.floor(Math.random() * aiCandies.length)];
        
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/poison`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player_id: gameState.opponentId,
                poison_candy: randomAIPoison
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('AI poison set:', randomAIPoison);
            gameState.currentGameState = result.data.game_state;
        } else {
            console.warn('Failed to set AI poison, but continuing game');
        }
    } catch (error) {
        console.warn('Error setting AI poison:', error);
    }
}

// ===== GAME BOARD =====
function initializeGameBoard() {
    console.log('Initializing game board...');
    console.log('Game mode:', gameState.gameMode);
    console.log('Player candies:', gameState.playerCandies);
    console.log('Opponent candies:', gameState.opponentCandies);
    
    // Ensure game elements exist
    ensureGameElementsExist();
    
    // For offline/AI games, make sure we have starting collections
    if (gameState.gameMode === 'offline' || gameState.gameMode === 'ai') {
        if (gameState.playerCollection.length === 0) {
            gameState.playerCollection = [];
        }
        if (gameState.opponentCollection.length === 0) {
            gameState.opponentCollection = [];
        }
        
        // Start with player's turn
        gameState.isPlayerTurn = true;
        console.log('Started offline game - player turn:', gameState.isPlayerTurn);
    }
    
    updateGameBoard();
    updateCollections();
    updateGameStatus();
    
    console.log('Game board initialized successfully');
}

function updateGameBoard() {
    // Update player candies (owned candies that opponent can pick from)
    const playerGrid = document.getElementById('player-candy-grid');
    if (!playerGrid) {
        console.error('Player candy grid not found');
        return;
    }
    playerGrid.innerHTML = '';
    
    gameState.playerCandies.forEach((candy, index) => {
        const candyElement = document.createElement('div');
        candyElement.className = 'candy-item';
        candyElement.textContent = candy;
        candyElement.dataset.index = index;
        candyElement.dataset.candy = candy;
        
        // Player candies are not clickable (opponent picks from them)
        candyElement.style.cursor = 'default';
        
        // Mark as collected if it's in either player's collection
        if (gameState.playerCollection.includes(candy) || gameState.opponentCollection.includes(candy)) {
            candyElement.classList.add('collected');
            candyElement.style.opacity = '0.5';
        }
        
        playerGrid.appendChild(candyElement);
    });
    
    // Update opponent candies (available for player to pick from)
    const opponentGrid = document.getElementById('opponent-candy-grid');
    if (!opponentGrid) {
        console.error('Opponent candy grid not found');
        return;
    }
    opponentGrid.innerHTML = '';
    
    // Use available candies from game state if available
    const availableCandies = gameState.currentGameState?.player1?.available_to_pick || gameState.opponentCandies;
    
    gameState.opponentCandies.forEach((candy, index) => {
        const candyElement = document.createElement('div');
        candyElement.className = 'candy-item';
        candyElement.textContent = candy;
        candyElement.dataset.index = index;
        candyElement.dataset.candy = candy;
        
        // Check if candy is available to pick
        const isAvailable = gameState.gameMode === 'offline' || gameState.gameMode === 'ai' ? 
            !gameState.opponentCollection.includes(candy) : availableCandies.includes(candy);
        
        // Apply base styling to all candy elements
        candyElement.style.padding = '12px';
        candyElement.style.margin = '4px';
        candyElement.style.borderRadius = '8px';
        candyElement.style.fontSize = '24px';
        candyElement.style.textAlign = 'center';
        candyElement.style.border = '2px solid transparent';
        candyElement.style.transition = 'all 0.2s ease';
        candyElement.style.userSelect = 'none';
        candyElement.style.fontWeight = 'bold';
        
        if (gameState.isPlayerTurn && !gameState.gameEnded && isAvailable) {
            // Clickable candy styling
            candyElement.style.cursor = 'pointer';
            candyElement.style.backgroundColor = '#f8f9fa';
            candyElement.style.border = '2px solid #28a745';
            candyElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            candyElement.title = 'Click to collect this candy!';
            
            candyElement.addEventListener('click', () => {
                console.log('Candy clicked:', candy);
                candyElement.style.backgroundColor = '#28a745';
                candyElement.style.color = 'white';
                candyElement.style.transform = 'scale(0.95)';
                pickCandy(candy, index, candyElement);
            });
            
            // Add hover effect
            candyElement.addEventListener('mouseenter', () => {
                if (!gameState.gameEnded && gameState.isPlayerTurn) {
                    candyElement.style.backgroundColor = '#e8f5e8';
                    candyElement.style.border = '2px solid #20c997';
                    candyElement.style.transform = 'scale(1.05)';
                    candyElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }
            });
            
            candyElement.addEventListener('mouseleave', () => {
                if (!gameState.gameEnded && gameState.isPlayerTurn) {
                    candyElement.style.backgroundColor = '#f8f9fa';
                    candyElement.style.border = '2px solid #28a745';
                    candyElement.style.transform = 'scale(1)';
                    candyElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }
            });
        } else {
            // Disabled candy styling
            candyElement.classList.add('disabled');
            candyElement.style.opacity = '0.5';
            candyElement.style.cursor = 'not-allowed';
            candyElement.style.backgroundColor = '#e9ecef';
            candyElement.style.border = '2px solid #ced4da';
            candyElement.style.color = '#6c757d';
            
            if (!isAvailable) {
                candyElement.title = 'Already collected by someone';
                candyElement.style.backgroundColor = '#f8d7da';
                candyElement.style.border = '2px solid #dc3545';
            } else if (!gameState.isPlayerTurn) {
                candyElement.title = 'Wait for your turn';
                candyElement.style.backgroundColor = '#fff3cd';
                candyElement.style.border = '2px solid #ffc107';
            }
        }
        
        opponentGrid.appendChild(candyElement);
    });
}

function updateCollections() {
    // Update player collection
    const playerCollectionGrid = document.getElementById('player-collection-grid');
    if (!playerCollectionGrid) {
        console.error('Player collection grid not found');
        return;
    }
    playerCollectionGrid.innerHTML = '';
    
    // Show all collected candies (no limit of 9)
    gameState.playerCollection.forEach((candy, index) => {
        const slot = document.createElement('div');
        slot.className = 'collection-item';
        slot.textContent = candy;
        slot.style.fontSize = '18px';
        slot.style.padding = '6px';
        slot.style.backgroundColor = '#28a745';
        slot.style.color = 'white';
        slot.style.borderRadius = '6px';
        slot.style.textAlign = 'center';
        slot.style.border = '2px solid #1e7e34';
        slot.style.margin = '2px';
        slot.style.fontWeight = 'bold';
        slot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        slot.title = `Collected candy #${index + 1}`;
        
        playerCollectionGrid.appendChild(slot);
    });
    
    // Update opponent collection
    const opponentCollectionGrid = document.getElementById('opponent-collection-grid');
    if (!opponentCollectionGrid) {
        console.error('Opponent collection grid not found');
        return;
    }
    opponentCollectionGrid.innerHTML = '';
    
    // Show all collected candies (no limit of 9)
    gameState.opponentCollection.forEach((candy, index) => {
        const slot = document.createElement('div');
        slot.className = 'collection-item';
        slot.textContent = candy;
        slot.style.fontSize = '18px';
        slot.style.padding = '6px';
        slot.style.backgroundColor = '#dc3545';
        slot.style.color = 'white';
        slot.style.borderRadius = '6px';
        slot.style.textAlign = 'center';
        slot.style.border = '2px solid #c82333';
        slot.style.margin = '2px';
        slot.style.fontWeight = 'bold';
        slot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        slot.title = `AI collected candy #${index + 1}`;
        
        opponentCollectionGrid.appendChild(slot);
    });
    
    // Update collection counts
    const playerCount = document.getElementById('player-collection-count');
    const opponentCount = document.getElementById('opponent-collection-count');
    if (playerCount) playerCount.textContent = gameState.playerCollection.length;
    if (opponentCount) opponentCount.textContent = gameState.opponentCollection.length;
}

function updateGameStatus() {
    const turnIndicator = document.getElementById('turn-indicator');
    const statusText = document.getElementById('game-status-text');
    const progressFill = document.getElementById('game-progress');
    
    if (gameState.gameEnded) {
        if (turnIndicator) turnIndicator.textContent = 'Game Over';
        if (statusText) statusText.textContent = 'Game has ended';
        return;
    }
    
            if (gameState.isPlayerTurn) {
            if (turnIndicator) {
                turnIndicator.textContent = '🎯 Your Turn';
                turnIndicator.style.color = '#28a745';
            }
            if (statusText) statusText.textContent = 'Choose a candy from opponent\'s collection - avoid the poison!';
        } else {
            if (turnIndicator) {
                turnIndicator.textContent = '🤖 AI Turn';
                turnIndicator.style.color = '#dc3545';
            }
            if (statusText) statusText.textContent = 'AI is thinking... 🤔';
        }
    
    // Update progress bar based on collections
    if (progressFill) {
        const totalProgress = (gameState.playerCollection.length + gameState.opponentCollection.length) / 18 * 100;
        progressFill.style.width = `${totalProgress}%`;
    }
}

async function pickCandy(candy, index, element) {
    if (!gameState.isPlayerTurn || gameState.gameEnded) {
        console.log('Cannot pick candy - not player turn or game ended');
        return;
    }
    
    // Stop timer when player makes a move
    stopTurnTimer();
    
    try {
        console.log('Picking candy:', candy, 'with player ID:', gameState.playerId);
        
        // For offline mode, handle locally
        if (gameState.gameMode === 'offline' || gameState.gameMode === 'ai' || !gameState.gameId) {
            console.log('Offline mode - handling candy pick locally');
            handleOfflineCandyPick(candy, index);
            return;
        }
        
        // Validate we have required data
        if (!gameState.playerId) {
            throw new Error('Player ID not set. Please restart the game.');
        }
        
        // Send pick to backend - use correct player ID
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/pick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player: gameState.playerId, // Use actual player ID instead of 'player1'
                candy_choice: candy
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Pick error:', errorData);
            throw new Error(errorData.detail || 'Failed to pick candy');
        }
        
        const result = await response.json();
        console.log('Pick result:', result);
        
        if (result.success) {
            // Update game state from backend response
            gameState.currentGameState = result.data.game_state;
            
            // Update local state from backend game state
            updateFromGameState(gameState.currentGameState);
            
            // Check game result
            if (result.data.result && result.data.result !== "ongoing") {
                handleGameEnd(result.data.result);
            } else {
                // Update UI
                updateGameBoard();
                updateCollections();
                updateGameStatus();
                
                // Check for AI move after a delay
                if (gameState.gameMode === 'ai' && !gameState.isPlayerTurn) {
                    setTimeout(checkForAIMove, 1500);
                } else if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
                    // Start timer for next turn if it's still player's turn
                    if (gameState.isPlayerTurn) {
                        startTurnTimer();
                    }
                }
            }
        } else {
            throw new Error(result.message || 'Failed to pick candy');
        }
        
    } catch (error) {
        console.error('Error picking candy:', error);
        
        // Restart timer if there was an error
        if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
            startTurnTimer();
        }
        
        createModal(
            '❌ Pick Failed',
            `<div class="text-center">
                <p class="text-lg mb-4">Failed to pick candy</p>
                <p class="text-gray-600">${error.message}</p>
            </div>`,
            [
                { text: 'Try Again', action: closeModal, class: 'btn-primary' },
                { text: 'Forfeit', action: () => { closeModal(); forfeitGame(); }, class: 'btn-secondary' }
            ]
        );
    }
}

// Helper function for offline candy picking
function handleOfflineCandyPick(candy, index) {
    console.log(`🎯 Player picked candy: ${candy}`);
    
    // **STEP 3 FIX: Enforce strict alternation - must be player's turn**
    if (!gameState.isPlayerTurn) {
        console.log('❌ Not player\'s turn! Ignoring pick.');
        showNotification('⚠️ Wait for your turn!', 'warning', 2000);
        return;
    }
    
    // **STEP 2 FIX: Start timer for OFFLINE mode on first move**
    const isFirstMove = (gameState.playerCollection.length === 0 && gameState.opponentCollection.length === 0);
    if (isFirstMove) {
        console.log('⏰ Starting turn timer for offline mode!');
        startGameTimer(); // Now works for all modes including offline
    }
    
    // Stop current turn timer since player made their move
    stopGameTimer();
    
    // Check if candy is the opponent's poison (player loses)
    if (candy === gameState.opponentPoison) {
        endGame(false, `💀 You picked the opponent's poison ${candy}! You lose!`);
        return;
    }
    
    // **CRITICAL FIX: Player picks from OPPONENT's pool, so remove from opponent's candies**
    // Remove candy from opponent's candy pool (since player picked it from opponent's pool)
    const candyIndexInOpponentPool = gameState.opponentCandies.indexOf(candy);
    if (candyIndexInOpponentPool !== -1) {
        gameState.opponentCandies.splice(candyIndexInOpponentPool, 1);
        console.log(`🔥 Removed ${candy} from opponent's pool. Opponent now has ${gameState.opponentCandies.length} candies`);
    }
    
    // Add to player collection if new candy type
    if (!gameState.playerCollection.includes(candy)) {
        gameState.playerCollection.push(candy);
        console.log(`✅ Added ${candy} to player collection. Total: ${gameState.playerCollection.length}/11`);
    }
    
    // **STEP 3 FIX: Increment round counter**
    const totalMoves = gameState.playerCollection.length + gameState.opponentCollection.length;
    gameState.round = Math.ceil(totalMoves / 2); // Round = pair of moves
    
    // Show pickup animation/feedback
    showNotification(`✅ You picked: ${candy}`, 'success', 2000);
    
    // Check win condition
    if (gameState.playerCollection.length >= 11) {
        endGame(true, '🎉 You collected 11 different candies! You win!');
        return;
    }
    
    // **STEP 3 FIX: Switch turn to opponent/AI - STRICT ALTERNATION**
    gameState.isPlayerTurn = false;
    
    // Update the game board to reflect turn change
    initializeGameBoardInPage();
    
    // **STEP 2 FIX: Notify AI turn and start timer**
    showNotification('🤖 AI/Opponent turn starting...', 'info', 1000);
    
    // AI turn in offline mode with timer
    if (gameState.gameMode === 'offline' || gameState.gameMode === 'friends') {
        // Start timer for AI turn after brief delay
        setTimeout(() => {
            startGameTimer(); // AI gets 30 seconds too
            console.log('⏰ Timer started for AI turn');
        }, 500);
        
        // AI makes move after delay (but before timer expires)
        setTimeout(() => {
            handleOfflineAITurn();
        }, 2000);
    }
}

// Helper function for offline AI turns
function handleOfflineAITurn() {
    // **STEP 3 FIX: Enforce strict alternation - must be AI's turn**
    if (gameState.gameEnded || gameState.isPlayerTurn) {
        console.log('❌ Not AI\'s turn or game ended! Ignoring AI turn.');
        return;
    }
    
    console.log('🤖 AI/Opponent turn starting...');
    
    // **STEP 2 FIX: Stop AI timer since AI is making their move**
    stopGameTimer();
    
    // Enhanced AI: pick strategically, avoiding poison when possible
    const availableCandies = gameState.playerCandies.filter(candy => candy !== gameState.selectedPoison);
    
    console.log('AI thinking... Available candies (non-poison):', availableCandies);
    console.log('AI poison:', gameState.opponentPoison);
    console.log('Player poison:', gameState.selectedPoison);
    
    if (availableCandies.length === 0) {
        // AI has to pick poison - player wins
        endGame(true, `🎉 ${gameState.gameMode === 'friends' ? 'Your friend' : 'AI'} picked your poison ${gameState.selectedPoison}! You win!`);
        return;
    }
    
    // AI picks from non-poison candies when possible
    let pickedCandy;
    let randomIndex;
    
    if (availableCandies.length > 0) {
        // Pick from safe candies
        randomIndex = Math.floor(Math.random() * availableCandies.length);
        pickedCandy = availableCandies[randomIndex];
    } else {
        // Fallback to any candy (shouldn't happen due to check above)
        randomIndex = Math.floor(Math.random() * gameState.playerCandies.length);
        pickedCandy = gameState.playerCandies[randomIndex];
    }
    
    // Check if AI picked poison
    if (pickedCandy === gameState.selectedPoison) {
        endGame(true, `🎉 ${gameState.gameMode === 'friends' ? 'Your friend' : 'AI'} picked your poison ${pickedCandy}! You win!`);
        return;
    }
    
    // **CRITICAL FIX: AI picks from PLAYER's pool, so remove from player's candies**
    // Remove candy from player's candy pool (since AI picked it from player's pool)
    const candyIndexInPlayerPool = gameState.playerCandies.indexOf(pickedCandy);
    if (candyIndexInPlayerPool !== -1) {
        gameState.playerCandies.splice(candyIndexInPlayerPool, 1);
        console.log(`🔥 AI removed ${pickedCandy} from player's pool. Player now has ${gameState.playerCandies.length} candies`);
    }
    
    // Add to AI collection if new candy type
    if (!gameState.opponentCollection.includes(pickedCandy)) {
        gameState.opponentCollection.push(pickedCandy);
        console.log(`🤖 ${gameState.gameMode === 'friends' ? 'Friend' : 'AI'} added ${pickedCandy} to collection. Total: ${gameState.opponentCollection.length}/11`);
    }
    
    // **STEP 3 FIX: Update round counter after AI move**
    const totalMoves = gameState.playerCollection.length + gameState.opponentCollection.length;
    gameState.round = Math.ceil(totalMoves / 2); // Round = pair of moves
    
    // Check AI win condition
    if (gameState.opponentCollection.length >= 11) {
        endGame(false, `💔 ${gameState.gameMode === 'friends' ? 'Your friend' : 'AI'} collected 11 different candies! They win!`);
        return;
    }
    
    console.log(`🤖 ${gameState.gameMode === 'friends' ? 'Friend' : 'AI'} picked ${pickedCandy}. Collection now: ${gameState.opponentCollection.length}/11`);
    
    // **STEP 3 FIX: Switch turn back to player - STRICT ALTERNATION**
    gameState.isPlayerTurn = true;
    
    // Update the game board to reflect turn change
    initializeGameBoardInPage();
    
    // **STEP 2 FIX: Start timer for player's next turn**
    setTimeout(() => {
        startGameTimer(); // Player gets 30 seconds for their next turn
        console.log('⏰ Timer started for player\'s next turn');
    }, 500);
    
    // Show what AI picked with appropriate label
    const turnMessage = document.createElement('div');
    turnMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${gameState.gameMode === 'friends' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.5s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    turnMessage.textContent = `${gameState.gameMode === 'friends' ? '👥 Friend' : '🤖 AI'} picked: ${pickedCandy}`;
    document.body.appendChild(turnMessage);
    
    setTimeout(() => {
        if (turnMessage.parentNode) {
            turnMessage.parentNode.removeChild(turnMessage);
        }
    }, 3000);
}

function updateFromGameState(gameState_backend) {
    if (!gameState_backend) {
        console.warn('No backend game state provided');
        return;
    }
    
    console.log('Updating from backend game state:', gameState_backend);
    
    try {
        // Update local game state from backend game state
        if (gameState_backend.player1) {
            gameState.playerCandies = Array.from(gameState_backend.player1.owned_candies || []);
            gameState.playerCollection = Array.from(gameState_backend.player1.collected_candies || []);
        }
        
        if (gameState_backend.player2) {
            gameState.opponentCandies = Array.from(gameState_backend.player2.owned_candies || []);
            gameState.opponentCollection = Array.from(gameState_backend.player2.collected_candies || []);
        }
        
        // Update turn info - check current_player field
        if (gameState_backend.current_player) {
            gameState.isPlayerTurn = (gameState_backend.current_player === gameState.playerId);
            console.log('Turn updated - Player turn:', gameState.isPlayerTurn, 'Current player:', gameState_backend.current_player, 'Player ID:', gameState.playerId);
        }
        
        // Update game status
        if (gameState_backend.state) {
            gameState.gameEnded = (gameState_backend.state === "finished");
            console.log('Game ended status:', gameState.gameEnded);
        }
        
        // Update game started status
        if (gameState_backend.state === "playing") {
            gameState.gameStarted = true;
        }
        
        // Store the current game state for reference
        gameState.currentGameState = gameState_backend;
        
    } catch (error) {
        console.error('Error updating from game state:', error);
        console.error('Backend game state was:', gameState_backend);
    }
}

async function checkForAIMove() {
    if (gameState.gameEnded) return;
    
    try {
        // Poll game state to see if AI has moved
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/state`);
        if (!response.ok) {
            console.error('Failed to fetch game state');
            return;
        }
        
        const currentState = await response.json();
        console.log('Checking for AI move, current state:', currentState);
        
        // Check if game state has changed (AI moved)
        const newPlayerTurn = (currentState.current_player === gameState.playerId);
        const gameFinished = (currentState.state === "finished");
        
        if (gameFinished) {
            // Game ended, determine result
            updateFromGameState(currentState);
            updateGameBoard();
            updateCollections();
            
            // Determine winner
            let result = "draw";
            if (currentState.winner) {
                result = currentState.winner === gameState.playerId ? "player1_win" : "player2_win";
            }
            handleGameEnd(result);
        } else if (newPlayerTurn && !gameState.isPlayerTurn) {
            // AI has moved, update game state
            console.log('AI has moved, updating game state');
            updateFromGameState(currentState);
            updateGameBoard();
            updateCollections();
            updateGameStatus();
        } else if (!newPlayerTurn && !gameState.isPlayerTurn) {
            // Still AI's turn, check again in a moment
            setTimeout(checkForAIMove, 1000);
        }
        
    } catch (error) {
        console.error('Error checking for AI move:', error);
        // Continue game on error
        gameState.isPlayerTurn = true;
        updateGameStatus();
    }
}

function handleGameEnd(result) {
    gameState.gameEnded = true;
    
    let playerWon = false;
    let message = "";
    
    switch(result) {
        case "player1_win":
            playerWon = true;
            message = "Congratulations! You won!";
            break;
        case "player2_win":
            playerWon = false;
            message = "You lost! Better luck next time.";
            break;
        case "draw":
            playerWon = false; // Treat draw as not winning for stats
            message = "It's a draw!";
            break;
        default:
            message = "Game ended.";
    }
    
    endGame(playerWon, message);
}

async function aiTurn() {
    if (gameState.gameEnded || gameState.isPlayerTurn) {
        console.log('AI turn cancelled - game ended or player turn');
        return;
    }
    
    console.log('AI making move...');
    
    try {
        // For offline mode, use local AI logic
        if (gameState.gameMode === 'offline' || !gameState.gameId) {
            handleOfflineAITurn();
            return;
        }
        
        // For online AI, wait a bit then make a move via API
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Get available candies from player's pool
        const playerCandies = gameState.currentGameState?.player1?.owned_candies || gameState.playerCandies;
        const availableCandies = Array.from(playerCandies);
        
        if (availableCandies.length === 0) {
            console.log('No candies available for AI to pick');
            return;
        }
        
        // Simple AI: pick random candy from player's pool
        const randomIndex = Math.floor(Math.random() * availableCandies.length);
        const pickedCandy = availableCandies[randomIndex];
        
        console.log('AI picking candy:', pickedCandy, 'with opponent ID:', gameState.opponentId);
        
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/pick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player: gameState.opponentId, // Use actual AI player ID
                candy_choice: pickedCandy
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('AI pick error:', errorData);
            throw new Error('AI pick failed');
        }
        
        const result = await response.json();
        console.log('AI pick result:', result);
        
        if (result.success) {
            // Update game state
            gameState.currentGameState = result.data.game_state;
            updateFromGameState(gameState.currentGameState);
            
            // Check game result
            if (result.data.result && result.data.result !== "ongoing") {
                handleGameEnd(result.data.result);
            } else {
                // Update UI and continue game
                updateGameBoard();
                updateCollections();
                updateGameStatus();
                
                // Start timer for next player turn if online/friends mode
                if ((gameState.gameMode === 'online' || gameState.gameMode === 'friends') && gameState.isPlayerTurn) {
                    startTurnTimer();
                }
            }
        } else {
            throw new Error(result.message || 'AI move failed');
        }
        
    } catch (error) {
        console.error('Error in AI turn:', error);
        
        // Fallback to continue game
        gameState.isPlayerTurn = true;
        updateGameStatus();
        
        // If it's an online/friends game, start the timer
        if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
            startTurnTimer();
        }
    }
}

function endGame(playerWon, message) {
    console.log('Game ended. Player won:', playerWon, 'Message:', message);
    
    // Stop any timers
    stopTurnTimer();
    
    gameState.gameEnded = true;
    gameState.recordGameResult(playerWon);
    
    // Update result screen elements
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const finalPlayerScore = document.getElementById('final-player-score');
    const finalOpponentScore = document.getElementById('final-opponent-score');
    
    if (resultIcon) {
        resultIcon.textContent = playerWon ? '🏆' : '💔';
    }
    
    if (resultTitle) {
        resultTitle.textContent = playerWon ? 'Victory!' : 'Defeat!';
        resultTitle.className = `text-3xl font-display font-bold mb-4 ${playerWon ? 'text-success' : 'text-danger'}`;
    }
    
    if (resultMessage) {
        resultMessage.textContent = message;
    }
    
    if (finalPlayerScore) {
        finalPlayerScore.textContent = gameState.playerCollection.length;
    }
    
    if (finalOpponentScore) {
        finalOpponentScore.textContent = gameState.opponentCollection.length;
    }
    
    // Show result screen
    showScreen('page5');
    
    // Create a celebration modal for wins
    if (playerWon) {
        setTimeout(() => {
            createModal(
                '🎉 Congratulations!',
                `<div class="text-center">
                    <div class="text-6xl mb-4">🏆</div>
                    <p class="text-lg mb-4">${message}</p>
                    <div class="bg-success bg-opacity-10 rounded-lg p-4">
                        <p class="text-success font-bold">+${gameState.playerCollection.length * 10} XP</p>
                        <p class="text-success">+${gameState.playerCollection.length * 5} Coins</p>
                    </div>
                </div>`,
                [
                    { text: 'Play Again', action: () => { closeModal(); startNewGameNew(); }, class: 'btn-primary' },
                    { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
                ]
            );
        }, 1000);
    }
}

// ===== ENHANCED RESTART GAME BUTTON =====
function startNewGame() {
    console.log('🔄 Enhanced Restart Game - Full reset with new poison...');
    
    // 1. CLEAR SELECTION - Remove all selections and visual states
    clearAllSelections();
    
    // 2. RESET TIMER - Stop all timers
    resetAllTimers();
    
    // 3. RE-RANDOMIZE POISONED CANDY - Generate new poison choice
    gameState.selectedPoison = null;
    gameState.opponentPoison = null;
    
    // 4. RESET SCORE & COMPLETELY CLEAR MEMORY - Clear all scoring and candy arrays
    gameState.playerScore = 0;
    gameState.opponentScore = 0;
    gameState.playerCollection = [];
    gameState.opponentCollection = [];
    
    // **CRITICAL FIX: Completely clear candy arrays to prevent memory persistence**
    gameState.playerCandies = [];
    gameState.opponentCandies = [];
    
    // Reset round counter
    gameState.round = 0;
    
    updateScoreDisplay();
    
    // Show feedback
    showNotification('🔄 Game Reset! New candies generated', 'info', 2000);
    
    // Stop any existing timers first
    stopTurnTimer();
    stopGameTimer();
    
    // Close any open modals
    closeModal();
    
    // Hide any special interfaces
    const poisonModal = document.getElementById('poison-selection-modal');
    if (poisonModal) {
        poisonModal.style.display = 'none';
    }
    
    const offlineInterface = document.getElementById('offline-game-interface');
    if (offlineInterface) {
        offlineInterface.style.display = 'none';
    }
    
    // Remember the current game mode for restart
    const currentMode = gameState.gameMode;
    const currentDifficulty = gameState.aiDifficulty;
    const currentCity = gameState.selectedCity;
    const currentCost = gameState.gameCost;
    
    // Reset all game state but preserve mode info
    gameState.gameId = null;
    gameState.playerId = null;
    gameState.opponentId = null;
    gameState.currentGameState = null;
    gameState.playerCandies = [];
    gameState.opponentCandies = [];
    gameState.isPlayerTurn = false;
    gameState.gameStarted = false;
    gameState.gameEnded = false;
    
    // Clean up any additional timers
    if (gameState.turnTimer) {
        clearTimeout(gameState.turnTimer);
        gameState.turnTimer = null;
    }
    if (gameState.turnCountdown) {
        clearInterval(gameState.turnCountdown);
        gameState.turnCountdown = null;
    }
    if (gameState.gameTimer) {
        clearInterval(gameState.gameTimer);
        gameState.gameTimer = null;
    }
    
    // Clear any existing modals
    const existingModal = document.getElementById('game-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    console.log('🎮 Game state fully reset. Restarting mode:', currentMode);
    
    // Start appropriate game type based on current mode
    if (currentMode === 'ai' || currentMode === 'offline') {
        console.log('Restarting AI game with difficulty:', currentDifficulty);
        startAIGame(currentDifficulty || 'easy');
    } else if (currentMode === 'online') {
        console.log('Restarting online game in city:', currentCity);
        gameState.gameMode = 'online';
        gameState.selectedCity = currentCity;
        gameState.gameCost = currentCost;
        startGame(); // This will handle online game creation via API
    } else if (currentMode === 'friends') {
        console.log('Restarting friends game');
        gameState.gameMode = 'friends';
        startGame(); // This will handle friends game creation via API
    } else {
        // Default case - go back to difficulty selection for AI
        console.log('Unknown mode, returning to AI selection');
        showScreen('page7');
    }
}

function forfeitGame() {
    if (confirm('Are you sure you want to forfeit this game?')) {
        endGame(false, 'You forfeited the game.');
    }
}

function shareResult() {
    const won = gameState.gameEnded && document.querySelector('.result-display.win');
    const text = won ? 
        `🎉 I just won a game of Poisoned Candy Duel! Collected ${gameState.playerCollection.length}/11 candies!` :
        `💔 Just played Poisoned Candy Duel. Got ${gameState.playerCollection.length}/11 candies before losing.`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Poisoned Candy Duel',
            text: text,
            url: window.location.href
        });
    } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(text).then(() => {
            alert('Result copied to clipboard!');
        });
    }
}

// ===== LEADERBOARD =====
function loadLeaderboard() {
    // Mock leaderboard data - in real app this would come from backend
    const leaderboardData = {
        wins: [
            { name: 'CandyMaster', wins: 45, games: 67 },
            { name: 'SweetVictory', wins: 38, games: 52 },
            { name: 'PoisonPro', wins: 32, games: 48 },
            { name: gameState.playerName, wins: gameState.stats.wins, games: gameState.stats.totalGames },
            { name: 'TacticalTreats', wins: 28, games: 41 }
        ],
        winrate: [
            { name: 'PerfectPlayer', wins: 15, games: 15 },
            { name: 'AlmostPerfect', wins: 29, games: 31 },
            { name: 'CandyGenius', wins: 22, games: 25 },
            { name: gameState.playerName, wins: gameState.stats.wins, games: gameState.stats.totalGames },
            { name: 'StrategyKing', wins: 35, games: 42 }
        ],
        streak: [
            { name: 'OnFire', streak: 12 },
            { name: 'Unstoppable', streak: 8 },
            { name: 'WinMachine', streak: 7 },
            { name: gameState.playerName, streak: 0 }, // Would track actual streak
            { name: 'LuckyStreak', streak: 5 }
        ]
    };
    
    showLeaderboardTab('wins', leaderboardData);
}

function showLeaderboardTab(tab, data = null) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event?.target?.classList.add('active');
    
    // Mock data if not provided
    if (!data) {
        loadLeaderboard();
        return;
    }
    
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '';
    
    let entries = [];
    switch(tab) {
        case 'wins':
            entries = data.wins.sort((a, b) => b.wins - a.wins);
            break;
        case 'winrate':
            entries = data.winrate
                .filter(entry => entry.games > 0)
                .sort((a, b) => (b.wins/b.games) - (a.wins/a.games));
            break;
        case 'streak':
            entries = data.streak.sort((a, b) => b.streak - a.streak);
            break;
    }
    
    entries.slice(0, 10).forEach((entry, index) => {
        const entryElement = document.createElement('div');
        entryElement.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: ${entry.name === gameState.playerName ? 'rgba(255, 107, 107, 0.1)' : 'white'};
            border-radius: 0.75rem;
            border: ${entry.name === gameState.playerName ? '2px solid var(--primary-color)' : '1px solid var(--gray-200)'};
        `;
        
        let statText = '';
        switch(tab) {
            case 'wins':
                statText = `${entry.wins} wins (${entry.games} games)`;
                break;
            case 'winrate':
                const winRate = entry.games > 0 ? Math.round((entry.wins/entry.games) * 100) : 0;
                statText = `${winRate}% (${entry.wins}/${entry.games})`;
                break;
            case 'streak':
                statText = `${entry.streak} game streak`;
                break;
        }
        
        entryElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-color);">#${index + 1}</span>
                <span style="font-weight: 600;">${entry.name}</span>
            </div>
            <span style="color: var(--gray-600);">${statText}</span>
        `;
        
        leaderboardList.appendChild(entryElement);
    });
}

// ===== REMOVED CONFLICTING INITIALIZATION =====
// This conflicting initialization was causing blank screen issues
// The proper initialization is handled later in the file

// ===== MISSING FUNCTIONS FOR MENU FUNCTIONALITY =====

// Online game starter from city selection
function startOnlineGame(city, cost) {
    console.log(`Starting online game in ${city} for ${cost} coins`);
    
    // Check if player has enough coins
    let currentCoins = parseInt(localStorage.getItem('playerCoins') || '1000');
    if (currentCoins < cost) {
        createModal(
            '💰 Insufficient Coins',
            `<div class="text-center">
                <p class="text-lg mb-4">You need ${cost} coins to play in ${city}</p>
                <p class="text-gray-600">Current balance: ${currentCoins} coins</p>
            </div>`,
            [
                { text: 'OK', action: closeModal, class: 'btn-primary' }
            ]
        );
        return;
    }
    
    // Deduct coins
    currentCoins -= cost;
    localStorage.setItem('playerCoins', currentCoins.toString());
    
    // Update coins display
    const coinsElement = document.getElementById('coins-count');
    if (coinsElement) {
        coinsElement.textContent = currentCoins;
    }
    
    // Set game mode
    gameState.gameMode = 'online';
    gameState.selectedCity = city;
    gameState.gameCost = cost;
    
    // Initialize player name if not set
    if (!gameState.playerName) {
        gameState.playerName = 'Player 1';
    }
    
    console.log('Online game setup complete, starting game creation...');
    
    // Initialize game setup
    setTimeout(() => {
        startGame(); // This will handle online game creation via API
    }, 300);
}

// Help function
function showHelp() {
    const helpModal = createModal('Help & Instructions', `
        <div style="text-align: left; max-height: 400px; overflow-y: auto;">
            <h3>🎯 How to Play</h3>
            <p><strong>Objective:</strong> Collect 11 candies before your opponent while avoiding poison!</p>
            
            <h3>🍬 Game Rules</h3>
            <ul>
                <li>Each player starts with 16 random candies</li>
                <li>Before the game starts, pick one candy as your "poison"</li>
                <li>Take turns picking candies from your opponent's collection</li>
                <li>If you pick your own poison candy, you lose immediately!</li>
                <li>First player to collect 11 candies wins</li>
            </ul>
            
            <h3>🎮 Controls</h3>
            <ul>
                <li><strong>Click:</strong> Select candy or poison</li>
                <li><strong>Confirm:</strong> Lock in your poison selection</li>
                <li><strong>Pick:</strong> Choose opponent's candy during your turn</li>
            </ul>
            
            <h3>💡 Strategy Tips</h3>
            <ul>
                <li>Choose a common candy as poison to increase chances opponent picks it</li>
                <li>Remember which candies you've already picked</li>
                <li>Pay attention to opponent's picking patterns</li>
            </ul>
        </div>
    `);
}

// Poison picking function for game screen
function pickPoison() {
    if (!gameState.selectedPoison) {
        showNotification('Please select a poison candy first!', 'warning');
        return;
    }
    
    confirmPoison();
}

// Create modal utility function
function createModal(title, content, buttons = []) {
    // Remove existing modal if any
    const existingModal = document.getElementById('game-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'game-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: var(--radius-xl);
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: var(--shadow-2xl);
    `;
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 style="margin: 0; color: var(--primary);">${title}</h2>
            <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500);">×</button>
        </div>
        <div>${content}</div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
            ${buttons.length > 0 ? buttons.map(btn => `<button class="btn ${btn.class || 'btn-secondary'}" onclick="${btn.onclick}">${btn.text}</button>`).join('') : '<button class="btn btn-primary" onclick="closeModal()">Close</button>'}
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    return modal;
}

function closeModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
        modal.remove();
    }
}

// ===== ADDITIONAL MISSING FUNCTIONS =====

// AI Game Functions
function startAIGame(difficulty) {
    console.log(`🎮 Starting AI game with difficulty: ${difficulty}`);
    
    // Force initialize gameState if needed
    if (!gameState) {
        gameState = new GameState();
    }
    
    // Set up game immediately
    gameState.gameMode = 'offline';
    gameState.aiDifficulty = difficulty;
    gameState.playerName = 'Player';
    
    // Create candy arrays immediately
    gameState.playerCandies = ['🍭', '🍪', '🍫', '🧁', '🍰', '🍯', '🍮', '🍬', '🍩', '🎂', '🍊', '🍎'];
    gameState.opponentCandies = ['🍇', '🍓', '🥭', '🍌', '🍒', '🥝', '🍑', '🍈', '🍉', '🍐', '🥥', '🍍'];
    gameState.playerCollection = [];
    gameState.opponentCollection = [];
    
    // Reset game state
    gameState.selectedPoison = null; // User must select
    gameState.opponentPoison = gameState.opponentCandies[0]; // AI poison is set
    gameState.gameStarted = false; // Not started until poison selected
    gameState.gameEnded = false;
    gameState.isPlayerTurn = true;
    
    console.log('✅ Game initialized - going to poison selection');
    
    // Go to poison selection first
    showScreen('page4');
    initializePoisonSelection();
    
    // Close any modal
    if (typeof closeModal === 'function') {
        closeModal();
    }
}

// Ensure required game elements exist
function ensureGameElementsExist() {
    const gameContainer = document.getElementById('page3');
    if (!gameContainer) {
        console.error('Game container not found');
        return;
    }
    
    // Create a comprehensive game interface for offline mode
    if (!document.getElementById('poison-candy-grid')) {
        createOfflineGameInterface();
    }
    
    const requiredElements = [
        'player1-grid', 'player2-grid', 
        'player1-status', 'player2-status',
        'player1-progress', 'player2-progress',
        'poison-candy-grid', 'player-candy-grid', 'opponent-candy-grid',
        'player-collection-grid', 'opponent-collection-grid',
        'turn-indicator', 'game-status-text', 'game-progress',
        'player-collection-count', 'opponent-collection-count'
    ];
    
    requiredElements.forEach(id => {
        let element = document.getElementById(id);
        if (!element) {
            console.log(`Creating missing element: ${id}`);
            element = document.createElement('div');
            element.id = id;
            element.innerHTML = 'Loading...';
            element.style.display = 'none'; // Hide created elements initially
            gameContainer.appendChild(element);
        }
    });
}

// Create a simplified offline game interface
function createOfflineGameInterface() {
    const gameContainer = document.getElementById('page3');
    if (!gameContainer) return;
    
    // Create poison selection modal
    const poisonModal = document.createElement('div');
    poisonModal.id = 'poison-selection-modal';
    poisonModal.style.display = 'none';
    poisonModal.style.position = 'fixed';
    poisonModal.style.top = '0';
    poisonModal.style.left = '0';
    poisonModal.style.width = '100%';
    poisonModal.style.height = '100%';
    poisonModal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    poisonModal.style.zIndex = '9999';
    poisonModal.style.justifyContent = 'center';
    poisonModal.style.alignItems = 'center';
    
    poisonModal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; text-align: center;">
            <h3 style="margin-bottom: 20px; color: #333;">🧪 Select Your Poison</h3>
            <p style="margin-bottom: 20px; color: #666;">Choose a candy from your collection to poison:</p>
            <div id="poison-candy-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 10px; margin-bottom: 20px;"></div>
            <button id="confirm-poison-btn" style="padding: 12px 24px; border: none; border-radius: 6px; background: #007bff; color: white; font-size: 16px; cursor: pointer;" disabled>Confirm Poison</button>
        </div>
    `;
    document.body.appendChild(poisonModal);
    
    // Create game grids if they don't exist
    const gameGridsHTML = `
        <div id="offline-game-interface" style="display: none; padding: 20px; background: white; border-radius: 12px; margin: 20px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div id="turn-indicator" style="font-size: 18px; font-weight: bold; color: #007bff; margin-bottom: 10px;">Your Turn</div>
                <div id="game-status-text" style="color: #666;">Choose a candy from opponent's collection</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px;">
                <div>
                    <h4 style="text-align: center; color: #333; margin-bottom: 15px;">🎯 Opponent's Candies</h4>
                    <div style="text-align: center; margin-bottom: 10px;">
                        <small style="color: #666;">Pick from here - avoid the poison!</small>
                    </div>
                    <div id="opponent-candy-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 15px; background: #f8f9fa; border-radius: 8px; min-height: 200px;"></div>
                </div>
                
                <div>
                    <h4 style="text-align: center; color: #333; margin-bottom: 15px;">🏠 Your Candies</h4>
                    <div style="text-align: center; margin-bottom: 10px;">
                        <small style="color: #666;">AI will pick from here</small>
                    </div>
                    <div id="player-candy-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 15px; background: #fff3cd; border-radius: 8px; min-height: 200px;"></div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div>
                    <h5 style="text-align: center; color: #333; margin-bottom: 15px;">🏆 Your Collection (<span id="player-collection-count">0</span>/11)</h5>
                    <div id="player-collection-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; padding: 10px; background: #d4edda; border-radius: 8px; min-height: 80px;"></div>
                </div>
                
                <div>
                    <h5 style="text-align: center; color: #333; margin-bottom: 15px;">🤖 AI Collection (<span id="opponent-collection-count">0</span>/11)</h5>
                    <div id="opponent-collection-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; padding: 10px; background: #f8d7da; border-radius: 8px; min-height: 80px;"></div>
                </div>
            </div>
            
            <div id="game-progress" style="display: none;"></div>
        </div>
    `;
    
    gameContainer.insertAdjacentHTML('beforeend', gameGridsHTML);
    
    console.log('Created offline game interface');
}

// Private Room Functions
function createPrivateRoom() {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    showNotification(`Room created! Code: ${roomCode}`, 'success');
    
    // Create modal and start friends game when ready
    createModal('Private Room Created', `
        <div class="text-center">
            <div class="text-6xl mb-4">🔗</div>
            <h3 class="text-xl font-bold mb-4">Your room is ready!</h3>
            <div class="bg-primary bg-opacity-10 rounded-lg p-4 mb-4">
                <div class="text-2xl font-bold font-mono text-primary">${roomCode}</div>
                <div class="text-sm text-gray-600">Share this code with your friend</div>
            </div>
            <p class="text-gray-600">Click "Start Game" to begin with poison selection</p>
        </div>
    `, [
        { text: 'Start Game', onclick: `startFriendsGameWithRoom('${roomCode}')`, class: 'btn-primary' },
        { text: 'Copy Code', onclick: `copyToClipboard('${roomCode}')`, class: 'btn-secondary' },
        { text: 'Cancel', onclick: 'closeModal()', class: 'btn-secondary' }
    ]);
}

// New function to start friends game with room code
function startFriendsGameWithRoom(roomCode) {
    closeModal();
    initializeFriendsGame(roomCode);
}

function joinPrivateRoom() {
    const roomCode = document.getElementById('room-code-input').value.trim();
    
    if (!roomCode) {
        showNotification('Please enter a room code!', 'warning');
        return;
    }
    
    if (roomCode.length !== 6) {
        showNotification('Room code must be 6 characters!', 'error');
        return;
    }
    
    showNotification(`Joining room ${roomCode}...`, 'info');
    
    // Initialize friends game mode properly
    initializeFriendsGame(roomCode);
}

// New function to properly initialize friends game
function initializeFriendsGame(roomCode = null) {
    console.log('🎮 Initializing friends game mode...');
    
    // Ensure gameState is initialized
    if (!gameState || typeof gameState.updateStats !== 'function') {
        console.log('GameState not ready, waiting...');
        setTimeout(() => initializeFriendsGame(roomCode), 100);
        return;
    }
    
    // Set game mode to friends
    gameState.gameMode = 'friends';
    gameState.roomCode = roomCode;
    
    // Initialize player name if not set
    if (!gameState.playerName) {
        gameState.playerName = 'Player 1';
    }
    
    // Initialize game data for friends mode
    gameState.playerCandies = getRandomCandies(12);
    gameState.opponentCandies = getRandomCandies(12);
    gameState.playerCollection = [];
    gameState.opponentCollection = [];
    gameState.isPlayerTurn = true;
    gameState.gameStarted = false; // Will be set to true after poison selection
    gameState.gameEnded = false;
    gameState.selectedPoison = null;
    gameState.opponentPoison = null;
    
    console.log('Friends game initialized with:');
    console.log('- Player candies:', gameState.playerCandies);
    console.log('- Opponent candies:', gameState.opponentCandies);
    console.log('- Game mode:', gameState.gameMode);
    console.log('- Room code:', gameState.roomCode);
    
    // **CRITICAL FIX: Start with poison selection like AI mode**
    showScreen('page4');
    initializePoisonSelection();
    
    // Show success message
    showNotification('Joined room successfully! Select your poison to begin.', 'success');
    
    if (typeof closeModal === 'function') {
        closeModal();
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Code copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy code', 'error');
    });
}

// Rewards Functions
function claimDailyReward() {
    const lastClaim = localStorage.getItem('pcd_last_daily_claim');
    const today = new Date().toDateString();
    
    if (lastClaim === today) {
        showNotification('Daily reward already claimed today!', 'warning');
        return;
    }
    
    const coinsCount = parseInt(document.getElementById('coins-count').textContent);
    const newCoinsCount = coinsCount + 50;
    
    document.getElementById('coins-count').textContent = newCoinsCount;
    localStorage.setItem('pcd_coins', newCoinsCount.toString());
    localStorage.setItem('pcd_last_daily_claim', today);
    
    showNotification('Daily reward claimed! +50 coins', 'success');
}

// Leaderboard Functions
function showLeaderboard(type) {
    const content = document.getElementById('leaderboard-content');
    
    // Update button states
    document.querySelectorAll('#page10 .btn').forEach(btn => {
        btn.className = 'btn btn-secondary';
    });
    event.target.className = 'btn btn-primary';
    
    // Mock leaderboard data based on type
    let leaderboardData = [];
    
    switch(type) {
        case 'global':
            leaderboardData = [
                { rank: 1, name: 'CandyMaster2024', wins: 1247, points: 2350, winRate: 98.5, icon: '🥇' },
                { rank: 2, name: 'SweetTooth_Pro', wins: 892, points: 1890, winRate: 94.2, icon: '🥈' },
                { rank: 3, name: 'PoisonPicker', wins: 756, points: 1654, winRate: 91.8, icon: '🥉' }
            ];
            break;
        case 'weekly':
            leaderboardData = [
                { rank: 1, name: 'WeeklyChamp', wins: 45, points: 450, winRate: 90.0, icon: '🥇' },
                { rank: 2, name: 'QuickPlayer', wins: 38, points: 380, winRate: 86.4, icon: '🥈' },
                { rank: 3, name: 'CandyLover', wins: 32, points: 320, winRate: 84.2, icon: '🥉' }
            ];
            break;
        case 'friends':
            leaderboardData = [
                { rank: 1, name: 'You', wins: 12, points: 120, winRate: 75.0, icon: '🥇' },
                { rank: 2, name: 'Friend1', wins: 8, points: 80, winRate: 66.7, icon: '🥈' },
                { rank: 3, name: 'Friend2', wins: 5, points: 50, winRate: 55.6, icon: '🥉' }
            ];
            break;
    }
    
    content.innerHTML = `
        <div class="space-y-4">
            ${leaderboardData.map((player, index) => `
                <div class="flex items-center justify-between p-4 ${index === 0 ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-300' : index === 1 ? 'bg-gray-100' : 'bg-orange-100'} rounded-lg">
                    <div class="flex items-center space-x-4">
                        <div class="text-2xl">${player.icon}</div>
                        <div>
                            <div class="font-bold ${index === 0 ? 'text-yellow-800' : index === 2 ? 'text-orange-800' : ''}">${player.name}</div>
                            <div class="text-sm ${index === 0 ? 'text-yellow-600' : index === 2 ? 'text-orange-600' : 'text-gray-600'}">${player.wins} wins</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold ${index === 0 ? 'text-yellow-800' : index === 2 ? 'text-orange-800' : ''}">${player.points} pts</div>
                        <div class="text-sm ${index === 0 ? 'text-yellow-600' : index === 2 ? 'text-orange-600' : 'text-gray-600'}">${player.winRate}% win rate</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Profile Settings Functions
function toggleSound() {
    const soundEnabled = localStorage.getItem('pcd_sound_enabled') !== 'false';
    localStorage.setItem('pcd_sound_enabled', (!soundEnabled).toString());
    
    showNotification(`Sound effects ${!soundEnabled ? 'enabled' : 'disabled'}`, 'info');
    
    // Update button text
    event.target.textContent = `🔊 Sound Effects ${!soundEnabled ? 'ON' : 'OFF'}`;
}

function toggleMusic() {
    const musicEnabled = localStorage.getItem('pcd_music_enabled') !== 'false';
    localStorage.setItem('pcd_music_enabled', (!musicEnabled).toString());
    
    showNotification(`Background music ${!musicEnabled ? 'enabled' : 'disabled'}`, 'info');
    
    // Update button text
    event.target.textContent = `🎵 Background Music ${!musicEnabled ? 'ON' : 'OFF'}`;
}

function resetStats() {
    createModal('Reset Statistics', `
        <div class="text-center">
            <div class="text-6xl mb-4">⚠️</div>
            <p class="text-gray-600 mb-4">Are you sure you want to reset all your game statistics? This action cannot be undone.</p>
        </div>
    `, [
        { text: 'Reset', onclick: 'confirmResetStats()', class: 'btn-danger' },
        { text: 'Cancel', onclick: 'closeModal()', class: 'btn-secondary' }
    ]);
}

function confirmResetStats() {
    localStorage.removeItem('pcd_total_games');
    localStorage.removeItem('pcd_wins');
    localStorage.removeItem('pcd_losses');
    
    gameState.stats = {
        totalGames: 0,
        wins: 0,
        losses: 0
    };
    
    gameState.updateStats();
    
    showNotification('Statistics reset successfully!', 'success');
    closeModal();
}

// Currency display initialization will be handled in main DOMContentLoaded

// ===== POISON SELECTION IN GAME SCREEN =====
function initializePoisonSelectionInGame() {
    // Use player1-grid for poison selection
    const candyGrid = document.getElementById('player1-grid');
    candyGrid.innerHTML = '';
    candyGrid.style.display = 'block';
    candyGrid.style.position = 'relative';
    
    // Use player's owned candies for poison selection
    const playerCandies = gameState.playerCandies || [];
    console.log('Player candies for poison selection:', playerCandies);
    
    // Create a header for poison selection
    const header = document.createElement('div');
    header.className = 'text-center mb-2 p-2 bg-warning bg-opacity-10 rounded-lg';
    header.innerHTML = `
        <h4 class="font-display font-bold text-warning mb-2">🔍 Select Your Poison</h4>
        <p class="text-sm text-gray-600">Choose which candy to use as your poison</p>
    `;
    candyGrid.appendChild(header);
    
    // Create a grid container for candies
    const gridContainer = document.createElement('div');
    gridContainer.className = 'candy-grid';
    
    playerCandies.forEach((candy, index) => {
        const candyElement = document.createElement('div');
        candyElement.className = 'candy-item';
        candyElement.textContent = candy;
        candyElement.dataset.index = index;
        candyElement.dataset.candy = candy;
        
        candyElement.addEventListener('click', () => selectPoisonInGame(candy, index, candyElement));
        
        gridContainer.appendChild(candyElement);
    });
    
    candyGrid.appendChild(gridContainer);
    
    // Update game status
    document.getElementById('player1-status').textContent = 'Selecting Poison...';
    document.getElementById('player2-status').textContent = 'Waiting...';
    
    // Update button states
    const pickPoisonBtn = document.getElementById('pick-poison-btn');
    pickPoisonBtn.textContent = 'Confirm Poison';
    pickPoisonBtn.disabled = true;
    pickPoisonBtn.onclick = confirmPoisonInGame;
    
    // Disable start game button
    document.getElementById('start-game-btn').disabled = true;
    
    gameState.selectedPoison = null;
}

function selectPoisonInGame(candy, index, element) {
    // Remove previous selection
    document.querySelectorAll('.candy-item.selected').forEach(item => {
        item.classList.remove('selected', 'border-warning', 'bg-warning', 'bg-opacity-20');
    });
    
    // Select new poison
    element.classList.add('selected', 'border-warning', 'bg-warning', 'bg-opacity-20');
    gameState.selectedPoison = candy;
    
    // Update status
    document.getElementById('player1-status').textContent = `Poison: ${candy}`;
    
    // Enable confirm button
    document.getElementById('pick-poison-btn').disabled = false;
}

async function confirmPoisonInGame() {
    if (!gameState.selectedPoison) return;
    
    try {
        // Send poison choice to backend with correct field names
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/poison`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player_id: gameState.playerId,
                poison_candy: gameState.selectedPoison
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error('Failed to set poison');
        }
        
        const result = await response.json();
        console.log('Poison set result:', result);
        
        if (result.success) {
            // Update game state
            gameState.currentGameState = result.data.game_state;
            gameState.isPlayerTurn = true; // Player 1 typically starts
            
            // Initialize the actual game board
            initializeGameBoardInPage();
            
            // Start turn timer if applicable
            if (gameState.isPlayerTurn) {
                startTurnTimer();
            }
        } else {
            throw new Error(result.message || 'Failed to set poison');
        }
        
    } catch (error) {
        console.error('Error setting poison:', error);
        alert('Failed to set poison. Please try again.');
    }
}

function initializeGameBoardInPage() {
    console.log('🎮 Initializing game board in page3...');
    console.log('Player candies:', gameState.playerCandies);
    console.log('Opponent candies:', gameState.opponentCandies);
    console.log('Player collection:', gameState.playerCollection);
    console.log('Opponent collection:', gameState.opponentCollection);
    
    // CRITICAL: Ensure candy arrays exist - if not, generate them
    if (!gameState.playerCandies || gameState.playerCandies.length === 0) {
        console.warn('⚠️ Player candies missing! Generating new ones...');
        gameState.playerCandies = getRandomCandies(12);
        console.log('✅ Generated player candies:', gameState.playerCandies);
    }
    
    if (!gameState.opponentCandies || gameState.opponentCandies.length === 0) {
        console.warn('⚠️ Opponent candies missing! Generating new ones...');
        gameState.opponentCandies = getRandomCandies(12);
        console.log('✅ Generated opponent candies:', gameState.opponentCandies);
    }
    
    // Initialize collections if they don't exist
    if (!gameState.playerCollection) {
        gameState.playerCollection = [];
        console.log('✅ Initialized player collection');
    }
    if (!gameState.opponentCollection) {
        gameState.opponentCollection = [];
        console.log('✅ Initialized opponent collection');
    }
    
    // Update player-candy-grid with player's candies (for display only)
    const playerCandyGrid = document.getElementById('player-candy-grid');
    if (playerCandyGrid) {
        playerCandyGrid.innerHTML = '';
        console.log('🏠 Populating player candy grid with', gameState.playerCandies.length, 'candies');
    
        gameState.playerCandies.forEach((candy, index) => {
            // **FIXED: No need to skip - we show what's actually in player's pool**
            // (AI picks from this pool, so it shrinks as AI picks candies)
            
            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;
            candyElement.style.cursor = 'default';
            
            // Enhanced styling for player candies (only for remaining ones)
            candyElement.style.cssText = `
                padding: 15px;
                font-size: 28px;
                text-align: center;
                background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
                border: 3px solid #22C55E;
                border-radius: 12px;
                cursor: default;
                user-select: none;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                box-shadow: 0 3px 10px rgba(34, 197, 94, 0.3);
                margin: 4px;
                transition: all 0.3s ease;
            `;
            
            // Highlight poison candy
            if (candy === gameState.selectedPoison) {
                candyElement.classList.add('bg-danger', 'bg-opacity-20', 'border-danger');
                candyElement.style.border = '3px solid #EF4444';
                candyElement.style.background = 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)';
                candyElement.style.boxShadow = '0 3px 15px rgba(239, 68, 68, 0.5)';
                candyElement.style.fontWeight = 'bold';
                candyElement.title = 'Your Poison ☠️';
                
                // Add pulsing animation for poison
                const poisonGlow = setInterval(() => {
                    candyElement.style.boxShadow = candyElement.style.boxShadow.includes('0.5') 
                        ? '0 3px 15px rgba(239, 68, 68, 0.8)' 
                        : '0 3px 15px rgba(239, 68, 68, 0.5)';
                }, 1000);
            }
            
            playerCandyGrid.appendChild(candyElement);
        });
        
        console.log('✅ Player candy grid populated with', playerCandyGrid.children.length, 'candies');
    } else {
        console.error('❌ Player candy grid not found!');
    }
    
    // Update opponent-candy-grid with opponent's remaining candies (clickable)
    const opponentCandyGrid = document.getElementById('opponent-candy-grid');
    if (opponentCandyGrid) {
        opponentCandyGrid.innerHTML = '';
        console.log('🎯 Populating opponent candy grid with', gameState.opponentCandies.length, 'candies');
    
        gameState.opponentCandies.forEach((candy, index) => {
            // **FIXED: No need to skip - we show what's actually in opponent's pool**
            // (Player picks from this pool, so it shrinks as player picks candies)
            
            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;
            
            // Enhanced styling for opponent candies (only for remaining ones)
            candyElement.style.cssText = `
                padding: 18px;
                font-size: 32px;
                text-align: center;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                border: 3px solid #F59E0B;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                user-select: none;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
                margin: 4px;
                position: relative;
            `;
            
            if (gameState.isPlayerTurn && !gameState.gameEnded) {
                // Available for clicking
                candyElement.style.cursor = 'pointer';
                
                // Add enhanced hover effects
                candyElement.addEventListener('mouseenter', function() {
                    this.style.background = 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)';
                    this.style.borderColor = '#D97706';
                    this.style.transform = 'scale(1.15) translateY(-2px)';
                    this.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.5)';
                    this.style.zIndex = '10';
                });
                
                candyElement.addEventListener('mouseleave', function() {
                    this.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)';
                    this.style.borderColor = '#F59E0B';
                    this.style.transform = 'scale(1) translateY(0)';
                    this.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                    this.style.zIndex = '1';
                });
                
                // Add click handler for offline mode
                if (gameState.gameMode === 'offline') {
                    candyElement.addEventListener('click', () => handleOfflineCandyPick(candy, index));
                } else {
                    candyElement.addEventListener('click', () => pickCandyFromOpponent(candy, index, candyElement));
                }
            } else {
                // Not player's turn
                candyElement.style.opacity = '0.75';
                candyElement.style.cursor = 'not-allowed';
                candyElement.title = 'Not your turn';
            }
            
            opponentCandyGrid.appendChild(candyElement);
        });
        
        console.log('✅ Opponent candy grid populated with', opponentCandyGrid.children.length, 'candies');
    } else {
        console.error('❌ Opponent candy grid not found!');
    }
    
    // **STEP 4 FIX: REMOVE COLLECTION GRIDS - Hide collection trays**
    const playerCollectionGrid = document.getElementById('player-collection-grid');
    if (playerCollectionGrid) {
        playerCollectionGrid.style.display = 'none'; // Hide player collection tray
        console.log('✅ Player collection grid hidden');
    }
    
    const opponentCollectionGrid = document.getElementById('opponent-collection-grid');
    if (opponentCollectionGrid) {
        opponentCollectionGrid.style.display = 'none'; // Hide opponent collection tray
        console.log('✅ Opponent collection grid hidden');
    }
    
    // Update progress indicators
    const player1Progress = document.getElementById('player1-progress');
    const player2Progress = document.getElementById('player2-progress');
    
    if (player1Progress) {
        const playerCount = gameState.playerCollection ? gameState.playerCollection.length : 0;
        player1Progress.textContent = `(${playerCount}/11)`;
    }
    
    if (player2Progress) {
        const opponentCount = gameState.opponentCollection ? gameState.opponentCollection.length : 0;
        player2Progress.textContent = `(${opponentCount}/11)`;
    }
    
    // Update turn indicator
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) {
        if (gameState.isPlayerTurn) {
            turnIndicator.textContent = 'Your Turn';
            turnIndicator.style.color = '#22C55E';
        } else {
            turnIndicator.textContent = 'Opponent\'s Turn';
            turnIndicator.style.color = '#EF4444';
        }
    }
    
    // Update game status
    const gameStatusText = document.getElementById('game-status-text');
    if (gameStatusText) {
        if (gameState.isPlayerTurn) {
            gameStatusText.textContent = 'Pick a candy from opponent\'s collection';
        } else {
            gameStatusText.textContent = 'Waiting for opponent...';
        }
    }
    
    console.log('✅ Game board initialization complete!');
    console.log('Final state:', {
        playerCandies: gameState.playerCandies?.length || 0,
        opponentCandies: gameState.opponentCandies?.length || 0,
        playerCollection: gameState.playerCollection?.length || 0,
        opponentCollection: gameState.opponentCollection?.length || 0,
        playerGridChildren: playerCandyGrid?.children.length || 0,
        opponentGridChildren: opponentCandyGrid?.children.length || 0
    });
}

async function pickCandyFromOpponent(candy, index, element) {
    if (!gameState.isPlayerTurn || gameState.gameEnded) return;
    
    // Stop turn timer when player makes a move
    stopTurnTimer();
    
    try {
        // Send pick choice to backend
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/pick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player: 'player1',
                candy_choice: candy
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error('Failed to pick candy');
        }
        
        const result = await response.json();
        console.log('Pick result:', result);
        
        if (result.success) {
            // Update game state
            gameState.currentGameState = result.data.game_state;
            
            // Update collections from game state
            gameState.playerCollection = result.data.game_state.player1.collected_candies || [];
            gameState.opponentCollection = result.data.game_state.player2.collected_candies || [];
            
            console.log('Updated collections - Player:', gameState.playerCollection, 'Opponent:', gameState.opponentCollection);
            
            // Make the picked candy disappear immediately
            element.style.opacity = '0.3';
            element.style.transform = 'scale(0.8)';
            element.classList.add('collected', 'cursor-not-allowed');
            element.removeEventListener('click', pickCandyFromOpponent);
            element.title = 'Collected!';
            
            // Check if game is over
            if (result.data.game_state.game_over) {
                const winner = result.data.game_state.winner;
                const playerWon = winner === gameState.playerId;
                handleGameEndInPage(playerWon, result.data.game_state.message || 'Game Over');
            } else {
                // Update turn
                gameState.isPlayerTurn = false;
                
                // Refresh the board after a short delay to show the collection
                setTimeout(() => {
                    initializeGameBoardInPage();
                    
                    // Wait for AI move
                    setTimeout(() => {
                        checkForAIMoveInPage();
                    }, 1000);
                }, 500);
            }
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Error picking candy:', error);
        alert('Failed to pick candy. Please try again.');
    }
}

async function checkForAIMoveInPage() {
    if (gameState.isPlayerTurn || gameState.gameEnded) return;
    
    try {
        // Check game state for AI move
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get game state');
        }
        
        const result = await response.json();
        console.log('Game state check:', result);
        
        if (result.success) {
            gameState.currentGameState = result.data.game_state;
            
            // Update collections from game state
            gameState.playerCollection = result.data.game_state.player1.collected_candies || [];
            gameState.opponentCollection = result.data.game_state.player2.collected_candies || [];
            
            console.log('AI move - Updated collections - Player:', gameState.playerCollection, 'Opponent:', gameState.opponentCollection);
            
            // Check if game is over
            if (result.data.game_state.game_over) {
                const winner = result.data.game_state.winner;
                const playerWon = winner === gameState.playerId;
                handleGameEndInPage(playerWon, result.data.game_state.message || 'Game Over');
            } else {
                // Update turn back to player
                gameState.isPlayerTurn = true;
                
                // Refresh the board
                initializeGameBoardInPage();
                
                // Start timer for player's turn
                startTurnTimer();
            }
        }
        
    } catch (error) {
        console.error('Error checking AI move:', error);
        // Retry after a delay
        setTimeout(() => {
            checkForAIMoveInPage();
        }, 2000);
    }
}

function handleGameEndInPage(playerWon, message) {
    gameState.gameEnded = true;
    
    // Update status displays
    if (playerWon) {
        document.getElementById('player1-status').textContent = '🎉 You Won!';
        document.getElementById('player2-status').textContent = '😞 AI Lost';
    } else {
        document.getElementById('player1-status').textContent = '😞 You Lost';
        document.getElementById('player2-status').textContent = '🎉 AI Won!';
    }
    
    // Show game over modal
    setTimeout(() => {
        createModal(
            playerWon ? '🎉 Victory!' : '😞 Game Over',
            `<div class="text-center">
                <p class="text-lg mb-4">${message}</p>
                <div class="text-sm text-gray-600">
                    <p>Game ID: ${gameState.gameId.substring(0, 8)}</p>
                </div>
            </div>`,
            [
                { text: 'Play Again', action: () => { closeModal(); startNewGameNew(); }, class: 'btn-primary' },
                { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
            ]
        );
    }, 1500);
    
    // Update stats
    gameState.updateStats();
    gameState.recordGameResult(playerWon);
}

// Timer functions are defined earlier in the file

// ===== GLOBAL INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎮 PCD Game - DOM Content Loaded');
    
    // Initialize global game state
    if (!gameState || typeof gameState.updateStats !== 'function') {
        gameState = new GameState();
        console.log('✅ Game state initialized');
    }
    
    // Initialize sound manager safely (skip if not available)
    try {
        if (typeof SoundManager !== 'undefined' && typeof soundManager === 'undefined') {
            window.soundManager = new SoundManager();
            console.log('✅ Sound manager initialized');
        } else {
            console.log('ℹ️ Sound manager not available, continuing without sound');
        }
    } catch (error) {
        console.log('ℹ️ Sound manager initialization skipped:', error.message);
    }
    
    // Show the main menu by default
    showScreen('page1');
    
    // Update stats display
    gameState.updateStats();
    
    // Initialize saved preferences
    const savedCoins = localStorage.getItem('playerCoins') || localStorage.getItem('pcd_coins') || '1000';
    const savedDiamonds = localStorage.getItem('playerDiamonds') || localStorage.getItem('pcd_diamonds') || '50';
    
    // Update coin/diamond displays if elements exist
    const coinsElement = document.getElementById('coins-count');
    const diamondsElement = document.getElementById('diamonds-count');
    
    if (coinsElement) coinsElement.textContent = savedCoins;
    if (diamondsElement) diamondsElement.textContent = savedDiamonds;
    
    console.log('🎯 PCD Game initialization complete!');
});

// Fallback initialization for immediate access
if (document.readyState === 'loading') {
    // DOM not ready yet, the DOMContentLoaded listener will handle initialization
    console.log('⏳ Waiting for DOM to load...');
} else {
    // DOM is already ready, initialize immediately
    console.log('🚀 DOM already loaded, initializing immediately...');
    
    if (!gameState || typeof gameState.updateStats !== 'function') {
        gameState = new GameState();
    }
    
    // Show main menu
    setTimeout(() => {
        showScreen('page1');
    }, 100);
}

// ===== TURN TIMER FUNCTIONALITY =====
function startTurnTimer() {
    // Only show timer for online and friends modes
    if (gameState.gameMode !== 'online' && gameState.gameMode !== 'friends') {
        return;
    }
    
    // Don't start timer if it's not the player's turn
    if (!gameState.isPlayerTurn || gameState.gameEnded) {
        return;
    }
    
    console.log('Starting turn timer for', gameState.gameMode, 'mode');
    
    gameState.turnTimeRemaining = 10;
    
    // Show timer displays
    const timerDisplay = document.getElementById('turn-timer-display');
    const timerOverlay = document.getElementById('turn-timer-overlay');
    const timerSeconds = document.getElementById('turn-timer-seconds');
    const timerCountdown = document.getElementById('timer-countdown');
    
    if (timerDisplay) timerDisplay.style.display = 'block';
    if (timerOverlay) timerOverlay.style.display = 'flex';
    if (timerCountdown) timerCountdown.style.display = 'block';
    
    // Clear any existing timer
    if (gameState.turnTimer) {
        clearInterval(gameState.turnTimer);
    }
    if (gameState.turnCountdown) {
        clearInterval(gameState.turnCountdown);
    }
    
    // Update display
    updateTimerDisplay();
    
    // Start countdown
    gameState.turnTimer = setInterval(() => {
        gameState.turnTimeRemaining--;
        updateTimerDisplay();
        
        if (gameState.turnTimeRemaining <= 0) {
            handleTimerExpired();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerSeconds = document.getElementById('turn-timer-seconds');
    const timerCountdown = document.getElementById('timer-countdown');
    
    if (timerSeconds) {
        timerSeconds.textContent = gameState.turnTimeRemaining;
    }
    if (timerCountdown) {
        timerCountdown.textContent = gameState.turnTimeRemaining;
    }
    
    // Add warning colors for low time
    const timerElements = [timerSeconds, timerCountdown];
    timerElements.forEach(element => {
        if (element) {
            element.className = gameState.turnTimeRemaining <= 3 ? 'timer-warning' : 'timer-normal';
        }
    });
}

function stopTurnTimer() {
    // Clear timers
    if (gameState.turnTimer) {
        clearInterval(gameState.turnTimer);
        gameState.turnTimer = null;
    }
    if (gameState.turnCountdown) {
        clearInterval(gameState.turnCountdown);
        gameState.turnCountdown = null;
    }
    
    // Hide timer displays
    const timerDisplay = document.getElementById('turn-timer-display');
    const timerOverlay = document.getElementById('turn-timer-overlay');
    const timerCountdown = document.getElementById('timer-countdown');
    
    if (timerDisplay) timerDisplay.style.display = 'none';
    if (timerOverlay) timerOverlay.style.display = 'none';
    if (timerCountdown) timerCountdown.style.display = 'none';
}

function handleTimerExpired() {
    console.log('Turn timer expired');
    stopTurnTimer();
    
    // Force end turn or make random move
    if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
        // For online games, forfeit or make random move
        alert('Time expired! Making random move...');
        makeRandomMove();
    }
}

function makeRandomMove() {
    // Find available candies and make a random pick
    const opponentCandyGrid = document.getElementById('opponent-candy-grid');
    if (opponentCandyGrid) {
        const availableCandies = opponentCandyGrid.querySelectorAll('.candy-item:not(.collected)');
        if (availableCandies.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCandies.length);
            const randomCandy = availableCandies[randomIndex];
            randomCandy.click();
        }
    }
}

// ===== 30-SECOND PER-TURN TIMER (FIXED) =====
let turnTimerInterval = null;
let turnTimeRemaining = 30;

function startGameTimer() {
    console.log('⏰ Starting 30-second PER-TURN timer...');
    
    // **STEP 1 & 2 FIX: This is now a per-turn timer for ALL game modes**
    // Reset timer for this turn
    turnTimeRemaining = 30;
    
    // Clear any existing timer
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
    }
    
    // Update timer display initially
    updateGameTimerDisplay();
    
    // Start countdown for this turn
    turnTimerInterval = setInterval(() => {
        turnTimeRemaining--;
        updateGameTimerDisplay();
        
        // Warning at 10 seconds
        if (turnTimeRemaining === 10) {
            showNotification('⚠️ Only 10 seconds left for this turn!', 'warning', 2000);
        }
        
        // Warning at 5 seconds
        if (turnTimeRemaining === 5) {
            showNotification('🚨 5 seconds remaining for this turn!', 'error', 2000);
        }
        
        // Time's up for this turn!
        if (turnTimeRemaining <= 0) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
            handleTurnTimeout();
        }
    }, 1000);
    
    const currentPlayer = gameState.isPlayerTurn ? 'Your' : 'Opponent\'s';
    showNotification(`⏰ ${currentPlayer} turn - 30 seconds!`, 'info', 1500);
}

function stopGameTimer() {
    console.log('⏰ Stopping turn timer...');
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
    turnTimeRemaining = 30;
    updateGameTimerDisplay();
}

function updateGameTimerDisplay() {
    const timerElement = document.getElementById('game-timer');
    if (timerElement) {
        const minutes = Math.floor(turnTimeRemaining / 60);
        const seconds = turnTimeRemaining % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color based on time remaining
        if (turnTimeRemaining <= 5) {
            timerElement.style.color = '#ef4444'; // Red
            timerElement.style.animation = 'pulse 1s infinite';
        } else if (turnTimeRemaining <= 10) {
            timerElement.style.color = '#f59e0b'; // Orange
            timerElement.style.animation = 'none';
        } else {
            timerElement.style.color = '#059669'; // Green
            timerElement.style.animation = 'none';
        }
    }
}

function handleTurnTimeout() {
    console.log('⏰ Turn timer expired!');
    const currentPlayer = gameState.isPlayerTurn ? 'You' : 'Opponent';
    showNotification(`⏰ ${currentPlayer} ran out of time!`, 'error', 3000);
    
    // Current player loses for taking too long
    if (gameState.isPlayerTurn) {
        // Player loses the game for taking too long
        endGame(false, '⏰ You ran out of time! You lose!');
    } else {
        // AI/Opponent loses their turn, player wins
        endGame(true, '⏰ Opponent ran out of time! You win!');
    }
}

function handleGameTimeout() {
    console.log('⏰ Game timer expired!');
    showNotification('⏰ Time\'s up! You lose!', 'error', 3000);
    
    // End game with loss
    endGame(false, '⏰ Time ran out! You took too long to make your moves.');
}

// ===== HELPER FUNCTIONS FOR ENHANCED FEATURES =====
function clearAllSelections() {
    console.log('🧹 Clearing all selections...');
    
    // Clear poison selections
    document.querySelectorAll('.poison-option.selected, .candy-item.selected').forEach(element => {
        element.classList.remove('selected');
        element.style.backgroundColor = '#f8f9fa';
        element.style.border = '2px solid #ddd';
        element.style.transform = 'scale(1)';
    });
    
    // Clear poison display
    const poisonDisplay = document.getElementById('selected-poison-display');
    if (poisonDisplay) {
        poisonDisplay.innerHTML = '';
    }
    
    // Reset confirm button
    const confirmBtn = document.getElementById('confirm-poison-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
    }
    
    // Clear candy grids
    const grids = ['player-candy-grid', 'opponent-candy-grid', 'player-collection-grid', 'opponent-collection-grid', 'poison-candy-grid'];
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (grid) {
            grid.innerHTML = '';
        }
    });
}

function resetAllTimers() {
    console.log('⏰ Resetting all timers...');
    
    // Stop game timer
    stopGameTimer();
    
    // Stop turn timer
    stopTurnTimer();
    
    // Clear any other timers
    if (gameState.turnTimer) {
        clearTimeout(gameState.turnTimer);
        gameState.turnTimer = null;
    }
    if (gameState.turnCountdown) {
        clearInterval(gameState.turnCountdown);
        gameState.turnCountdown = null;
    }
    
    // Reset timer displays
    const gameTimer = document.getElementById('game-timer');
    if (gameTimer) {
        gameTimer.textContent = '00:30';
        gameTimer.style.color = '#059669';
        gameTimer.style.animation = 'none';
    }
    
    const turnTimer = document.getElementById('turn-timer-seconds');
    if (turnTimer) {
        turnTimer.textContent = '10';
    }
}

function updateScoreDisplay() {
    console.log('📊 Updating score display...');
    
    // Update player progress
    const player1Progress = document.getElementById('player1-progress');
    if (player1Progress) {
        const playerScore = gameState.playerCollection ? gameState.playerCollection.length : 0;
        player1Progress.textContent = `(${playerScore}/11)`;
    }
    
    // Update opponent progress  
    const player2Progress = document.getElementById('player2-progress');
    if (player2Progress) {
        const opponentScore = gameState.opponentCollection ? gameState.opponentCollection.length : 0;
        player2Progress.textContent = `(${opponentScore}/11)`;
    }
    
    // Update round counter
    const roundCounter = document.getElementById('round-counter');
    if (roundCounter) {
        const totalMoves = (gameState.playerCollection ? gameState.playerCollection.length : 0) + 
                          (gameState.opponentCollection ? gameState.opponentCollection.length : 0);
        roundCounter.textContent = totalMoves.toString();
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    console.log(`📢 Notification (${type}): ${message}`);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#059669';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        case 'info':
        default:
            notification.style.backgroundColor = '#3b82f6';
            break;
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// ===== PROPER OFFLINE GAME BOARD INITIALIZATION =====
function initializeOfflineGameBoard() {
    console.log('🎮 Creating playable game interface...');
    
    // Update opponent candy grid with clickable candies
    const opponentCandyGrid = document.getElementById('opponent-candy-grid');
    if (opponentCandyGrid) {
        opponentCandyGrid.innerHTML = '';
        
        gameState.opponentCandies.forEach((candy, index) => {
            // Skip if already collected (disappeared)
            if (gameState.playerCollection.includes(candy)) return;
            
            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.style.cssText = `
                padding: 12px;
                margin: 4px;
                border: 2px solid #ddd;
                border-radius: 8px;
                cursor: pointer;
                text-align: center;
                font-size: 20px;
                background: white;
                transition: all 0.2s;
            `;
            
            // Add hover effect
            candyElement.addEventListener('mouseenter', () => {
                candyElement.style.backgroundColor = '#e3f2fd';
                candyElement.style.transform = 'scale(1.05)';
            });
            
            candyElement.addEventListener('mouseleave', () => {
                candyElement.style.backgroundColor = 'white';
                candyElement.style.transform = 'scale(1)';
            });
            
            // Add click handler for picking candy
            candyElement.onclick = () => {
                console.log(`🍭 Player picked: ${candy}`);
                
                // Check if it's the poison
                if (candy === gameState.opponentPoison) {
                    alert(`💀 You picked the poison ${candy}! You lose!`);
                    gameState.gameEnded = true;
                    return;
                }
                
                // Add to player collection and make candy disappear
                if (!gameState.playerCollection.includes(candy)) {
                    gameState.playerCollection.push(candy);
                    candyElement.remove(); // DISAPPEAR from matrix
                    
                    console.log(`✅ Collected ${candy}. Total: ${gameState.playerCollection.length}`);
                    
                    // Check win condition
                    if (gameState.playerCollection.length >= 11) {
                        alert(`🎉 You won! Collected ${gameState.playerCollection.length} candies!`);
                        gameState.gameEnded = true;
                        return;
                    }
                    
                    // AI turn after delay
                    setTimeout(doAITurn, 1000);
                }
            };
            
            opponentCandyGrid.appendChild(candyElement);
        });
    }
    
    // Update player candy grid (display only - shows what AI can pick from)
    const playerCandyGrid = document.getElementById('player-candy-grid');
    if (playerCandyGrid) {
        playerCandyGrid.innerHTML = '';
        
        gameState.playerCandies.forEach((candy, index) => {
            // Skip if AI already collected (disappeared)
            if (gameState.opponentCollection.includes(candy)) return;
            
            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.style.cssText = `
                padding: 8px;
                margin: 2px;
                border: 2px solid #28a745;
                border-radius: 6px;
                text-align: center;
                font-size: 16px;
                background: #d4edda;
                cursor: default;
            `;
            
            // Highlight poison
            if (candy === gameState.selectedPoison) {
                candyElement.style.backgroundColor = '#f8d7da';
                candyElement.style.borderColor = '#dc3545';
                candyElement.title = 'Your Poison ☠️';
            }
            
            playerCandyGrid.appendChild(candyElement);
        });
    }
    
    // Update counters to show remaining candies (not collected ones)
    updateRemainingCandyCounters();
    
    console.log('✅ Game interface is ready and playable!');
}

// Update counters to show remaining candies
function updateRemainingCandyCounters() {
    const playerCount = document.getElementById('player-collection-count');
    const opponentCount = document.getElementById('opponent-collection-count');
    
    // Show remaining candies, not collected ones
    const playerRemaining = gameState.playerCandies.length - gameState.opponentCollection.length;
    const opponentRemaining = gameState.opponentCandies.length - gameState.playerCollection.length;
    
    if (playerCount) playerCount.textContent = `${playerRemaining} left`;
    if (opponentCount) opponentCount.textContent = `${opponentRemaining} left`;
}

// Simple AI turn with disappearing candies
function doAITurn() {
    if (gameState.gameEnded) return;
    
    console.log('🤖 AI turn...');
    
    // AI picks from player candies (avoiding poison when possible)
    const availableCandies = gameState.playerCandies.filter(candy => 
        !gameState.opponentCollection.includes(candy)
    );
    
    if (availableCandies.length === 0) return;
    
    // AI avoids poison unless no choice
    const nonPoisonCandies = availableCandies.filter(candy => candy !== gameState.selectedPoison);
    const aiChoice = nonPoisonCandies.length > 0 ? 
        nonPoisonCandies[Math.floor(Math.random() * nonPoisonCandies.length)] :
        availableCandies[0]; // AI forced to pick poison
    
    console.log(`🤖 AI picked: ${aiChoice}`);
    
    if (aiChoice === gameState.selectedPoison) {
        alert(`🎉 AI picked your poison ${aiChoice}! You win!`);
        gameState.gameEnded = true;
        updateGameStatus('🎉 AI picked your poison! You Won!');
        return;
    }
    
    // Add to AI collection and make candy disappear from player grid
    gameState.opponentCollection.push(aiChoice);
    
    // Make the candy disappear from player candy display
    const playerCandyGrid = document.getElementById('player-candy-grid');
    if (playerCandyGrid) {
        Array.from(playerCandyGrid.children).forEach(elem => {
            if (elem.dataset.candy === aiChoice) {
                elem.remove(); // DISAPPEAR from matrix
            }
        });
    }
    
    // Update scores and counters
    updateGameScores();
    
    console.log(`🤖 AI collected ${aiChoice}. AI total: ${gameState.opponentCollection.length}`);
    
    // Check AI win
    if (gameState.opponentCollection.length >= 11) {
        alert(`😞 AI won! They collected ${gameState.opponentCollection.length} candies!`);
        gameState.gameEnded = true;
        updateGameStatus('😞 AI Won! Game Over');
        return;
    }
    
    // Back to player turn
    updateGameStatus('🎯 Your turn - Pick a candy!');
}

// ===== CURRENCY BUTTON FUNCTIONS =====
function showCoinsInfo() {
    const currentCoins = parseInt(document.getElementById('coins-count').textContent);
    
    createModal('💰 Coins Information', `
        <div class="text-center">
            <div class="text-6xl mb-4">💰</div>
            <h3 class="text-xl font-bold mb-4">Your Coin Balance</h3>
            <div class="bg-warning bg-opacity-10 rounded-lg p-6 mb-4">
                <div class="text-3xl font-bold text-warning mb-2">${currentCoins.toLocaleString()}</div>
                <div class="text-sm text-gray-600">Total Coins</div>
            </div>
            <div class="space-y-3 text-left">
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>🏆 Win Games</span>
                    <span class="text-warning font-bold">+100 coins</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>📅 Daily Login</span>
                    <span class="text-warning font-bold">+50 coins</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>🎯 Complete Challenges</span>
                    <span class="text-warning font-bold">+200 coins</span>
                </div>
            </div>
        </div>
    `, [
        { text: 'Get More Coins', onclick: 'closeModal(); showScreen("page9")', class: 'btn-primary' },
        { text: 'Close', onclick: 'closeModal()', class: 'btn-secondary' }
    ]);
}

function showDiamondsInfo() {
    const currentDiamonds = parseInt(document.getElementById('diamonds-count').textContent);
    
    createModal('💎 Diamonds Information', `
        <div class="text-center">
            <div class="text-6xl mb-4">💎</div>
            <h3 class="text-xl font-bold mb-4">Your Diamond Balance</h3>
            <div class="bg-success bg-opacity-10 rounded-lg p-6 mb-4">
                <div class="text-3xl font-bold text-success mb-2">${currentDiamonds}</div>
                <div class="text-sm text-gray-600">Premium Diamonds</div>
            </div>
            <div class="space-y-3 text-left">
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>🏆 Win Streak (10)</span>
                    <span class="text-success font-bold">+5 diamonds</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>🎖️ Weekly Tournaments</span>
                    <span class="text-success font-bold">+10 diamonds</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>🛒 Premium Purchases</span>
                    <span class="text-success font-bold">Available</span>
                </div>
            </div>
        </div>
    `, [
        { text: 'Earn Diamonds', onclick: 'closeModal(); showScreen("page9")', class: 'btn-primary' },
        { text: 'Close', onclick: 'closeModal()', class: 'btn-secondary' }
    ]);
}

// Game initialization is handled in the main DOMContentLoaded listener above

// Create a complete, working game interface
function createWorkingGameInterface() {
    console.log('🔨 Creating complete working game interface...');
    console.log('Current gameState candies:', {
        playerCandies: gameState.playerCandies,
        opponentCandies: gameState.opponentCandies,
        playerCollection: gameState.playerCollection,
        opponentCollection: gameState.opponentCollection
    });
    
    const gameContainer = document.getElementById('page3');
    if (!gameContainer) {
        console.error('❌ Game container not found!');
        return;
    }
    
    // Hide the default page3 content
    const existingCards = gameContainer.querySelectorAll('.card');
    existingCards.forEach(card => card.style.display = 'none');
    
    // Remove any existing interface
    const existingInterface = document.getElementById('working-game-interface');
    if (existingInterface) {
        existingInterface.remove();
    }
    
    // Create the working game interface with beautiful styling
    const gameInterface = document.createElement('div');
    gameInterface.id = 'working-game-interface';
    gameInterface.style.cssText = `
        min-height: 100vh;
        background: linear-gradient(135deg, #F2F8F0 0%, #DFEODC 50%, #C5D4C1 100%);
        padding: 20px;
        margin: 0;
        position: relative;
        overflow-x: hidden;
    `;
    
    gameInterface.innerHTML = `
        <!-- Game Header with Gradient -->
        <div style="
            text-align: center; 
            margin-bottom: 30px; 
            background: linear-gradient(135deg, #8B4513 0%, #A0612A 100%);
            color: white;
            padding: 25px;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(139, 69, 19, 0.3);
            position: relative;
            overflow: hidden;
        ">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"20\" cy=\"20\" r=\"2\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"80\" cy=\"30\" r=\"1.5\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"40\" cy=\"70\" r=\"1\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"70\" cy=\"80\" r=\"2.5\" fill=\"rgba(255,255,255,0.1)\"/></svg>'); opacity: 0.3;"></div>
            <h1 style="
                color: white; 
                margin-bottom: 15px; 
                font-size: 2.5rem; 
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                position: relative;
                z-index: 2;
            ">🎮 Poison Candy Duel</h1>
            <div style="
                font-size: 20px; 
                font-weight: bold; 
                color: #F2F8F0; 
                margin-bottom: 12px;
                position: relative;
                z-index: 2;
            " id="game-turn-indicator">✨ Your Turn ✨</div>
            <div style="
                color: rgba(255,255,255,0.9); 
                font-size: 16px;
                position: relative;
                z-index: 2;
            " id="game-instructions">🍭 Click on opponent's candies to collect them - avoid the poison! 🍭</div>
        </div>
        
        <!-- Main Game Grid with Beautiful Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
            <!-- Opponent's Candies Section -->
            <div style="
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                padding: 25px;
                border-radius: 20px;
                border: 3px solid #F59E0B;
                box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3);
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); pointer-events: none;"></div>
                <h3 style="
                    text-align: center; 
                    color: #8B4513; 
                    margin-bottom: 20px; 
                    font-size: 22px;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                    position: relative;
                    z-index: 2;
                ">🎯 Opponent's Candies</h3>
                <p style="
                    text-align: center; 
                    color: #A0612A; 
                    margin-bottom: 20px; 
                    font-weight: 600;
                    position: relative;
                    z-index: 2;
                ">Pick from here - avoid the poison!</p>
                <div id="opponent-candy-grid" style="
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 12px; 
                    min-height: 220px;
                    position: relative;
                    z-index: 2;
                "></div>
                <p style="
                    text-align: center; 
                    color: #8B4513; 
                    font-size: 16px; 
                    margin-top: 15px; 
                    font-weight: bold;
                    position: relative;
                    z-index: 2;
                ">🍬 Remaining: <span id="opponent-remaining-count" style="color: #F59E0B;">12</span></p>
            </div>
            
            <!-- Player's Candies Section -->
            <div style="
                background: linear-gradient(135deg, #d4edda 0%, #a3d9a4 100%);
                padding: 25px;
                border-radius: 20px;
                border: 3px solid #22C55E;
                box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); pointer-events: none;"></div>
                <h3 style="
                    text-align: center; 
                    color: #8B4513; 
                    margin-bottom: 20px; 
                    font-size: 22px;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                    position: relative;
                    z-index: 2;
                ">🏠 Your Candies</h3>
                <p style="
                    text-align: center; 
                    color: #16A34A; 
                    margin-bottom: 20px; 
                    font-weight: 600;
                    position: relative;
                    z-index: 2;
                ">AI will pick from here</p>
                <div id="player-candy-grid" style="
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 12px; 
                    min-height: 220px;
                    position: relative;
                    z-index: 2;
                "></div>
                <p style="
                    text-align: center; 
                    color: #8B4513; 
                    font-size: 16px; 
                    margin-top: 15px; 
                    font-weight: bold;
                    position: relative;
                    z-index: 2;
                ">🍭 Remaining: <span id="player-remaining-count" style="color: #22C55E;">12</span></p>
            </div>
        </div>
        
        <!-- Progress Section with Colorful Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
            <!-- Player Progress -->
            <div style="
                background: linear-gradient(135deg, #e7f3ff 0%, #b3d9ff 100%);
                padding: 25px;
                border-radius: 20px;
                border: 3px solid #3B82F6;
                box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
                text-align: center;
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: 0; right: 0; width: 100px; height: 100px; background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); pointer-events: none;"></div>
                <h4 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; font-weight: bold; position: relative; z-index: 2;">🏆 Your Progress</h4>
                <div style="
                    font-size: 36px; 
                    font-weight: bold; 
                    color: #3B82F6; 
                    margin-bottom: 10px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                    position: relative;
                    z-index: 2;
                " id="player-score">0/11</div>
                <div style="color: #8B4513; font-size: 16px; font-weight: 600; position: relative; z-index: 2;">Candies Collected</div>
            </div>
            
            <!-- AI Progress -->
            <div style="
                background: linear-gradient(135deg, #ffe7e7 0%, #ffb3b3 100%);
                padding: 25px;
                border-radius: 20px;
                border: 3px solid #EF4444;
                box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);
                text-align: center;
                position: relative;
                overflow: hidden;
            ">
                <div style="position: absolute; top: 0; left: 0; width: 100px; height: 100px; background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); pointer-events: none;"></div>
                <h4 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; font-weight: bold; position: relative; z-index: 2;">🤖 AI Progress</h4>
                <div style="
                    font-size: 36px; 
                    font-weight: bold; 
                    color: #EF4444; 
                    margin-bottom: 10px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                    position: relative;
                    z-index: 2;
                " id="ai-score">0/11</div>
                <div style="color: #8B4513; font-size: 16px; font-weight: 600; position: relative; z-index: 2;">Candies Collected</div>
            </div>
        </div>
        
        <!-- Action Buttons with Premium Styling -->
        <div style="text-align: center; margin-top: 40px;">
            <button onclick="startNewGame()" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%);
                color: white;
                border: none;
                border-radius: 15px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                margin-right: 20px;
                box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 12px 35px rgba(107, 114, 128, 0.5)';" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 8px 25px rgba(107, 114, 128, 0.4)';">
                🔄 New Game
            </button>
            <button onclick="showScreen('page1')" style="
                padding: 15px 30px;
                background: linear-gradient(135deg, #8B4513 0%, #A0612A 100%);
                color: white;
                border: none;
                border-radius: 15px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 8px 25px rgba(139, 69, 19, 0.4);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 12px 35px rgba(139, 69, 19, 0.5)';" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 8px 25px rgba(139, 69, 19, 0.4)';">
                🏠 Main Menu
            </button>
        </div>
    `;
    
    gameContainer.appendChild(gameInterface);
    
    console.log('✅ Beautiful game interface created!');
    
    // CRITICAL: Ensure candies are populated immediately
    setTimeout(() => {
        console.log('🍭 About to populate candies...');
        populateGameGrids();
        console.log('✅ Candies should now be visible!');
    }, 100);
}

// Populate the game grids with clickable candies
function populateGameGrids() {
    console.log('🍭 Populating game grids with candies...');
    console.log('Current gameState:', {
        playerCandies: gameState.playerCandies,
        opponentCandies: gameState.opponentCandies,
        playerCollection: gameState.playerCollection,
        opponentCollection: gameState.opponentCollection,
        selectedPoison: gameState.selectedPoison
    });
    
    // CRITICAL: Ensure candy arrays exist
    if (!gameState.playerCandies || gameState.playerCandies.length === 0) {
        console.warn('⚠️ Player candies missing! Generating new ones...');
        gameState.playerCandies = getRandomCandies(12);
    }
    
    if (!gameState.opponentCandies || gameState.opponentCandies.length === 0) {
        console.warn('⚠️ Opponent candies missing! Generating new ones...');
        gameState.opponentCandies = getRandomCandies(12);
    }
    
    // Initialize collections if they don't exist
    if (!gameState.playerCollection) gameState.playerCollection = [];
    if (!gameState.opponentCollection) gameState.opponentCollection = [];
    
    console.log('✅ Candy arrays verified:', {
        playerCandies: gameState.playerCandies.length,
        opponentCandies: gameState.opponentCandies.length
    });
    
    // Populate opponent candy grid (clickable)
    const opponentGrid = document.getElementById('opponent-candy-grid');
    if (opponentGrid) {
        opponentGrid.innerHTML = '';
        console.log('🎯 Populating opponent grid with', gameState.opponentCandies.length, 'candies');
        
        gameState.opponentCandies.forEach((candy, index) => {
            // Skip if already collected
            if (gameState.playerCollection.includes(candy)) {
                console.log(`Skipping ${candy} - already collected`);
                return;
            }
            
            const candyElement = document.createElement('div');
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;
            candyElement.style.cssText = `
                padding: 18px;
                font-size: 32px;
                text-align: center;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                border: 3px solid #F59E0B;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                user-select: none;
                position: relative;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            `;
            
            // Add enhanced hover effects
            candyElement.onmouseenter = () => {
                candyElement.style.background = 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)';
                candyElement.style.borderColor = '#D97706';
                candyElement.style.transform = 'scale(1.15) translateY(-2px)';
                candyElement.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.5)';
                candyElement.style.zIndex = '10';
            };
            
            candyElement.onmouseleave = () => {
                candyElement.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)';
                candyElement.style.borderColor = '#F59E0B';
                candyElement.style.transform = 'scale(1) translateY(0)';
                candyElement.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                candyElement.style.zIndex = '1';
            };
            
            // Add click handler with enhanced feedback
            candyElement.onclick = () => {
                console.log(`🍭 Player picked: ${candy}`);
                
                // Visual feedback on click
                candyElement.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
                candyElement.style.borderColor = '#047857';
                candyElement.style.color = 'white';
                candyElement.style.transform = 'scale(0.9)';
                
                // Check if it's the poison
                if (candy === gameState.opponentPoison) {
                    setTimeout(() => {
                        candyElement.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
                        candyElement.style.borderColor = '#B91C1C';
                        setTimeout(() => {
                            alert(`💀 You picked the poison ${candy}! You lose!`);
                            gameState.gameEnded = true;
                            updateGameStatus('💀 Game Over - You picked the poison!');
                        }, 300);
                    }, 200);
                    return;
                }
                
                // Add to player collection and remove candy
                gameState.playerCollection.push(candy);
                
                // Smooth removal animation
                setTimeout(() => {
                    candyElement.style.transform = 'scale(0) rotate(180deg)';
                    candyElement.style.opacity = '0';
                    setTimeout(() => {
                        candyElement.remove();
                        updateGameScores();
                        
                        // Check win condition
                        if (gameState.playerCollection.length >= 11) {
                            setTimeout(() => {
                                alert(`🎉 You won! Collected ${gameState.playerCollection.length} candies!`);
                                gameState.gameEnded = true;
                                updateGameStatus('🎉 You Won!');
                            }, 500);
                            return;
                        }
                        
                        updateGameStatus('🤖 AI is thinking...');
                        
                        // AI turn after delay
                        setTimeout(doAITurn, 1500);
                    }, 300);
                }, 400);
            };
            
            opponentGrid.appendChild(candyElement);
            console.log(`Added candy ${candy} to opponent grid`);
        });
    } else {
        console.error('❌ Opponent candy grid not found!');
    }
    
    // Populate player candy grid (display only)
    const playerGrid = document.getElementById('player-candy-grid');
    if (playerGrid) {
        playerGrid.innerHTML = '';
        console.log('🏠 Populating player grid with', gameState.playerCandies.length, 'candies');
        
        gameState.playerCandies.forEach((candy, index) => {
            // Skip if AI already collected
            if (gameState.opponentCollection.includes(candy)) {
                console.log(`Skipping ${candy} - AI collected it`);
                return;
            }
            
            const candyElement = document.createElement('div');
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.style.cssText = `
                padding: 15px;
                font-size: 28px;
                text-align: center;
                background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
                border: 3px solid #22C55E;
                border-radius: 12px;
                cursor: default;
                user-select: none;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                box-shadow: 0 3px 10px rgba(34, 197, 94, 0.3);
                position: relative;
            `;
            
            // Highlight poison with special styling
            if (candy === gameState.selectedPoison) {
                candyElement.style.background = 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)';
                candyElement.style.borderColor = '#EF4444';
                candyElement.style.boxShadow = '0 3px 15px rgba(239, 68, 68, 0.4)';
                candyElement.title = 'Your Poison ☠️';
                
                // Add pulsing animation for poison
                const poisonGlow = setInterval(() => {
                    candyElement.style.boxShadow = candyElement.style.boxShadow.includes('rgba(239, 68, 68, 0.4)') 
                        ? '0 3px 15px rgba(239, 68, 68, 0.8)' 
                        : '0 3px 15px rgba(239, 68, 68, 0.4)';
                }, 1000);
                
                // Store interval to clear later if needed
                candyElement.dataset.poisonGlow = poisonGlow;
            }
            
            playerGrid.appendChild(candyElement);
            console.log(`Added candy ${candy} to player grid`);
        });
    } else {
        console.error('❌ Player candy grid not found!');
    }
    
    // Update scores and status
    updateGameScores();
    updateGameStatus('🎯 Your turn - Pick a candy!');
    
    console.log('✅ All candies populated successfully!');
    console.log('Final state:', {
        opponentGridChildren: opponentGrid?.children.length || 0,
        playerGridChildren: playerGrid?.children.length || 0
    });
}

// Update game scores and counters
function updateGameScores() {
    const playerScore = document.getElementById('player-score');
    const aiScore = document.getElementById('ai-score');
    const opponentRemaining = document.getElementById('opponent-remaining-count');
    const playerRemaining = document.getElementById('player-remaining-count');
    
    if (playerScore) playerScore.textContent = `${gameState.playerCollection.length}/11`;
    if (aiScore) aiScore.textContent = `${gameState.opponentCollection.length}/11`;
    if (opponentRemaining) opponentRemaining.textContent = gameState.opponentCandies.length - gameState.playerCollection.length;
    if (playerRemaining) playerRemaining.textContent = gameState.playerCandies.length - gameState.opponentCollection.length;
}

// Update game status message
function updateGameStatus(message) {
    const statusElement = document.getElementById('game-instructions');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

