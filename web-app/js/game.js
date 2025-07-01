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
        this.isPlayerTurn = true;
        this.gameStarted = false;
        this.gameEnded = false;
        
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
        
        document.getElementById('total-games').textContent = this.stats.totalGames;
        document.getElementById('win-rate').textContent = `${winRate}%`;
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
const gameState = new GameState();

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        gameState.currentScreen = screenId;
        
        // Handle screen-specific logic
        switch(screenId) {
            case 'main-menu':
                gameState.updateStats();
                break;
            case 'game-setup':
                initializeGameSetup();
                break;
            case 'poison-selection':
                initializePoisonSelection();
                break;
            case 'game-board':
                initializeGameBoard();
                break;
            case 'leaderboard':
                loadLeaderboard();
                break;
        }
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

async function startGame() {
    // Get setup values
    gameState.playerName = document.getElementById('player-name').value || 'Player';
    gameState.gameMode = document.querySelector('input[name="game-mode"]:checked').value;
    gameState.difficulty = document.querySelector('input[name="difficulty"]:checked').value;
    
    // Update player name display
    document.getElementById('player-name-display').textContent = gameState.playerName;
    
    try {
        // Create new game via API
        const response = await fetch('http://localhost:8000/games', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player1_name: gameState.playerName,
                player2_name: gameState.gameMode === 'ai' ? 'AI Opponent' : 'Player 2'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create game');
        }
        
        const gameData = await response.json();
        console.log('Game created:', gameData);
        
        // Extract game info from the response structure
        gameState.gameId = gameData.data.game_id;
        gameState.currentGameState = gameData.data.game_state;
        
        // Store player info
        gameState.playerId = gameData.data.game_state.player1.id;
        gameState.opponentId = gameData.data.game_state.player2.id;
        
        // Set up game data from the game state
        gameState.playerCandies = gameData.data.game_state.player1.owned_candies;
        gameState.opponentCandies = gameData.data.game_state.player2.owned_candies;
        gameState.playerCollection = gameData.data.game_state.player1.collected_candies;
        gameState.opponentCollection = gameData.data.game_state.player2.collected_candies;
        
        // Update game ID display
        document.getElementById('current-game-id').textContent = gameState.gameId.substring(0, 8);
        
        // Move to poison selection
        showScreen('poison-selection');
        
    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start game. Please check your connection and try again.');
    }
}

// ===== POISON SELECTION =====
function initializePoisonSelection() {
    const candyGrid = document.getElementById('poison-candy-grid');
    candyGrid.innerHTML = '';
    
    // Use player's owned candies for poison selection
    const playerCandies = gameState.playerCandies || [];
    console.log('Player candies for poison selection:', playerCandies);
    
    playerCandies.forEach((candy, index) => {
        const candyElement = document.createElement('div');
        candyElement.className = 'candy-item';
        candyElement.textContent = candy;
        candyElement.dataset.index = index;
        candyElement.dataset.candy = candy;
        
        candyElement.addEventListener('click', () => selectPoison(candy, index, candyElement));
        
        candyGrid.appendChild(candyElement);
    });
    
    // Initialize confirm button state
    document.getElementById('confirm-poison-btn').disabled = true;
    gameState.selectedPoison = null;
}

function selectPoison(candy, index, element) {
    // Remove previous selection
    document.querySelectorAll('.candy-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select new poison
    element.classList.add('selected');
    gameState.selectedPoison = candy;
    
    // Update display
    const poisonDisplay = document.getElementById('selected-poison-display');
    poisonDisplay.innerHTML = `<p>Selected poison: <strong>${candy}</strong></p>`;
    
    // Enable confirm button
    document.getElementById('confirm-poison-btn').disabled = false;
}

async function confirmPoison() {
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
            
            // Move to game board
            showScreen('game-board');
            initializeGameBoard();
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Error setting poison:', error);
        alert('Failed to set poison. Please try again.');
    }
}

// ===== GAME BOARD =====
function initializeGameBoard() {
    updateGameBoard();
    updateCollections();
    updateGameStatus();
}

function updateGameBoard() {
    // Update player candies (owned candies that opponent can pick from)
    const playerGrid = document.getElementById('player-candy-grid');
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
        const isAvailable = availableCandies.includes(candy);
        
        if (gameState.isPlayerTurn && !gameState.gameEnded && isAvailable) {
            candyElement.addEventListener('click', () => pickCandy(candy, index, candyElement));
        } else {
            candyElement.classList.add('disabled');
            if (!isAvailable) {
                candyElement.style.opacity = '0.5';
                candyElement.title = 'Already collected';
            }
        }
        
        opponentGrid.appendChild(candyElement);
    });
}

function updateCollections() {
    // Update player collection
    const playerCollectionGrid = document.getElementById('player-collection-grid');
    playerCollectionGrid.innerHTML = '';
    
    for (let i = 0; i < 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'collection-item';
        
        if (i < gameState.playerCollection.length) {
            slot.textContent = gameState.playerCollection[i];
        } else {
            slot.classList.add('empty');
            slot.textContent = '?';
        }
        
        playerCollectionGrid.appendChild(slot);
    }
    
    // Update opponent collection
    const opponentCollectionGrid = document.getElementById('opponent-collection-grid');
    opponentCollectionGrid.innerHTML = '';
    
    for (let i = 0; i < 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'collection-item';
        
        if (i < gameState.opponentCollection.length) {
            slot.textContent = gameState.opponentCollection[i];
        } else {
            slot.classList.add('empty');
            slot.textContent = '?';
        }
        
        opponentCollectionGrid.appendChild(slot);
    }
    
    // Update collection counts
    document.getElementById('player-collection-count').textContent = gameState.playerCollection.length;
    document.getElementById('opponent-collection-count').textContent = gameState.opponentCollection.length;
}

function updateGameStatus() {
    const turnIndicator = document.getElementById('turn-indicator');
    const statusText = document.getElementById('game-status-text');
    const progressFill = document.getElementById('game-progress');
    
    if (gameState.gameEnded) {
        turnIndicator.textContent = 'Game Over';
        statusText.textContent = 'Game has ended';
        return;
    }
    
    if (gameState.isPlayerTurn) {
        turnIndicator.textContent = 'Your Turn';
        statusText.textContent = 'Choose a candy from opponent\'s pool';
    } else {
        turnIndicator.textContent = 'Opponent\'s Turn';
        statusText.textContent = 'Waiting for opponent to pick...';
    }
    
    // Update progress bar based on collections
    const totalProgress = (gameState.playerCollection.length + gameState.opponentCollection.length) / 18 * 100;
    progressFill.style.width = `${totalProgress}%`;
}

async function pickCandy(candy, index, element) {
    if (!gameState.isPlayerTurn || gameState.gameEnded) return;
    
    try {
        // Send pick to backend
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
            console.error('Pick error:', errorData);
            throw new Error('Failed to pick candy');
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
                    setTimeout(checkForAIMove, 2000);
                }
            }
        } else {
            throw new Error(result.message || 'Failed to pick candy');
        }
        
    } catch (error) {
        console.error('Error picking candy:', error);
        alert('Failed to pick candy. Please try again.');
    }
}

function updateFromGameState(gameState_backend) {
    // Update local game state from backend game state
    gameState.playerCandies = gameState_backend.player1.owned_candies;
    gameState.opponentCandies = gameState_backend.player2.owned_candies;
    gameState.playerCollection = gameState_backend.player1.collected_candies;
    gameState.opponentCollection = gameState_backend.player2.collected_candies;
    
    // Update turn info
    const currentPlayerId = gameState_backend.current_player;
    gameState.isPlayerTurn = (currentPlayerId === gameState.playerId);
    
    // Update game status
    gameState.gameEnded = (gameState_backend.state === "finished");
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
    if (gameState.gameEnded || gameState.isPlayerTurn) return;
    
    // Simple AI: pick random candy from player's pool
    const availableCandies = gameState.playerCandies.filter(candy => candy !== gameState.selectedPoison);
    
    if (availableCandies.length === 0) {
        // AI has to pick poison - player wins
        endGame(true, 'AI picked your poison! You win!');
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * gameState.playerCandies.length);
    const pickedCandy = gameState.playerCandies[randomIndex];
    
    try {
        const response = await fetch(`http://localhost:8000/games/${gameState.gameId}/pick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player: 'player2',
                candy_choice: pickedCandy
            })
        });
        
        if (!response.ok) {
            throw new Error('AI pick failed');
        }
        
        const result = await response.json();
        
        if (result.picked_poison) {
            // AI picked poison - player wins
            endGame(true, `AI picked your poison ${pickedCandy}! You win!`);
        } else {
            // Add to AI collection if new candy type
            if (!gameState.opponentCollection.includes(pickedCandy)) {
                gameState.opponentCollection.push(pickedCandy);
            }
            
            // Remove candy from player's pool
            gameState.playerCandies.splice(randomIndex, 1);
            
            // Check AI win condition
            if (gameState.opponentCollection.length >= 9) {
                endGame(false, 'AI collected 9 different candies! You lose!');
                return;
            }
            
            // Switch back to player turn
            gameState.isPlayerTurn = true;
            updateGameBoard();
            updateCollections();
            updateGameStatus();
        }
        
    } catch (error) {
        console.error('Error in AI turn:', error);
        // Continue game on error
        gameState.isPlayerTurn = true;
        updateGameStatus();
    }
}

function endGame(playerWon, message) {
    gameState.gameEnded = true;
    gameState.recordGameResult(playerWon);
    
    // Update result display
    const resultDisplay = document.getElementById('result-display');
    resultDisplay.className = `result-display ${playerWon ? 'win' : 'lose'}`;
    resultDisplay.innerHTML = `
        <h2>${playerWon ? '🎉 Victory!' : '💔 Defeat'}</h2>
        <p>${message}</p>
    `;
    
    // Update game summary
    const gameSummary = document.getElementById('game-summary');
    gameSummary.innerHTML = `
        <h3>Game Summary</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
            <div>
                <strong>Your Collection:</strong>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    ${gameState.playerCollection.map(candy => `<span style="font-size: 1.5rem;">${candy}</span>`).join('')}
                </div>
                <p style="margin-top: 0.5rem;">${gameState.playerCollection.length}/9 candies</p>
            </div>
            <div>
                <strong>Opponent's Collection:</strong>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    ${gameState.opponentCollection.map(candy => `<span style="font-size: 1.5rem;">${candy}</span>`).join('')}
                </div>
                <p style="margin-top: 0.5rem;">${gameState.opponentCollection.length}/9 candies</p>
            </div>
        </div>
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 0.5rem;">
            <strong>Your Poison:</strong> <span style="font-size: 1.5rem;">${gameState.selectedPoison}</span>
        </div>
    `;
    
    // Show end screen
    showScreen('game-end');
}

function startNewGame() {
    // Reset game state
    gameState.gameId = null;
    gameState.currentGame = null;
    gameState.playerCandies = [];
    gameState.opponentCandies = [];
    gameState.playerCollection = [];
    gameState.opponentCollection = [];
    gameState.selectedPoison = null;
    gameState.isPlayerTurn = true;
    gameState.gameStarted = false;
    gameState.gameEnded = false;
    
    // Go to game setup
    showScreen('game-setup');
}

function forfeitGame() {
    if (confirm('Are you sure you want to forfeit this game?')) {
        endGame(false, 'You forfeited the game.');
    }
}

function shareResult() {
    const won = gameState.gameEnded && document.querySelector('.result-display.win');
    const text = won ? 
        `🎉 I just won a game of Poisoned Candy Duel! Collected ${gameState.playerCollection.length}/9 candies!` :
        `💔 Just played Poisoned Candy Duel. Got ${gameState.playerCollection.length}/9 candies before losing.`;
    
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

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Start with loading screen, then move to main menu
    setTimeout(() => {
        showScreen('main-menu');
    }, 2000);
    
    // Initialize game state
    gameState.updateStats();
});