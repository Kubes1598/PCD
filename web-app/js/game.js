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
        // Only persist stats if user is NOT a guest
        if (typeof authManager !== 'undefined' && authManager.isGuest) {
            console.log('📈 Guest mode: Statistics updated in memory but not persisted');
            this.updateStats();
            return;
        }

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

// ===== UNIVERSAL GAME LOGIC FOR ALL MODES =====
// New simplified game logic that ensures fair play for both players
// Rule: After a player picks the 11th candy, give the second player a chance to also reach 11
// If second player doesn't pick poison and reaches 11, it's a draw
function checkGameWinCondition(gameState) {
    const playerCount = gameState.playerCollection.length;
    const opponentCount = gameState.opponentCollection.length;

    console.log(`🎮 Universal game logic check: Player: ${playerCount}/11, Opponent: ${opponentCount}/11, Turn: ${gameState.isPlayerTurn ? 'Player' : 'Opponent'}`);

    // Initialize game progress tracking if not exists
    if (!gameState.gameProgress) {
        gameState.gameProgress = {
            playerReached11First: false,
            opponentReached11First: false,
            playerGotChance: false,
            opponentGotChance: false,
            gamePhase: 'normal' // 'normal', 'player_reached_11', 'opponent_reached_11', 'both_reached_11'
        };
    }

    // Case 1: Neither player has reached 11 yet - normal game continues
    if (playerCount < 11 && opponentCount < 11) {
        gameState.gameProgress.gamePhase = 'normal';
        return {
            hasWinner: false,
            canContinue: true,
            message: "Game continues..."
        };
    }

    // Case 2: Both players have reached 11 - DRAW
    if (playerCount === 11 && opponentCount === 11) {
        gameState.gameProgress.gamePhase = 'both_reached_11';
        return {
            hasWinner: false,
            canContinue: false,
            isDraw: true,
            message: "🤝 Draw! Both players collected 11 candies!"
        };
    }

    // Case 3: Player reached 11 first, opponent hasn't
    if (playerCount === 11 && opponentCount < 11) {
        if (!gameState.gameProgress.playerReached11First) {
            // Player just reached 11 - mark it and give opponent a chance
            gameState.gameProgress.playerReached11First = true;
            gameState.gameProgress.gamePhase = 'player_reached_11';
            console.log("🎯 Player reached 11 first! Giving opponent final chance...");

            // If it's currently player's turn, they just picked the 11th candy
            // Switch to opponent for their final chance
            if (gameState.isPlayerTurn) {
                return {
                    hasWinner: false,
                    canContinue: true,
                    switchToOpponent: true,
                    message: "🎉 You reached 11 candies! Opponent gets final chance..."
                };
            }
        }

        // Player has 11, opponent had their chance
        if (gameState.gameProgress.playerReached11First && !gameState.isPlayerTurn) {
            // Currently opponent's turn - they're getting their chance
            gameState.gameProgress.opponentGotChance = true;
            return {
                hasWinner: false,
                canContinue: true,
                message: "Opponent's final chance..."
            };
        } else if (gameState.gameProgress.opponentGotChance || gameState.isPlayerTurn) {
            // Opponent already had their chance and didn't reach 11, or it's back to player's turn
            return {
                hasWinner: true,
                winner: 'player',
                message: "🎉 You win! You collected 11 candies first!"
            };
        }
    }

    // Case 4: Opponent reached 11 first, player hasn't
    if (opponentCount === 11 && playerCount < 11) {
        if (!gameState.gameProgress.opponentReached11First) {
            // Opponent just reached 11 - mark it and give player a chance
            gameState.gameProgress.opponentReached11First = true;
            gameState.gameProgress.gamePhase = 'opponent_reached_11';
            console.log("🎯 Opponent reached 11 first! Giving player final chance...");

            // If it's currently opponent's turn, they just picked the 11th candy
            // Switch to player for their final chance
            if (!gameState.isPlayerTurn) {
                return {
                    hasWinner: false,
                    canContinue: true,
                    switchToPlayer: true,
                    message: "💔 Opponent reached 11 candies! You get final chance..."
                };
            }
        }

        // Opponent has 11, player had their chance
        if (gameState.gameProgress.opponentReached11First && gameState.isPlayerTurn) {
            // Currently player's turn - they're getting their chance
            gameState.gameProgress.playerGotChance = true;
            return {
                hasWinner: false,
                canContinue: true,
                message: "Your final chance..."
            };
        } else if (gameState.gameProgress.playerGotChance || !gameState.isPlayerTurn) {
            // Player already had their chance and didn't reach 11, or it's back to opponent's turn
            const opponentLabel = gameState.gameMode === 'friends' ? 'Friend' : 'Opponent';
            return {
                hasWinner: true,
                winner: 'opponent',
                message: `💔 ${opponentLabel} wins! They collected 11 candies first!`
            };
        }
    }

    // Default case - continue game
    return {
        hasWinner: false,
        canContinue: true,
        message: "Game continues..."
    };
}

// ===== CANDY DEFINITIONS =====
// User-specified candy set to avoid repetition and ensure consistency
const CANDY_TYPES = [
    '🍏', '🍋', '🍇', '🍒', '🍎', '🍓', '🍑', '🍐', '🍌',
    '🫐', '🥭', '🍊', '🍉', '🍈', '🍍', '🥥', '🥑', '🥒', '🥕',
    '🥝', '🌶️', '🫒', '🍅', '🥦', '🫑', '🧄', '🍆', '🥬',
    '🌽', '🧅', '🥔', '🍠', '🥖', '🍞', '🥚', '🧇', '🧀',
    '🥞', '🧈', '🍖', '🍗', '🌭', '🥩', '🌮', '🌯', '🥙', '🥗',
    '🧆', '🍕', '🫔', '🦴', '🍝', '🍜', '🍥', '🍰', '🍬', '🍭',
    '🍪', '🍩', '🌰', '🍫', '🍵'
];

// Global candy allocation tracker to ensure absolute uniqueness
let globalUsedCandies = new Set();

function getRandomCandies(count) {
    // Ensure no duplicates by shuffling the entire candy array
    const shuffledCandies = [...CANDY_TYPES].sort(() => Math.random() - 0.5);

    // Take only the number of candies requested (max 30 since we have 30 different types)
    const maxCandies = Math.min(count, CANDY_TYPES.length);
    const uniqueCandies = shuffledCandies.slice(0, maxCandies);

    // CRITICAL FIX: Ensure absolute uniqueness by checking against global tracker
    const finalCandies = [...new Set(uniqueCandies)];
    if (finalCandies.length !== uniqueCandies.length) {
        console.warn('⚠️ Duplicates detected and removed!');
    }

    console.log(`Generated ${finalCandies.length} unique candies:`, finalCandies);
    return finalCandies;
}

// Generate completely unique candy sets for the entire game
function generateUniqueGameCandies() {
    console.log('🍭 Generating completely unique candy sets for entire game...');

    // Try to use enhanced candy pool system if available
    if (typeof generateEnhancedGameCandies === 'function') {
        try {
            console.log('🎯 Using enhanced candy pool system...');

            // Determine city based on current game state
            let city = 'Dubai'; // Default
            if (typeof gameState !== 'undefined' && gameState.selectedCity) {
                city = gameState.selectedCity;
            }

            const enhancedResult = generateEnhancedGameCandies(city);

            console.log(`✅ Enhanced candy generation successful for ${city}:`, {
                playerCandies: enhancedResult.playerCandies.length,
                opponentCandies: enhancedResult.opponentCandies.length
            });

            return enhancedResult;

        } catch (error) {
            console.warn('⚠️ Enhanced candy pool failed, falling back to legacy system:', error);
        }
    }

    // Legacy candy generation system (fallback)
    console.log('🔄 Using legacy candy generation system...');

    // Reset the global tracker
    globalUsedCandies.clear();

    // Verify we have enough candies
    if (CANDY_TYPES.length < 24) {
        console.error('❌ Not enough candy types! Need at least 24, have:', CANDY_TYPES.length);
        throw new Error(`Need at least 24 candy types, but only have ${CANDY_TYPES.length}`);
    }

    // Shuffle all available candies multiple times for better randomness
    let shuffledCandies = [...CANDY_TYPES];
    for (let i = 0; i < 3; i++) {
        shuffledCandies = shuffledCandies.sort(() => Math.random() - 0.5);
    }

    // CRITICAL FIX: Allocate candies ensuring NO overlaps anywhere
    const playerCandies = shuffledCandies.slice(0, 12);      // First 12 unique candies
    const opponentCandies = shuffledCandies.slice(12, 24);   // Next 12 unique candies (no overlap)

    // Verify arrays are exactly the right length
    if (playerCandies.length !== 12 || opponentCandies.length !== 12) {
        console.error('❌ Invalid candy array lengths!', {
            playerLength: playerCandies.length,
            opponentLength: opponentCandies.length
        });
        throw new Error('Failed to generate correct candy array lengths');
    }

    // Force uniqueness check (this should be redundant but critical)
    const playerSet = new Set(playerCandies);
    const opponentSet = new Set(opponentCandies);

    if (playerSet.size !== 12) {
        console.error('❌ PLAYER DUPLICATES DETECTED!', playerCandies);
        throw new Error('Player candies contain duplicates!');
    }

    if (opponentSet.size !== 12) {
        console.error('❌ OPPONENT DUPLICATES DETECTED!', opponentCandies);
        throw new Error('Opponent candies contain duplicates!');
    }

    // Check for overlaps
    const intersection = [...playerSet].filter(candy => opponentSet.has(candy));
    if (intersection.length > 0) {
        console.error('❌ OVERLAP DETECTED:', intersection);
        throw new Error('Player and opponent candies overlap!');
    }

    // CRITICAL FIX: Poison selection uses player's actual game candies
    const poisonCandies = [...playerCandies]; // Exact copy

    console.log('✅ Generated unique candy sets (legacy):');
    console.log('   Player candies:', playerCandies);
    console.log('   Opponent candies:', opponentCandies);
    console.log('   Poison selection (same as player):', poisonCandies);
    console.log('✅ All validation checks passed');

    return {
        playerCandies: playerCandies,
        opponentCandies: opponentCandies,
        poisonCandies: poisonCandies
    };
}

// ===== GLOBAL GAME STATE =====
let gameState;

// ===== TURN TIMER FUNCTIONALITY =====
// Note: Turn timer properties will be added to gameState after initialization

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    console.log(`Switching to screen: ${screenId}`);

    // CRITICAL: Scroll to top so users see the game immediately
    window.scrollTo(0, 0);

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
    switch (screenId) {
        case 'page1':
            // Main menu - update stats
            if (gameState && gameState.updateStats) {
                gameState.updateStats();
            }
            break;
        case 'page2':
            // City selection - update player balance display
            updatePlayerBalanceDisplay();
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
                        statusText.innerHTML = '<i data-lucide="target" class="w-4 h-4 mr-2 inline-block"></i> Your Turn - Pick a candy!';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
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
        case 'page8':
            // Enhanced offline game board - initialize if game started
            if (gameState && gameState.gameStarted) {
                console.log('Initializing enhanced game board');
                initializeEnhancedGameBoard();
            }
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

            // Generate completely unique candy sets using new system
            const uniqueCandySets = generateUniqueGameCandies();
            gameState.playerCandies = uniqueCandySets.playerCandies;
            gameState.opponentCandies = uniqueCandySets.opponentCandies;

            gameState.playerCollection = [];
            gameState.opponentCollection = [];
            gameState.isPlayerTurn = true;
            gameState.gameStarted = false; // Will be set to true after poison selection

            // 3. UPDATE SCORE (Initialize)
            gameState.playerScore = 0;
            gameState.opponentScore = 0;
            updateScoreDisplay();

            // 4. START 30-SECOND TIMER - Only for non-matchmaking games
            if (!gameState.isMatchmakingGame) {
                startGameTimer();
            }

            console.log('Player candies:', gameState.playerCandies);
            console.log('Opponent candies:', gameState.opponentCandies);

            // Start poison selection for offline mode - show the poison selection screen
            showScreen('page4');
            initializePoisonSelection();
        }

    } catch (error) {
        console.error('Error starting game:', error);
        console.error('Error stack:', error.stack);
        showNotification('❌ Failed to start game: ' + error.message, 'error', 5000);

        // More specific error messages based on error type
        let errorTitle = '❌ Game Start Error';
        let errorContent = '';

        if (error.message.includes('duplicate')) {
            errorTitle = '❌ Duplicate Candy Error';
            errorContent = `
                <div class="text-center">
                    <p class="text-lg mb-4">Duplicate candies detected!</p>
                    <p class="text-gray-600 mb-2">The candy generation system found duplicate items.</p>
                    <p class="text-sm text-gray-500">This should be automatically fixed now. Please try again.</p>
                </div>
            `;
        } else if (error.message.includes('overlap')) {
            errorTitle = '❌ Candy Pool Error';
            errorContent = `
                <div class="text-center">
                    <p class="text-lg mb-4">Candy pool overlap detected!</p>
                    <p class="text-gray-600 mb-2">Player and opponent candies must be unique.</p>
                    <p class="text-sm text-gray-500">The system will regenerate unique candy sets.</p>
                </div>
            `;
        } else {
            errorContent = `
                <div class="text-center">
                    <p class="text-lg mb-4">Failed to start AI game</p>
                    <p class="text-gray-600">${error.message}</p>
                    <p class="text-sm text-gray-500 mt-2">Please try again or contact support if the issue persists</p>
                </div>
            `;
        }

        createModal(
            errorTitle,
            errorContent,
            [
                { text: 'Try Again', action: () => { closeModal(); startGame(); }, class: 'btn-primary' },
                { text: 'Play Offline', action: () => { closeModal(); startAIGame('easy'); }, class: 'btn-secondary' },
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

    // CRITICAL FIX: Use player's actual game candies for poison selection
    // This ensures the poison selection pool matches the player's game pool perfectly
    let playerCandies = gameState.playerCandies || [];
    console.log('Player candies for poison selection:', playerCandies);

    if (playerCandies.length === 0) {
        console.error('No player candies available for poison selection');
        return;
    }

    // CRITICAL FIX: Use player's actual candies (typically 12) for poison selection
    // No need to force 16 - use the actual player candy set
    console.log('✅ Using player\'s actual game candies for poison selection:', playerCandies);

    // CRITICAL: Verify all candies are unique
    const uniqueCandies = [...new Set(playerCandies)];
    if (uniqueCandies.length !== playerCandies.length) {
        console.error('❌ DUPLICATE CANDIES DETECTED IN PLAYER POOL!');
        console.error('Original array:', playerCandies);
        console.error('Unique array:', uniqueCandies);
        console.error('Duplicates found:', playerCandies.filter((candy, index) => playerCandies.indexOf(candy) !== index));

        // Try to fix by using unique candies
        console.log('🔧 Attempting to fix by using unique candies...');
        gameState.playerCandies = uniqueCandies;
        playerCandies = uniqueCandies;

        if (uniqueCandies.length < 12) {
            console.error('❌ Not enough unique candies after deduplication!');
            throw new Error(`Duplicate candies found in player pool! Only ${uniqueCandies.length} unique candies available.`);
        }

        console.log('✅ Fixed duplicate issue by using unique candies');
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

        // Add click event listener
        candyElement.addEventListener('click', function () {
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
    });

    // Select new poison
    element.classList.add('selected');
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

    // Play poison selection sound
    if (typeof soundManager !== 'undefined') {
        soundManager.play('poison');
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
                // Navigate to the enhanced game board
                navigateToEnhancedGameBoard();

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

            // For AI games, set AI poison automatically and start game
            if (gameState.gameMode === 'ai' && gameState.currentGameState.player2.poison_choice === null) {
                console.log('Setting AI poison automatically...');
                await setAIPoison();

                // Start AI game immediately after AI poison is set
                gameState.isPlayerTurn = true;
                gameState.gameStarted = true;
                showNotification(`🎮 Game Starting! Your poison: ${gameState.selectedPoison}`, 'success', 2000);

                setTimeout(() => {
                    showScreen('page3');
                    initializeGameBoardInPage();

                    if (gameState.isMatchmakingGame) {
                        console.log('🎮 Starting matchmaking game timers after poison selection');
                        const cityTimerValue = getDifficultyTimerValue('easy');
                        showNotification(`⏰ Game starting in ${gameState.selectedCity}! Each turn: ${cityTimerValue} seconds`, 'info', 3000);

                        setTimeout(() => {
                            startGameTimer();
                            if (gameState.isPlayerTurn) {
                                startTurnTimer();
                            }
                        }, 1000);
                    } else {
                        console.log('🎮 Starting AI game with non-blocking timer');
                        startTurnTimer();
                    }
                }, 500);
                return;
            }

            // For online multiplayer games, check if both players have set poison
            if (gameState.gameMode === 'online' && gameState.currentGameState) {
                const player1HasPoison = gameState.currentGameState.player1.poison_choice !== null;
                const player2HasPoison = gameState.currentGameState.player2.poison_choice !== null;

                console.log('Poison selection status:', {
                    player1HasPoison,
                    player2HasPoison,
                    gameState: gameState.currentGameState.state
                });

                if (player1HasPoison && player2HasPoison) {
                    // Both players have set poison - start the game
                    console.log('🎮 Both players have set poison - starting game!');
                    gameState.isPlayerTurn = true;
                    gameState.gameStarted = true;

                    showNotification(`🎮 Game Starting! Your poison: ${gameState.selectedPoison}`, 'success', 2000);

                    setTimeout(() => {
                        showScreen('page3');
                        initializeGameBoardInPage();

                        if (gameState.isMatchmakingGame) {
                            console.log('🎮 Starting matchmaking game timers after poison selection');
                            const cityTimerValue = getDifficultyTimerValue('easy');
                            showNotification(`⏰ Game starting in ${gameState.selectedCity}! Each turn: ${cityTimerValue} seconds`, 'info', 3000);

                            setTimeout(() => {
                                startGameTimer();
                                if (gameState.isPlayerTurn) {
                                    startTurnTimer();
                                }
                            }, 1000);
                        } else {
                            console.log('🎮 Starting online game with non-blocking timer');
                            startTurnTimer();
                        }
                    }, 500);
                } else {
                    // Only this player has set poison - wait for opponent
                    console.log('🎮 Waiting for opponent to select poison...');

                    // Show waiting notification
                    showNotification(`✅ Poison set: ${gameState.selectedPoison}! Waiting for opponent...`, 'success', 3000);

                    // Update UI to show waiting state
                    const poisonDisplay = document.getElementById('selected-poison-display');
                    if (poisonDisplay) {
                        poisonDisplay.innerHTML = `
                            <div class="text-center">
                                <p class="text-lg font-bold text-success">✅ Your Poison: ${gameState.selectedPoison}</p>
                                <p class="text-sm text-warning">⏳ Waiting for opponent to select poison...</p>
                            </div>
                        `;
                    }

                    // Disable confirm button
                    const confirmBtn = document.getElementById('confirm-poison-btn');
                    if (confirmBtn) {
                        confirmBtn.textContent = 'Confirmed ✅';
                        confirmBtn.disabled = true;
                        confirmBtn.style.backgroundColor = '#10b981';
                    }

                    // Start monitoring for opponent poison selection
                    startOpponentPoisonCheck();
                }
            } else {
                // Fallback for offline/friends modes
                gameState.isPlayerTurn = true;
                gameState.gameStarted = true;

                showNotification(`🎮 Game Starting! Your poison: ${gameState.selectedPoison}`, 'success', 2000);

                setTimeout(() => {
                    showScreen('page3');
                    initializeGameBoardInPage();

                    if (gameState.gameMode === 'friends') {
                        console.log('🎮 Starting friends game with non-blocking timer');
                        startTurnTimer();
                    }
                }, 500);
            }
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

// Monitor opponent poison selection in online games
let opponentPoisonCheckInterval = null;

function startOpponentPoisonCheck() {
    console.log('🔍 Starting opponent poison selection monitoring...');

    // Clear any existing interval
    if (opponentPoisonCheckInterval) {
        clearInterval(opponentPoisonCheckInterval);
    }

    opponentPoisonCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/state`);
            if (!response.ok) {
                console.error('Failed to fetch game state for poison check');
                return;
            }

            const currentState = await response.json();
            console.log('Checking opponent poison status:', currentState);

            if (currentState.success && currentState.data) {
                const gameData = currentState.data;
                const player1HasPoison = gameData.player1.poison_choice !== null;
                const player2HasPoison = gameData.player2.poison_choice !== null;
                const gameIsPlaying = gameData.state === 'playing';

                console.log('Poison check:', {
                    player1HasPoison,
                    player2HasPoison,
                    gameIsPlaying,
                    gameState: gameData.state
                });

                if (player1HasPoison && player2HasPoison && gameIsPlaying) {
                    console.log('🎮 Both players have set poison and game is ready - starting!');

                    // Stop monitoring
                    clearInterval(opponentPoisonCheckInterval);
                    opponentPoisonCheckInterval = null;

                    // Update game state
                    gameState.currentGameState = gameData;
                    gameState.isPlayerTurn = true;
                    gameState.gameStarted = true;

                    // Show final notification
                    showNotification('🎮 Opponent selected poison! Game starting now!', 'success', 2000);

                    // Start the game
                    setTimeout(() => {
                        showScreen('page3');
                        initializeGameBoardInPage();

                        if (gameState.isMatchmakingGame) {
                            console.log('🎮 Starting matchmaking game timers after both players ready');
                            const cityTimerValue = getDifficultyTimerValue('easy');
                            showNotification(`⏰ Game starting in ${gameState.selectedCity}! Each turn: ${cityTimerValue} seconds`, 'info', 3000);

                            setTimeout(() => {
                                startGameTimer();
                                if (gameState.isPlayerTurn) {
                                    startTurnTimer();
                                }
                            }, 1000);
                        } else {
                            console.log('🎮 Starting online game with non-blocking timer');
                            startTurnTimer();
                        }
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Error checking opponent poison status:', error);
        }
    }, 2000); // Check every 2 seconds
}

function stopOpponentPoisonCheck() {
    if (opponentPoisonCheckInterval) {
        clearInterval(opponentPoisonCheckInterval);
        opponentPoisonCheckInterval = null;
        console.log('Stopped monitoring opponent poison selection');
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

        // Apply subtle base styling to match left side design
        candyElement.style.padding = '12px';
        candyElement.style.margin = '4px';
        candyElement.style.borderRadius = '8px';
        candyElement.style.fontSize = '20px';
        candyElement.style.textAlign = 'center';
        candyElement.style.border = '2px solid #e9ecef';
        candyElement.style.background = '#f8f9fa';
        candyElement.style.transition = 'all 0.2s ease';
        candyElement.style.userSelect = 'none';
        candyElement.style.fontWeight = 'normal';
        candyElement.style.color = '#6c757d';

        if (gameState.isPlayerTurn && !gameState.gameEnded && isAvailable) {
            // Subtle clickable candy styling to match left side
            candyElement.style.cursor = 'pointer';
            candyElement.style.backgroundColor = '#ffffff';
            candyElement.style.border = '2px solid #ced4da';
            candyElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            candyElement.style.color = '#495057';
            candyElement.title = 'Click to collect this candy!';

            candyElement.addEventListener('click', () => {
                console.log('Candy clicked:', candy);
                candyElement.style.backgroundColor = '#e9ecef';
                candyElement.style.color = '#495057';
                candyElement.style.transform = 'scale(0.95)';
                pickCandy(candy, index, candyElement);
            });

            // Add subtle hover effect
            candyElement.addEventListener('mouseenter', () => {
                if (!gameState.gameEnded && gameState.isPlayerTurn) {
                    candyElement.style.backgroundColor = '#e9ecef';
                    candyElement.style.border = '2px solid #adb5bd';
                    candyElement.style.transform = 'scale(1.02)';
                    candyElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                }
            });

            candyElement.addEventListener('mouseleave', () => {
                if (!gameState.gameEnded && gameState.isPlayerTurn) {
                    candyElement.style.backgroundColor = '#ffffff';
                    candyElement.style.border = '2px solid #ced4da';
                    candyElement.style.transform = 'scale(1)';
                    candyElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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
            turnIndicator.innerHTML = '<i data-lucide="user" class="w-4 h-4 mr-1"></i> Your Turn';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            turnIndicator.style.color = '#28a745';
        }
        if (statusText) statusText.textContent = 'Choose a candy from opponent\'s collection - avoid the poison!';
    } else {
        if (turnIndicator) {
            turnIndicator.innerHTML = '<i data-lucide="bot" class="w-4 h-4 mr-1"></i> AI Turn';
            if (typeof lucide !== 'undefined') lucide.createIcons();
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
        // Show "Got ya!!!" on the winner's profile (opponent/AI)
        showCandyPickFeedback('player1', candy, true);
        setTimeout(() => {
            endGame(false, `💀 You picked the opponent's poison ${candy}! You lose!`);
        }, 1000); // Small delay to see the feedback
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

    // Show pickup animation/feedback - Profile-based
    showCandyPickFeedback('player1', candy, false);

    // UNIVERSAL GAME LOGIC: Check win condition with new logic
    const winCondition = checkGameWinCondition(gameState);
    if (winCondition.hasWinner) {
        endGame(winCondition.winner === 'player', winCondition.message);
        return;
    }

    if (winCondition.isDraw) {
        endGame(false, winCondition.message, true);  // true for isDraw parameter
        return;
    }

    // Handle turn switching based on universal game logic
    if (winCondition.switchToOpponent) {
        console.log("🔄 Player reached 11 - switching to opponent for final chance");
        gameState.isPlayerTurn = false;
        showNotification('🎉 You reached 11! Opponent gets final chance...', 'info', 3000);
    } else if (winCondition.switchToPlayer) {
        console.log("🔄 Opponent reached 11 - switching to player for final chance");
        gameState.isPlayerTurn = true;
        showNotification('💔 Opponent reached 11! You get final chance...', 'warning', 3000);
    } else {
        // Normal turn switch
        gameState.isPlayerTurn = false;
    }

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
        // Show "Got ya!!!" on the winner's profile (player)
        showCandyPickFeedback('player2', pickedCandy, true);
        setTimeout(() => {
            endGame(true, `🎉 ${gameState.gameMode === 'friends' ? 'Your friend' : 'AI'} picked your poison ${pickedCandy}! You win!`);
        }, 1000); // Small delay to see the feedback
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

    // UNIVERSAL GAME LOGIC: Check win condition with new logic
    const winCondition = checkGameWinCondition(gameState);
    if (winCondition.hasWinner) {
        endGame(winCondition.winner === 'player', winCondition.message);
        return;
    }

    if (winCondition.isDraw) {
        endGame(false, winCondition.message, true);  // true for isDraw
        return;
    }

    console.log(`🤖 ${gameState.gameMode === 'friends' ? 'Friend' : 'AI'} picked ${pickedCandy}. Collection now: ${gameState.opponentCollection.length}/11`);

    // Handle turn switching based on universal game logic
    if (winCondition.switchToPlayer) {
        console.log("🔄 Opponent reached 11 - switching to player for final chance");
        gameState.isPlayerTurn = true;
        showNotification('💔 Opponent reached 11! You get final chance...', 'warning', 3000);
    } else if (winCondition.switchToOpponent) {
        console.log("🔄 Player reached 11 - switching to opponent for final chance");
        gameState.isPlayerTurn = false;
        showNotification('🎉 You reached 11! Opponent gets final chance...', 'info', 3000);
    } else {
        // Normal turn switch back to player
        gameState.isPlayerTurn = true;
    }

    // Update the game board and counters to reflect turn change
    initializeGameBoardInPage();
    if (typeof updateEnhancedCounters === 'function') updateEnhancedCounters();
    if (typeof updateUnifiedCandyCounters === 'function') updateUnifiedCandyCounters();

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
    let isDraw = false;
    let message = "";

    switch (result) {
        case "player1_win":
            playerWon = true;
            message = "Congratulations! You won!";
            break;
        case "player2_win":
            playerWon = false;
            message = "You lost! Better luck next time.";
            break;
        case "draw":
            playerWon = false;
            isDraw = true;
            message = "It's a draw! Both players collected 11 candies!";
            break;
        default:
            message = "Game ended.";
    }

    endGame(playerWon, message, isDraw);
}

function endGame(playerWon, message, isDraw = false) {
    console.log('Game ended. Player won:', playerWon, 'Message:', message, 'Is draw:', isDraw);

    // Stop any timers
    stopTurnTimer();

    gameState.gameEnded = true;

    // Play appropriate sound effect
    if (typeof soundManager !== 'undefined') {
        if (playerWon) {
            soundManager.play('win');
        } else if (!isDraw) {
            soundManager.play('lose');
        }
    }

    // Only record result if not a draw
    if (!isDraw) {
        gameState.recordGameResult(playerWon);
    }


    // Update result screen elements
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const finalPlayerScore = document.getElementById('final-player-score');
    const finalOpponentScore = document.getElementById('final-opponent-score');

    if (resultIcon) {
        resultIcon.textContent = isDraw ? '🤝' : (playerWon ? '🏆' : '💔');
    }

    if (resultTitle) {
        resultTitle.textContent = isDraw ? 'Draw!' : (playerWon ? 'Victory!' : 'Defeat!');
        resultTitle.className = `text-3xl font-display font-bold mb-4 ${isDraw ? 'text-warning' : (playerWon ? 'text-success' : 'text-danger')}`;
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

    // Create appropriate modal based on result
    if (isDraw) {
        // Draw modal with new round option
        setTimeout(() => {
            createModal(
                '🤝 Draw Game!',
                `<div class="text-center">
                    <div class="text-6xl mb-4">⚖️</div>
                    <p class="text-lg mb-4">${message}</p>
                    <div class="bg-warning bg-opacity-10 rounded-lg p-4 mb-4">
                        <p class="text-warning font-bold">Final Score: ${gameState.playerCollection.length} - ${gameState.opponentCollection.length}</p>
                        <p class="text-warning">Both players avoided poison and collected 11 candies!</p>
                    </div>
                    <p class="text-gray-600">Ready for a tiebreaker round?</p>
                </div>`,
                [
                    { text: 'New Round', action: () => { closeModal(); startNewRound(); }, class: 'btn-primary' },
                    { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
                ]
            );
        }, 1000);
    } else if (playerWon) {
        // Victory modal with different rewards based on game mode
        let coinReward = gameState.playerCollection.length * 5; // Base reward
        let diamondReward = Math.floor(gameState.playerCollection.length / 3); // Base diamonds
        let prizeAmount = 0;

        // Handle online game prizes
        if (gameState.gameMode === 'online' && gameState.gameCost && gameState.selectedCity) {
            // Award the arena prize
            prizeAmount = awardGamePrize(gameState.selectedCity, gameState.gameCost, true, gameState.playerName);
            coinReward = 0; // Don't add base reward for online games, just the prize
            diamondReward = Math.floor(prizeAmount / 1000); // Diamonds based on prize amount

            setTimeout(() => {
                createModal(
                    '🏆 Arena Victory!',
                    `<div class="text-center">
                        <div class="text-6xl mb-4">🏆</div>
                        <p class="text-lg mb-4">${message}</p>
                        <div class="bg-success bg-opacity-10 rounded-lg p-4">
                            <p class="text-success font-bold text-xl">🎉 ${gameState.selectedCity} Arena Champion!</p>
                            <p class="text-success font-bold text-lg">Prize: ${prizeAmount.toLocaleString()} Coins 💰</p>
                            <p class="text-info">+${diamondReward} Diamonds 💎</p>
                            <p class="text-gray-600 text-sm mt-2">Entry fee: ${gameState.gameCost.toLocaleString()} coins</p>
                        </div>
                    </div>`,
                    [
                        { text: 'Play Again', action: () => { closeModal(); showScreen('page2'); }, class: 'btn-primary' },
                        { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
                    ]
                );
            }, 1000);
        } else {
            // Add difficulty-based bonus for offline mode
            if (gameState.gameMode === 'offline' || gameState.gameMode === 'ai') {
                switch (gameState.aiDifficulty) {
                    case 'easy':
                        coinReward += 50;
                        break;
                    case 'medium':
                        coinReward += 100;
                        break;
                    case 'hard':
                        coinReward += 200;
                        diamondReward += 1; // Extra diamond for hard mode
                        break;
                }
            }

            // Apply the rewards to the player's balance
            const currentCoins = parseInt(document.getElementById('coins-count').textContent);
            const currentDiamonds = parseInt(document.getElementById('diamonds-count').textContent);
            const newCoins = currentCoins + coinReward;
            const newDiamonds = currentDiamonds + diamondReward;

            // Update displays using currency manager formatter if available
            const formatFn = (val) => typeof currencyManager !== 'undefined' ? currencyManager.formatNumber(val) : val.toLocaleString();

            document.getElementById('coins-count').textContent = formatFn(newCoins);
            document.getElementById('diamonds-count').textContent = formatFn(newDiamonds);

            const coinsProfile = document.getElementById('coins-profile');
            const diamondsProfile = document.getElementById('diamonds-profile');
            if (coinsProfile) coinsProfile.textContent = formatFn(newCoins);
            if (diamondsProfile) diamondsProfile.textContent = formatFn(newDiamonds);

            // Save to localStorage
            localStorage.setItem('playerCoins', newCoins.toString());
            localStorage.setItem('playerDiamonds', newDiamonds.toString());
            localStorage.setItem('pcd_coins', newCoins.toString());
            localStorage.setItem('pcd_diamonds', newDiamonds.toString());

            setTimeout(() => {
                createModal(
                    '🎉 Congratulations!',
                    `<div class="text-center">
                        <div class="text-6xl mb-4">🏆</div>
                        <p class="text-lg mb-4">${message}</p>
                        <div class="bg-success bg-opacity-10 rounded-lg p-4">
                            <p class="text-success font-bold">+${gameState.playerCollection.length * 10} XP</p>
                            <p class="text-success">+${coinReward} Coins 💰</p>
                            <p class="text-info">+${diamondReward} Diamonds 💎</p>
                            ${(gameState.gameMode === 'offline' || gameState.gameMode === 'ai') ?
                        `<p class="text-warning text-sm mt-2">Difficulty Bonus: ${gameState.aiDifficulty.charAt(0).toUpperCase() + gameState.aiDifficulty.slice(1)} Mode</p>` : ''}
                        </div>
                    </div>`,
                    [
                        { text: 'Play Again', action: () => { closeModal(); startNewGameNew(); }, class: 'btn-primary' },
                        { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
                    ]
                );
            }, 1000);
        }
    } else {
        // Loss modal
        setTimeout(() => {
            createModal(
                '💔 Game Over',
                `<div class="text-center">
                    <div class="text-6xl mb-4">😞</div>
                    <p class="text-lg mb-4">${message}</p>
                    <div class="bg-danger bg-opacity-10 rounded-lg p-4">
                        <p class="text-danger">Better luck next time!</p>
                        <p class="text-danger">Final Score: ${gameState.playerCollection.length}/11</p>
                    </div>
                </div>`,
                [
                    { text: 'Try Again', action: () => { closeModal(); startNewGameNew(); }, class: 'btn-primary' },
                    { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
                ]
            );
        }, 1000);
    }
}

// Function to start a new round after a draw
function startNewRound() {
    console.log('🔄 Starting new round after draw...');

    // Reset game state for new round
    gameState.gameEnded = false;
    gameState.gameStarted = false;
    gameState.playerCollection = [];
    gameState.opponentCollection = [];
    gameState.selectedPoison = null;
    gameState.opponentPoison = null;
    gameState.isPlayerTurn = true;
    gameState.round = 1;

    // Show notification
    showNotification('🔄 Starting new round!', 'info', 2000);

    // Start a new game
    startNewGameNew();
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
                // Update ALL UI components including header progress
                updateAllGameDisplays();

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
async function loadLeaderboard() {
    // Try to fetch from backend
    try {
        if (isConnectedToBackend) {
            const [winsRes, winrateRes, coinsRes] = await Promise.all([
                fetch('http://localhost:8000/leaderboard/wins'),
                fetch('http://localhost:8000/leaderboard/winrate'),
                fetch('http://localhost:8000/leaderboard/coins')
            ]);

            const winsData = await winsRes.json();
            const winrateData = await winrateRes.json();
            const coinsData = await coinsRes.json();

            if (winsData.success) {
                const leaderboardData = {
                    wins: winsData.data.leaderboard.map(p => ({
                        name: p.name,
                        wins: p.wins,
                        games: p.games
                    })),
                    winrate: winrateData.success ? winrateData.data.leaderboard.map(p => ({
                        name: p.name,
                        wins: p.wins,
                        games: p.games
                    })) : [],
                    coins: coinsData.success ? coinsData.data.leaderboard.map(p => ({
                        name: p.name,
                        coins: p.coins,
                        wins: p.wins,
                        games: p.games
                    })) : []
                };

                showLeaderboardTab('wins', leaderboardData);
                console.log('📊 Leaderboard loaded from backend');
                return;
            }
        }
    } catch (error) {
        console.error('Error loading leaderboard from backend:', error);
    }

    // Fallback to mock data
    loadLeaderboardMock();
}

function loadLeaderboardMock() {
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
        coins: [
            { name: 'RichPlayer', coins: 50000, wins: 30, games: 40 },
            { name: 'CoinKing', coins: 35000, wins: 25, games: 35 },
            { name: gameState.playerName, coins: playerBalance || 10000, wins: gameState.stats.wins, games: gameState.stats.totalGames }
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
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';

    let entries = [];
    switch (tab) {
        case 'wins':
            entries = (data.wins || []).sort((a, b) => b.wins - a.wins);
            break;
        case 'winrate':
            entries = (data.winrate || [])
                .filter(entry => entry.games > 0)
                .sort((a, b) => (b.wins / b.games) - (a.wins / a.games));
            break;
        case 'coins':
            entries = (data.coins || []).sort((a, b) => b.coins - a.coins);
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
        switch (tab) {
            case 'wins':
                statText = `${entry.wins} wins (${entry.games} games)`;
                break;
            case 'winrate':
                const winRate = entry.games > 0 ? Math.round((entry.wins / entry.games) * 100) : 0;
                statText = `${winRate}% (${entry.wins}/${entry.games})`;
                break;
            case 'coins':
                statText = `${entry.coins?.toLocaleString() || 0} coins`;
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

// ===== COIN BALANCE MANAGEMENT WITH BACKEND INTEGRATION =====

let playerBalance = 10000; // Starting balance
let isConnectedToBackend = false;

// Check if backend is available
async function checkBackendConnection() {
    try {
        const response = await fetch('http://localhost:8000/health', { timeout: 5000 });
        if (response.ok) {
            isConnectedToBackend = true;
            updateConnectionStatus(true);
            console.log('✅ Backend connected');
        } else {
            isConnectedToBackend = false;
            updateConnectionStatus(false);
            console.log('⚠️ Backend unavailable, using local storage');
        }
    } catch (error) {
        isConnectedToBackend = false;
        updateConnectionStatus(false);
        console.log('⚠️ Backend connection failed, using local storage');
    }
    return isConnectedToBackend;
}

// ===== ERROR HANDLING & RETRY LOGIC =====

// Fetch with retry and exponential backoff
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            if (!response.ok && response.status >= 500) {
                throw new Error(`Server error: ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error;
            console.warn(`API call attempt ${attempt + 1}/${maxRetries} failed:`, error.message);

            if (attempt < maxRetries - 1) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed
    showNotification('Connection issue. Please check your network.', 'error');
    throw lastError;
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status');
    if (statusIndicator) {
        if (connected) {
            statusIndicator.innerHTML = '<span class="text-green-500">●</span> Online';
            statusIndicator.className = 'text-xs text-green-600';
        } else {
            statusIndicator.innerHTML = '<span class="text-yellow-500">●</span> Offline Mode';
            statusIndicator.className = 'text-xs text-yellow-600';
        }
    }
}

// Monitor online/offline status
window.addEventListener('online', () => {
    console.log('🌐 Network connection restored');
    showNotification('Connection restored!', 'success');
    checkBackendConnection();
});

window.addEventListener('offline', () => {
    console.log('📴 Network connection lost');
    isConnectedToBackend = false;
    updateConnectionStatus(false);
    showNotification('You are offline. Some features may be limited.', 'warning');
});

// Periodic connection check (every 30 seconds)
setInterval(() => {
    if (!document.hidden) {
        checkBackendConnection();
    }
}, 30000);


// Get player balance from backend or local storage
async function getPlayerBalance(playerName = 'Player') {
    try {
        if (isConnectedToBackend) {
            const response = await fetch('http://localhost:8000/players/balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player_name: playerName })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return data.data.coin_balance;
                }
            }
        }

        // Fallback to local storage
        const stored = localStorage.getItem('playerCoins');
        return stored ? parseInt(stored) : 10000;
    } catch (error) {
        console.error('Error getting player balance:', error);
        return 10000;
    }
}

// Process coin transaction through backend or local storage
async function processCoinTransaction(amount, transactionType, description = null, arenaType = null, gameId = null) {
    const playerName = gameState.playerName || 'Player';

    try {
        if (isConnectedToBackend) {
            const response = await fetch('http://localhost:8000/players/transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player_name: playerName,
                    amount: amount,
                    transaction_type: transactionType,
                    description: description,
                    arena_type: arenaType,
                    game_id: gameId
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return {
                        success: true,
                        newBalance: data.data.new_balance,
                        previousBalance: data.data.previous_balance
                    };
                } else {
                    return {
                        success: false,
                        error: data.message,
                        currentBalance: data.data ? data.data.current_balance : null,
                        shortfall: data.data ? data.data.shortfall : null
                    };
                }
            }
        }

        // Fallback to local storage
        const currentBalance = await getPlayerBalance(playerName);
        const newBalance = currentBalance + amount;

        if (newBalance < 0) {
            return {
                success: false,
                error: 'Insufficient funds',
                currentBalance: currentBalance,
                shortfall: Math.abs(newBalance)
            };
        }

        localStorage.setItem('playerCoins', newBalance.toString());
        return {
            success: true,
            newBalance: newBalance,
            previousBalance: currentBalance
        };

    } catch (error) {
        console.error('Error processing coin transaction:', error);
        return {
            success: false,
            error: 'Transaction failed'
        };
    }
}

// Update arena statistics
async function updateArenaStatistics(arenaType, entryFee, prizeAmount, serviceFee) {
    try {
        if (isConnectedToBackend) {
            const response = await fetch('http://localhost:8000/arena/stats/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    arena_type: arenaType.toLowerCase(),
                    entry_fee: entryFee,
                    prize_amount: prizeAmount,
                    service_fee: serviceFee
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📊 Arena stats updated:', data.message);
            }
        }
    } catch (error) {
        console.error('Error updating arena stats:', error);
    }
}

// Enhanced updatePlayerBalanceDisplay function
async function updatePlayerBalanceDisplay() {
    try {
        // Initialize backend connection
        await checkBackendConnection();

        // Get current balance
        const balance = await getPlayerBalance(gameState.playerName);

        // Update all balance displays
        const balanceElements = document.querySelectorAll('#player-balance, .player-balance, [data-balance]');
        balanceElements.forEach(element => {
            element.textContent = balance.toLocaleString();
        });

        // Update global variable
        playerBalance = balance;

        console.log(`💰 Balance updated: ${balance.toLocaleString()} coins`);
        return balance;
    } catch (error) {
        console.error('Error updating balance display:', error);
        return 10000;
    }
}

// Enhanced canAffordGame function
async function canAffordGame(city, cost) {
    const balance = await getPlayerBalance(gameState.playerName);
    return balance >= cost;
}

// Enhanced deductCoins function
async function deductCoins(amount, reason, arenaType = null, gameId = null) {
    const result = await processCoinTransaction(
        -amount,
        'game_entry',
        reason,
        arenaType,
        gameId
    );

    if (result.success) {
        updatePlayerBalanceDisplay();
        console.log(`💸 ${amount} coins deducted: ${reason}`);
        return result.newBalance;
    } else {
        console.error('Failed to deduct coins:', result.error);
        return null;
    }
}

// Enhanced addCoins function
async function addCoins(amount, reason, arenaType = null, gameId = null) {
    const result = await processCoinTransaction(
        amount,
        'prize_payout',
        reason,
        arenaType,
        gameId
    );

    if (result.success) {
        updatePlayerBalanceDisplay();
        console.log(`💰 ${amount} coins added: ${reason}`);
        return result.newBalance;
    } else {
        console.error('Failed to add coins:', result.error);
        return null;
    }
}

// Helper functions for city information
function getCityIcon(city) {
    const icons = {
        'Dubai': '🏙️',
        'Cairo': '🏛️',
        'Oslo': '🏔️'
    };
    return icons[city] || '🏟️';
}

function getCityTimer(city) {
    const timers = {
        'Dubai': 30,
        'Cairo': 20,
        'Oslo': 10
    };
    return timers[city] || 30;
}

function getPrizeAmount(entryCost) {
    // Calculate prize amount based on exact game rules
    // Dubai: 500*2=1000, fee=50, prize=950
    // Cairo: 1000*2=2000, fee=100, prize=1900  
    // Oslo: 5000*2=10000, fee=500, prize=9500
    const prizeMap = {
        500: 950,   // Dubai
        1000: 1900, // Cairo
        5000: 9500  // Oslo
    };

    return prizeMap[entryCost] || ((entryCost * 2) - Math.floor(entryCost * 2 * 0.05));
}

// Online game starter from city selection
// Start city-specific matchmaking
function startCityMatchmaking(city, cost, prize) {
    console.log(`🌍 Starting ${city} matchmaking: ${cost} coins entry, ${prize} coins prize`);
    startOnlineGame(city, cost);
}

function startOnlineGame(city, cost) {
    console.log(`Starting online game in ${city} for ${cost} coins`);

    // Update balance display first
    const currentCoins = updatePlayerBalanceDisplay();

    // Check if this is a matchmaking game
    if (gameState.isMatchmakingGame) {
        console.log('🎮 Matchmaking game - city selected:', city);

        // For matchmaking games, validate and process payment immediately
        if (!processMatchmakingPayment(cost, city)) {
            // Payment failed, user was already notified
            return;
        }

        // Store the selection and payment info
        gameState.selectedCity = city;
        gameState.gameCost = cost;

        // Show city-specific info with payment confirmation
        const prizeAmount = getPrizeAmount(cost);
        showNotification(`✅ ${city} Arena: Entry paid! Prize pool: ${prizeAmount.toLocaleString()} coins`, 'success', 3000);

        // Go to poison selection
        setTimeout(() => {
            showScreen('page4');
            initializePoisonSelection();
        }, 500);

        return;
    }

    // Regular online game flow (non-matchmaking)
    // Check if player has enough coins
    if (!canAffordGame(city, cost)) {
        const shortfall = cost - currentCoins;
        createModal(
            '💰 Insufficient Balance',
            `<div class="text-center">
                <div class="text-6xl mb-4">🏦</div>
                <p class="text-lg mb-4">You need <strong>${cost.toLocaleString()}</strong> coins to enter ${city}</p>
                <p class="text-gray-600 mb-4">Current balance: <strong>${currentCoins.toLocaleString()}</strong> coins</p>
                <p class="text-red-600">You need <strong>${shortfall.toLocaleString()}</strong> more coins</p>
                <div class="bg-blue-50 rounded-lg p-4 mt-4">
                    <p class="text-sm text-blue-700">💡 <strong>Tip:</strong> Play offline games or complete daily challenges to earn more coins!</p>
                </div>
            </div>`,
            [
                { text: 'Play Offline Instead', action: () => { closeModal(); showScreen('page7'); }, class: 'btn-primary' },
                { text: 'OK', action: closeModal, class: 'btn-secondary' }
            ]
        );
        return;
    }

    // Show confirmation modal for entry fee
    const prizeAmount = getPrizeAmount(cost);
    createModal(
        `🏟️ Enter ${city} Arena`,
        `<div class="text-center">
            <div class="text-6xl mb-4">${getCityIcon(city)}</div>
            <h3 class="text-xl font-bold mb-4">${city} Arena</h3>
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div class="text-gray-600">Entry Fee</div>
                        <div class="font-bold text-red-600">${cost.toLocaleString()} coins</div>
                    </div>
                    <div>
                        <div class="text-gray-600">Prize Pool</div>
                        <div class="font-bold text-green-600">${prizeAmount.toLocaleString()} coins</div>
                    </div>
                </div>
            </div>
            <div class="bg-blue-50 rounded-lg p-3 mb-4">
                <div class="text-sm text-blue-700">⏰ Turn Timer: ${getCityTimer(city)} seconds</div>
            </div>
            <p class="text-gray-600">Your balance after entry: <strong>${(currentCoins - cost).toLocaleString()}</strong> coins</p>
        </div>`,
        [
            {
                text: `Pay ${cost.toLocaleString()} Coins & Play`,
                action: () => {
                    closeModal();
                    proceedWithOnlineGame(city, cost);
                },
                class: 'btn-primary'
            },
            { text: 'Cancel', action: closeModal, class: 'btn-secondary' }
        ]
    );
}

// Proceed with online game after confirmation
function proceedWithOnlineGame(city, cost) {
    // Deduct coins
    const newBalance = deductCoins(cost, `${city} Arena entry`);

    // Set game mode
    gameState.gameMode = 'online';
    gameState.selectedCity = city;
    gameState.gameCost = cost;

    // Initialize player name if not set
    if (!gameState.playerName) {
        gameState.playerName = 'Player 1';
    }

    // Show success message
    showNotification(`💳 Entry fee paid! Balance: ${newBalance.toLocaleString()} coins`, 'success', 3000);

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
            ${buttons.length > 0 ? buttons.map((btn, index) => `<button class="btn ${btn.class || 'btn-secondary'}" id="modal-btn-${index}">${btn.text}</button>`).join('') : '<button class="btn btn-primary" onclick="closeModal()">Close</button>'}
        </div>
    `;

    // Add event listeners for buttons after creating the modal
    if (buttons.length > 0) {
        buttons.forEach((btn, index) => {
            const buttonElement = modalContent.querySelector(`#modal-btn-${index}`);
            if (buttonElement && btn.action) {
                buttonElement.addEventListener('click', btn.action);
            }
        });
    }

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

    // Enhanced: Generate completely unique candy sets using enhanced system
    try {
        // Try enhanced candy pool first
        if (typeof generateEnhancedGameCandies === 'function') {
            const enhancedCandies = generateEnhancedGameCandies('Dubai'); // AI games default to Dubai
            gameState.playerCandies = enhancedCandies.playerCandies;
            gameState.opponentCandies = enhancedCandies.opponentCandies;
            console.log('✅ Successfully generated enhanced candy sets for AI game');
        } else {
            // Use legacy system
            const uniqueCandySets = generateUniqueGameCandies();
            gameState.playerCandies = uniqueCandySets.playerCandies;
            gameState.opponentCandies = uniqueCandySets.opponentCandies;
            console.log('✅ Successfully generated unique candy sets for AI game');
        }
    } catch (error) {
        console.error('❌ Error generating candies:', error);
        // Fallback: create simple unique arrays
        const shuffled = [...CANDY_TYPES].sort(() => Math.random() - 0.5);
        gameState.playerCandies = shuffled.slice(0, 12);
        gameState.opponentCandies = shuffled.slice(12, 24);
        console.log('✅ Used fallback candy generation');
    }
    gameState.playerCollection = [];
    gameState.opponentCollection = [];

    console.log('✅ Generated unique candies for AI game:');
    console.log('   Player:', gameState.playerCandies);
    console.log('   Opponent:', gameState.opponentCandies);

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
    // Use the unified interface for offline mode
    createUnifiedGameInterface('offline');

    console.log('Created offline game interface using unified system');
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
    // Generate completely unique candy sets using new system
    const uniqueCandySets = generateUniqueGameCandies();
    gameState.playerCandies = uniqueCandySets.playerCandies;
    gameState.opponentCandies = uniqueCandySets.opponentCandies;

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
async function claimDailyReward() {
    const playerName = gameState.playerName || 'Player';

    try {
        // Check if backend is available
        if (isConnectedToBackend) {
            const response = await fetch('http://localhost:8000/players/daily-reward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player_name: playerName })
            });

            const data = await response.json();

            if (data.success) {
                // Update balance display from server
                await updatePlayerBalanceDisplay();

                // Update local currency manager if available
                if (typeof currencyManager !== 'undefined') {
                    currencyManager.currency.coins = data.data.new_balance;
                    currencyManager.saveCurrency();
                }

                showNotification(data.message, 'success');
                console.log(`🎁 Daily reward claimed: +${data.data.reward_amount} coins`);
            } else {
                // Show cooldown message from server
                showNotification(data.message, 'warning');
                console.log('⏰ Daily reward on cooldown');
            }
            return;
        }
    } catch (error) {
        console.error('Error claiming daily reward from backend:', error);
        // Fall through to localStorage fallback
    }

    // Fallback to localStorage if backend unavailable
    claimDailyRewardLocal();
}

// Fallback function for when backend is unavailable
function claimDailyRewardLocal() {
    const lastClaim = localStorage.getItem('pcd_last_daily_claim');
    const today = new Date().toDateString();

    if (lastClaim === today) {
        showNotification('Daily reward already claimed today!', 'warning');
        return;
    }

    const coinsCount = parseInt(document.getElementById('coins-count').textContent.replace(/,/g, '')) || 0;
    const diamondsCount = parseInt(document.getElementById('diamonds-count').textContent.replace(/,/g, '')) || 0;
    const newCoinsCount = coinsCount + 1000;  // PRD: 1000 coins per daily login (matching backend)
    const newDiamondsCount = diamondsCount + 1;

    const formatFn = (val) => typeof currencyManager !== 'undefined' ? currencyManager.formatNumber(val) : val.toLocaleString();

    document.getElementById('coins-count').textContent = formatFn(newCoinsCount);
    document.getElementById('diamonds-count').textContent = formatFn(newDiamondsCount);
    localStorage.setItem('pcd_coins', newCoinsCount.toString());
    localStorage.setItem('pcd_diamonds', newDiamondsCount.toString());
    localStorage.setItem('pcd_last_daily_claim', today);

    showNotification('Daily reward claimed! +1,000 coins +1 diamond', 'success');
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

    switch (type) {
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

function removeAds() {
    const adsRemoved = localStorage.getItem('pcd_ads_removed') === 'true';

    if (adsRemoved) {
        createModal(
            '✅ Ads Already Removed',
            `<div class="text-center">
                <div class="text-6xl mb-4">🚫</div>
                <h3 class="text-xl font-bold mb-4">Ad-Free Experience</h3>
                <p class="text-lg mb-4">You already have the premium ad-free experience!</p>
                <div class="bg-success bg-opacity-10 rounded-lg p-4">
                    <p class="text-success font-bold">✓ No advertisements</p>
                    <p class="text-success">✓ Faster loading times</p>
                    <p class="text-success">✓ Premium support</p>
                </div>
            </div>`,
            [{ text: 'Great!', action: closeModal, class: 'btn-success' }]
        );
        return;
    }

    createModal(
        '🚫 Remove Ads - Premium Upgrade',
        `<div class="text-center">
            <div class="text-6xl mb-4">✨</div>
            <h3 class="text-xl font-bold mb-4">Upgrade to Premium</h3>
            <p class="text-lg mb-4">Remove all ads for a better gaming experience</p>
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-4">
                <div class="text-2xl font-bold mb-2 text-green-600">Only $5.00</div>
                <div class="text-sm text-gray-600 mb-4">One-time payment • Permanent upgrade</div>
                <div class="space-y-2 text-left">
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span class="text-sm">No more advertisements</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span class="text-sm">Faster game performance</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span class="text-sm">Premium player status</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span class="text-sm">Support game development</span>
                    </div>
                </div>
            </div>
            <div class="text-sm text-gray-600">
                Secure payment processing • 30-day money-back guarantee
            </div>
        </div>`,
        [
            {
                text: 'Purchase Premium ($5)',
                action: () => {
                    closeModal();
                    processPayment();
                },
                class: 'btn-success'
            },
            { text: 'Maybe Later', action: closeModal, class: 'btn-secondary' }
        ]
    );
}

function processPayment() {
    // Simulate payment processing
    createModal(
        '💳 Processing Payment',
        `<div class="text-center">
            <div class="text-6xl mb-4">⏳</div>
            <h3 class="text-xl font-bold mb-4">Processing Payment</h3>
            <p class="text-lg mb-4">Please wait while we process your payment...</p>
            <div class="bg-blue-50 rounded-lg p-4 mb-4">
                <div class="text-lg font-bold mb-2">Payment Details:</div>
                <div class="text-sm text-gray-600">Amount: $5.00</div>
                <div class="text-sm text-gray-600">Item: Premium Ad-Free Experience</div>
            </div>
            <div class="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        </div>`,
        [] // No buttons during processing
    );

    // Simulate payment processing delay
    setTimeout(() => {
        // Mark ads as removed
        localStorage.setItem('pcd_ads_removed', 'true');
        localStorage.setItem('pcd_premium_purchase_date', new Date().toISOString());

        // Give bonus diamonds for purchase
        const currentDiamonds = parseInt(document.getElementById('diamonds-count').textContent);
        const bonusDiamonds = currentDiamonds + 10; // Bonus 10 diamonds for purchase
        document.getElementById('diamonds-count').textContent = bonusDiamonds;
        document.getElementById('diamonds-profile').textContent = bonusDiamonds;
        localStorage.setItem('pcd_diamonds', bonusDiamonds.toString());
        localStorage.setItem('playerDiamonds', bonusDiamonds.toString());

        // Show success message
        createModal(
            '🎉 Payment Successful!',
            `<div class="text-center">
                <div class="text-6xl mb-4">✨</div>
                <h3 class="text-xl font-bold mb-4">Welcome to Premium!</h3>
                <p class="text-lg mb-4">Your payment has been processed successfully</p>
                <div class="bg-success bg-opacity-10 rounded-lg p-6 mb-4">
                    <div class="text-success font-bold text-lg mb-2">Premium Benefits Activated:</div>
                    <div class="space-y-1 text-left">
                        <div class="flex items-center space-x-2">
                            <span class="text-success">✓</span>
                            <span>No more advertisements</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="text-success">✓</span>
                            <span>Faster loading times</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="text-success">✓</span>
                            <span>Premium player badge</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="text-success">✓</span>
                            <span>Priority support</span>
                        </div>
                    </div>
                </div>
                <div class="bg-blue-50 rounded-lg p-4 mb-4">
                    <div class="text-blue-600 font-bold">🎁 Bonus: +10 Diamonds!</div>
                    <div class="text-sm text-gray-600">Thank you for supporting the game!</div>
                </div>
                <div class="text-sm text-gray-600">
                    Receipt sent to your email • Transaction ID: PCD-${Date.now()}
                </div>
            </div>`,
            [{ text: 'Enjoy Premium!', action: closeModal, class: 'btn-success' }]
        );

        showNotification('🎉 Premium activated! Payment successful!', 'success');
    }, 2000); // 2 second delay to simulate processing
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
    console.log('🎮 Initializing game board in page...');

    // COMPLETELY REMOVE the old vertical card interface for online modes
    const gameContainer = document.getElementById('page3');
    if (gameContainer) {
        // Remove the old premium game board (vertical cards)
        const oldGameBoard = gameContainer.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2.gap-8');
        if (oldGameBoard) {
            oldGameBoard.remove();
            console.log('🗑️ Removed old vertical card interface');
        }

        // Also remove old action panel that might conflict
        const oldActionPanel = gameContainer.querySelector('.card.mt-6');
        if (oldActionPanel && !oldActionPanel.id) { // Don't remove if it's part of unified interface
            oldActionPanel.remove();
            console.log('🗑️ Removed old action panel');
        }
    }

    // Ensure unified interface exists for online modes
    const unifiedInterface = document.getElementById('unified-game-interface');
    if (!unifiedInterface) {
        createUnifiedGameInterface(gameState.gameMode);
    }

    // Show the unified interface
    const unifiedInterfaceElement = document.getElementById('unified-game-interface');
    if (unifiedInterfaceElement) {
        unifiedInterfaceElement.style.display = 'block';
        console.log('✅ Unified offline-style interface displayed');
    }

    // Initialize offline-style interface for online modes
    initializeUnifiedOfflineStyleBoard();

    // Update game status
    updateGameStatus('🎯 Your turn - pick a candy from opponent!');

    // CRITICAL: Update header progress immediately upon initialization
    updateAllGameDisplays();

    console.log('✅ Game board initialized with offline-style design and header progress updated for', gameState.gameMode, 'mode');
}

// New function to initialize the offline-style board for online modes
function initializeUnifiedOfflineStyleBoard() {
    console.log('🎮 Initializing unified offline-style game board...');

    // DEBUG: Log current candy arrays
    console.log('🔍 DEBUG - Current gameState candy arrays:');
    console.log('  playerCandies:', gameState.playerCandies);
    console.log('  opponentCandies:', gameState.opponentCandies);
    console.log('  gameMode:', gameState.gameMode);
    console.log('  gameId:', gameState.gameId);
    console.log('  currentGameState:', gameState.currentGameState);

    // CRITICAL: For online modes, ensure candy arrays are populated from backend data
    if ((gameState.gameMode === 'online' || gameState.gameMode === 'friends') && gameState.currentGameState) {
        console.log('🌐 Online mode detected - populating candies from backend state');

        if (gameState.currentGameState.player1 && gameState.currentGameState.player1.owned_candies) {
            gameState.playerCandies = Array.from(gameState.currentGameState.player1.owned_candies);
            console.log('✅ Loaded player candies from backend:', gameState.playerCandies);
        }

        if (gameState.currentGameState.player2 && gameState.currentGameState.player2.owned_candies) {
            gameState.opponentCandies = Array.from(gameState.currentGameState.player2.owned_candies);
            console.log('✅ Loaded opponent candies from backend:', gameState.opponentCandies);
        }

        // Also update collections if available
        if (gameState.currentGameState.player1 && gameState.currentGameState.player1.collected_candies) {
            gameState.playerCollection = Array.from(gameState.currentGameState.player1.collected_candies);
        }

        if (gameState.currentGameState.player2 && gameState.currentGameState.player2.collected_candies) {
            gameState.opponentCollection = Array.from(gameState.currentGameState.player2.collected_candies);
        }
    }

    // FALLBACK: Generate candies if still empty (for offline mode or failed online load)
    if (!gameState.playerCandies || gameState.playerCandies.length === 0) {
        console.warn('⚠️ Player candies missing! Generating fallback candies...');
        const uniqueCandySets = generateUniqueGameCandies();
        gameState.playerCandies = uniqueCandySets.playerCandies;
        gameState.opponentCandies = uniqueCandySets.opponentCandies;
        console.log('🔄 Generated fallback candies - Player:', gameState.playerCandies, 'Opponent:', gameState.opponentCandies);
    }

    // Get current city theme for candy styling
    const cityTheme = getCityTheme(gameState.gameMode);

    // Update player candy grid (display only - shows what opponent can pick from)
    const playerCandyGrid = document.getElementById('player-candy-grid');
    if (playerCandyGrid) {
        playerCandyGrid.innerHTML = '';
        console.log(`🍭 Populating player candy grid with ${gameState.playerCandies.length} candies`);

        gameState.playerCandies.forEach((candy, index) => {
            // Skip if opponent already collected (disappeared)
            if (gameState.opponentCollection.includes(candy)) return;

            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item-enhanced';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;

            // Apply city-specific styling
            candyElement.style.cssText = `
                padding: 12px;
                font-size: 20px;
                text-align: center;
                background: ${cityTheme.gridStyle ? cityTheme.gridStyle.replace('background: ', '') : '#ffffff'};
                border: 2px solid ${cityTheme.primaryColor || '#ced4da'};
                border-radius: 8px;
                transition: all 0.2s ease;
                user-select: none;
                font-weight: normal;
                color: #495057;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                margin: 4px;
            `;

            // Highlight poison if set
            if (candy === gameState.selectedPoison) {
                candyElement.style.borderColor = '#dc3545';
                candyElement.style.background = '#f8d7da';
                candyElement.title = 'Your Poison ☠️';
            }

            playerCandyGrid.appendChild(candyElement);
        });

        console.log(`✅ Player candy grid populated with ${playerCandyGrid.children.length} visible candies`);
    }

    // Update opponent candy grid (clickable)
    const opponentCandyGrid = document.getElementById('opponent-candy-grid');
    if (opponentCandyGrid) {
        opponentCandyGrid.innerHTML = '';
        console.log(`🎯 Populating opponent candy grid with ${gameState.opponentCandies.length} candies`);

        gameState.opponentCandies.forEach((candy, index) => {
            // Skip if already collected (disappeared)
            if (gameState.playerCollection.includes(candy)) return;

            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item-enhanced clickable';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;

            // Enhanced styling with city theme
            candyElement.style.cssText = `
                padding: 12px;
                font-size: 20px;
                text-align: center;
                background: ${cityTheme.gridStyle ? cityTheme.gridStyle.replace('background: ', '') : '#ffffff'};
                border: 2px solid ${cityTheme.primaryColor || '#ced4da'};
                border-radius: 8px;
                transition: all 0.2s ease;
                user-select: none;
                font-weight: normal;
                color: #495057;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                margin: 4px;
                cursor: pointer;
            `;

            // Add hover effects with city theme colors
            candyElement.addEventListener('mouseenter', () => {
                candyElement.style.backgroundColor = cityTheme.primaryColor ? `${cityTheme.primaryColor}33` : '#e3f2fd';
                candyElement.style.transform = 'scale(1.05)';
                candyElement.style.borderColor = cityTheme.primaryColor || '#007bff';
            });

            candyElement.addEventListener('mouseleave', () => {
                candyElement.style.backgroundColor = cityTheme.gridStyle ? cityTheme.gridStyle.replace('background: ', '') : '#ffffff';
                candyElement.style.transform = 'scale(1)';
                candyElement.style.borderColor = cityTheme.primaryColor || '#ced4da';
            });

            // Use unified candy picker
            attachUnifiedCandyPicker(candyElement, candy, index, 'opponent');

            opponentCandyGrid.appendChild(candyElement);
        });

        console.log(`✅ Opponent candy grid populated with ${opponentCandyGrid.children.length} visible candies`);
    }

    // Update counters
    updateUnifiedCandyCounters();

    // Update round display
    const roundDisplay = document.getElementById('round-display');
    if (roundDisplay) {
        roundDisplay.textContent = gameState.round || 1;
    }

    // Start circular timer for player turns
    if (gameState.isPlayerTurn) {
        setTimeout(() => {
            startCircularTimer();
        }, 500);
    }

    console.log('✅ Unified offline-style game board initialized successfully');
}

function updateUnifiedCandyCounters() {
    // Directly use the length of the remaining candy arrays
    const playerCandyCount = document.getElementById('player-candy-count');
    if (playerCandyCount) {
        playerCandyCount.textContent = `${gameState.playerCandies.length} left`;
    }

    const opponentCandyCount = document.getElementById('opponent-candy-count');
    if (opponentCandyCount) {
        opponentCandyCount.textContent = `${gameState.opponentCandies.length} left`;
    }

    // Update collection status
    const collectionStatus = document.getElementById('collection-status');
    if (collectionStatus) {
        collectionStatus.textContent = `${gameState.playerCollection.length}/11 collected`;
    }
}

async function pickCandyFromOpponent(candy, index, element) {
    if (!gameState.isPlayerTurn || gameState.gameEnded) return;

    // Stop turn timer when player makes a move
    stopTurnTimer();

    try {
        // Use actual player ID for online games, fallback to player1 for practice
        const playerId = gameState.playerId || 'player1';

        // Send pick choice to backend
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/pick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player: playerId,
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

    // Award prizes for online games
    if (playerWon && gameState.gameMode === 'online' && gameState.gameCost && gameState.selectedCity) {
        // Award the arena prize
        const prizeAmount = awardGamePrize(gameState.selectedCity, gameState.gameCost, true, gameState.playerName);
        console.log(`🏆 Arena prize awarded: ${prizeAmount} coins for ${gameState.selectedCity}`);
    }

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
        let modalContent = `<div class="text-center">
            <p class="text-lg mb-4">${message}</p>`;

        if (gameState.gameMode === 'online' && gameState.gameCost && gameState.selectedCity) {
            if (playerWon) {
                const prizeAmount = getPrizeAmount(gameState.gameCost);
                modalContent += `
                    <div class="bg-success bg-opacity-10 rounded-lg p-4 mb-4">
                        <p class="text-success font-bold">🏆 ${gameState.selectedCity} Arena Champion!</p>
                        <p class="text-success">Prize: ${prizeAmount.toLocaleString()} coins 💰</p>
                    </div>`;
            } else {
                modalContent += `
                    <div class="bg-danger bg-opacity-10 rounded-lg p-4 mb-4">
                        <p class="text-danger">Entry fee lost: ${gameState.gameCost.toLocaleString()} coins</p>
                    </div>`;
            }
        }

        modalContent += `
            <div class="text-sm text-gray-600">
                <p>Game ID: ${gameState.gameId.substring(0, 8)}</p>
            </div>
        </div>`;

        createModal(
            playerWon ? '🎉 Victory!' : '😞 Game Over',
            modalContent,
            [
                { text: 'Play Again', action: () => { closeModal(); gameState.gameMode === 'online' ? showScreen('page2') : startNewGameNew(); }, class: 'btn-primary' },
                { text: 'Main Menu', action: () => { closeModal(); showScreen('page1'); }, class: 'btn-secondary' }
            ]
        );
    }, 1500);

    // Update stats
    gameState.updateStats();
    gameState.recordGameResult(playerWon);
}

// Timer functions are defined earlier in the file

// ===== BALANCE RESET FUNCTION =====
function resetBalanceToPRD() {
    console.log('🔄 Resetting balance to PRD specifications...');

    // Set PRD-specified amounts
    const prdCoins = 10000;
    const prdDiamonds = 500;

    // Clear old values and set new ones
    localStorage.setItem('playerCoins', prdCoins.toString());
    localStorage.setItem('playerDiamonds', prdDiamonds.toString());
    localStorage.setItem('pcd_coins', prdCoins.toString());
    localStorage.setItem('pcd_diamonds', prdDiamonds.toString());

    // Update all displays
    const coinsElements = document.querySelectorAll('#coins-count, #coins-profile');
    const diamondsElements = document.querySelectorAll('#diamonds-count, #diamonds-profile');

    coinsElements.forEach(element => {
        if (element) element.textContent = prdCoins;
    });

    diamondsElements.forEach(element => {
        if (element) element.textContent = prdDiamonds;
    });

    console.log(`✅ Balance reset to PRD: ${prdCoins} coins, ${prdDiamonds} diamonds`);

    // Show notification
    showNotification('💰 Balance reset to PRD specifications!', 'success', 3000);
}

// ===== GLOBAL INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
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

    // Initialize saved preferences with PRD enforcement
    let savedCoins = localStorage.getItem('playerCoins') || localStorage.getItem('pcd_coins') || '10000';
    let savedDiamonds = localStorage.getItem('playerDiamonds') || localStorage.getItem('pcd_diamonds') || '500';  // PRD: 500 diamonds for new players

    // Force PRD minimums if stored values are below specification
    if (parseInt(savedCoins) < 10000) {
        savedCoins = '10000';
        localStorage.setItem('playerCoins', savedCoins);
        localStorage.setItem('pcd_coins', savedCoins);
        console.log('⚡ Coins upgraded to PRD minimum: 10,000');
    }

    if (parseInt(savedDiamonds) < 500) {
        savedDiamonds = '500';
        localStorage.setItem('playerDiamonds', savedDiamonds);
        localStorage.setItem('pcd_diamonds', savedDiamonds);
        console.log('⚡ Diamonds upgraded to PRD minimum: 500');
    }

    // Update coin/diamond displays if elements exist
    const coinsElement = document.getElementById('coins-count');
    const diamondsElement = document.getElementById('diamonds-count');
    const coinsProfileElement = document.getElementById('coins-profile');
    const diamondsProfileElement = document.getElementById('diamonds-profile');

    if (coinsElement) coinsElement.textContent = savedCoins;
    if (diamondsElement) diamondsElement.textContent = savedDiamonds;
    if (coinsProfileElement) coinsProfileElement.textContent = savedCoins;
    if (diamondsProfileElement) diamondsProfileElement.textContent = savedDiamonds;

    console.log('🎯 PCD Game initialization complete!');
    console.log(`💰 Current balance: ${savedCoins} coins, ${savedDiamonds} diamonds`);
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
    // Use non-blocking timer for online and friends modes
    if (gameState.gameMode !== 'online' && gameState.gameMode !== 'friends') {
        return;
    }

    // Don't start timer if it's not the player's turn
    if (!gameState.isPlayerTurn || gameState.gameEnded) {
        return;
    }

    console.log('Starting non-blocking turn timer for', gameState.gameMode, 'mode');

    // Play turn start sound
    if (typeof soundManager !== 'undefined') {
        soundManager.play('turnStart');
    }

    gameState.turnTimeRemaining = getDifficultyTimerValue(gameState.aiDifficulty || 'easy'); // Use difficulty-based timer

    // Show ONLY the small timer display (not the blocking overlay)
    const timerDisplay = document.getElementById('turn-timer-display');
    const timerSeconds = document.getElementById('turn-timer-seconds');

    if (timerDisplay) timerDisplay.style.display = 'block';
    if (timerSeconds) timerSeconds.textContent = gameState.turnTimeRemaining;

    // NEVER show the blocking overlay for online mode
    const timerOverlay = document.getElementById('turn-timer-overlay');
    if (timerOverlay) timerOverlay.style.display = 'none';

    // Clear any existing timer
    if (gameState.turnTimer) {
        clearInterval(gameState.turnTimer);
    }

    // Show initial notification (non-blocking)
    showNotification(`⏰ Your turn! ${gameState.turnTimeRemaining} seconds to pick a candy`, 'info', 3000);

    // Start countdown
    gameState.turnTimer = setInterval(() => {
        gameState.turnTimeRemaining--;

        // Update small timer display
        if (timerSeconds) {
            timerSeconds.textContent = gameState.turnTimeRemaining;
        }

        // Play tick sound during last 5 seconds
        if (gameState.turnTimeRemaining <= 5 && gameState.turnTimeRemaining > 0) {
            if (typeof soundManager !== 'undefined') {
                soundManager.play('tick');
            }
        }

        // Show warnings at key intervals (non-blocking notifications)
        if (gameState.turnTimeRemaining === 10) {
            showNotification('⚠️ 10 seconds remaining!', 'warning', 2000);
        } else if (gameState.turnTimeRemaining === 5) {
            showNotification('🚨 5 seconds left!', 'error', 2000);
        }

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
    console.log('Stopping turn timer and ensuring overlay is hidden');

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
    if (timerOverlay) {
        timerOverlay.style.display = 'none';
        console.log('✅ Timer overlay hidden');
    }
    if (timerCountdown) timerCountdown.style.display = 'none';

    // Reset timer values
    gameState.turnTimeRemaining = 0;
}

function handleTimerExpired() {
    console.log('Turn timer expired for online mode');
    stopTurnTimer();

    // For online games, end the game instead of making random moves
    if (gameState.gameMode === 'online' || gameState.gameMode === 'friends') {
        showNotification('⏰ Time expired! You lose this round.', 'error', 4000);

        // End the game with a loss due to timeout
        setTimeout(() => {
            endGame(false, '⏰ You ran out of time! Game Over.');
        }, 1000);
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
    console.log('⏰ Starting difficulty-based PER-TURN timer...');

    // **STEP 1 & 2 FIX: This is now a per-turn timer for ALL game modes**
    // Reset timer for this turn with difficulty-based duration
    turnTimeRemaining = getDifficultyTimerValue(gameState.aiDifficulty || 'easy');

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
    const timerDuration = getDifficultyTimerValue(gameState.aiDifficulty || 'easy');
    showNotification(`⏰ ${currentPlayer} turn - ${timerDuration} seconds!`, 'info', 1500);
}

function stopGameTimer() {
    console.log('⏰ Stopping turn timer...');
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
    turnTimeRemaining = getDifficultyTimerValue(gameState.aiDifficulty || 'easy');
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
        const timerDuration = getDifficultyTimerValue(gameState.aiDifficulty || 'easy');
        const minutes = Math.floor(timerDuration / 60);
        const seconds = timerDuration % 60;
        gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

    // Update player progress in online game header
    const player1Progress = document.getElementById('player1-progress');
    if (player1Progress) {
        const playerScore = gameState.playerCollection ? gameState.playerCollection.length : 0;
        player1Progress.textContent = `(${playerScore}/11)`;
        console.log('✅ Updated player1 progress:', `(${playerScore}/11)`);
    }

    // Update opponent progress in online game header
    const player2Progress = document.getElementById('player2-progress');
    if (player2Progress) {
        const opponentScore = gameState.opponentCollection ? gameState.opponentCollection.length : 0;
        player2Progress.textContent = `(${opponentScore}/11)`;
        console.log('✅ Updated player2 progress:', `(${opponentScore}/11)`);
    }

    // Update round counter in enhanced interface
    const roundDisplay = document.getElementById('round-display');
    if (roundDisplay) {
        const totalMoves = (gameState.playerCollection ? gameState.playerCollection.length : 0) +
            (gameState.opponentCollection ? gameState.opponentCollection.length : 0);
        roundDisplay.textContent = (totalMoves + 1).toString();
    }

    // Update round counter in standard interface
    const roundCounter = document.getElementById('round-counter');
    if (roundCounter) {
        const totalMoves = (gameState.playerCollection ? gameState.playerCollection.length : 0) +
            (gameState.opponentCollection ? gameState.opponentCollection.length : 0);
        roundCounter.textContent = (totalMoves + 1).toString();
    }

    // Update unified interface counters
    if (typeof updateUnifiedCandyCounters === 'function') {
        updateUnifiedCandyCounters();
    }
}

// Enhanced function to update all UI elements after any game state change
function updateAllGameDisplays() {
    console.log('🔄 Updating all game displays...');

    // Always update score display for online game headers
    updateScoreDisplay();

    // Update other game board elements
    if (typeof updateGameBoard === 'function') {
        updateGameBoard();
    }

    if (typeof updateCollections === 'function') {
        updateCollections();
    }

    if (typeof updateGameStatus === 'function') {
        updateGameStatus();
    }

    // Update enhanced interface if it exists
    if (typeof updateUnifiedCandyCounters === 'function') {
        updateUnifiedCandyCounters();
    }

    // Update remaining candy counters
    if (typeof updateRemainingCandyCounters === 'function') {
        updateRemainingCandyCounters();
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
    switch (type) {
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

            // Use unified candy picker
            attachUnifiedCandyPicker(candyElement, candy, index, 'opponent');

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

// ===== ENHANCED GAME BOARD FUNCTIONS =====

// Initialize Enhanced Game Board (Page 8)
function initializeEnhancedGameBoard() {
    console.log('🎮 Initializing Enhanced Game Board...');

    // Update player candy grid
    const playerCandyGrid = document.getElementById('player-candy-grid-enhanced');
    if (playerCandyGrid) {
        playerCandyGrid.innerHTML = '';

        gameState.playerCandies.forEach((candy, index) => {
            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item-enhanced';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;

            // Highlight poison
            if (candy === gameState.selectedPoison) {
                candyElement.style.borderColor = '#dc3545';
                candyElement.style.background = '#f8d7da';
                candyElement.title = 'Your Poison ☠️';
            }

            playerCandyGrid.appendChild(candyElement);
        });
    }

    // Update opponent candy grid (clickable)
    const opponentCandyGrid = document.getElementById('opponent-candy-grid-enhanced');
    if (opponentCandyGrid) {
        opponentCandyGrid.innerHTML = '';

        gameState.opponentCandies.forEach((candy, index) => {
            const candyElement = document.createElement('div');
            candyElement.className = 'candy-item-enhanced clickable';
            candyElement.textContent = candy;
            candyElement.dataset.candy = candy;
            candyElement.dataset.index = index;

            // CRITICAL FIX: ALWAYS make candies clickable when it's player's turn
            candyElement.addEventListener('click', () => {
                console.log(`🍭 Candy clicked: ${candy} (Player turn: ${gameState.isPlayerTurn}, Game ended: ${gameState.gameEnded})`);
                handleEnhancedCandyPick(candy, index);
            });

            // CRITICAL FIX: Only apply visual restrictions, not functional restrictions
            if (!gameState.isPlayerTurn || gameState.gameEnded) {
                candyElement.classList.add('disabled');
                candyElement.style.opacity = '0.6';
                candyElement.style.cursor = 'not-allowed';
            } else {
                candyElement.classList.remove('disabled');
                candyElement.style.opacity = '1';
                candyElement.style.cursor = 'pointer';
            }

            // CRITICAL FIX: Apply subtle styling to match left side design
            candyElement.style.cssText = `
                ${candyElement.style.cssText}
                padding: 12px;
                font-size: 20px;
                text-align: center;
                background: #ffffff;
                border: 2px solid #ced4da;
                border-radius: 8px;
                transition: all 0.2s ease;
                user-select: none;
                font-weight: normal;
                color: #495057;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                margin: 4px;
                position: relative;
            `;

            opponentCandyGrid.appendChild(candyElement);
        });

        console.log(`✅ Created ${gameState.opponentCandies.length} clickable opponent candies`);
    }

    // Update counters
    updateEnhancedCounters();

    // Update round display
    const roundDisplay = document.getElementById('round-display');
    if (roundDisplay) {
        roundDisplay.textContent = gameState.round || 1;
    }

    // Update game status
    updateEnhancedGameStatus();

    // Start circular timer only for player turns
    if (gameState.isPlayerTurn) {
        setTimeout(() => {
            startCircularTimer();
        }, 500);
    }

    console.log('✅ Enhanced Game Board initialized');
}

// Handle Enhanced Candy Pick
function handleEnhancedCandyPick(candy, index) {
    console.log(`🍭 Enhanced candy pick: ${candy}`);

    // Same logic as handleOfflineCandyPick but with enhanced UI updates
    if (gameState.gameEnded || !gameState.isPlayerTurn) {
        console.log('❌ Not player turn or game ended');
        return;
    }

    // Check if already collected
    if (gameState.playerCollection.includes(candy)) {
        console.log('❌ Candy already collected');
        return;
    }

    // Check if it's poison
    if (candy === gameState.opponentPoison) {
        // Show "Got ya!!!" on the winner's profile (AI)
        showCandyPickFeedback('player1', candy, true);
        setTimeout(() => {
            endGame(false, `💀 You picked the poison ${candy}! AI wins!`);
        }, 1000); // Small delay to see the feedback
        return;
    }

    // Add to collection
    gameState.playerCollection.push(candy);

    // Remove from opponent's pool
    const candyIndexInOpponentPool = gameState.opponentCandies.indexOf(candy);
    if (candyIndexInOpponentPool !== -1) {
        gameState.opponentCandies.splice(candyIndexInOpponentPool, 1);
    }

    // Update round counter
    const totalMoves = gameState.playerCollection.length + gameState.opponentCollection.length;
    gameState.round = Math.ceil(totalMoves / 2);

    // Show pickup animation - Profile-based
    showCandyPickFeedback('player1', candy, false);

    // UNIVERSAL GAME LOGIC: Check win condition with new logic
    const winCondition = checkGameWinCondition(gameState);
    if (winCondition.hasWinner) {
        endGame(winCondition.winner === 'player', winCondition.message);
        return;
    }

    if (winCondition.isDraw) {
        endGame(false, winCondition.message, true);  // true for isDraw
        return;
    }

    // Handle turn switching based on universal game logic
    if (winCondition.switchToOpponent) {
        console.log("🔄 Player reached 11 - switching to opponent for final chance");
        gameState.isPlayerTurn = false;
        showNotification('🎉 You reached 11! Opponent gets final chance...', 'info', 3000);
    } else if (winCondition.switchToPlayer) {
        console.log("🔄 Opponent reached 11 - switching to player for final chance");
        gameState.isPlayerTurn = true;
        showNotification('💔 Opponent reached 11! You get final chance...', 'warning', 3000);
    } else {
        // Normal turn switch to AI
        gameState.isPlayerTurn = false;
    }

    // Stop player timer
    stopCircularTimer();

    // Update the enhanced board
    initializeEnhancedGameBoard();

    // AI turn after delay
    setTimeout(() => {
        handleEnhancedAITurn();
    }, 1500);
}

// Handle Enhanced AI Turn
function handleEnhancedAITurn() {
    if (gameState.gameEnded || gameState.isPlayerTurn) {
        console.log('❌ Not AI turn or game ended');
        return;
    }

    console.log('🤖 Enhanced AI turn...');

    // AI picks strategically
    const availableCandies = gameState.playerCandies.filter(candy => candy !== gameState.selectedPoison);

    if (availableCandies.length === 0) {
        endGame(true, `🎉 AI picked your poison ${gameState.selectedPoison}! You win!`);
        return;
    }

    // Pick random candy from safe options
    const randomIndex = Math.floor(Math.random() * availableCandies.length);
    const pickedCandy = availableCandies[randomIndex];

    // Check if AI picked poison
    if (pickedCandy === gameState.selectedPoison) {
        // Show "Got ya!!!" on the winner's profile (player)
        showCandyPickFeedback('player2', pickedCandy, true);
        setTimeout(() => {
            endGame(true, `🎉 AI picked your poison ${pickedCandy}! You win!`);
        }, 1000); // Small delay to see the feedback
        return;
    }

    // Remove from player's pool
    const candyIndexInPlayerPool = gameState.playerCandies.indexOf(pickedCandy);
    if (candyIndexInPlayerPool !== -1) {
        gameState.playerCandies.splice(candyIndexInPlayerPool, 1);
    }

    // Add to AI collection
    if (!gameState.opponentCollection.includes(pickedCandy)) {
        gameState.opponentCollection.push(pickedCandy);
    }

    // Update round counter
    const totalMoves = gameState.playerCollection.length + gameState.opponentCollection.length;
    gameState.round = Math.ceil(totalMoves / 2);

    // UNIVERSAL GAME LOGIC: Check win condition with new logic
    const winCondition = checkGameWinCondition(gameState);
    if (winCondition.hasWinner) {
        endGame(winCondition.winner === 'player', winCondition.message);
        return;
    }

    if (winCondition.isDraw) {
        endGame(false, winCondition.message, true);  // true for isDraw
        return;
    }

    console.log(`🤖 AI picked ${pickedCandy}. Collection: ${gameState.opponentCollection.length}/11`);

    // Handle turn switching based on universal game logic
    if (winCondition.switchToPlayer) {
        console.log("🔄 Opponent reached 11 - switching to player for final chance");
        gameState.isPlayerTurn = true;
        showNotification('💔 Opponent reached 11! You get final chance...', 'warning', 3000);
    } else if (winCondition.switchToOpponent) {
        console.log("🔄 Player reached 11 - switching to opponent for final chance");
        gameState.isPlayerTurn = false;
        showNotification('🎉 You reached 11! Opponent gets final chance...', 'info', 3000);
    } else {
        // Normal turn switch back to player
        gameState.isPlayerTurn = true;
    }

    // Update the enhanced board
    initializeEnhancedGameBoard();

    // Start timer for player's next turn
    setTimeout(() => {
        startCircularTimer();
    }, 1000);

    // Show AI pick feedback - Profile-based
    showCandyPickFeedback('player2', pickedCandy, false);
}

// Update Enhanced Counters
function updateEnhancedCounters() {
    // Update candy counters
    const playerCandyCount = document.getElementById('player-candy-count');
    if (playerCandyCount) {
        playerCandyCount.textContent = `${gameState.playerCandies.length} left`;
    }

    const opponentCandyCount = document.getElementById('opponent-candy-count');
    if (opponentCandyCount) {
        opponentCandyCount.textContent = `${gameState.opponentCandies.length} left`;
    }

    // Update collection status
    const collectionStatus = document.getElementById('collection-status');
    if (collectionStatus) {
        collectionStatus.textContent = `${gameState.playerCollection.length}/11 collected`;
    }
}

// Update Enhanced Game Status
function updateEnhancedGameStatus() {
    const statusText = document.getElementById('game-status-text-enhanced');
    if (statusText) {
        if (gameState.gameEnded) {
            statusText.textContent = '🎮 Game Over';
        } else if (gameState.isPlayerTurn) {
            statusText.textContent = '🎯 Your Turn - Pick a candy!';
        } else {
            statusText.textContent = '⏳ AI Turn - Please wait...';
        }
    }
}

// Enhanced Circular Timer with Proper Game Logic
let currentTimerInterval = null;
let currentTimerTimeout = null;

// Get timer duration based on difficulty level OR city-specific for online modes
function getDifficultyTimerValue(difficulty) {
    // For online modes, use city-specific timers
    if (gameState.gameMode === 'online' && gameState.selectedCity) {
        const cityTimers = {
            'dubai': 30,   // Dubai: 30 seconds
            'cairo': 20,   // Cairo: 20 seconds 
            'oslo': 10     // Oslo: 10 seconds
        };
        const cityTimer = cityTimers[gameState.selectedCity.toLowerCase()];
        if (cityTimer) {
            console.log(`🌍 Using city-specific timer for ${gameState.selectedCity}: ${cityTimer} seconds`);
            return cityTimer;
        }
    }

    // For offline modes, use difficulty-based timers
    const timerMap = {
        'easy': 30,
        'medium': 20,
        'hard': 10
    };
    return timerMap[difficulty] || 30;
}

function startCircularTimer() {
    console.log('🕒 Starting circular timer for player:', gameState.isPlayerTurn ? 'Player 1' : 'Player 2/AI');

    // Stop any existing timer
    stopCircularTimer();

    const player1Progress = document.getElementById('player1-timer-progress');
    const player2Progress = document.getElementById('player2-timer-progress');

    if (!player1Progress || !player2Progress) return;

    const circumference = 2 * Math.PI * 36; // radius = 36
    // Use difficulty-based timer duration
    const duration = getDifficultyTimerValue(gameState.aiDifficulty || 'easy');

    // Reset both timers to empty state
    player1Progress.style.strokeDasharray = circumference;
    player1Progress.style.strokeDashoffset = circumference;
    player1Progress.classList.remove('warning', 'danger');
    player2Progress.style.strokeDasharray = circumference;
    player2Progress.style.strokeDashoffset = circumference;
    player2Progress.classList.remove('warning', 'danger');

    // Determine active player
    const activeProgress = gameState.isPlayerTurn ? player1Progress : player2Progress;

    // For AI turns, don't show timer (AI moves automatically)
    if (!gameState.isPlayerTurn && (gameState.gameMode === 'offline' || gameState.gameMode === 'ai')) {
        console.log('🤖 AI turn - no timer needed');
        return;
    }

    // Start the circular timer animation
    activeProgress.style.transition = 'none';
    activeProgress.style.strokeDashoffset = 0; // Full circle

    // Animate the timer countdown
    setTimeout(() => {
        activeProgress.style.transition = `stroke-dashoffset ${duration}s linear`;
        activeProgress.style.strokeDashoffset = circumference; // Empty circle
    }, 50);

    let timeRemaining = duration;

    // Update timer colors based on time remaining
    currentTimerInterval = setInterval(() => {
        timeRemaining--;

        if (timeRemaining <= 15 && timeRemaining > 10) {
            activeProgress.classList.add('warning');
        } else if (timeRemaining <= 10) {
            activeProgress.classList.remove('warning');
            activeProgress.classList.add('danger');
        }

        if (timeRemaining <= 0) {
            handleTimerExpiry();
        }
    }, 1000);

    // Auto-timeout after duration
    currentTimerTimeout = setTimeout(() => {
        handleTimerExpiry();
    }, duration * 1000);
}

function stopCircularTimer() {
    if (currentTimerInterval) {
        clearInterval(currentTimerInterval);
        currentTimerInterval = null;
    }
    if (currentTimerTimeout) {
        clearTimeout(currentTimerTimeout);
        currentTimerTimeout = null;
    }
}

function handleTimerExpiry() {
    console.log('⏰ Timer expired!');
    stopCircularTimer();

    if (gameState.isPlayerTurn) {
        // Player timeout - END GAME instead of making random move
        showNotification('⏰ Time expired! Game Over!', 'error', 3000);
        endGame(false, '⏰ You ran out of time! Game Over.');
    } else {
        // AI timeout - Player wins
        showNotification('⏰ AI took too long! You win!', 'success', 3000);
        endGame(true, '⏰ Your opponent ran out of time! You win!');
    }
}

function makeRandomPlayerMove() {
    const availableCandies = gameState.opponentCandies;
    if (availableCandies.length > 0) {
        const randomCandy = availableCandies[Math.floor(Math.random() * availableCandies.length)];
        const randomIndex = gameState.opponentCandies.indexOf(randomCandy);
        handleEnhancedCandyPick(randomCandy, randomIndex);
    }
}

// Navigate to Enhanced Game Board after poison selection
function navigateToEnhancedGameBoard() {
    console.log('🎮 Navigating to Enhanced Game Board...');
    showScreen('page8');

    // Small delay to ensure DOM is ready
    setTimeout(() => {
        initializeEnhancedGameBoard();
    }, 100);
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

    // UNIVERSAL GAME LOGIC: Check win condition with new logic
    const winCondition = checkGameWinCondition(gameState);
    if (winCondition.hasWinner) {
        endGame(winCondition.winner === 'player', winCondition.message);
        return;
    }

    if (winCondition.isDraw) {
        endGame(false, winCondition.message, true);  // true for isDraw
        return;
    }

    // Handle turn switching based on universal game logic
    if (winCondition.switchToPlayer) {
        console.log("🔄 Opponent reached 11 - switching to player for final chance");
        showNotification('💔 Opponent reached 11! You get final chance...', 'warning', 3000);
        updateGameStatus('🎯 Your final chance - Pick a candy!');
    } else if (winCondition.switchToOpponent) {
        console.log("🔄 Player reached 11 - switching to opponent for final chance");
        showNotification('🎉 You reached 11! Opponent gets final chance...', 'info', 3000);
        updateGameStatus('⏳ Opponent final chance...');
    } else {
        // Back to normal player turn
        updateGameStatus('🎯 Your turn - Pick a candy!');
    }
}

// ===== ENHANCED ECONOMY SYSTEM =====

// EconomyManager removed - Use CurrencyManager from currency-manager.js


// ===== CURRENCY BUTTON FUNCTIONS (ENHANCED) =====
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
                    <span class="text-warning font-bold">+100 coins</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>🎯 Complete Challenges</span>
                    <span class="text-warning font-bold">+200 coins</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span>💎 Exchange Diamonds</span>
                    <span class="text-blue-600 font-bold">1 💎 = 25 💰</span>
                </div>
            </div>
        </div>
    `, [
        { text: 'Get More Coins', action: () => { closeModal(); showScreen('page9'); }, class: 'btn-primary' },
        { text: 'Exchange Diamonds', action: () => { closeModal(); exchangeDiamonds(); }, class: 'btn-info' },
        {
            text: 'Reset Balance', action: () => {
                closeModal();
                createModal(
                    '🔄 Reset Balance',
                    '<div class="text-center"><p class="mb-4">Reset your balance to PRD specifications?</p><div class="bg-blue-50 rounded-lg p-4"><p class="text-sm text-blue-700">This will set your balance to:<br><strong>10,000 coins</strong> and <strong>500 diamonds</strong></p></div></div>',
                    [
                        { text: 'Reset Now', action: () => { resetBalanceToPRD(); closeModal(); }, class: 'btn-primary' },
                        { text: 'Cancel', action: closeModal, class: 'btn-secondary' }
                    ]
                );
            }, class: 'btn-warning'
        },
        { text: 'Close', action: closeModal, class: 'btn-secondary' }
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
                    <span>📅 Daily Rewards</span>
                    <span class="text-success font-bold">+1 diamond</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span>💰 Exchange for Coins</span>
                    <span class="text-blue-600 font-bold">1 💎 = 10 💰</span>
                </div>
            </div>
        </div>
    `, [
        { text: 'Earn Diamonds', action: () => { closeModal(); showScreen('page9'); }, class: 'btn-primary' },
        { text: 'Exchange for Coins', action: () => { closeModal(); exchangeDiamonds(); }, class: 'btn-info' },
        { text: 'Close', action: closeModal, class: 'btn-secondary' }
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
                background: #f8f9fa;
                padding: 25px;
                border-radius: 12px;
                border: 2px solid #ced4da;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                position: relative;
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
                    color: #6c757d; 
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
                ">🍬 Remaining: <span id="opponent-remaining-count" style="color: #495057;">12</span></p>
            </div>
            
            <!-- Player's Candies Section -->
            <div style="
                background: #f8f9fa;
                padding: 25px;
                border-radius: 12px;
                border: 2px solid #ced4da;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                position: relative;
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
                    color: #6c757d; 
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
                    color: #495057; 
                    font-size: 16px; 
                    margin-top: 15px; 
                    font-weight: bold;
                    position: relative;
                    z-index: 2;
                ">🍭 Remaining: <span id="player-remaining-count" style="color: #495057;">12</span></p>
            </div>
        </div>
        
        <!-- Progress Section with Consistent Subtle Design -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
            <!-- Player Progress -->
            <div style="
                background: #f8f9fa;
                padding: 25px;
                border-radius: 12px;
                border: 2px solid #ced4da;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                text-align: center;
                position: relative;
            ">
                <h4 style="color: #495057; margin-bottom: 20px; font-size: 20px; font-weight: bold; position: relative; z-index: 2;">🏆 Your Progress</h4>
                <div style="
                    font-size: 36px; 
                    font-weight: bold; 
                    color: #495057; 
                    margin-bottom: 10px;
                    position: relative;
                    z-index: 2;
                " id="player-score">0/11</div>
                <div style="color: #6c757d; font-size: 16px; font-weight: 600; position: relative; z-index: 2;">Candies Collected</div>
            </div>
            
            <!-- AI Progress -->
            <div style="
                background: #f8f9fa;
                padding: 25px;
                border-radius: 12px;
                border: 2px solid #ced4da;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                text-align: center;
                position: relative;
            ">
                <h4 style="color: #495057; margin-bottom: 20px; font-size: 20px; font-weight: bold; position: relative; z-index: 2;">🤖 AI Progress</h4>
                <div style="
                    font-size: 36px; 
                    font-weight: bold; 
                    color: #495057; 
                    margin-bottom: 10px;
                    position: relative;
                    z-index: 2;
                " id="ai-score">0/11</div>
                <div style="color: #6c757d; font-size: 16px; font-weight: 600; position: relative; z-index: 2;">Candies Collected</div>
            </div>
        </div>
        
        <!-- Action Buttons with Subtle Styling -->
        <div style="text-align: center; margin-top: 40px;">
            <button onclick="startNewGame()" style="
                padding: 15px 30px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-right: 20px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)';">
                🔄 New Game
            </button>
            <button onclick="showScreen('page1')" style="
                padding: 15px 30px;
                background: #495057;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                transition: all 0.2s ease;
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)';">
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
        console.warn('⚠️ Player candies missing! Generating new unique sets...');
        // Generate completely unique candy sets using new system
        const uniqueCandySets = generateUniqueGameCandies();
        gameState.playerCandies = uniqueCandySets.playerCandies;
        gameState.opponentCandies = uniqueCandySets.opponentCandies;
        console.log('✅ Generated unique player candies:', gameState.playerCandies);
        console.log('✅ Generated unique opponent candies:', gameState.opponentCandies);
    } else if (!gameState.opponentCandies || gameState.opponentCandies.length === 0) {
        console.warn('⚠️ Opponent candies missing! Generating new ones...');
        // Generate opponent candies ensuring no overlap with player
        const usedCandies = new Set(gameState.playerCandies);
        const availableCandies = CANDY_TYPES.filter(candy => !usedCandies.has(candy));
        gameState.opponentCandies = availableCandies.slice(0, 12);
        console.log('✅ Generated unique opponent candies:', gameState.opponentCandies);
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
                padding: 12px;
                font-size: 20px;
                text-align: center;
                background: #ffffff;
                border: 2px solid #ced4da;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
                position: relative;
                font-weight: normal;
                color: #495057;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            `;

            // Add subtle hover effects to match left side design
            candyElement.onmouseenter = () => {
                candyElement.style.background = '#e9ecef';
                candyElement.style.borderColor = '#adb5bd';
                candyElement.style.transform = 'scale(1.02)';
                candyElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)';
                candyElement.style.zIndex = '2';
            };

            candyElement.onmouseleave = () => {
                candyElement.style.background = '#ffffff';
                candyElement.style.borderColor = '#ced4da';
                candyElement.style.transform = 'scale(1)';
                candyElement.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                candyElement.style.zIndex = '1';
            };

            // Add click handler with enhanced feedback
            candyElement.onclick = () => {
                console.log(`🍭 Player picked: ${candy}`);

                // Subtle visual feedback on click
                candyElement.style.background = '#e9ecef';
                candyElement.style.borderColor = '#adb5bd';
                candyElement.style.color = '#495057';
                candyElement.style.transform = 'scale(0.95)';

                // Check if it's the poison
                if (candy === gameState.opponentPoison) {
                    setTimeout(() => {
                        candyElement.style.background = '#f8d7da';
                        candyElement.style.borderColor = '#dc3545';
                        candyElement.style.color = '#721c24';
                        setTimeout(() => {
                            // Show "Got ya!!!" on the winner's profile (opponent)
                            showCandyPickFeedback('player1', candy, true);
                            setTimeout(() => {
                                alert(`💀 You picked the poison ${candy}! You lose!`);
                                gameState.gameEnded = true;
                                updateGameStatus('💀 Game Over - You picked the poison!');
                            }, 1000);
                        }, 300);
                    }, 200);
                    return;
                }

                // Add to player collection and remove candy
                gameState.playerCollection.push(candy);

                // Show yummy feedback on player profile
                showCandyPickFeedback('player1', candy, false);

                // Smooth removal animation
                setTimeout(() => {
                    candyElement.style.transform = 'scale(0) rotate(180deg)';
                    candyElement.style.opacity = '0';
                    setTimeout(() => {
                        candyElement.remove();
                        updateGameScores();

                        // FIXED: Check win condition properly - ensure both players get fair chance
                        const winCondition = checkGameWinCondition(gameState);
                        if (winCondition.hasWinner) {
                            setTimeout(() => {
                                endGame(winCondition.winner === 'player', winCondition.message);
                            }, 500);
                            return;
                        }

                        if (winCondition.isDraw) {
                            setTimeout(() => {
                                endGame(false, winCondition.message, true);  // true for isDraw
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
    // Update both old interface and new offline-style interface
    const statusElement = document.getElementById('game-instructions');
    if (statusElement) {
        statusElement.textContent = message;
    }

    // Update offline-style interface status
    const enhancedStatusElement = document.getElementById('game-status-text-enhanced');
    if (enhancedStatusElement) {
        enhancedStatusElement.textContent = message;
    }
}

// ===== UNIFIED GAME INTERFACE FOR ALL MODES =====
function createUnifiedGameInterface(gameMode = 'offline') {
    const gameContainer = document.getElementById('page3');
    if (!gameContainer) return;

    // Determine opponent label based on game mode
    const opponentLabel = getOpponentLabel(gameMode);
    const opponentEmoji = getOpponentEmoji(gameMode);

    // Get city-specific theming
    const cityTheme = getCityTheme(gameMode);

    // Remove existing interfaces
    const existingOfflineInterface = document.getElementById('offline-game-interface');
    const existingOnlineInterface = document.getElementById('online-game-interface');
    const existingUnifiedInterface = document.getElementById('unified-game-interface');
    if (existingOfflineInterface) existingOfflineInterface.remove();
    if (existingOnlineInterface) existingOnlineInterface.remove();
    if (existingUnifiedInterface) existingUnifiedInterface.remove();

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

    // Create unified game interface matching offline mode design (page8 style)
    const gameInterfaceHTML = `
        <div id="unified-game-interface" style="display: none; padding: 20px; margin-top: 20px; ${cityTheme.containerStyle}">
            <!-- City-Specific Theme Banner -->
            ${cityTheme.banner ? `
                <div class="city-theme-banner" style="${cityTheme.bannerStyle}">
                    <div class="theme-icon">${cityTheme.icon}</div>
                    <div class="theme-details">
                        <div class="theme-name">${cityTheme.name}</div>
                        <div class="theme-subtitle">${cityTheme.subtitle}</div>
                    </div>
                    <div class="theme-decoration">${cityTheme.decoration}</div>
                </div>
            ` : ''}
            
            <!-- Game Board Header with Profile Timers -->
            <div class="game-board-header" style="${cityTheme.headerStyle}">
                <!-- Player 1 Profile -->
                <div class="player-profile">
                    <div class="player-profile-wrapper">
                        <div class="profile-logo" style="${cityTheme.profileStyle}">
                            P1
                        </div>
                        <svg class="circular-timer" viewBox="0 0 80 80">
                            <circle class="circular-timer-track" cx="40" cy="40" r="36"></circle>
                            <circle class="circular-timer-progress" id="player1-timer-progress" cx="40" cy="40" r="36" 
                                    style="stroke-dasharray: 226.2; stroke-dashoffset: 0; stroke: ${cityTheme.primaryColor};"></circle>
                        </svg>
                    </div>
                    <div class="player-name">Player 1</div>
                </div>
                
                <!-- Round Counter -->
                <div class="round-counter" style="${cityTheme.counterStyle}">
                    <span class="round-number" id="round-display">1</span>
                    <span class="round-label">Round</span>
                </div>
                
                <!-- Player 2 Profile -->
                <div class="player-profile">
                    <div class="player-profile-wrapper">
                        <div class="profile-logo player2" style="${cityTheme.profileStyle}">
                            ${opponentEmoji === '🤖' ? 'AI' : (opponentEmoji === '🌐' ? 'OP' : 'FR')}
                        </div>
                        <svg class="circular-timer" viewBox="0 0 80 80">
                            <circle class="circular-timer-track" cx="40" cy="40" r="36"></circle>
                            <circle class="circular-timer-progress" id="player2-timer-progress" cx="40" cy="40" r="36" 
                                    style="stroke-dasharray: 226.2; stroke-dashoffset: 0; stroke: ${cityTheme.secondaryColor};"></circle>
                        </svg>
                    </div>
                    <div class="player-name">${opponentLabel}</div>
                </div>
            </div>

            <!-- Horizontal Game Board -->
            <div class="game-board-horizontal" style="${cityTheme.boardStyle}">
                <!-- Player 1 Section -->
                <div class="candy-section player-section" style="${cityTheme.sectionStyle}">
                    <div class="candy-section-header">
                        <div class="candy-section-title">
                            🏠 Your Candies
                        </div>
                        <div class="candy-counter" id="player-candy-count">12 left</div>
                    </div>
                    <div class="candy-grid-enhanced" id="player-candy-grid" style="${cityTheme.gridStyle}">
                        <!-- Player's candies populated by JavaScript -->
                    </div>
                </div>

                <!-- Player 2 Section -->
                <div class="candy-section opponent-section" style="${cityTheme.sectionStyle}">
                    <div class="candy-section-header">
                        <div class="candy-section-title">
                            🎯 ${opponentLabel}'s Candies
                        </div>
                        <div class="candy-counter" id="opponent-candy-count">12 left</div>
                    </div>
                    <div class="candy-grid-enhanced" id="opponent-candy-grid" style="${cityTheme.gridStyle}">
                        <!-- Opponent's candies populated by JavaScript -->
                    </div>
                </div>
            </div>

            <!-- Game Status and Actions -->
            <div class="card mt-6">
                <div class="p-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <div id="game-status-display-enhanced" class="btn btn-info cursor-default">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,6A1,1 0 0,1 13,7A1,1 0 0,1 12,8A1,1 0 0,1 11,7A1,1 0 0,1 12,6M12,10C12.5,10 13,10.5 13,11V17C13,17.5 12.5,18 12,18C11.5,18 11,17.5 11,17V11C11,10.5 11.5,10 12,10Z"/>
                                </svg>
                                <span id="game-status-text-enhanced">🎯 Your Turn - Pick a candy!</span>
                            </div>
                            <div class="btn btn-secondary cursor-default">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"/>
                                </svg>
                                <span id="collection-status">0/11 collected</span>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="btn btn-secondary" onclick="showScreen('page1')">
                                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                                </svg>
                                Home
                            </button>
                            <button class="btn btn-secondary" onclick="showHelp()">
                                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                                </svg>
                                Help
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    gameContainer.insertAdjacentHTML('beforeend', gameInterfaceHTML);

    console.log(`Created unified game interface with offline-style design for ${gameMode} mode`);
}

// Helper functions for mode-specific labels
function getOpponentLabel(gameMode) {
    switch (gameMode) {
        case 'online':
        case 'dubai':
        case 'cairo':
        case 'oslo':
            return 'Opponent';
        case 'friends':
            return 'Friend';
        case 'offline':
        case 'ai':
        default:
            return 'AI';
    }
}

function getOpponentEmoji(gameMode) {
    switch (gameMode) {
        case 'online':
        case 'dubai':
        case 'cairo':
        case 'oslo':
            return '🌐';
        case 'friends':
            return '👥';
        case 'offline':
        case 'ai':
        default:
            return '🤖';
    }
}

function getCityTheme(gameMode) {
    switch (gameMode) {
        case 'dubai':
            return {
                name: 'Dubai Arena',
                subtitle: 'Luxury Desert Gaming',
                icon: '🏙️',
                decoration: '🏗️✨',
                banner: true,
                primaryColor: '#FFD700',
                secondaryColor: '#FF6B35',
                containerStyle: 'background: linear-gradient(135deg, #FFF8DC 0%, #F5DEB3 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);',
                bannerStyle: 'background: linear-gradient(90deg, #FFD700 0%, #FF8C00 100%); padding: 16px; margin-bottom: 20px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; color: #8B4513; font-weight: bold; box-shadow: 0 2px 10px rgba(255, 215, 0, 0.4);',
                headerStyle: 'background: rgba(255, 215, 0, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;',
                profileStyle: 'background: linear-gradient(135deg, #FFD700, #FFA500); color: #8B4513; font-weight: bold; border: 2px solid #DAA520;',
                counterStyle: 'background: linear-gradient(135deg, #FFD700, #FFA500); color: #8B4513; border: 2px solid #DAA520;',
                boardStyle: 'background: rgba(255, 215, 0, 0.05); border-radius: 8px; padding: 16px;',
                sectionStyle: 'background: rgba(255, 215, 0, 0.1); border: 2px solid #DAA520; border-radius: 8px;',
                gridStyle: 'background: rgba(255, 248, 220, 0.8);'
            };
        case 'cairo':
            return {
                name: 'Cairo Temple',
                subtitle: 'Ancient Pharaoh Gaming',
                icon: '🏛️',
                decoration: '🐪⚱️',
                banner: true,
                primaryColor: '#CD853F',
                secondaryColor: '#8B4513',
                containerStyle: 'background: linear-gradient(135deg, #F4A460 0%, #DEB887 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(205, 133, 63, 0.3);',
                bannerStyle: 'background: linear-gradient(90deg, #CD853F 0%, #8B4513 100%); padding: 16px; margin-bottom: 20px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; color: #FFFFFF; font-weight: bold; box-shadow: 0 2px 10px rgba(205, 133, 63, 0.4);',
                headerStyle: 'background: rgba(205, 133, 63, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;',
                profileStyle: 'background: linear-gradient(135deg, #CD853F, #8B4513); color: #FFFFFF; font-weight: bold; border: 2px solid #A0522D;',
                counterStyle: 'background: linear-gradient(135deg, #CD853F, #8B4513); color: #FFFFFF; border: 2px solid #A0522D;',
                boardStyle: 'background: rgba(205, 133, 63, 0.05); border-radius: 8px; padding: 16px;',
                sectionStyle: 'background: rgba(205, 133, 63, 0.1); border: 2px solid #A0522D; border-radius: 8px;',
                gridStyle: 'background: rgba(244, 164, 96, 0.2);'
            };
        case 'oslo':
            return {
                name: 'Oslo Fjord',
                subtitle: 'Nordic Winter Gaming',
                icon: '🏔️',
                decoration: '❄️🌨️',
                banner: true,
                primaryColor: '#4169E1',
                secondaryColor: '#00CED1',
                containerStyle: 'background: linear-gradient(135deg, #E0F6FF 0%, #B0E0E6 100%); border-radius: 12px; box-shadow: 0 4px 20px rgba(65, 105, 225, 0.3);',
                bannerStyle: 'background: linear-gradient(90deg, #4169E1 0%, #00CED1 100%); padding: 16px; margin-bottom: 20px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; color: #FFFFFF; font-weight: bold; box-shadow: 0 2px 10px rgba(65, 105, 225, 0.4);',
                headerStyle: 'background: rgba(65, 105, 225, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;',
                profileStyle: 'background: linear-gradient(135deg, #4169E1, #00CED1); color: #FFFFFF; font-weight: bold; border: 2px solid #1E90FF;',
                counterStyle: 'background: linear-gradient(135deg, #4169E1, #00CED1); color: #FFFFFF; border: 2px solid #1E90FF;',
                boardStyle: 'background: rgba(65, 105, 225, 0.05); border-radius: 8px; padding: 16px;',
                sectionStyle: 'background: rgba(65, 105, 225, 0.1); border: 2px solid #1E90FF; border-radius: 8px;',
                gridStyle: 'background: rgba(224, 246, 255, 0.8);'
            };
        default:
            return {
                name: '',
                subtitle: '',
                icon: '',
                decoration: '',
                banner: false,
                primaryColor: '#007bff',
                secondaryColor: '#6c757d',
                containerStyle: '',
                bannerStyle: '',
                headerStyle: '',
                profileStyle: '',
                counterStyle: '',
                boardStyle: '',
                sectionStyle: '',
                gridStyle: ''
            };
    }
}

// ===== UNIFIED CANDY PICKING SYSTEM =====
class UnifiedCandyPicker {
    constructor() {
        this.isProcessing = false;
        this.animationDuration = 200;
    }

    // Main unified candy picking method
    async pickCandy(candy, index, element, source = 'opponent') {
        // Prevent double-clicking and concurrent picks
        if (this.isProcessing) {
            console.log('🔒 Candy pick already in progress');
            return;
        }

        // Validate pick is allowed
        if (!this.validatePick(candy, source)) {
            return;
        }

        this.isProcessing = true;

        try {
            // Stop any active timers
            this.stopActiveTimers();

            // Show immediate visual feedback
            this.showPickAnimation(element, candy);

            // Process the pick based on game mode
            const result = await this.processPick(candy, index, source);

            if (result.success) {
                // Handle successful pick
                await this.handleSuccessfulPick(result, candy, element);
            } else {
                // Handle failed pick
                this.handleFailedPick(result, element);
            }

        } catch (error) {
            console.error('❌ Error during candy pick:', error);
            this.handleFailedPick({ error: error.message }, element);
        } finally {
            this.isProcessing = false;
        }
    }

    // Validate if the pick is allowed
    validatePick(candy, source) {
        // Basic game state checks
        if (gameState.gameEnded) {
            showNotification('⏹️ Game has ended', 'warning', 2000);
            return false;
        }

        if (!gameState.isPlayerTurn) {
            showNotification('⏳ Wait for your turn', 'warning', 2000);
            return false;
        }

        // Source-specific validation
        if (source === 'opponent') {
            if (!gameState.opponentCandies.includes(candy)) {
                showNotification('❌ Candy not available', 'error', 2000);
                return false;
            }
        } else if (source === 'player') {
            if (!gameState.playerCandies.includes(candy)) {
                showNotification('❌ Candy not available', 'error', 2000);
                return false;
            }
        }

        // Check if already collected
        if (gameState.playerCollection.includes(candy)) {
            showNotification('🔄 Already collected this candy type', 'warning', 2000);
            return false;
        }

        return true;
    }

    // Stop all active timers
    stopActiveTimers() {
        if (typeof stopTurnTimer === 'function') {
            stopTurnTimer();
        }
        if (typeof stopGameTimer === 'function') {
            stopGameTimer();
        }
        if (typeof stopCircularTimer === 'function') {
            stopCircularTimer();
        }
    }

    // Show pick animation
    showPickAnimation(element, candy) {
        if (!element) return;

        // Consistent animation for all modes
        element.style.transition = `all ${this.animationDuration}ms ease`;
        element.style.transform = 'scale(1.1)';
        element.style.background = '#22C55E';
        element.style.color = 'white';
        element.style.borderColor = '#16A34A';
        element.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';

        // Show immediate feedback - Profile-based
        showPlayerFeedback('player1', '🎯 Picking...', 'info');
    }

    // Process the pick based on game mode
    async processPick(candy, index, source) {
        const gameMode = gameState.gameMode;

        try {
            if (gameMode === 'offline' || gameMode === 'ai' || !gameState.gameId) {
                return await this.processOfflinePick(candy, index, source);
            } else if (gameMode === 'p2p') {
                return await this.processP2PPick(candy, index, source);
            } else if (gameMode === 'online' || gameMode === 'friends') {
                return await this.processOnlinePick(candy, index, source);
            } else {
                // Default to offline processing
                return await this.processOfflinePick(candy, index, source);
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Process offline pick
    async processOfflinePick(candy, index, source) {
        console.log(`🎯 Processing offline pick: ${candy}`);

        // Check for poison
        if (candy === gameState.opponentPoison) {
            return {
                success: false,
                isPoisonPick: true,
                message: `💀 You picked the opponent's poison ${candy}! Game Over!`,
                endGame: { won: false, message: `💀 You picked the poison ${candy}! You lose!` }
            };
        }

        // Add to player collection
        if (!gameState.playerCollection.includes(candy)) {
            gameState.playerCollection.push(candy);
        }

        // Remove from opponent's pool (source pool)
        if (source === 'opponent') {
            const candyIndexInPool = gameState.opponentCandies.indexOf(candy);
            if (candyIndexInPool !== -1) {
                gameState.opponentCandies.splice(candyIndexInPool, 1);
            }
        }

        // Update round counter
        const totalMoves = gameState.playerCollection.length + gameState.opponentCollection.length;
        gameState.round = Math.ceil(totalMoves / 2);

        // FIXED: Check win condition properly - ensure both players get fair chance
        const winCondition = checkGameWinCondition(gameState);
        if (winCondition.hasWinner) {
            return {
                success: false,
                isWin: true,
                message: winCondition.message,
                endGame: { won: winCondition.winner === 'player', message: winCondition.message }
            };
        }

        if (winCondition.isDraw) {
            return {
                success: false,
                isDraw: true,
                message: winCondition.message,
                endGame: { won: false, message: winCondition.message, isDraw: true }
            };
        }

        // Switch turn to opponent
        gameState.isPlayerTurn = false;

        return {
            success: true,
            candy: candy,
            newTurn: 'opponent',
            collectionCount: gameState.playerCollection.length
        };
    }

    // Process online pick
    async processOnlinePick(candy, index, source) {
        console.log(`🌐 Processing online pick: ${candy}`);

        if (!gameState.gameId) {
            throw new Error('Game ID not available for online pick');
        }

        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/pick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player: gameState.playerId || 'player1',
                candy_choice: candy
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to pick candy');
        }

        const result = await response.json();

        if (result.success) {
            // Update game state from backend
            gameState.currentGameState = result.data.game_state;

            // Update collections
            gameState.playerCollection = result.data.game_state.player1.collected_candies || [];
            gameState.opponentCollection = result.data.game_state.player2.collected_candies || [];

            // Check if game ended
            if (result.data.game_state.game_over) {
                const winner = result.data.game_state.winner;
                const playerWon = winner === gameState.playerId;
                return {
                    success: false,
                    isGameEnd: true,
                    endGame: {
                        won: playerWon,
                        message: result.data.game_state.message || 'Game Over'
                    }
                };
            }

            // Update turn state
            gameState.isPlayerTurn = false;

            return {
                success: true,
                candy: candy,
                backendResult: result,
                newTurn: 'opponent'
            };
        } else {
            throw new Error(result.message || 'Backend pick failed');
        }
    }

    // Process P2P pick
    async processP2PPick(candy, index, source) {
        console.log(`🎮 Processing P2P pick: ${candy}`);

        // Check for poison
        if (candy === gameState.opponentPoison) {
            return {
                success: false,
                isPoisonPick: true,
                message: `💀 You picked the opponent's poison ${candy}! Game Over!`,
                endGame: { won: false, message: `💀 You picked the poison ${candy}! You lose!` }
            };
        }

        // Add to player collection
        if (!gameState.playerCollection.includes(candy)) {
            gameState.playerCollection.push(candy);
        }

        // Remove from opponent's pool (source pool)
        if (source === 'opponent') {
            const candyIndexInPool = gameState.opponentCandies.indexOf(candy);
            if (candyIndexInPool !== -1) {
                gameState.opponentCandies.splice(candyIndexInPool, 1);
            }
        }

        // Update round counter
        const totalMoves = gameState.playerCollection.length + gameState.opponentCollection.length;
        gameState.round = Math.ceil(totalMoves / 2);

        // Check win condition
        if (gameState.playerCollection.length >= 11) {
            return {
                success: false,
                isWin: true,
                message: '🎉 You collected 11 different candies! You win!',
                endGame: { won: true, message: '🎉 You collected 11 different candies! You win!' }
            };
        }

        // Send move to peer
        if (p2pManager && p2pManager.connected) {
            const moveSuccess = p2pManager.sendMove({
                candy: candy,
                index: index,
                player: 'local',
                timestamp: Date.now()
            });

            if (!moveSuccess) {
                console.warn('⚠️ Failed to send move to peer');
            }
        }

        // Switch turn to opponent
        gameState.isPlayerTurn = false;

        return {
            success: true,
            candy: candy,
            newTurn: 'opponent',
            collectionCount: gameState.playerCollection.length,
            p2pMove: true
        };
    }

    // Handle successful pick
    async handleSuccessfulPick(result, candy, element) {
        // Finalize element animation
        if (element) {
            setTimeout(() => {
                element.style.opacity = '0.3';
                element.style.transform = 'scale(0.8)';
                element.style.pointerEvents = 'none';
                element.title = 'Collected!';
            }, this.animationDuration);
        }

        // Show success feedback - Profile-based
        showCandyPickFeedback('player1', candy, false);

        // Update UI
        this.updateGameUI();

        // Handle next turn
        if (result.newTurn === 'opponent') {
            // Start opponent turn
            setTimeout(() => {
                this.startOpponentTurn();
            }, 1000);
        }
    }

    // Handle failed pick
    handleFailedPick(result, element) {
        // Reset element animation
        if (element) {
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.background = '';
                element.style.color = '';
                element.style.borderColor = '';
                element.style.boxShadow = '';
            }, this.animationDuration);
        }

        // Handle specific failure types
        if (result.isPoisonPick || result.isWin || result.isGameEnd) {
            // End game scenarios
            setTimeout(() => {
                if (typeof endGame === 'function') {
                    endGame(result.endGame.won, result.endGame.message);
                }
            }, 500);
        } else {
            // Regular failure
            showNotification(result.message || result.error || '❌ Pick failed', 'error', 3000);
        }
    }

    // Update game UI after successful pick
    updateGameUI() {
        console.log('🎮 UnifiedCandyPicker: Updating game UI...');

        // Update ALL game displays including online header progress
        if (typeof updateAllGameDisplays === 'function') {
            updateAllGameDisplays();
        }

        // Refresh the offline-style board
        if (typeof initializeUnifiedOfflineStyleBoard === 'function') {
            initializeUnifiedOfflineStyleBoard();
        }

        // Update game status for offline-style interface
        const gameStatusText = document.getElementById('game-status-text-enhanced');
        if (gameStatusText) {
            if (gameState.isPlayerTurn) {
                gameStatusText.textContent = '🎯 Your Turn - Pick a candy!';
            } else {
                gameStatusText.textContent = '⏳ Opponent\'s Turn...';
            }
        }

        // Update round display
        const roundDisplay = document.getElementById('round-display');
        if (roundDisplay) {
            roundDisplay.textContent = gameState.round || 1;
        }
    }

    // Start opponent turn
    startOpponentTurn() {
        console.log('🔄 Starting opponent turn...');

        // Update UI for opponent turn
        showNotification('🤖 Opponent turn starting...', 'info', 1500);

        // Handle based on game mode
        if (gameState.gameMode === 'offline' || gameState.gameMode === 'ai') {
            // Start timer for AI
            if (typeof startGameTimer === 'function') {
                setTimeout(() => {
                    startGameTimer();
                }, 500);
            }

            // AI makes move after delay
            setTimeout(() => {
                if (typeof handleOfflineAITurn === 'function') {
                    handleOfflineAITurn();
                } else if (typeof aiTurn === 'function') {
                    aiTurn();
                }
            }, 2000);
        } else {
            // Online mode - start timer and wait for opponent
            if (typeof startTurnTimer === 'function') {
                startTurnTimer();
            }

            // Check for opponent move periodically
            setTimeout(() => {
                if (typeof checkForAIMoveInPage === 'function') {
                    checkForAIMoveInPage();
                }
            }, 1000);
        }
    }
}

// Global instance
const unifiedCandyPicker = new UnifiedCandyPicker();

// ===== UNIFIED CANDY PICK FUNCTION =====
async function pickCandyUnified(candy, index, element, source = 'opponent') {
    await unifiedCandyPicker.pickCandy(candy, index, element, source);
}

// ===== REPLACE ALL EXISTING CANDY PICK HANDLERS =====
// This function should be used everywhere instead of individual handlers
function attachUnifiedCandyPicker(element, candy, index, source = 'opponent') {
    if (!element) return;

    // Remove any existing event listeners
    element.replaceWith(element.cloneNode(true));
    const newElement = element.parentNode?.lastElementChild || element;

    // Add unified click handler
    newElement.addEventListener('click', () => {
        pickCandyUnified(candy, index, newElement, source);
    });

    // Add consistent hover effects
    newElement.addEventListener('mouseenter', function () {
        if (gameState.isPlayerTurn && !gameState.gameEnded) {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            this.style.zIndex = '10';
        }
    });

    newElement.addEventListener('mouseleave', function () {
        if (gameState.isPlayerTurn && !gameState.gameEnded) {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '';
            this.style.zIndex = '1';
        }
    });

    return newElement;
}

// ===== P2P GAME MANAGER =====
class P2PGameManager {
    constructor() {
        this.localConnection = null;
        this.dataChannel = null;
        this.isHost = false;
        this.roomCode = null;
        this.signalingSocket = null;
        this.onGameStateUpdate = null;
        this.connected = false;

        // WebRTC Configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    // Initialize P2P connection as host
    async initializeAsHost(roomCode) {
        console.log('🎮 Initializing P2P as host with room:', roomCode);
        this.isHost = true;
        this.roomCode = roomCode;

        try {
            this.localConnection = new RTCPeerConnection(this.rtcConfig);

            // Create data channel for game communication
            this.dataChannel = this.localConnection.createDataChannel('gameData', {
                ordered: true
            });

            this.setupDataChannel(this.dataChannel);
            this.setupConnectionHandlers();

            // Create offer
            const offer = await this.localConnection.createOffer();
            await this.localConnection.setLocalDescription(offer);

            console.log('✅ P2P host initialized, waiting for peer...');
            return true;

        } catch (error) {
            console.error('❌ P2P host initialization failed:', error);
            return false;
        }
    }

    // Initialize P2P connection as guest
    async initializeAsGuest(roomCode) {
        console.log('🎮 Initializing P2P as guest with room:', roomCode);
        this.isHost = false;
        this.roomCode = roomCode;

        try {
            this.localConnection = new RTCPeerConnection(this.rtcConfig);

            // Handle incoming data channel
            this.localConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel(this.dataChannel);
            };

            this.setupConnectionHandlers();

            console.log('✅ P2P guest initialized, waiting for connection...');
            return true;

        } catch (error) {
            console.error('❌ P2P guest initialization failed:', error);
            return false;
        }
    }

    // Setup data channel event handlers
    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('✅ P2P data channel opened');
            this.connected = true;
            this.onConnectionEstablished();
        };

        channel.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('📨 P2P message received:', data);
            this.handleGameMessage(data);
        };

        channel.onerror = (error) => {
            console.error('❌ P2P data channel error:', error);
        };

        channel.onclose = () => {
            console.log('🔌 P2P data channel closed');
            this.connected = false;
            this.onConnectionClosed();
        };
    }

    // Setup WebRTC connection handlers
    setupConnectionHandlers() {
        this.localConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 ICE candidate generated');
                // In a real implementation, this would be sent through signaling server
                // For now, we'll simulate the connection
            }
        };

        this.localConnection.onconnectionstatechange = () => {
            console.log('🔗 P2P connection state:', this.localConnection.connectionState);
            if (this.localConnection.connectionState === 'connected') {
                this.connected = true;
            }
        };
    }

    // Send game data to peer
    sendGameData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            console.log('📤 Sending P2P data:', data);
            this.dataChannel.send(JSON.stringify(data));
            return true;
        }
        console.warn('⚠️ P2P data channel not ready');
        return false;
    }

    // Handle incoming game messages
    handleGameMessage(data) {
        switch (data.type) {
            case 'move':
                this.handlePeerMove(data.move);
                break;
            case 'poison-selection':
                this.handlePeerPoison(data.poison);
                break;
            case 'game-state':
                this.syncGameState(data.state);
                break;
            default:
                console.warn('❓ Unknown P2P message type:', data.type);
        }
    }

    // Handle peer moves
    handlePeerMove(move) {
        console.log('🎯 Handling peer move:', move);

        // Update opponent's collection
        if (!gameState.opponentCollection.includes(move.candy)) {
            gameState.opponentCollection.push(move.candy);
        }

        // Update UI
        if (typeof updateGameBoard === 'function') updateGameBoard();
        if (typeof updateCollections === 'function') updateCollections();

        // Make it our turn
        gameState.isPlayerTurn = true;
        if (typeof updateGameStatus === 'function') updateGameStatus();
    }

    // Handle peer poison selection
    handlePeerPoison(poison) {
        console.log('☠️ Peer selected poison:', poison);
        gameState.opponentPoison = poison;
    }

    // Send move to peer
    sendMove(move) {
        return this.sendGameData({
            type: 'move',
            move: move,
            timestamp: Date.now()
        });
    }

    // Send poison selection to peer
    sendPoisonSelection(poison) {
        return this.sendGameData({
            type: 'poison-selection',
            poison: poison,
            timestamp: Date.now()
        });
    }

    // Sync game state with peer
    syncGameState(peerState) {
        console.log('🔄 Syncing game state with peer:', peerState);
        if (this.onGameStateUpdate) {
            this.onGameStateUpdate(peerState);
        }
    }

    // Connection established callback
    onConnectionEstablished() {
        console.log('🎮 P2P connection established - game can start!');
        if (typeof gameState !== 'undefined') {
            gameState.p2pConnected = true;
            gameState.gameMode = 'p2p';
        }

        if (typeof showNotification === 'function') {
            showNotification('🎮 P2P connection established!', 'success');
        }
    }

    // Connection closed callback
    onConnectionClosed() {
        console.log('🔌 P2P connection closed');
        if (typeof gameState !== 'undefined') {
            gameState.p2pConnected = false;
        }

        if (typeof showNotification === 'function') {
            showNotification('🔌 P2P connection lost', 'warning');
        }
    }

    // Simulate peer connection for demo
    simulatePeerConnection() {
        console.log('🤖 Simulating P2P connection...');

        setTimeout(() => {
            this.connected = true;
            this.onConnectionEstablished();

            // Simulate peer poison selection
            setTimeout(() => {
                const availableCandies = ['🍎', '🍊', '🍌', '🍓', '🍇', '🥝', '🍑', '🍒', '🍉', '🍋', '🍏'];
                const randomPoison = availableCandies[Math.floor(Math.random() * availableCandies.length)];
                this.handlePeerPoison(randomPoison);
            }, 1000);
        }, 2000);
    }

    // Close connection
    close() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.localConnection) {
            this.localConnection.close();
        }
        this.connected = false;
    }
}

// Global P2P manager instance
let p2pManager = null;

// ===== P2P INTEGRATION FUNCTIONS =====

// Initialize P2P game
async function initializeP2PGame(roomCode, isHost = false) {
    console.log('🚀 Initializing P2P game...');

    p2pManager = new P2PGameManager();

    // Set up game state synchronization
    p2pManager.onGameStateUpdate = (peerState) => {
        syncWithPeerGameState(peerState);
    };

    // Initialize connection
    let success = false;
    if (isHost) {
        success = await p2pManager.initializeAsHost(roomCode);
    } else {
        success = await p2pManager.initializeAsGuest(roomCode);
    }

    if (success) {
        // Set up game mode
        gameState.gameMode = 'p2p';
        gameState.roomCode = roomCode;
        gameState.isHost = isHost;

        // For demo purposes, simulate connection
        p2pManager.simulatePeerConnection();

        console.log('✅ P2P game initialized');
        return true;
    }

    console.error('❌ P2P game initialization failed');
    return false;
}

// Handle P2P candy pick
function handleP2PCandyPick(candy, index) {
    console.log('🍬 P2P candy pick:', candy);

    // Process move locally first
    if (typeof handleOfflineCandyPick === 'function') {
        handleOfflineCandyPick(candy, index);
    }

    // Send move to peer
    if (p2pManager && p2pManager.connected) {
        const success = p2pManager.sendMove({
            candy: candy,
            index: index,
            player: 'local'
        });

        if (success) {
            // Make it opponent's turn
            gameState.isPlayerTurn = false;
            if (typeof updateGameStatus === 'function') updateGameStatus();
        }
    }
}

// Handle P2P poison selection
function handleP2PPoisonSelection(poison) {
    console.log('☠️ P2P poison selection:', poison);

    if (p2pManager && p2pManager.connected) {
        p2pManager.sendPoisonSelection(poison);
    }
}

// Sync with peer game state
function syncWithPeerGameState(peerState) {
    console.log('🔄 Syncing with peer state:', peerState);

    // Merge states carefully to avoid conflicts
    if (peerState.opponentCollection) {
        gameState.opponentCollection = [...new Set([
            ...gameState.opponentCollection,
            ...peerState.opponentCollection
        ])];
    }

    // Update UI
    if (typeof updateGameBoard === 'function') updateGameBoard();
    if (typeof updateCollections === 'function') updateCollections();
    if (typeof updateGameStatus === 'function') updateGameStatus();
}

// Create P2P room
function createP2PRoom() {
    const roomCode = generateRoomCode();

    if (typeof createModal === 'function') {
        createModal(
            '🎮 Create P2P Room',
            `<div class="text-center">
                <div class="text-6xl mb-4">🎮</div>
                <h3 class="text-xl font-bold mb-4">P2P Room Created</h3>
                <div class="bg-blue-50 rounded-lg p-6 mb-4">
                    <div class="text-2xl font-bold mb-2">${roomCode}</div>
                    <div class="text-sm text-gray-600">Share this code with your friend</div>
                </div>
                <p class="text-lg mb-4">Waiting for peer to join...</p>
                <div class="text-sm text-gray-600">
                    Your friend can join by clicking "Join P2P Game" and entering this code
                </div>
            </div>`,
            [
                {
                    text: 'Start Game',
                    action: () => {
                        if (typeof closeModal === 'function') closeModal();
                        startP2PGame(roomCode, true);
                    },
                    class: 'btn-success'
                },
                { text: 'Cancel', action: typeof closeModal === 'function' ? closeModal : () => { }, class: 'btn-secondary' }
            ]
        );
    }
}

// Join P2P room
function joinP2PRoom() {
    if (typeof createModal === 'function') {
        createModal(
            '🎮 Join P2P Room',
            `<div class="text-center">
                <div class="text-6xl mb-4">🎮</div>
                <h3 class="text-xl font-bold mb-4">Join P2P Game</h3>
                <p class="text-lg mb-4">Enter the room code shared by your friend</p>
                <div class="mb-4">
                    <input type="text" id="p2p-room-code" class="w-full p-3 border rounded-lg text-center text-2xl font-bold" 
                           placeholder="Enter Room Code" maxlength="8" style="text-transform: uppercase;">
                </div>
                <div class="text-sm text-gray-600">
                    Room codes are 8 characters long (e.g., ABCD1234)
                </div>
            </div>`,
            [
                {
                    text: 'Join Game',
                    action: () => {
                        const roomCode = document.getElementById('p2p-room-code').value.toUpperCase();
                        if (roomCode.length === 8) {
                            if (typeof closeModal === 'function') closeModal();
                            startP2PGame(roomCode, false);
                        } else {
                            if (typeof showNotification === 'function') {
                                showNotification('Please enter a valid 8-character room code', 'warning');
                            }
                        }
                    },
                    class: 'btn-primary'
                },
                { text: 'Cancel', action: typeof closeModal === 'function' ? closeModal : () => { }, class: 'btn-secondary' }
            ]
        );
    }
}

// Start P2P game
async function startP2PGame(roomCode, isHost) {
    console.log('🎮 Starting P2P game:', roomCode, 'as', isHost ? 'host' : 'guest');

    // Show loading modal
    if (typeof createModal === 'function') {
        createModal(
            '🔄 Connecting...',
            `<div class="text-center">
                <div class="text-6xl mb-4">⏳</div>
                <h3 class="text-xl font-bold mb-4">Connecting to Peer</h3>
                <p class="text-lg mb-4">Establishing P2P connection...</p>
                <div class="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full"></div>
            </div>`,
            [] // No buttons during connection
        );
    }

    // Initialize P2P connection
    const success = await initializeP2PGame(roomCode, isHost);

    if (success) {
        // Close loading modal and start game
        if (typeof closeModal === 'function') closeModal();

        // Navigate to game screen
        if (typeof showScreen === 'function') showScreen('page3');

        // Initialize game with P2P mode
        gameState.gameMode = 'p2p';
        gameState.roomCode = roomCode;
        gameState.isHost = isHost;

        // Create unified game interface for P2P
        if (typeof createUnifiedGameInterface === 'function') {
            createUnifiedGameInterface('p2p');
        }

        if (typeof showNotification === 'function') {
            showNotification('🎮 P2P game started!', 'success');
        }
    } else {
        if (typeof closeModal === 'function') closeModal();
        if (typeof showNotification === 'function') {
            showNotification('❌ Failed to connect to peer', 'error');
        }
    }
}

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ===== UI MODE SWITCHING =====

// Show server mode (traditional online)
function showServerMode() {
    console.log('🌐 Switching to Server Mode');

    // Update button states
    const serverBtn = document.getElementById('server-mode-btn');
    const p2pBtn = document.getElementById('p2p-mode-btn');

    if (serverBtn && p2pBtn) {
        serverBtn.className = 'btn btn-primary';
        p2pBtn.className = 'btn btn-secondary';
    }

    // Show/hide content
    const serverContent = document.getElementById('server-mode-content');
    const p2pContent = document.getElementById('p2p-mode-content');

    if (serverContent) serverContent.style.display = 'grid';
    if (p2pContent) p2pContent.style.display = 'none';

    if (typeof showNotification === 'function') {
        showNotification('🌐 Server Mode - Play with global matchmaking', 'info');
    }
}

// Show P2P mode
function showP2PMode() {
    console.log('🎮 Switching to P2P Mode');

    // Update button states
    const serverBtn = document.getElementById('server-mode-btn');
    const p2pBtn = document.getElementById('p2p-mode-btn');

    if (serverBtn && p2pBtn) {
        serverBtn.className = 'btn btn-secondary';
        p2pBtn.className = 'btn btn-primary';
    }

    // Show/hide content
    const serverContent = document.getElementById('server-mode-content');
    const p2pContent = document.getElementById('p2p-mode-content');

    if (serverContent) serverContent.style.display = 'none';
    if (p2pContent) p2pContent.style.display = 'grid';

    if (typeof showNotification === 'function') {
        showNotification('🎮 P2P Mode - Direct connection with friends', 'info');
    }
}
// AutomaticMatchmakingManager removed - using class in matchmaking.js


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

// ===== PROFILE-BASED FEEDBACK SYSTEM =====
class ProfileFeedbackManager {
    constructor() {
        this.feedbackQueue = [];
        this.activeFeedbacks = new Set();
        this.feedbackDuration = 2500; // How long feedback stays visible
        this.animationDuration = 300; // Animation transition time
    }

    // Show feedback on a specific player's profile
    showProfileFeedback(playerType, message, type = 'success') {
        console.log(`💬 Profile feedback: ${playerType} - ${message}`);

        const profileElement = this.getProfileElement(playerType);
        if (!profileElement) {
            console.warn(`Profile element not found for ${playerType}`);
            return;
        }

        // Create unique feedback ID
        const feedbackId = `${playerType}-${Date.now()}`;

        // Don't show multiple feedbacks on the same profile simultaneously
        if (this.activeFeedbacks.has(playerType)) {
            console.log(`Feedback already active for ${playerType}, skipping...`);
            return;
        }

        this.activeFeedbacks.add(playerType);

        // Create feedback element
        const feedbackElement = this.createFeedbackElement(message, type);

        // Position feedback relative to profile
        this.positionFeedback(feedbackElement, profileElement);

        // Add to DOM
        document.body.appendChild(feedbackElement);

        // Animate in
        setTimeout(() => {
            feedbackElement.style.opacity = '1';
            feedbackElement.style.transform = 'translateY(-10px) scale(1)';
        }, 50);

        // Auto-remove after duration
        setTimeout(() => {
            this.removeFeedback(feedbackElement, playerType);
        }, this.feedbackDuration);
    }

    // Get the profile element for a player
    getProfileElement(playerType) {
        let profileSelector = '';

        switch (playerType) {
            case 'player1':
            case 'player':
                // Look for various player 1 profile elements
                profileSelector = '.profile-logo:not(.player2), .player-profile:first-child .profile-logo';
                break;

            case 'player2':
            case 'opponent':
            case 'ai':
                // Look for player 2/opponent profile elements
                profileSelector = '.profile-logo.player2, .player-profile:last-child .profile-logo';
                break;
        }

        const element = document.querySelector(profileSelector);
        if (!element) {
            // Fallback: try to find by text content
            const allProfiles = document.querySelectorAll('.profile-logo');
            for (const profile of allProfiles) {
                const text = profile.textContent.toLowerCase();
                if (playerType === 'player1' && (text.includes('p1') || text.includes('player'))) {
                    return profile;
                } else if ((playerType === 'player2' || playerType === 'opponent' || playerType === 'ai') &&
                    (text.includes('ai') || text.includes('op') || text.includes('p2'))) {
                    return profile;
                }
            }
        }

        return element;
    }

    // Create the feedback element
    createFeedbackElement(message, type) {
        const feedbackElement = document.createElement('div');
        feedbackElement.className = 'profile-feedback';
        feedbackElement.textContent = message;

        // Base styles
        feedbackElement.style.cssText = `
            position: fixed;
            background: ${this.getBackgroundColor(type)};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10001;
            pointer-events: none;
            opacity: 0;
            transform: translateY(0px) scale(0.8);
            transition: all ${this.animationDuration}ms ease-out;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border: 2px solid rgba(255, 255, 255, 0.2);
        `;

        return feedbackElement;
    }

    // Position feedback relative to profile
    positionFeedback(feedbackElement, profileElement) {
        const rect = profileElement.getBoundingClientRect();
        const feedbackWidth = 120; // Estimated width
        const feedbackHeight = 36; // Estimated height

        // Position above the profile, centered
        const left = rect.left + (rect.width / 2) - (feedbackWidth / 2);
        const top = rect.top - feedbackHeight - 10; // 10px gap above profile

        feedbackElement.style.left = `${Math.max(10, left)}px`;
        feedbackElement.style.top = `${Math.max(10, top)}px`;
    }

    // Get background color based on feedback type
    getBackgroundColor(type) {
        switch (type) {
            case 'success':
            case 'yummy':
                return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            case 'victory':
            case 'gotcha':
                return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            case 'error':
            case 'poison':
                return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            case 'info':
            default:
                return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        }
    }

    // Remove feedback element
    removeFeedback(feedbackElement, playerType) {
        // Animate out
        feedbackElement.style.opacity = '0';
        feedbackElement.style.transform = 'translateY(-20px) scale(0.8)';

        // Remove from DOM after animation
        setTimeout(() => {
            if (document.body.contains(feedbackElement)) {
                document.body.removeChild(feedbackElement);
            }
            this.activeFeedbacks.delete(playerType);
        }, this.animationDuration);
    }

    // Enhanced feedback methods for specific game events
    showCandyPickFeedback(playerType, candy, isPoison = false) {
        if (isPoison) {
            // Show "Got ya!!!" on the winner's profile
            const winner = playerType === 'player1' ? 'player2' : 'player1';
            this.showProfileFeedback(winner, 'Got ya!!! 🎉', 'gotcha');
        } else {
            // Show "Yummy!" on the picker's profile
            this.showProfileFeedback(playerType, 'Yummy! 😋', 'yummy');
        }
    }

    // Clear all active feedbacks
    clearAllFeedbacks() {
        const allFeedbacks = document.querySelectorAll('.profile-feedback');
        allFeedbacks.forEach(feedback => {
            if (document.body.contains(feedback)) {
                document.body.removeChild(feedback);
            }
        });
        this.activeFeedbacks.clear();
    }
}

// Global instance
const profileFeedback = new ProfileFeedbackManager();

// ===== TESTING AND DEBUG HELPERS =====
function showMatchmakingDebugInfo() {
    console.log('🔍 MATCHMAKING DEBUG INFO:');
    console.log('- Player ID:', matchmakingManager?.playerId || 'Not set');
    console.log('- Player Name:', matchmakingManager?.playerName || 'Not set');
    console.log('- Is Searching:', matchmakingManager?.isSearching || false);
    console.log('- WebSocket State:', matchmakingManager?.websocket?.readyState || 'No connection');
    console.log('- Game Mode:', gameState?.gameMode || 'Not set');
    console.log('- Game ID:', gameState?.gameId || 'Not set');

    // Also check backend status
    fetch('http://localhost:8000/matchmaking/status')
        .then(res => res.json())
        .then(data => {
            console.log('- Queue Size:', data.queue_size);
            console.log('- Waiting Players:', data.waiting_players);
        })
        .catch(err => console.log('- Backend Status: ERROR -', err.message));
}

function simulateSecondPlayer() {
    console.log('🎮 Simulating second player for testing...');

    if (!matchmakingManager) {
        console.log('❌ Matchmaking manager not initialized');
        return;
    }

    // Create a second matchmaking connection with different player ID
    const secondPlayer = new AutomaticMatchmakingManager();
    secondPlayer.playerId = 'test_player_2_' + Date.now();
    secondPlayer.playerName = 'Test Player 2';

    console.log('🎯 Second player connecting with ID:', secondPlayer.playerId);

    // Start search for second player
    secondPlayer.startSearch().then(() => {
        console.log('✅ Second player joined queue');
        showMatchmakingDebugInfo();
    }).catch(err => {
        console.log('❌ Second player failed to join:', err.message);
    });

    return secondPlayer;
}

// Make debug functions available globally for testing
window.showMatchmakingDebugInfo = showMatchmakingDebugInfo;
window.simulateSecondPlayer = simulateSecondPlayer;

// Enhanced feedback functions to replace generic showNotification calls
function showPlayerFeedback(playerType, message, type = 'success') {
    profileFeedback.showProfileFeedback(playerType, message, type);
}

function showCandyPickFeedback(playerType, candy, isPoison = false) {
    profileFeedback.showCandyPickFeedback(playerType, candy, isPoison);
}

// Update stats periodically
setInterval(updateOnlineStats, 5000);

// ===== MATCHMAKING PAYMENT SYSTEM =====

// Process matchmaking coin deduction (called when match is found)
function processMatchmakingPayment(cost, city) {
    const currentCoins = parseInt(localStorage.getItem('playerCoins') || '10000');

    if (currentCoins >= cost) {
        const newBalance = deductCoins(cost, `${city} Arena matchmaking entry`);
        showNotification(`💳 Entry fee paid: ${cost.toLocaleString()} coins. Balance: ${newBalance.toLocaleString()}`, 'info', 3000);
        console.log(`💰 Matchmaking payment processed: ${cost} coins for ${city}`);
        return true;
    } else {
        showNotification(`❌ Insufficient coins for matchmaking! Need ${cost.toLocaleString()} coins.`, 'error', 4000);
        console.log(`❌ Matchmaking payment failed: Need ${cost} coins, have ${currentCoins}`);
        return false;
    }
}

// Award prize to winner
function awardGamePrize(city, cost, isWinner = true, playerName = 'Player') {
    if (!isWinner) {
        console.log(`💔 ${playerName} did not win, no prize awarded`);
        return 0;
    }

    const prizeAmount = getPrizeAmount(cost);
    const newBalance = addCoins(prizeAmount, `${city} Arena victory prize`);

    showNotification(`🏆 Victory! Prize: ${prizeAmount.toLocaleString()} coins! Balance: ${newBalance.toLocaleString()}`, 'success', 5000);
    console.log(`🏆 Prize awarded: ${prizeAmount} coins for winning ${city} arena`);

    return prizeAmount;
}

// Get total prize pool for display purposes
function getTotalPrizePool(cost) {
    return cost * 2; // Both players' entry fees
}

// Get service fee for display purposes
function getServiceFee(cost) {
    const prizeAmount = getPrizeAmount(cost);
    const totalPool = getTotalPrizePool(cost);
    return totalPool - prizeAmount;
}

// ===== CANDY SELECTION CONFIRMATION SYSTEM =====

// Global variables for candy selection confirmation
let candyConfirmationTimer = null;
let candyConfirmationCountdown = 60; // 60 seconds as requested
let opponentStatusCheckInterval = null;

// Initialize candy selection confirmation screen
function initializeCandySelectionConfirmation(matchData) {
    console.log('🍬 Initializing candy selection confirmation screen');

    // Store match data
    gameState.matchData = matchData;
    gameState.gameId = matchData.game_id;
    gameState.playerId = matchData.player_id;
    gameState.opponentName = matchData.opponent.name;
    gameState.city = matchData.city || 'dubai';

    // Update UI elements
    const opponentNameElement = document.getElementById('opponent-name-display');
    if (opponentNameElement) {
        opponentNameElement.textContent = gameState.opponentName;
    }

    const cityDisplayElement = document.getElementById('city-display');
    if (cityDisplayElement) {
        cityDisplayElement.textContent = gameState.city.toUpperCase();
    }

    // Display player's candy collection
    displayPlayerCandyCollection();

    // Start confirmation timer
    startCandyConfirmationTimer();

    // Start checking opponent status
    startOpponentStatusCheck();
}

// Display player's candy collection for confirmation
function displayPlayerCandyCollection() {
    const candyCollectionElement = document.getElementById('player-candy-collection');
    if (!candyCollectionElement) return;

    // Generate unique candies for this game
    const candies = generateUniqueGameCandies();
    gameState.playerCandies = candies;

    candyCollectionElement.innerHTML = '';
    candies.forEach((candy, index) => {
        const candyElement = document.createElement('div');
        candyElement.className = 'candy-item';
        candyElement.innerHTML = `
            <div class="candy-icon">${candy}</div>
            <div class="candy-name">${candy}</div>
        `;
        candyCollectionElement.appendChild(candyElement);
    });
}

// Start candy confirmation timer - PRD: 20 seconds + 10 second warning
function startCandyConfirmationTimer() {
    candyConfirmationCountdown = 20; // PRD: 20 seconds initial confirmation time
    updateCandyConfirmationDisplay();

    candyConfirmationTimer = setInterval(() => {
        candyConfirmationCountdown--;
        updateCandyConfirmationDisplay();

        // PRD: Show warning at 10 seconds remaining
        if (candyConfirmationCountdown === 10) {
            showNotification('⚠️ Please confirm your candy selection - 10 seconds remaining!', 'warning', 3000);
        }

        // PRD: Disconnect after 30 seconds total (20+10)
        if (candyConfirmationCountdown <= 0) {
            clearInterval(candyConfirmationTimer);
            handleCandyConfirmationTimeout();
        }
    }, 1000);
}

// Update candy confirmation timer display - PRD compliant
function updateCandyConfirmationDisplay() {
    const timerElement = document.getElementById('candy-confirmation-timer');
    if (timerElement) {
        // PRD: First 20 seconds - normal confirmation phase
        if (candyConfirmationCountdown > 10) {
            timerElement.textContent = `Confirm your candy selection: ${candyConfirmationCountdown}s`;
            timerElement.style.color = '#10b981';
            timerElement.style.fontWeight = 'normal';
        }
        // PRD: Last 10 seconds - warning phase
        else if (candyConfirmationCountdown > 0) {
            timerElement.textContent = `⚠️ WARNING - Confirm now: ${candyConfirmationCountdown}s`;
            timerElement.style.color = '#ef4444';
            timerElement.style.fontWeight = 'bold';
        }
        // PRD: Timeout phase
        else {
            timerElement.textContent = 'TIMEOUT - Disconnecting...';
            timerElement.style.color = '#dc2626';
            timerElement.style.fontWeight = 'bold';
        }
    }
}

// Handle candy confirmation timeout - PRD compliant
function handleCandyConfirmationTimeout() {
    console.log('⏰ PRD: Candy confirmation timeout after 30 seconds - disconnecting player');

    // Stop opponent status checking
    if (opponentStatusCheckInterval) {
        clearInterval(opponentStatusCheckInterval);
        opponentStatusCheckInterval = null;
    }

    // PRD: Disconnect player and return opponent to matchmaking queue
    showNotification('⏰ Candy selection timed out after 30 seconds! Disconnecting...', 'error', 5000);

    // Notify backend of timeout/disconnect
    if (gameState.gameId && gameState.playerId) {
        fetch('http://localhost:8000/games/disconnect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_id: gameState.gameId,
                player_id: gameState.playerId,
                reason: 'candy_confirmation_timeout'
            })
        }).catch(error => console.error('Failed to notify backend of disconnect:', error));
    }

    // Return to main menu
    setTimeout(() => {
        showScreen('page1');
    }, 2000);
}

// Confirm candy selection
async function confirmCandySelection() {
    console.log('🍬 Confirming candy selection...');

    try {
        // Call backend API to confirm candy selection
        const response = await fetch('http://localhost:8000/candy/select', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player_id: gameState.playerId,
                candy_id: 'confirmed', // Just confirming the existing candy collection
                game_id: gameState.gameId
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Candy selection confirmed successfully');

            // Stop confirmation timer
            if (candyConfirmationTimer) {
                clearInterval(candyConfirmationTimer);
                candyConfirmationTimer = null;
            }

            // Update UI to show confirmation
            const confirmButton = document.getElementById('confirm-candy-btn');
            if (confirmButton) {
                confirmButton.textContent = 'Confirmed ✅';
                confirmButton.disabled = true;
                confirmButton.style.backgroundColor = '#10b981';
            }

            // Update status message
            const statusElement = document.getElementById('candy-confirmation-status');
            if (statusElement) {
                statusElement.textContent = 'Waiting for opponent to confirm...';
                statusElement.style.color = '#10b981';
            }

            showNotification('✅ Candy selection confirmed! Waiting for opponent...', 'success', 3000);

            // Continue checking opponent status
            // This will automatically proceed to game start when both players confirmed

        } else {
            console.log('❌ Failed to confirm candy selection:', result.message);
            showNotification('❌ Failed to confirm candy selection. Please try again.', 'error');
        }

    } catch (error) {
        console.error('❌ Error confirming candy selection:', error);
        showNotification('❌ Error confirming candy selection. Please try again.', 'error');
    }
}

// Start checking opponent status
function startOpponentStatusCheck() {
    opponentStatusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`http://localhost:8000/game/status/${gameState.gameId}`);
            const data = await response.json();

            if (data.success) {
                const gameStatus = data.data;

                // Update opponent status display
                const opponentStatusElement = document.getElementById('opponent-status');
                if (opponentStatusElement) {
                    const opponentConfirmed = gameStatus.player2 && gameStatus.player2.candy_confirmed;
                    opponentStatusElement.textContent = opponentConfirmed ? 'Confirmed ✅' : 'Waiting...';
                    opponentStatusElement.style.color = opponentConfirmed ? '#10b981' : '#f59e0b';
                }

                // Check if both players confirmed
                const player1Confirmed = gameStatus.player1 && gameStatus.player1.candy_confirmed;
                const player2Confirmed = gameStatus.player2 && gameStatus.player2.candy_confirmed;

                if (player1Confirmed && player2Confirmed) {
                    console.log('🎮 Both players confirmed candy selection - starting game');

                    // Stop status checking
                    clearInterval(opponentStatusCheckInterval);
                    opponentStatusCheckInterval = null;

                    // Start the game
                    await startGameAfterConfirmation();
                }
            }
        } catch (error) {
            console.error('❌ Error checking opponent status:', error);
        }
    }, 2000); // Check every 2 seconds
}

// Start game after both players confirmed
async function startGameAfterConfirmation() {
    console.log('🎮 Starting game after candy confirmation');

    try {
        // Call backend to start the game
        const response = await fetch('http://localhost:8000/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                game_id: gameState.gameId,
                player_id: gameState.playerId
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Game started successfully');

            // Show success message
            showNotification('🎮 Game starting! Get ready to play!', 'success', 3000);

            // Navigate to game screen
            setTimeout(() => {
                showScreen('page4'); // Go to main game screen
                initializeOnlineGame();
            }, 2000);

        } else {
            console.log('❌ Failed to start game:', result.message);
            showNotification('❌ Failed to start game. Returning to main menu.', 'error');

            setTimeout(() => {
                showScreen('page1');
            }, 2000);
        }

    } catch (error) {
        console.error('❌ Error starting game:', error);
        showNotification('❌ Error starting game. Returning to main menu.', 'error');

        setTimeout(() => {
            showScreen('page1');
        }, 2000);
    }
}

// Initialize online game after candy confirmation
function initializeOnlineGame() {
    console.log('🎮 Initializing online game');

    // Set game mode
    gameState.gameMode = 'online';

    // Initialize game board
    if (typeof initializeGameBoard === 'function') {
        initializeGameBoard();
    }

    // Set up opponent name display
    const opponentNameElement = document.getElementById('opponent-name');
    if (opponentNameElement) {
        opponentNameElement.textContent = gameState.opponentName;
    }

    // Initialize poison selection
    if (typeof initializePoisonSelectionInGame === 'function') {
        initializePoisonSelectionInGame();
    }

    console.log('✅ Online game initialized');
}

// Clean up candy confirmation timers
function cleanupCandyConfirmation() {
    if (candyConfirmationTimer) {
        clearInterval(candyConfirmationTimer);
        candyConfirmationTimer = null;
    }

    if (opponentStatusCheckInterval) {
        clearInterval(opponentStatusCheckInterval);
        opponentStatusCheckInterval = null;
    }
}

// Export candy confirmation functions
window.initializeCandySelectionConfirmation = initializeCandySelectionConfirmation;
window.confirmCandySelection = confirmCandySelection;
window.cleanupCandyConfirmation = cleanupCandyConfirmation;

