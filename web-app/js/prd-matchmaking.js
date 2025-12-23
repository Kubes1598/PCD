// ===== PRD COMPLIANT MATCHMAKING SYSTEM =====

class PRDMatchmakingManager {
    constructor() {
        this.searchTimeout = null;
        this.countdownInterval = null;
        this.searchStartTime = null;
        this.selectedCity = null;
        this.isSearching = false;
        this.searchTimeLimit = 30; // 30 seconds as per PRD
        this.candySelectionTimeLimit = 30; // 30 seconds for candy selection
        this.candyWarningTime = 20; // 20 seconds warning

        // Mock player data for realistic simulation
        this.mockPlayerCounts = {
            'Dubai': { min: 45, max: 120 },
            'Cairo': { min: 25, max: 80 },
            'Oslo': { min: 15, max: 50 }
        };

        this.statusMessages = [
            '🔍 Scanning for available players...',
            '🌐 Connecting to game servers...',
            '⚡ Analyzing player skill levels...',
            '🎯 Finding suitable opponents...',
            '🤝 Matching with players...'
        ];

        this.currentStatusIndex = 0;

        // Initialize timeout handlers immediately
        this.initializeTimeoutHandlers();
    }

    // ===== PRD STEP 2: START PLAYER SEARCH =====
    startPlayerSearch(city) {
        console.log(`🔍 PRD: Starting player search in ${city}`);

        if (this.isSearching) {
            console.warn('Search already in progress');
            return;
        }

        this.selectedCity = city;
        this.isSearching = true;
        this.searchStartTime = Date.now();
        this.currentStatusIndex = 0;

        // PRD: Show "Searching for Player" screen
        this.showSearchingScreen(city);

        // Start countdown timer (30 seconds)
        this.startSearchCountdown();

        // Update status messages periodically
        this.startStatusUpdates();

        // Simulate matchmaking process
        this.simulateMatchmaking();
    }

    // PRD: Display the searching screen
    showSearchingScreen(city) {
        // Update city-specific information
        const cityIcon = document.getElementById('selected-city-icon');
        const cityText = document.getElementById('searching-city-text');
        const playersCount = document.getElementById('players-online-count');

        if (cityIcon) {
            cityIcon.textContent = this.getCityIcon(city);
            cityIcon.className = `text-8xl mb-4 city-icon-${city.toLowerCase()}`;
        }

        if (cityText) {
            cityText.textContent = `Searching for players in ${city}...`;
        }

        if (playersCount) {
            const mockCount = this.generateMockPlayerCount(city);
            playersCount.textContent = `${mockCount} online`;
        }

        // PRD: Set searching status
        this.setSearchingStatus();

        // Show the searching screen
        if (typeof showScreen === 'function') {
            showScreen('page2b');
        }

        console.log(`✅ PRD: Searching screen displayed for ${city}`);
    }

    // PRD: 30-second countdown timer
    startSearchCountdown() {
        let timeRemaining = this.searchTimeLimit;
        const countdownElement = document.getElementById('countdown-timer');
        const progressElement = document.getElementById('search-progress');

        // Start progress bar animation
        if (progressElement) {
            progressElement.classList.add('search-countdown-active');
        }

        this.countdownInterval = setInterval(() => {
            timeRemaining--;

            if (countdownElement) {
                countdownElement.textContent = timeRemaining;
            }

            // Update progress bar manually for more control
            if (progressElement) {
                const progress = (timeRemaining / this.searchTimeLimit) * 100;
                progressElement.style.width = `${progress}%`;
            }

            // PRD: Handle timeout after 30 seconds
            if (timeRemaining <= 0) {
                this.handleSearchTimeout();
            }

            // Change color as time runs out
            if (timeRemaining <= 10 && progressElement) {
                progressElement.style.backgroundColor = '#dc2626'; // Red
            } else if (timeRemaining <= 20 && progressElement) {
                progressElement.style.backgroundColor = '#f59e0b'; // Orange
            }

        }, 1000);
    }

    // PRD: Update status messages during search
    startStatusUpdates() {
        const statusElement = document.getElementById('search-status-text');

        const updateStatus = () => {
            if (!this.isSearching) return;

            if (statusElement) {
                statusElement.classList.add('status-text-updating');

                setTimeout(() => {
                    statusElement.textContent = this.statusMessages[this.currentStatusIndex];
                    statusElement.classList.remove('status-text-updating');
                }, 250);
            }

            this.currentStatusIndex = (this.currentStatusIndex + 1) % this.statusMessages.length;

            // Continue updating every 3-5 seconds
            if (this.isSearching) {
                setTimeout(updateStatus, 3000 + Math.random() * 2000);
            }
        };

        // Start first update after 2 seconds
        setTimeout(updateStatus, 2000);
    }

    // PRD: Connect to real matchmaking backend
    connectToRealMatchmaking() {
        const city = this.selectedCity.toLowerCase();
        const playerId = this.getPlayerId();
        const playerName = this.getPlayerName();

        console.log(`🌐 Connecting to real matchmaking for ${city} as ${playerName}`);

        try {
            // Close existing connection if any
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.close();
            }

            // Connect to backend WebSocket
            const wsUrl = `ws://localhost:8000/matchmaking/ws/${playerId}`;
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('🎮 Connected to matchmaking server');

                // Join the city-specific queue
                this.websocket.send(JSON.stringify({
                    type: 'join_queue',
                    player_name: playerName,
                    city: city
                }));

                console.log(`📍 Joined ${city} matchmaking queue`);
            };

            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('🎮 Matchmaking message:', data);

                if (data.type === 'match_found') {
                    this.handleRealMatchFound(data);
                } else if (data.type === 'matchmaking_timeout') {
                    this.handleSearchTimeout();
                } else if (data.type === 'queue_status') {
                    this.updateQueueInfo(data);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('🎮 WebSocket error:', error);
                // Fall back to simulation if backend unavailable
                this.fallbackToSimulation();
            };

            this.websocket.onclose = () => {
                console.log('🎮 WebSocket closed');
            };

        } catch (error) {
            console.error('🎮 Failed to connect:', error);
            this.fallbackToSimulation();
        }
    }

    getPlayerId() {
        // Use authenticated user ID if available
        if (typeof authManager !== 'undefined' && authManager.user) {
            return authManager.user.id;
        }
        // Fallback to localStorage player ID
        let playerId = localStorage.getItem('pcd_player_id');
        if (!playerId) {
            playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('pcd_player_id', playerId);
        }
        return playerId;
    }

    getPlayerName() {
        if (typeof authManager !== 'undefined' && authManager.user) {
            return authManager.user.username || authManager.user.name;
        }
        if (typeof gameState !== 'undefined' && gameState.playerName) {
            return gameState.playerName;
        }
        return 'Player_' + Math.floor(1000 + Math.random() * 9000);
    }

    handleRealMatchFound(data) {
        console.log('🎯 Real match found!', data);
        this.stopSearch();

        // Store match data in gameState
        if (typeof gameState !== 'undefined') {
            gameState.gameId = data.game_id;
            gameState.gameMode = 'online';
            gameState.currentGame = data.game_state;
            gameState.city = data.city || this.selectedCity.toLowerCase();
            gameState.opponentName = data.opponent?.name || 'Opponent';

            // Set player role
            if (data.your_role === 'player1') {
                gameState.playerId = data.game_state.player1.id;
                gameState.opponentId = data.game_state.player2.id;
                gameState.playerCandies = Array.from(data.game_state.player1.owned_candies || []);
                gameState.opponentCandies = Array.from(data.game_state.player2.owned_candies || []);
            } else {
                gameState.playerId = data.game_state.player2.id;
                gameState.opponentId = data.game_state.player1.id;
                gameState.playerCandies = Array.from(data.game_state.player2.owned_candies || []);
                gameState.opponentCandies = Array.from(data.game_state.player1.owned_candies || []);
            }
        }

        this.setMatchFoundStatus();
        this.showMatchFoundOverlay();

        setTimeout(() => {
            this.proceedToCandySelection();
        }, 2000);
    }

    updateQueueInfo(data) {
        const queueInfoEl = document.getElementById('queue-info-page');
        if (queueInfoEl) {
            queueInfoEl.style.display = 'block';
            queueInfoEl.innerHTML = `
                <div class="text-sm text-gray-600">
                    Position: ${data.position} of ${data.total_waiting} waiting
                </div>
            `;
        }
    }

    fallbackToSimulation() {
        console.log('⚠️ Falling back to simulated matchmaking');
        // Random success time between 8-25 seconds for offline/demo mode
        const successTime = 8000 + Math.random() * 17000;
        this.searchTimeout = setTimeout(() => {
            if (this.isSearching) {
                this.handleMatchFound();
            }
        }, successTime);
    }

    // Legacy simulate function - now connects to real backend
    simulateMatchmaking() {
        this.connectToRealMatchmaking();
    }

    // PRD: Handle successful match
    handleMatchFound() {
        console.log('🎯 PRD: Match found!');

        this.stopSearch();

        // PRD: Update opponent status
        this.setMatchFoundStatus();

        // Show match found overlay
        this.showMatchFoundOverlay();

        // Wait 2 seconds then proceed to candy selection
        setTimeout(() => {
            this.proceedToCandySelection();
        }, 2000);
    }

    // PRD: Handle 30-second timeout (no players found)
    handleSearchTimeout() {
        console.log('⏰ PRD: Search timeout after 30 seconds');

        this.stopSearch();

        // PRD: Show enhanced timeout message with statistics
        this.showEnhancedTimeoutModal();
    }

    showEnhancedTimeoutModal() {
        const city = this.selectedCity;
        const timeSlot = this.getCurrentTimeSlot();
        const suggestions = this.getTimeoutSuggestions(city, timeSlot);

        if (typeof uxManager !== 'undefined') {
            uxManager.showModal(
                '⏰ No Players Found',
                `
                    <div class="text-center space-y-4">
                        <div class="text-6xl mb-4">🔍</div>
                        <h3 class="text-xl font-bold mb-4">No players found in ${city}</h3>
                        <p class="text-gray-600 mb-4">We searched for 30 seconds but couldn't find another player in the ${city} arena.</p>
                        
                        <div class="bg-blue-50 rounded-lg p-4 mb-4">
                            <div class="text-sm text-blue-700">
                                <strong>📊 Quick Stats:</strong>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-sm text-blue-700 mt-2">
                                <div>Current time: ${timeSlot}</div>
                                <div>Players online: ${this.generateMockPlayerCount(city)}</div>
                                <div>Avg wait: ~${this.getAverageWaitTime(city)}s</div>
                                <div>Success rate: ${this.getSuccessRate(city, timeSlot)}%</div>
                            </div>
                        </div>
                        
                        <div class="space-y-2">
                            ${suggestions.map(suggestion => `
                                <div class="bg-${suggestion.color}-50 rounded-lg p-3">
                                    <div class="text-sm text-${suggestion.color}-700">
                                        ${suggestion.icon} <strong>${suggestion.title}:</strong> ${suggestion.description}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'Try Again',
                        class: 'btn-primary',
                        onclick: () => this.retrySearchWithDelay()
                    },
                    {
                        text: 'Change City',
                        class: 'btn-secondary',
                        onclick: () => this.returnToCitySelection()
                    },
                    {
                        text: 'Practice Mode',
                        class: 'btn-outline',
                        onclick: () => this.goToPracticeMode()
                    }
                ]
            );
        }
    }

    getCurrentTimeSlot() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'Morning';
        if (hour >= 12 && hour < 18) return 'Afternoon';
        if (hour >= 18 && hour < 24) return 'Evening';
        return 'Night';
    }

    getTimeoutSuggestions(city, timeSlot) {
        const suggestions = [];

        // Time-based suggestions
        if (timeSlot === 'Night' || timeSlot === 'Morning') {
            suggestions.push({
                icon: '🌙',
                title: 'Off-Peak Hours',
                description: 'Try again during evening hours (6-10 PM) for more players',
                color: 'blue'
            });
        }

        // City-based suggestions
        if (city === 'Oslo') {
            suggestions.push({
                icon: '🏙️',
                title: 'Try Dubai',
                description: 'Dubai arena typically has more active players',
                color: 'green'
            });
        }

        // General suggestions
        suggestions.push({
            icon: '💡',
            title: 'Quick Tip',
            description: 'Practice mode helps improve your skills while waiting',
            color: 'yellow'
        });

        return suggestions;
    }

    getAverageWaitTime(city) {
        const waitTimes = { 'Dubai': 12, 'Cairo': 18, 'Oslo': 25 };
        return waitTimes[city] || 20;
    }

    getSuccessRate(city, timeSlot) {
        const baseRates = { 'Dubai': 85, 'Cairo': 70, 'Oslo': 60 };
        const timeMultiplier = timeSlot === 'Evening' ? 1.2 : 0.8;
        return Math.min(95, Math.floor(baseRates[city] * timeMultiplier));
    }

    retrySearchWithDelay() {
        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
            uxManager.showNotification('🔄 Retrying search in 3 seconds...', 'info', 3000);
        }

        setTimeout(() => {
            this.startPlayerSearch(this.selectedCity);
        }, 3000);
    }

    // PRD: Show match found animation
    showMatchFoundOverlay() {
        const overlay = document.getElementById('match-found-overlay');
        const opponentInfo = document.getElementById('opponent-info');

        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('show');
        }

        if (opponentInfo) {
            // Simulate opponent information
            const mockOpponent = this.generateMockOpponent();
            opponentInfo.textContent = `Matched with ${mockOpponent.name} (${mockOpponent.rating} rating)`;
        }
    }

    // PRD: STEP 4 - Proceed to candy selection
    proceedToCandySelection() {
        console.log('🍭 PRD: Proceeding to candy selection');

        // Hide match found overlay
        const overlay = document.getElementById('match-found-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('show');
        }

        // Set up game state for matched game
        this.setupMatchedGameState();

        // PRD: Go to candy selection screen
        if (typeof showScreen === 'function') {
            showScreen('page4'); // Existing candy selection screen

            // Initialize PRD-compliant candy selection
            this.initializePRDCandySelection();
        }
    }

    // ===== UTILITY FUNCTIONS =====

    stopSearch() {
        this.isSearching = false;

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    getCityIcon(city) {
        const icons = {
            'Dubai': '🏙️',
            'Cairo': '🏛️',
            'Oslo': '🏔️'
        };
        return icons[city] || '🌍';
    }

    generateMockPlayerCount(city) {
        const range = this.mockPlayerCounts[city] || { min: 10, max: 50 };
        return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }

    generateMockOpponent() {
        const names = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Avery'];
        const ratings = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

        return {
            name: names[Math.floor(Math.random() * names.length)],
            rating: ratings[Math.floor(Math.random() * ratings.length)]
        };
    }

    setupMatchedGameState() {
        if (typeof gameState !== 'undefined') {
            gameState.gameMode = 'online';
            gameState.selectedCity = this.selectedCity;
            gameState.isMatchmakingGame = true;
            gameState.opponentName = this.generateMockOpponent().name;

            // Enhanced: Use the new enhanced candy pool system
            try {
                console.log(`🍭 PRD: Using enhanced candy pool for ${this.selectedCity}`);

                if (typeof generatePRDEnhancedCandies === 'function') {
                    const enhancedCandies = generatePRDEnhancedCandies(this.selectedCity);

                    gameState.playerCandies = enhancedCandies.playerCandies;
                    gameState.opponentCandies = enhancedCandies.opponentCandies;
                    gameState.sessionId = enhancedCandies.sessionId;
                    gameState.difficulty = enhancedCandies.difficulty;

                    console.log(`✅ PRD Enhanced candy allocation:`, {
                        city: this.selectedCity,
                        difficulty: enhancedCandies.difficulty,
                        playerCandies: gameState.playerCandies.length,
                        opponentCandies: gameState.opponentCandies.length,
                        sessionId: enhancedCandies.sessionId
                    });

                    // Validate the candy pools
                    this.validateCandyPools(gameState.playerCandies, gameState.opponentCandies);

                } else {
                    throw new Error('Enhanced candy pool system not available');
                }

            } catch (error) {
                console.warn('⚠️ Enhanced candy pool failed, falling back to legacy system:', error);

                // Fallback to original system
                if (typeof generateUniqueGameCandies === 'function') {
                    const candySets = generateUniqueGameCandies();
                    gameState.playerCandies = candySets.playerCandies;
                    gameState.opponentCandies = candySets.opponentCandies;

                    console.log('🔄 Using legacy candy generation as fallback');
                } else {
                    console.error('❌ No candy generation system available!');
                }
            }
        }
    }

    // Validate generated candy pools
    validateCandyPools(playerCandies, opponentCandies) {
        console.log('🔍 PRD: Validating candy pools...');

        // Check for duplicates within each pool
        const playerSet = new Set(playerCandies);
        const opponentSet = new Set(opponentCandies);

        if (playerSet.size !== playerCandies.length) {
            console.error('❌ Player candies contain duplicates!', playerCandies);
        }

        if (opponentSet.size !== opponentCandies.length) {
            console.error('❌ Opponent candies contain duplicates!', opponentCandies);
        }

        // Check for overlaps between pools
        const overlap = playerCandies.filter(candy => opponentCandies.includes(candy));
        if (overlap.length > 0) {
            console.error('❌ Candy pools overlap!', overlap);
        } else {
            console.log('✅ Candy pools are valid - no overlaps, no duplicates');
        }

        // Show pool balance if enhanced system is available
        if (typeof getEnhancedCandyPool === 'function') {
            const enhancedPool = getEnhancedCandyPool();

            console.log('📊 Player candy balance:');
            enhancedPool.validatePoolBalance(playerCandies);

            console.log('📊 Opponent candy balance:');
            enhancedPool.validatePoolBalance(opponentCandies);
        }

        return {
            playerValid: playerSet.size === playerCandies.length,
            opponentValid: opponentSet.size === opponentCandies.length,
            noOverlap: overlap.length === 0
        };
    }

    initializePRDCandySelection() {
        // This will be implemented in the next step
        console.log('🍭 PRD: Initializing candy selection with timer');

        // PRD: Set candy selection status
        this.setCandySelectionStatus();

        // Start realistic opponent behavior simulation
        this.simulateRealisticOpponentBehavior();

        if (typeof initializePoisonSelection === 'function') {
            initializePoisonSelection();
        }

        // Start candy selection timer (will be implemented next)
        this.startCandySelectionTimer();
    }

    startCandySelectionTimer() {
        console.log('⏰ PRD: Starting candy selection timer (30s)');

        this.candyTimeRemaining = this.candySelectionTimeLimit;
        this.candyTimerInterval = null;
        this.candyWarningShown = false;

        // Add timer UI to the candy selection screen
        this.addCandyTimerUI();

        // Start countdown
        this.candyTimerInterval = setInterval(() => {
            this.candyTimeRemaining--;
            this.updateCandyTimerUI();

            // PRD: Show warning at 20 seconds
            if (this.candyTimeRemaining === this.candyWarningTime && !this.candyWarningShown) {
                this.showCandySelectionWarning();
            }

            // PRD: Handle timeout at 30 seconds
            if (this.candyTimeRemaining <= 0) {
                this.handleCandySelectionTimeout();
            }

        }, 1000);

        // Also simulate opponent candy selection
        this.simulateOpponentCandySelection();
    }

    // Add timer UI to candy selection screen
    addCandyTimerUI() {
        const candyScreen = document.getElementById('page4');
        if (!candyScreen) return;

        // Remove existing timer if present
        const existingTimer = document.getElementById('prd-candy-timer');
        if (existingTimer) {
            existingTimer.remove();
        }

        // Create timer UI
        const timerHTML = `
            <div id="prd-candy-timer" class="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 border-2 border-blue-500 z-40">
                <div class="text-center">
                    <div class="text-sm text-gray-600 mb-1">Candy Selection</div>
                    <div class="text-2xl font-bold text-blue-600 mb-2" id="candy-time-display">0:30</div>
                    <div class="w-24 h-2 bg-gray-200 rounded-full">
                        <div id="candy-time-progress" class="h-full bg-blue-500 rounded-full transition-all duration-1000" style="width: 100%"></div>
                    </div>
                </div>
                <div id="opponent-status" class="text-xs text-center mt-2 text-gray-500">
                    Opponent is selecting candy...
                </div>
            </div>
        `;

        candyScreen.insertAdjacentHTML('afterbegin', timerHTML);
    }

    // Update candy timer UI
    updateCandyTimerUI() {
        const timeDisplay = document.getElementById('candy-time-display');
        const progressBar = document.getElementById('candy-time-progress');

        if (timeDisplay) {
            const minutes = Math.floor(this.candyTimeRemaining / 60);
            const seconds = this.candyTimeRemaining % 60;
            timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (progressBar) {
            const progress = (this.candyTimeRemaining / this.candySelectionTimeLimit) * 100;
            progressBar.style.width = `${progress}%`;

            // Change color as time runs out
            if (this.candyTimeRemaining <= 10) {
                progressBar.style.backgroundColor = '#dc2626'; // Red
            } else if (this.candyTimeRemaining <= 20) {
                progressBar.style.backgroundColor = '#f59e0b'; // Orange
            }
        }
    }

    // PRD: Show warning at 20 seconds
    showCandySelectionWarning() {
        this.candyWarningShown = true;

        if (typeof uxManager !== 'undefined') {
            uxManager.showModal(
                '⚠️ Time Warning',
                `
                    <div class="text-center space-y-4">
                        <div class="text-4xl mb-4">⏰</div>
                        <h3 class="text-xl font-bold mb-4">Please confirm your candy selection</h3>
                        <p class="text-gray-600 mb-4">You have <strong>10 seconds</strong> remaining to select and confirm your candy choice.</p>
                        <div class="bg-yellow-50 rounded-lg p-4">
                            <div class="text-sm text-yellow-700">
                                <strong>⚠️ Important:</strong> If you don't confirm in time, a random candy will be selected for you.
                            </div>
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'Continue',
                        class: 'btn-primary'
                    }
                ]
            );
        } else {
            alert('Please confirm your candy selection! 10 seconds remaining.');
        }
    }

    // PRD: Handle 30-second timeout
    handleCandySelectionTimeout() {
        console.log('⏰ PRD: Candy selection timeout');

        // Clear timeout handlers
        this.clearTimeoutHandler('candySelection');

        // Stop the timer
        if (this.candyTimerInterval) {
            clearInterval(this.candyTimerInterval);
            this.candyTimerInterval = null;
        }

        // PRD: Show enhanced timeout modal
        this.showCandyTimeoutModal();
    }

    showCandyTimeoutModal() {
        if (typeof uxManager !== 'undefined') {
            uxManager.showModal(
                '⏰ Selection Timeout',
                `
                    <div class="text-center space-y-4">
                        <div class="text-6xl mb-4">⏰</div>
                        <h3 class="text-xl font-bold mb-4">Time's Up!</h3>
                        <p class="text-gray-600 mb-4">You didn't confirm your candy selection within 30 seconds.</p>
                        
                        <div class="bg-red-50 rounded-lg p-4 mb-4">
                            <div class="text-sm text-red-700">
                                <strong>⚠️ Match Cancelled:</strong> The game has been cancelled due to timeout.
                            </div>
                        </div>
                        
                        <div class="bg-green-50 rounded-lg p-4 mb-4">
                            <div class="text-sm text-green-700">
                                <strong>💰 Refund Issued:</strong> Your entry fee has been refunded.
                            </div>
                        </div>
                        
                        <div class="bg-blue-50 rounded-lg p-3">
                            <div class="text-sm text-blue-700">
                                <strong>💡 Tips for Next Time:</strong>
                                <ul class="text-left mt-2 space-y-1">
                                    <li>• Review candy options quickly</li>
                                    <li>• Choose your favorite poison early</li>
                                    <li>• Watch the timer in the top-right corner</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'Find New Game',
                        class: 'btn-primary',
                        onclick: () => this.returnToCitySelection()
                    },
                    {
                        text: 'Practice First',
                        class: 'btn-secondary',
                        onclick: () => this.goToPracticeMode()
                    }
                ]
            );
        }

        // Issue refund
        this.refundGameCost();

        // Clean up UI
        this.removeCandyTimerUI();
    }

    // Simulate opponent candy selection
    simulateOpponentCandySelection() {
        const opponentStatusElement = document.getElementById('opponent-status');

        // Random time between 5-25 seconds for opponent to "select"
        const opponentTime = 5000 + Math.random() * 20000;

        setTimeout(() => {
            if (this.candyTimerInterval) { // Only if timer is still running
                // PRD: Update opponent status to confirmed
                this.setOpponentConfirmedStatus();

                // Update local status element if it exists
                if (opponentStatusElement) {
                    opponentStatusElement.textContent = 'Opponent has confirmed!';
                    opponentStatusElement.classList.add('text-green-600');
                    opponentStatusElement.classList.remove('text-gray-500');
                }
            }
        }, opponentTime);
    }

    // Remove candy timer UI
    removeCandyTimerUI() {
        const timerElement = document.getElementById('prd-candy-timer');
        if (timerElement) {
            timerElement.remove();
        }
    }

    // Handle player candy confirmation (called when player confirms)
    handlePlayerCandyConfirmation() {
        console.log('✅ PRD: Player confirmed candy selection');

        // Stop the timer
        if (this.candyTimerInterval) {
            clearInterval(this.candyTimerInterval);
            this.candyTimerInterval = null;
        }

        // PRD: Update opponent status to show player confirmed
        this.setPlayerConfirmedStatus();

        // Update local UI elements
        const opponentStatus = document.getElementById('opponent-status');
        if (opponentStatus) {
            opponentStatus.textContent = 'You confirmed! Waiting for opponent...';
            opponentStatus.classList.add('text-blue-600');
            opponentStatus.classList.remove('text-gray-500');
        }

        // Wait for opponent (or simulate it)
        this.waitForOpponentConfirmation();
    }

    // Wait for opponent confirmation
    waitForOpponentConfirmation() {
        // Simulate opponent confirmation after a short delay
        setTimeout(() => {
            this.handleOpponentConfirmation();
        }, 2000 + Math.random() * 3000);
    }

    // Handle opponent confirmation
    handleOpponentConfirmation() {
        console.log('✅ PRD: Both players confirmed - starting game');

        // Remove timer UI
        this.removeCandyTimerUI();

        // Show game starting notification
        if (typeof uxManager !== 'undefined') {
            uxManager.showNotification('🎮 Both players ready! Starting game...', 'success', 2000);
        }

        // Proceed to gameplay
        setTimeout(() => {
            this.startGameplay();
        }, 2000);
    }

    // Start the actual gameplay
    startGameplay() {
        console.log('🎮 PRD: Starting synchronized gameplay');

        // Navigate to game screen
        if (typeof showScreen === 'function') {
            showScreen('page3');
        }

        // Initialize game board
        if (typeof initializeGameBoard === 'function') {
            initializeGameBoard();
        }

        // Start game timer if needed
        if (typeof startGameTimer === 'function') {
            startGameTimer();
        }
    }

    // Navigation functions
    retrySearch() {
        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
        }
        this.startPlayerSearch(this.selectedCity);
    }

    returnToCitySelection() {
        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
        }
        if (typeof showScreen === 'function') {
            showScreen('page2');
        }
    }

    goToPracticeMode() {
        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
        }
        if (typeof showScreen === 'function') {
            showScreen('page7');
        }
    }

    // ===== OPPONENT STATUS MANAGEMENT =====

    updateOpponentStatus(status, context = 'general') {
        console.log(`👤 PRD: Updating opponent status - ${status} (${context})`);

        // Update various opponent status displays
        this.updateOpponentStatusElements(status, context);

        // Show status notifications if needed
        if (context === 'important') {
            if (typeof uxManager !== 'undefined') {
                uxManager.showNotification(`👤 ${status}`, 'info', 2000);
            }
        }
    }

    updateOpponentStatusElements(status, context) {
        // Main opponent status element
        const statusElements = [
            'opponent-status',
            'opponent-status-main',
            'player-opponent-status',
            'game-opponent-status'
        ];

        statusElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = status;
                element.className = this.getStatusClassName(context);
            }
        });

        // Update breadcrumb or header if needed
        this.updateHeaderOpponentStatus(status);
    }

    getStatusClassName(context) {
        const baseClass = 'opponent-status-text';
        switch (context) {
            case 'waiting':
                return `${baseClass} text-yellow-600`;
            case 'confirmed':
                return `${baseClass} text-green-600`;
            case 'error':
                return `${baseClass} text-red-600`;
            case 'searching':
                return `${baseClass} text-blue-600`;
            case 'playing':
                return `${baseClass} text-purple-600`;
            default:
                return `${baseClass} text-gray-600`;
        }
    }

    updateHeaderOpponentStatus(status) {
        // Add status to page headers if they exist
        const pageHeaders = document.querySelectorAll('h2, h3');
        pageHeaders.forEach(header => {
            if (header.textContent.includes('opponent') || header.textContent.includes('player')) {
                const statusSpan = header.querySelector('.opponent-status-inline') ||
                    document.createElement('span');
                statusSpan.className = 'opponent-status-inline text-sm text-gray-500 ml-2';
                statusSpan.textContent = `(${status})`;

                if (!header.querySelector('.opponent-status-inline')) {
                    header.appendChild(statusSpan);
                }
            }
        });
    }

    // ===== OPPONENT STATUS FLOW STATES =====

    // During player search
    setSearchingStatus() {
        this.updateOpponentStatus('Looking for players...', 'searching');
    }

    // When match is found
    setMatchFoundStatus() {
        this.updateOpponentStatus('Opponent found!', 'confirmed');
    }

    // During candy selection
    setCandySelectionStatus() {
        this.updateOpponentStatus('Opponent is selecting candy...', 'waiting');
    }

    // When opponent confirms candy
    setOpponentConfirmedStatus() {
        this.updateOpponentStatus('Opponent has confirmed!', 'confirmed');
    }

    // When player confirms candy
    setPlayerConfirmedStatus() {
        this.updateOpponentStatus('You confirmed! Waiting for opponent...', 'waiting');
    }

    // During gameplay
    setGameplayStatus(isOpponentTurn = false) {
        if (isOpponentTurn) {
            this.updateOpponentStatus('Opponent is thinking...', 'playing');
        } else {
            this.updateOpponentStatus('Your turn!', 'playing');
        }
    }

    // When opponent disconnects
    setDisconnectedStatus() {
        this.updateOpponentStatus('Opponent disconnected', 'error');
    }

    // When opponent reconnects
    setReconnectedStatus() {
        this.updateOpponentStatus('Opponent reconnected!', 'confirmed');
    }

    // ===== ENHANCED SIMULATION FOR REALISTIC OPPONENT BEHAVIOR =====

    simulateRealisticOpponentBehavior() {
        const behaviors = [
            {
                delay: 3000,
                status: 'Opponent is reviewing candies...',
                context: 'waiting'
            },
            {
                delay: 8000,
                status: 'Opponent is considering options...',
                context: 'waiting'
            },
            {
                delay: 15000,
                status: 'Opponent is making final choice...',
                context: 'waiting'
            }
        ];

        behaviors.forEach(behavior => {
            setTimeout(() => {
                if (this.candyTimerInterval) { // Only if timer is still running
                    this.updateOpponentStatus(behavior.status, behavior.context);
                }
            }, behavior.delay);
        });
    }

    // ===== DISCONNECTION AND RECONNECTION HANDLING =====

    simulateOpponentDisconnection() {
        console.log('📡 PRD: Simulating opponent disconnection');

        this.setDisconnectedStatus();

        if (typeof uxManager !== 'undefined') {
            uxManager.showModal(
                '📡 Connection Issue',
                `
                    <div class="text-center space-y-4">
                        <div class="text-4xl mb-4">📡</div>
                        <h3 class="text-xl font-bold mb-4">Opponent Disconnected</h3>
                        <p class="text-gray-600 mb-4">Your opponent has lost connection. We're attempting to reconnect...</p>
                        <div class="bg-blue-50 rounded-lg p-4">
                            <div class="flex items-center justify-center space-x-2">
                                <div class="searching-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
                                <span class="text-sm text-blue-700">Reconnecting...</span>
                            </div>
                        </div>
                        <div id="reconnection-timer" class="text-sm text-gray-500">
                            Time remaining: <span id="reconnect-countdown">15</span> seconds
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'Cancel Game',
                        class: 'btn-secondary',
                        onclick: () => this.handleReconnectionTimeout()
                    }
                ]
            );

            this.startReconnectionTimer();
        }
    }

    startReconnectionTimer() {
        let timeRemaining = 15;
        const countdownElement = document.getElementById('reconnect-countdown');

        const reconnectInterval = setInterval(() => {
            timeRemaining--;

            if (countdownElement) {
                countdownElement.textContent = timeRemaining;
            }

            if (timeRemaining <= 0) {
                clearInterval(reconnectInterval);
                this.handleReconnectionTimeout();
            } else if (timeRemaining === 8) {
                // Simulate successful reconnection
                clearInterval(reconnectInterval);
                this.handleSuccessfulReconnection();
            }
        }, 1000);
    }

    handleSuccessfulReconnection() {
        console.log('✅ PRD: Opponent reconnected successfully');

        this.setReconnectedStatus();

        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
            uxManager.showNotification('✅ Opponent reconnected! Game resuming...', 'success', 3000);
        }

        // Resume game state
        this.resumeAfterReconnection();
    }

    handleReconnectionTimeout() {
        console.log('⏰ PRD: Reconnection timeout');

        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
            uxManager.showModal(
                '❌ Game Ended',
                `
                    <div class="text-center space-y-4">
                        <div class="text-4xl mb-4">❌</div>
                        <h3 class="text-xl font-bold mb-4">Game Ended</h3>
                        <p class="text-gray-600 mb-4">Opponent could not reconnect within 15 seconds.</p>
                        <div class="bg-green-50 rounded-lg p-4">
                            <div class="text-sm text-green-700">
                                <strong>Good news:</strong> Your entry fee has been refunded since the game ended due to technical issues.
                            </div>
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'Find New Game',
                        class: 'btn-primary',
                        onclick: () => this.returnToCitySelection()
                    },
                    {
                        text: 'Main Menu',
                        class: 'btn-secondary',
                        onclick: () => this.goToMainMenu()
                    }
                ]
            );
        }

        // Refund the user's coins
        this.refundGameCost();
    }

    resumeAfterReconnection() {
        // Determine what state to resume based on current game phase
        if (this.candyTimerInterval) {
            // Still in candy selection phase
            this.setCandySelectionStatus();
        } else if (typeof gameState !== 'undefined' && gameState.gameStarted) {
            // In active gameplay
            this.setGameplayStatus(gameState.isPlayerTurn);
        }
    }

    refundGameCost() {
        if (typeof currencyManager !== 'undefined' && typeof gameState !== 'undefined' && gameState.gameCost) {
            try {
                currencyManager.addCoins(gameState.gameCost, 'Opponent disconnection refund');
                console.log(`💰 Refunded ${gameState.gameCost} coins due to opponent disconnection`);
            } catch (error) {
                console.error('Failed to refund coins:', error);
            }
        }
    }

    goToMainMenu() {
        if (typeof uxManager !== 'undefined') {
            uxManager.closeAllModals();
        }
        if (typeof showScreen === 'function') {
            showScreen('page1');
        }
    }

    // ===== COMPREHENSIVE TIMEOUT HANDLING =====

    // Initialize timeout handlers for all game phases
    initializeTimeoutHandlers() {
        this.timeoutHandlers = {
            search: null,
            candySelection: null,
            gamePlay: null,
            reconnection: null
        };
    }

    // PRD: Gameplay timeout handling
    handleGameplayTimeout() {
        console.log('⏰ PRD: Gameplay timeout');

        this.clearTimeoutHandler('gamePlay');

        if (typeof uxManager !== 'undefined') {
            uxManager.showModal(
                '⏰ Game Timeout',
                `
                    <div class="text-center space-y-4">
                        <div class="text-6xl mb-4">⏰</div>
                        <h3 class="text-xl font-bold mb-4">Game Timeout</h3>
                        <p class="text-gray-600 mb-4">The game has taken too long to complete.</p>
                        
                        <div class="bg-yellow-50 rounded-lg p-4 mb-4">
                            <div class="text-sm text-yellow-700">
                                <strong>⚖️ Result:</strong> Game ended in a draw due to timeout.
                            </div>
                        </div>
                        
                        <div class="bg-green-50 rounded-lg p-4">
                            <div class="text-sm text-green-700">
                                <strong>💰 Partial Refund:</strong> 50% of your entry fee has been refunded.
                            </div>
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'New Game',
                        class: 'btn-primary',
                        onclick: () => this.returnToCitySelection()
                    },
                    {
                        text: 'Main Menu',
                        class: 'btn-secondary',
                        onclick: () => this.goToMainMenu()
                    }
                ]
            );
        }

        // Issue partial refund
        this.issuePartialRefund();
    }

    // Timeout handler management
    setTimeoutHandler(type, handler, delay) {
        // Clear existing handler
        this.clearTimeoutHandler(type);

        // Set new handler
        this.timeoutHandlers[type] = setTimeout(handler, delay);
    }

    clearTimeoutHandler(type) {
        if (this.timeoutHandlers[type]) {
            clearTimeout(this.timeoutHandlers[type]);
            this.timeoutHandlers[type] = null;
        }
    }

    clearAllTimeoutHandlers() {
        Object.keys(this.timeoutHandlers).forEach(type => {
            this.clearTimeoutHandler(type);
        });
    }

    // Refund management
    issuePartialRefund() {
        if (typeof currencyManager !== 'undefined' && typeof gameState !== 'undefined' && gameState.gameCost) {
            try {
                const refundAmount = Math.floor(gameState.gameCost * 0.5);
                currencyManager.addCoins(refundAmount, 'Gameplay timeout partial refund');
                console.log(`💰 Issued partial refund: ${refundAmount} coins`);
            } catch (error) {
                console.error('Failed to issue partial refund:', error);
            }
        }
    }

    // PRD: Initialize timeout system
    initializeTimeoutSystem() {
        this.initializeTimeoutHandlers();

        // Set up global timeout handlers
        this.setTimeoutHandler('search', () => this.handleSearchTimeout(), this.searchTimeLimit * 1000);
        this.setTimeoutHandler('candySelection', () => this.handleCandySelectionTimeout(), this.candySelectionTimeLimit * 1000);

        // Set up gameplay timeout (5 minutes)
        this.setTimeoutHandler('gamePlay', () => this.handleGameplayTimeout(), 300000);

        console.log('⏰ PRD: Timeout system initialized');
    }
}

// ===== GLOBAL FUNCTIONS FOR UI INTERACTION =====

let prdMatchmaking = null;

// Initialize PRD matchmaking manager
function initializePRDMatchmaking() {
    if (!prdMatchmaking) {
        prdMatchmaking = new PRDMatchmakingManager();
    }
    return prdMatchmaking;
}

// PRD: Start city-specific player search
function startPRDCitySearch(city) {
    console.log(`🌍 PRD: Starting city search for ${city}`);

    const manager = initializePRDMatchmaking();
    manager.startPlayerSearch(city);
}

// PRD: Cancel player search
function cancelPlayerSearch() {
    if (prdMatchmaking && prdMatchmaking.isSearching) {
        prdMatchmaking.cancelPlayerSearch();
    }
}

// PRD: Show search tips
function showSearchTips() {
    if (typeof uxManager !== 'undefined') {
        uxManager.showModal(
            '💡 Finding Players Tips',
            `
                <div class="space-y-4">
                    <div class="text-center text-4xl mb-4">🔍</div>
                    <h3 class="text-xl font-bold text-center mb-4">Tips for Finding Players</h3>
                    
                    <div class="space-y-3">
                        <div class="bg-blue-50 rounded-lg p-3">
                            <div class="font-medium text-blue-900">🕒 Best Times to Play</div>
                            <div class="text-sm text-blue-700 mt-1">6-10 PM local time has the most active players</div>
                        </div>
                        
                        <div class="bg-green-50 rounded-lg p-3">
                            <div class="font-medium text-green-900">🌍 Try Different Cities</div>
                            <div class="text-sm text-green-700 mt-1">Dubai usually has more players, Oslo during European hours</div>
                        </div>
                        
                        <div class="bg-yellow-50 rounded-lg p-3">
                            <div class="font-medium text-yellow-900">⚡ Connection Tips</div>
                            <div class="text-sm text-yellow-700 mt-1">Ensure stable internet for best matchmaking experience</div>
                        </div>
                        
                        <div class="bg-purple-50 rounded-lg p-3">
                            <div class="font-medium text-purple-900">🎯 Practice While Waiting</div>
                            <div class="text-sm text-purple-700 mt-1">Improve your skills in Practice Mode between searches</div>
                        </div>
                    </div>
                </div>
            `,
            [
                {
                    text: 'Got it!',
                    class: 'btn-primary'
                }
            ]
        );
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.PRDMatchmakingManager = PRDMatchmakingManager;
    window.prdMatchmaking = prdMatchmaking;
    window.startPRDCitySearch = startPRDCitySearch;
    window.cancelPlayerSearch = cancelPlayerSearch;
    window.showSearchTips = showSearchTips;

    // Global function to handle PRD candy confirmation
    window.handlePRDCandyConfirmation = function () {
        if (prdMatchmaking && prdMatchmaking.candyTimerInterval) {
            console.log('🍭 PRD: Player confirmed candy selection globally');
            prdMatchmaking.handlePlayerCandyConfirmation();
            return true;
        }
        return false;
    };
} 