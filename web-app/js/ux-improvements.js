// ===== UX IMPROVEMENTS MODULE =====

class UXManager {
    constructor() {
        this.loadingScreen = null;
        this.notificationContainer = null;
        this.init();
    }

    init() {
        this.createNotificationContainer();
        this.setupLoadingScreen();
        this.handleInitialLoad();
    }

    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    setupLoadingScreen() {
        this.loadingScreen = document.getElementById('loading-screen');
        if (!this.loadingScreen) {
            console.warn('Loading screen not found');
        }
    }

    handleInitialLoad() {
        // Simulate app initialization
        setTimeout(() => {
            this.hideLoadingScreen();
            this.showNotification('Welcome to Poison Candy Duel!', 'success', 3000);
            
            // Show the main menu
            const mainMenu = document.getElementById('page1');
            if (mainMenu) {
                mainMenu.classList.add('active');
            }
        }, 2000);
    }

    showLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.remove('hidden');
        }
    }

    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.notificationContainer.appendChild(notification);
        
        // Trigger show animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto remove
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        return notification;
    }

    removeNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    showModal(title, content, buttons = []) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h3 class="modal-title">${title}</h3>`;
        
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else {
            body.appendChild(content);
        }
        
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `btn ${button.class || 'btn-secondary'}`;
            btn.textContent = button.text;
            btn.onclick = () => {
                if (button.onclick) button.onclick();
                this.closeModal(overlay);
            };
            footer.appendChild(btn);
        });
        
        if (buttons.length === 0) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn btn-secondary';
            closeBtn.textContent = 'Close';
            closeBtn.onclick = () => this.closeModal(overlay);
            footer.appendChild(closeBtn);
        }
        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal(overlay);
            }
        });
        
        return overlay;
    }

    closeModal(overlay) {
        overlay.classList.remove('show');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    }

    updateConnectionStatus(isConnected) {
        const status = document.getElementById('connection-status');
        if (status) {
            status.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
            status.innerHTML = `
                <span class="connection-dot"></span>
                <span class="connection-text">${isConnected ? 'Connected' : 'Disconnected'}</span>
            `;
        }
    }

    showLoadingState(element, text = 'Loading...') {
        if (!element) return;
        
        element.disabled = true;
        element.style.opacity = '0.7';
        element.style.pointerEvents = 'none';
        
        const originalText = element.textContent;
        element.textContent = text;
        
        return () => {
            element.disabled = false;
            element.style.opacity = '1';
            element.style.pointerEvents = 'auto';
            element.textContent = originalText;
        };
    }

    animateElement(element, animation = 'bounce') {
        if (!element) return;
        
        element.style.animation = `${animation} 0.6s ease`;
        setTimeout(() => {
            element.style.animation = '';
        }, 600);
    }

    showConfirmDialog(message, onConfirm, onCancel) {
        return this.showModal('Confirm Action', message, [
            {
                text: 'Cancel',
                class: 'btn-secondary',
                onclick: onCancel
            },
            {
                text: 'Confirm',
                class: 'btn-primary',
                onclick: onConfirm
            }
        ]);
    }

    addLoadingSpinner(element) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.style.cssText = `
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 0.5rem;
        `;
        
        element.insertBefore(spinner, element.firstChild);
        return spinner;
    }

    removeLoadingSpinner(element) {
        const spinner = element.querySelector('.loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    }
}

// Enhanced screen navigation with transitions
function showScreen(screenId) {
    console.log(`🖥️ Navigating to screen: ${screenId}`);
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen with animation
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        setTimeout(() => {
            targetScreen.classList.add('active');
        }, 100);
        
        // Update URL without page reload (for browser back button)
        if (history.pushState) {
            history.pushState({screen: screenId}, null, `#${screenId}`);
        }
        
        // Track navigation for analytics (if needed)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_title: screenId,
                page_location: window.location.href
            });
        }
    } else {
        console.error(`Screen not found: ${screenId}`);
        uxManager.showNotification(`Page not found: ${screenId}`, 'error');
    }
}

// Enhanced button feedback
function addButtonFeedback() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
            const button = e.target.classList.contains('btn') ? e.target : e.target.closest('.btn');
            
            // Create ripple effect
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                background-color: rgba(255, 255, 255, 0.7);
                pointer-events: none;
            `;
            
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            button.style.position = 'relative';
            button.style.overflow = 'hidden';
            button.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        }
    });
}

// Add CSS for ripple animation
const rippleCSS = `
@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}

@keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-10px);
    }
    60% {
        transform: translateY(-5px);
    }
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
`;

// Add the CSS to the page
const style = document.createElement('style');
style.textContent = rippleCSS;
document.head.appendChild(style);

// Initialize UX Manager
let uxManager;
document.addEventListener('DOMContentLoaded', () => {
    uxManager = new UXManager();
    addButtonFeedback();
    
    // Initialize enhanced features
    loadPlayerStats();
    showWelcomeExperience();
    enhanceScreenManagement();
    optimizePerformance();
    
    // Handle browser back button
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.screen) {
            showScreen(e.state.screen);
        }
    });
    
    // Enhanced error handling
    window.addEventListener('error', (e) => {
        console.error('Application error:', e.error);
        uxManager.showNotification('Something went wrong. Please refresh the page.', 'error');
    });
    
    // Connection status monitoring
    window.addEventListener('online', () => {
        uxManager.updateConnectionStatus(true);
        uxManager.showNotification('Connection restored', 'success');
    });
    
    window.addEventListener('offline', () => {
        uxManager.updateConnectionStatus(false);
        uxManager.showNotification('Connection lost', 'warning');
    });
    
    // Initialize game with UX improvements
    initializeGameWithUX();
});

// Export for use in other files
if (typeof window !== 'undefined') {
    window.UXManager = UXManager;
    window.uxManager = uxManager;
    window.showScreen = showScreen;
}

// Enhanced arena selection with better UX
function enterArena(arenaName, cost, prize, timeLimit) {
    console.log(`🎮 Entering ${arenaName} Arena - Cost: ${cost}, Prize: ${prize}, Time: ${timeLimit}s`);
    
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        uxManager.showNotification('Currency system not ready. Please refresh the page.', 'error');
        return;
    }
    
    // Check if user has enough coins using currency manager
    const currentBalance = currencyManager.getCoins();
    
    if (currentBalance < cost) {
        uxManager.showModal(
            '❌ Insufficient Funds',
            `
                <div class="text-center space-y-4">
                    <div class="text-4xl mb-4">💸</div>
                    <h3 class="text-xl font-bold mb-4">Not Enough Coins</h3>
                    <div class="bg-red-50 rounded-lg p-4">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div class="text-gray-600">Arena Cost</div>
                                <div class="font-bold text-red-600">${cost.toLocaleString()} coins</div>
                            </div>
                            <div>
                                <div class="text-gray-600">Your Balance</div>
                                <div class="font-bold text-gray-800">${currentBalance.toLocaleString()} coins</div>
                            </div>
                            <div>
                                <div class="text-gray-600">You Need</div>
                                <div class="font-bold text-orange-600">+${(cost - currentBalance).toLocaleString()} coins</div>
                            </div>
                            <div>
                                <div class="text-gray-600">Your Diamonds</div>
                                <div class="font-bold text-blue-600">${currencyManager.getDiamonds()} diamonds</div>
                            </div>
                        </div>
                    </div>
                    <p class="text-gray-600">You can earn coins by playing practice mode or convert diamonds!</p>
                </div>
            `,
            [
                {
                    text: 'Practice Mode',
                    class: 'btn-primary',
                    onclick: () => showScreen('page7')
                },
                {
                    text: 'Convert Diamonds',
                    class: 'btn-warning',
                    onclick: () => showConversionModal()
                },
                {
                    text: 'Buy Diamonds',
                    class: 'btn-success',
                    onclick: () => showPurchaseModal()
                },
                {
                    text: 'Cancel',
                    class: 'btn-secondary'
                }
            ]
        );
        return;
    }
    
    // Show confirmation dialog with real currency data
    uxManager.showModal(
        `🎯 Enter ${arenaName} Arena`,
        `
            <div class="text-center">
                <div class="text-6xl mb-4">${getArenaIcon(arenaName)}</div>
                <h3 class="text-xl font-bold mb-4">Confirm Arena Entry</h3>
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">Entry Cost</div>
                            <div class="font-bold text-danger">-${cost.toLocaleString()} coins</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Potential Prize</div>
                            <div class="font-bold text-success">+${prize.toLocaleString()} coins</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Turn Timer</div>
                            <div class="font-bold text-warning">${timeLimit} seconds</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Balance After</div>
                            <div class="font-bold text-primary">${(currentBalance - cost).toLocaleString()} coins</div>
                        </div>
                    </div>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 mb-4">
                    <div class="text-sm text-blue-700">
                        💡 <strong>Win Rate:</strong> Your skill level determines your chances of winning the prize!
                    </div>
                </div>
                <p class="text-sm text-gray-600">Are you ready to challenge players worldwide?</p>
            </div>
        `,
        [
            {
                text: 'Cancel',
                class: 'btn-secondary'
            },
            {
                text: `Enter ${arenaName}`,
                class: 'btn-primary',
                onclick: () => startPRDArenaFlow(arenaName, cost, prize, timeLimit)
            }
        ]
    );
}

// PRD-Compliant Arena Flow
function startPRDArenaFlow(arenaName, cost, prize, timeLimit) {
    console.log(`🌍 PRD: Starting arena flow for ${arenaName}`);
    
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        uxManager.showNotification('Currency system not ready. Please refresh the page.', 'error');
        return;
    }
    
    try {
        // Actually spend the coins using currency manager
        currencyManager.spendCoins(cost, `${arenaName} Arena entry`);
        
        uxManager.showNotification(`💰 ${cost.toLocaleString()} coins spent for ${arenaName} Arena`, 'info');
        
        // Store arena information for later use
        if (typeof gameState !== 'undefined') {
            gameState.selectedCity = arenaName;
            gameState.gameCost = cost;
            gameState.expectedPrize = prize;
            gameState.turnTimeLimit = timeLimit;
        }
        
        // PRD: Start the searching flow
        if (typeof startPRDCitySearch === 'function') {
            startPRDCitySearch(arenaName);
        } else {
            console.error('PRD matchmaking not loaded');
            uxManager.showNotification('Matchmaking system not ready. Please refresh the page.', 'error');
        }
        
    } catch (error) {
        console.error('Failed to spend coins:', error);
        uxManager.showNotification('Failed to process payment: ' + error.message, 'error');
        return;
    }
}

function getArenaIcon(arenaName) {
    const icons = {
        'Dubai': '🏙️',
        'Cairo': '🏛️',
        'Oslo': '🏔️'
    };
    return icons[arenaName] || '🎮';
}

function startArenaMatchmaking(arenaName, cost, prize, timeLimit) {
    console.log(`🔍 Starting matchmaking for ${arenaName} Arena`);
    
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        uxManager.showNotification('Currency system not ready. Please refresh the page.', 'error');
        return;
    }
    
    try {
        // Actually spend the coins using currency manager
        currencyManager.spendCoins(cost, `${arenaName} Arena entry`);
        
        uxManager.showNotification(`💰 ${cost.toLocaleString()} coins spent for ${arenaName} Arena`, 'info');
        
    } catch (error) {
        console.error('Failed to spend coins:', error);
        uxManager.showNotification('Failed to process payment: ' + error.message, 'error');
        return;
    }
    
    // Show matchmaking screen
    uxManager.showModal(
        `🌍 Finding Opponents`,
        `
            <div class="text-center">
                <div class="text-6xl mb-4">${getArenaIcon(arenaName)}</div>
                <h3 class="text-xl font-bold mb-4">${arenaName} Arena</h3>
                <div class="loading-spinner-large mx-auto mb-4"></div>
                <p class="text-lg font-medium mb-2">Searching for opponents...</p>
                <p class="text-sm text-gray-600">We're finding players with similar skill levels</p>
                
                <div class="bg-green-50 rounded-lg p-3 mb-4">
                    <div class="text-sm text-green-700">
                        ✓ Payment processed: ${cost.toLocaleString()} coins
                    </div>
                </div>
                
                <div id="matchmaking-status" class="mt-4">
                    <div class="bg-blue-50 rounded-lg p-3">
                        <div class="text-sm text-blue-700">⏰ Expected wait time: 5-15 seconds</div>
                    </div>
                </div>
            </div>
        `,
        [
            {
                text: 'Cancel Search',
                class: 'btn-danger',
                onclick: () => cancelArenaMatchmaking(cost)
            }
        ]
    );
    
    // Add loading spinner styles
    if (!document.getElementById('loading-spinner-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-spinner-styles';
        style.textContent = `
            .loading-spinner-large {
                width: 60px;
                height: 60px;
                border: 4px solid var(--gray-200);
                border-top: 4px solid var(--primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Simulate matchmaking process
    simulateMatchmaking(arenaName, cost, prize, timeLimit);
}

function simulateMatchmaking(arenaName, cost, prize, timeLimit) {
    let progress = 0;
    const steps = [
        'Connecting to game servers...',
        'Analyzing player skills...',
        'Finding suitable opponents...',
        'Opponent found! Preparing game...',
        'Entering game arena...'
    ];
    
    const interval = setInterval(() => {
        const statusElement = document.getElementById('matchmaking-status');
        if (statusElement && progress < steps.length) {
            statusElement.innerHTML = `
                <div class="bg-blue-50 rounded-lg p-3">
                    <div class="text-sm text-blue-700">${steps[progress]}</div>
                    <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                             style="width: ${((progress + 1) / steps.length) * 100}%"></div>
                    </div>
                </div>
            `;
            progress++;
        } else {
            clearInterval(interval);
            // Close modal and start game
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                uxManager.closeModal(modal);
            }
            
            uxManager.showNotification(`🎮 Entering ${arenaName} Arena!`, 'success');
            
            // Navigate to game screen
            setTimeout(() => {
                showGameScreen(arenaName, cost, prize, timeLimit);
            }, 1000);
        }
    }, 1000);
}

function cancelArenaMatchmaking(cost) {
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        return;
    }
    
    try {
        // Refund the cost using currency manager
        currencyManager.addCoins(cost, 'Arena matchmaking cancelled - refund');
        
        uxManager.showNotification(`🔄 Matchmaking cancelled. ${cost.toLocaleString()} coins refunded.`, 'info');
        
    } catch (error) {
        console.error('Failed to refund coins:', error);
        uxManager.showNotification('Refund processed', 'info');
    }
}

function showGameScreen(arenaName, cost, prize, timeLimit) {
    // This would typically transition to the actual game screen
    // For now, we'll show a placeholder
    console.log(`Starting ${arenaName} game with ${timeLimit}s timer`);
    
    // Try to use existing game functions
    if (typeof startCityMatchmaking === 'function') {
        startCityMatchmaking(arenaName, cost, prize);
    } else {
        // Fallback to showing game setup
        showScreen('page3');
    }
}

// Enhanced help system
function showEnhancedHelp() {
    uxManager.showModal(
        '🎯 How to Play Poison Candy Duel',
        `
            <div class="space-y-4">
                <div class="bg-blue-50 rounded-lg p-4">
                    <h4 class="font-bold text-blue-900 mb-2">🎮 Game Objective</h4>
                    <p class="text-blue-800 text-sm">Collect 11 candies from your opponent's collection while avoiding the poison candy they selected!</p>
                </div>
                
                <div class="bg-green-50 rounded-lg p-4">
                    <h4 class="font-bold text-green-900 mb-2">✅ How to Win</h4>
                    <ul class="text-green-800 text-sm space-y-1">
                        <li>• Collect 11 candies without picking the poison</li>
                        <li>• If you pick the poison, you lose instantly</li>
                        <li>• Both players get a fair chance to reach 11</li>
                    </ul>
                </div>
                
                <div class="bg-yellow-50 rounded-lg p-4">
                    <h4 class="font-bold text-yellow-900 mb-2">⚡ Game Modes</h4>
                    <ul class="text-yellow-800 text-sm space-y-1">
                        <li>• <strong>Online:</strong> Compete for coins in arenas</li>
                        <li>• <strong>Practice:</strong> Train against AI opponents</li>
                        <li>• <strong>Friends:</strong> Play with friends via room codes</li>
                    </ul>
                </div>
                
                <div class="bg-red-50 rounded-lg p-4">
                    <h4 class="font-bold text-red-900 mb-2">💡 Pro Tips</h4>
                    <ul class="text-red-800 text-sm space-y-1">
                        <li>• Choose your poison candy strategically</li>
                        <li>• Watch for patterns in opponent behavior</li>
                        <li>• Practice timing in different arenas</li>
                        <li>• Manage your coins wisely</li>
                    </ul>
                </div>
            </div>
        `,
        [
            {
                text: 'Start Playing',
                class: 'btn-primary',
                onclick: () => showScreen('page1')
            },
            {
                text: 'Close',
                class: 'btn-secondary'
            }
        ]
    );
}

// Enhanced error handling
function handleGameError(error, context = 'game') {
    console.error(`Game error in ${context}:`, error);
    
    let userMessage = 'Something went wrong. Please try again.';
    let suggestions = [];
    
    if (error.message && error.message.includes('network')) {
        userMessage = 'Connection problem detected.';
        suggestions = [
            'Check your internet connection',
            'Try refreshing the page',
            'Switch to offline mode'
        ];
    } else if (error.message && error.message.includes('balance')) {
        userMessage = 'Insufficient funds for this action.';
        suggestions = [
            'Earn more coins in practice mode',
            'Claim daily rewards',
            'Try a lower-stakes arena'
        ];
    }
    
    const suggestionsList = suggestions.length > 0 
        ? `<ul class="text-sm text-gray-600 mt-2">${suggestions.map(s => `<li>• ${s}</li>`).join('')}</ul>`
        : '';
    
    uxManager.showModal(
        '⚠️ Oops!',
        `
            <div class="text-center">
                <div class="text-4xl mb-4">😅</div>
                <p class="text-lg mb-4">${userMessage}</p>
                ${suggestionsList}
            </div>
        `,
        [
            {
                text: 'Try Again',
                class: 'btn-primary',
                onclick: () => window.location.reload()
            },
            {
                text: 'Go to Menu',
                class: 'btn-secondary',
                onclick: () => showScreen('page1')
            }
        ]
    );
}

// Auto-save game state
function autoSaveGameState() {
    if (typeof gameState !== 'undefined') {
        try {
            localStorage.setItem('pcd_game_state', JSON.stringify({
                playerCollection: gameState.playerCollection || [],
                opponentCollection: gameState.opponentCollection || [],
                gameMode: gameState.gameMode || 'ai',
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Could not save game state:', error);
        }
    }
}

// Load saved game state
function loadSavedGameState() {
    try {
        const saved = localStorage.getItem('pcd_game_state');
        if (saved) {
            const data = JSON.parse(saved);
            // Only load if saved recently (within 1 hour)
            if (Date.now() - data.timestamp < 3600000) {
                return data;
            }
        }
    } catch (error) {
        console.warn('Could not load saved game state:', error);
    }
    return null;
}

// Improved game initialization
function initializeGameWithUX() {
    // Load saved state if available
    const savedState = loadSavedGameState();
    if (savedState && savedState.playerCollection.length > 0) {
        uxManager.showModal(
            '💾 Resume Game',
            'You have a saved game in progress. Would you like to continue where you left off?',
            [
                {
                    text: 'Start Fresh',
                    class: 'btn-secondary',
                    onclick: () => {
                        localStorage.removeItem('pcd_game_state');
                        uxManager.showNotification('Starting new game', 'info');
                    }
                },
                {
                    text: 'Resume Game',
                    class: 'btn-primary',
                    onclick: () => {
                        // Restore saved state
                        if (typeof gameState !== 'undefined') {
                            Object.assign(gameState, savedState);
                        }
                        uxManager.showNotification('Game resumed', 'success');
                        showScreen('page3'); // or appropriate game screen
                    }
                }
            ]
        );
    }
    
    // Auto-save periodically
    setInterval(autoSaveGameState, 30000); // Every 30 seconds
}

// Enhanced screen transitions
const originalShowScreen = window.showScreen;
window.showScreen = function(screenId) {
    // Add loading state
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.opacity = '0.5';
    }
    
    // Call original function
    if (originalShowScreen) {
        originalShowScreen(screenId);
    } else {
        showScreen(screenId);
    }
    
    // Restore opacity with animation
    setTimeout(() => {
        if (targetScreen) {
            targetScreen.style.opacity = '1';
            targetScreen.style.transition = 'opacity 0.3s ease';
        }
    }, 100);
    
    // Track page views for analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
            page_title: screenId,
            page_location: window.location.href + '#' + screenId
        });
    }
};

// Export functions for global use
if (typeof window !== 'undefined') {
    window.enterArena = enterArena;
    window.showEnhancedHelp = showEnhancedHelp;
    window.handleGameError = handleGameError;
    window.initializeGameWithUX = initializeGameWithUX;
}

// UI Helper Functions
function showCoinsInfo() {
    uxManager.showModal(
        '💰 Coin System',
        `
            <div class="space-y-4">
                <div class="text-center">
                    <div class="text-6xl mb-4">💰</div>
                    <h3 class="text-xl font-bold mb-2">Your Coins: ${currencyManager ? currencyManager.getCoins().toLocaleString() : '0'}</h3>
                </div>
                
                <div class="bg-blue-50 rounded-lg p-4">
                    <h4 class="font-bold text-blue-900 mb-2">💡 How to Earn Coins</h4>
                    <ul class="text-blue-800 text-sm space-y-1">
                        <li>• Win arena battles to earn prize coins</li>
                        <li>• Complete daily challenges</li>
                        <li>• Claim daily login rewards</li>
                        <li>• Practice mode gives small rewards</li>
                        <li>• Convert diamonds to coins</li>
                    </ul>
                </div>
                
                <div class="bg-green-50 rounded-lg p-4">
                    <h4 class="font-bold text-green-900 mb-2">💸 How to Spend Coins</h4>
                    <ul class="text-green-800 text-sm space-y-1">
                        <li>• Enter premium arenas for bigger prizes</li>
                        <li>• Buy power-ups and advantages</li>
                        <li>• Unlock exclusive candy themes</li>
                    </ul>
                </div>
                
                <div class="bg-yellow-50 rounded-lg p-4">
                    <h4 class="font-bold text-yellow-900 mb-2">💎 Need More Coins?</h4>
                    <p class="text-yellow-800 text-sm mb-3">Convert your diamonds to coins instantly!</p>
                    <button class="btn btn-warning btn-sm w-full" onclick="showConversionModal()">
                        💎➡️💰 Convert Diamonds
                    </button>
                </div>
            </div>
        `,
        [
            {
                text: 'Earn More Coins',
                class: 'btn-primary',
                onclick: () => showScreen('page9')
            },
            {
                text: 'Close',
                class: 'btn-secondary'
            }
        ]
    );
}

function showDiamondsInfo() {
    uxManager.showModal(
        '💎 Diamond System',
        `
            <div class="space-y-4">
                <div class="text-center">
                    <div class="text-6xl mb-4">💎</div>
                    <h3 class="text-xl font-bold mb-2">Your Diamonds: ${currencyManager ? currencyManager.getDiamonds().toLocaleString() : '0'}</h3>
                </div>
                
                <div class="bg-purple-50 rounded-lg p-4">
                    <h4 class="font-bold text-purple-900 mb-2">✨ Premium Currency</h4>
                    <p class="text-purple-800 text-sm">Diamonds are rare and valuable! Use them wisely for premium features.</p>
                </div>
                
                <div class="bg-yellow-50 rounded-lg p-4">
                    <h4 class="font-bold text-yellow-900 mb-2">💎 How to Earn Diamonds</h4>
                    <ul class="text-yellow-800 text-sm space-y-1">
                        <li>• Win high-stakes arena battles</li>
                        <li>• Complete weekly challenges</li>
                        <li>• Achieve ranking milestones</li>
                        <li>• Special events and tournaments</li>
                        <li>• Purchase with real money</li>
                    </ul>
                </div>
                
                <div class="bg-red-50 rounded-lg p-4">
                    <h4 class="font-bold text-red-900 mb-2">🛍️ Premium Features</h4>
                    <ul class="text-red-800 text-sm space-y-1">
                        <li>• Convert to coins (600💎 = 10K coins)</li>
                        <li>• Unlock exclusive arenas</li>
                        <li>• Get premium candy themes</li>
                        <li>• Access VIP tournaments</li>
                        <li>• Purchase rare power-ups</li>
                    </ul>
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                    <button class="btn btn-primary btn-sm" onclick="showConversionModal()">
                        💰 Convert to Coins
                    </button>
                    <button class="btn btn-success btn-sm" onclick="showPurchaseModal()">
                        💳 Buy More
                    </button>
                </div>
            </div>
        `,
        [
            {
                text: 'Close',
                class: 'btn-secondary'
            }
        ]
    );
}

// Initialize stats on page load
function initializePlayerStats() {
    // Mock data for demonstration
    const stats = {
        totalGames: Math.floor(Math.random() * 50) + 10,
        wins: Math.floor(Math.random() * 30) + 5,
        coins: 10000,
        diamonds: 50
    };
    
    const winRate = Math.floor((stats.wins / stats.totalGames) * 100);
    
    // Update UI elements
    const totalGamesEl = document.getElementById('total-games');
    const winRateEl = document.getElementById('win-rate');
    const coinsEl = document.getElementById('coins-count');
    const diamondsEl = document.getElementById('diamonds-count');
    const balanceEl = document.getElementById('player-balance');
    
    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames;
    if (winRateEl) winRateEl.textContent = winRate + '%';
    if (coinsEl) coinsEl.textContent = stats.coins;
    if (diamondsEl) diamondsEl.textContent = stats.diamonds;
    if (balanceEl) balanceEl.textContent = stats.coins;
    
    // Store in localStorage for persistence
    localStorage.setItem('pcd_player_stats', JSON.stringify(stats));
}

// Load saved stats
function loadPlayerStats() {
    try {
        const saved = localStorage.getItem('pcd_player_stats');
        if (saved) {
            const stats = JSON.parse(saved);
            
            const totalGamesEl = document.getElementById('total-games');
            const winRateEl = document.getElementById('win-rate');
            const coinsEl = document.getElementById('coins-count');
            const diamondsEl = document.getElementById('diamonds-count');
            const balanceEl = document.getElementById('player-balance');
            
            if (totalGamesEl) totalGamesEl.textContent = stats.totalGames || 0;
            if (winRateEl) winRateEl.textContent = Math.floor((stats.wins / stats.totalGames) * 100) + '%';
            if (coinsEl) coinsEl.textContent = stats.coins || 0;
            if (diamondsEl) diamondsEl.textContent = stats.diamonds || 0;
            if (balanceEl) balanceEl.textContent = stats.coins || 0;
        }
    } catch (error) {
        console.warn('Could not load player stats:', error);
        initializePlayerStats();
    }
}

// Enhanced welcome experience
function showWelcomeExperience() {
    const isFirstTime = !localStorage.getItem('pcd_visited_before');
    
    if (isFirstTime) {
        setTimeout(() => {
            uxManager.showModal(
                '🎉 Welcome to Poison Candy Duel!',
                `
                    <div class="text-center space-y-4">
                        <div class="text-6xl mb-4">🍭</div>
                        <h3 class="text-xl font-bold mb-4">Ready for the Ultimate Strategy Game?</h3>
                        
                        <div class="bg-gradient-to-r from-primary to-primary-dark text-white rounded-lg p-4">
                            <h4 class="font-bold mb-2">🎁 Welcome Bonus</h4>
                            <p class="text-sm">Get 1000 coins and 10 diamonds to start your journey!</p>
                        </div>
                        
                        <div class="bg-gray-50 rounded-lg p-4">
                            <h4 class="font-bold text-gray-900 mb-2">🚀 Quick Start Guide</h4>
                            <ol class="text-sm text-gray-700 space-y-1 text-left">
                                <li>1. Choose your game mode</li>
                                <li>2. Select your poison candy</li>
                                <li>3. Pick from opponent's collection</li>
                                <li>4. Avoid the poison, collect 11 candies!</li>
                            </ol>
                        </div>
                    </div>
                `,
                [
                    {
                        text: 'Start Tutorial',
                        class: 'btn-primary',
                        onclick: () => showTutorial()
                    },
                    {
                        text: 'Skip to Game',
                        class: 'btn-secondary',
                        onclick: () => {
                            localStorage.setItem('pcd_visited_before', 'true');
                            uxManager.showNotification('Welcome bonus added!', 'success');
                        }
                    }
                ]
            );
        }, 1500);
    }
}

function showTutorial() {
    localStorage.setItem('pcd_visited_before', 'true');
    uxManager.showNotification('Welcome bonus added!', 'success');
    
    // Show tutorial steps
    const tutorialSteps = [
        {
            title: '🎯 Game Objective',
            content: 'Your goal is to collect 11 candies from your opponent\'s collection while avoiding the poison candy they selected.',
            next: 'Got it!'
        },
        {
            title: '🍭 Poison Selection',
            content: 'At the start, each player secretly selects one candy from their collection as "poison". If your opponent picks your poison, they lose!',
            next: 'Makes sense!'
        },
        {
            title: '🎲 Turn System',
            content: 'Players take turns picking candies. The game uses a fair system where both players get equal chances to reach 11 candies.',
            next: 'Understood!'
        },
        {
            title: '🏆 Victory Conditions',
            content: 'Win by collecting 11 candies without picking poison. If both players reach 11 safely, it\'s a draw and both get participation rewards!',
            next: 'Ready to play!'
        }
    ];
    
    let currentStep = 0;
    
    function showStep(step) {
        const isLast = step === tutorialSteps.length - 1;
        uxManager.showModal(
            tutorialSteps[step].title,
            `
                <div class="text-center space-y-4">
                    <div class="text-4xl mb-4">${step === 0 ? '🎯' : step === 1 ? '🍭' : step === 2 ? '🎲' : '🏆'}</div>
                    <p class="text-lg">${tutorialSteps[step].content}</p>
                    <div class="flex justify-center space-x-2 mt-4">
                        ${Array(tutorialSteps.length).fill(0).map((_, i) => 
                            `<div class="w-3 h-3 rounded-full ${i === step ? 'bg-primary' : 'bg-gray-300'}"></div>`
                        ).join('')}
                    </div>
                    <p class="text-sm text-gray-600">Step ${step + 1} of ${tutorialSteps.length}</p>
                </div>
            `,
            [
                {
                    text: isLast ? 'Start Playing!' : tutorialSteps[step].next,
                    class: 'btn-primary',
                    onclick: () => {
                        if (isLast) {
                            uxManager.showNotification('Tutorial complete! Good luck!', 'success');
                            showScreen('page7'); // Start with practice mode
                        } else {
                            currentStep++;
                            showStep(currentStep);
                        }
                    }
                },
                {
                    text: 'Skip Tutorial',
                    class: 'btn-secondary',
                    onclick: () => {
                        uxManager.showNotification('Tutorial skipped. You can access help anytime!', 'info');
                    }
                }
            ]
        );
    }
    
    showStep(0);
}

// Enhanced screen management
function enhanceScreenManagement() {
    // Add help button to all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        if (!screen.querySelector('.help-button')) {
            const helpButton = document.createElement('button');
            helpButton.className = 'help-button btn btn-secondary';
            helpButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 100;';
            helpButton.innerHTML = '❓ Help';
            helpButton.onclick = showEnhancedHelp;
            screen.appendChild(helpButton);
        }
    });
    
    // Add back button to screens that need it
    const screensNeedingBackButton = ['page3', 'page4', 'page5', 'page6', 'page7', 'page8', 'page9', 'page10'];
    screensNeedingBackButton.forEach(screenId => {
        const screen = document.getElementById(screenId);
        if (screen && !screen.querySelector('.back-to-menu-btn')) {
            const backButton = document.createElement('button');
            backButton.className = 'back-to-menu-btn btn btn-secondary';
            backButton.style.cssText = 'position: absolute; top: 20px; left: 20px; z-index: 10;';
            backButton.innerHTML = '← Menu';
            backButton.onclick = () => showScreen('page1');
            screen.style.position = 'relative';
            screen.appendChild(backButton);
        }
    });
}

// Performance optimization
function optimizePerformance() {
    // Lazy load images
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (lazyImages.length > 0) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    }
    
    // Debounce window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Trigger layout recalculation
            document.body.style.display = 'none';
            document.body.offsetHeight; // Force reflow
            document.body.style.display = '';
        }, 150);
    });
    
    // Optimize animations
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        document.documentElement.style.setProperty('--transition-fast', '0ms');
        document.documentElement.style.setProperty('--transition-medium', '0ms');
        document.documentElement.style.setProperty('--transition-slow', '0ms');
    }
}

// Export new functions
if (typeof window !== 'undefined') {
    window.showCoinsInfo = showCoinsInfo;
    window.showDiamondsInfo = showDiamondsInfo;
    window.initializePlayerStats = initializePlayerStats;
    window.loadPlayerStats = loadPlayerStats;
    window.showWelcomeExperience = showWelcomeExperience;
    window.enhanceScreenManagement = enhanceScreenManagement;
    window.optimizePerformance = optimizePerformance;
}

// Enhanced practice mode handler
function startPracticeMode(difficulty) {
    console.log(`🤖 Starting practice mode: ${difficulty}`);
    
    const difficultyInfo = {
        easy: {
            icon: '🟢',
            name: 'Easy AI',
            description: 'Slow and predictable patterns',
            reward: { min: 10, max: 25 },
            winRate: 70
        },
        medium: {
            icon: '🟡',
            name: 'Medium AI',
            description: 'Moderate speed with some strategy',
            reward: { min: 25, max: 50 },
            winRate: 50
        },
        hard: {
            icon: '🔴',
            name: 'Hard AI',
            description: 'Fast and strategic opponent',
            reward: { min: 50, max: 100 },
            winRate: 30
        }
    };
    
    const info = difficultyInfo[difficulty];
    
    // Show practice mode confirmation
    uxManager.showModal(
        `${info.icon} ${info.name}`,
        `
            <div class="text-center space-y-4">
                <div class="text-6xl mb-4">${info.icon}</div>
                <h3 class="text-xl font-bold mb-2">Start Practice Session</h3>
                <p class="text-gray-600 mb-4">${info.description}</p>
                
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">Difficulty</div>
                            <div class="font-bold capitalize">${difficulty}</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Reward Range</div>
                            <div class="font-bold text-success">${info.reward.min}-${info.reward.max} coins</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Player Win Rate</div>
                            <div class="font-bold text-primary">${info.winRate}%</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Cost</div>
                            <div class="font-bold text-green-600">Free</div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-blue-50 rounded-lg p-3">
                    <div class="text-sm text-blue-700">💡 Practice games don't affect your main statistics</div>
                </div>
            </div>
        `,
        [
            {
                text: 'Cancel',
                class: 'btn-secondary'
            },
            {
                text: 'Start Practice',
                class: 'btn-primary',
                onclick: () => launchPracticeGame(difficulty)
            }
        ]
    );
}

function launchPracticeGame(difficulty) {
    console.log(`🎮 Launching practice game: ${difficulty}`);
    
    // Show loading state
    uxManager.showModal(
        '🤖 Preparing AI Opponent',
        `
            <div class="text-center">
                <div class="text-6xl mb-4">🧠</div>
                <h3 class="text-xl font-bold mb-4">Initializing AI</h3>
                <div class="loading-spinner-large mx-auto mb-4"></div>
                <p class="text-lg font-medium mb-2">Setting up ${difficulty} difficulty...</p>
                <p class="text-sm text-gray-600">Preparing game environment</p>
            </div>
        `,
        []
    );
    
    // Simulate AI preparation
    setTimeout(() => {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            uxManager.closeModal(modal);
        }
        
        uxManager.showNotification(`🤖 ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} AI ready!`, 'success');
        
        // Start actual game
        setTimeout(() => {
            // Try to use existing AI game functions
            if (typeof startAIGameNew === 'function') {
                startAIGameNew(difficulty);
            } else if (typeof startAIGame === 'function') {
                startAIGame(difficulty);
            } else {
                // Fallback to game screen
                showScreen('page3');
            }
        }, 1000);
    }, 2000);
}

// Practice statistics management
function updatePracticeStats(difficulty, won, coinsEarned) {
    try {
        const stats = JSON.parse(localStorage.getItem('pcd_practice_stats') || '{}');
        
        if (!stats[difficulty]) {
            stats[difficulty] = { wins: 0, games: 0, coins: 0 };
        }
        
        stats[difficulty].games++;
        stats[difficulty].coins += coinsEarned;
        
        if (won) {
            stats[difficulty].wins++;
        }
        
        localStorage.setItem('pcd_practice_stats', JSON.stringify(stats));
        
        // Actually award coins using currency manager
        if (currencyManager) {
            currencyManager.addCoins(coinsEarned, `Practice mode - ${difficulty} AI ${won ? 'victory' : 'participation'}`);
        }
        
        // Update UI
        loadPracticeStats();
        
        // Show result notification
        if (won) {
            uxManager.showNotification(`🎉 Victory! +${coinsEarned} coins earned`, 'success');
        } else {
            uxManager.showNotification(`💪 Good effort! +${coinsEarned} participation coins`, 'info');
        }
        
    } catch (error) {
        console.warn('Could not update practice stats:', error);
    }
}

function loadPracticeStats() {
    try {
        const stats = JSON.parse(localStorage.getItem('pcd_practice_stats') || '{}');
        
        let totalCoins = 0;
        ['easy', 'medium', 'hard'].forEach(difficulty => {
            const wins = stats[difficulty]?.wins || 0;
            const coins = stats[difficulty]?.coins || 0;
            totalCoins += coins;
            
            const element = document.getElementById(`practice-${difficulty}-wins`);
            if (element) {
                element.textContent = wins;
            }
        });
        
        const totalElement = document.getElementById('practice-total-coins');
        if (totalElement) {
            totalElement.textContent = totalCoins;
        }
        
    } catch (error) {
        console.warn('Could not load practice stats:', error);
    }
}

// Enhanced game result handling
function handleGameResult(result) {
    const { winner, gameMode, difficulty, coinsEarned, isPractice, arenaName, originalCost } = result;
    
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        return;
    }
    
    try {
        if (isPractice) {
            updatePracticeStats(difficulty, winner === 'player', coinsEarned);
        } else {
            // Handle arena game results
            if (winner === 'player') {
                // Award prize coins
                currencyManager.addCoins(coinsEarned, `${arenaName} Arena victory prize`);
                
                // Award bonus diamonds for big wins
                if (coinsEarned >= 5000) {
                    const bonusDiamonds = Math.floor(coinsEarned / 1000);
                    currencyManager.addDiamonds(bonusDiamonds, `${arenaName} Arena victory bonus`);
                }
            } else {
                // Consolation prize for losing
                const consolationCoins = Math.floor(originalCost * 0.1); // 10% of entry fee
                if (consolationCoins > 0) {
                    currencyManager.addCoins(consolationCoins, `${arenaName} Arena participation`);
                }
            }
            
            // Update main game stats
            updatePlayerStats(result);
        }
        
    } catch (error) {
        console.error('Error handling game result:', error);
    }
    
    // Show enhanced result modal
    showGameResultModal(result);
}

function showGameResultModal(result) {
    const { winner, gameMode, difficulty, coinsEarned, isPractice, arenaName, originalCost } = result;
    
    const isWin = winner === 'player';
    const title = isWin ? '🎉 Victory!' : '💪 Good Game!';
    const message = isWin ? 'Congratulations on your win!' : 'Better luck next time!';
    
    // Calculate actual rewards
    let actualCoinsEarned = coinsEarned;
    let bonusDiamonds = 0;
    let consolationCoins = 0;
    
    if (!isPractice) {
        if (isWin && coinsEarned >= 5000) {
            bonusDiamonds = Math.floor(coinsEarned / 1000);
        } else if (!isWin && originalCost) {
            consolationCoins = Math.floor(originalCost * 0.1);
            actualCoinsEarned = consolationCoins;
        }
    }
    
    const content = `
        <div class="text-center space-y-4">
            <div class="text-6xl mb-4">${isWin ? '🏆' : '🎯'}</div>
            <h3 class="text-xl font-bold mb-2">${title}</h3>
            <p class="text-gray-600 mb-4">${message}</p>
            
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div class="text-gray-600">Game Mode</div>
                        <div class="font-bold capitalize">${gameMode}${arenaName ? ` - ${arenaName}` : ''}</div>
                    </div>
                    <div>
                        <div class="text-gray-600">Difficulty</div>
                        <div class="font-bold capitalize">${difficulty || 'Standard'}</div>
                    </div>
                    <div>
                        <div class="text-gray-600">Coins Earned</div>
                        <div class="font-bold text-success">+${actualCoinsEarned.toLocaleString()}</div>
                    </div>
                    <div>
                        <div class="text-gray-600">Result</div>
                        <div class="font-bold ${isWin ? 'text-success' : 'text-gray-600'}">${isWin ? 'Win' : 'Loss'}</div>
                    </div>
                </div>
                
                ${bonusDiamonds > 0 ? `
                    <div class="mt-3 bg-blue-50 rounded-lg p-3">
                        <div class="text-sm text-blue-700">
                            🎁 <strong>Victory Bonus:</strong> +${bonusDiamonds} diamonds!
                        </div>
                    </div>
                ` : ''}
                
                ${consolationCoins > 0 ? `
                    <div class="mt-3 bg-yellow-50 rounded-lg p-3">
                        <div class="text-sm text-yellow-700">
                            🎁 <strong>Participation Reward:</strong> +${consolationCoins} coins
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-sm text-gray-700">
                    <div>💰 Total Coins: ${currencyManager ? currencyManager.getCoins().toLocaleString() : '0'}</div>
                    <div>💎 Total Diamonds: ${currencyManager ? currencyManager.getDiamonds().toLocaleString() : '0'}</div>
                </div>
            </div>
            
            ${isPractice ? '<div class="bg-blue-50 rounded-lg p-3"><div class="text-sm text-blue-700">💡 Practice game - helps you improve without risk!</div></div>' : ''}
        </div>
    `;
    
    uxManager.showModal(
        title,
        content,
        [
            {
                text: 'Play Again',
                class: 'btn-primary',
                onclick: () => {
                    if (isPractice) {
                        startPracticeMode(difficulty);
                    } else if (arenaName) {
                        showScreen('page2'); // Back to arena selection
                    } else {
                        showScreen('page1');
                    }
                }
            },
            {
                text: 'Main Menu',
                class: 'btn-secondary',
                onclick: () => showScreen('page1')
            }
        ]
    );
}

// Daily reward system integration
function showDailyRewardModal() {
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        return;
    }
    
    try {
        const reward = currencyManager.claimDailyReward();
        
        uxManager.showModal(
            '🎁 Daily Reward Claimed!',
            `
                <div class="text-center space-y-4">
                    <div class="text-6xl mb-4">🎁</div>
                    <h3 class="text-xl font-bold mb-4">Daily Login Bonus</h3>
                    
                    <div class="bg-gradient-to-r from-yellow-50 to-green-50 rounded-lg p-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-white rounded-lg p-3">
                                <div class="text-2xl mb-1">💰</div>
                                <div class="font-bold text-primary">+${reward.coins} Coins</div>
                                <div class="text-sm text-gray-600">Daily bonus</div>
                            </div>
                            <div class="bg-white rounded-lg p-3">
                                <div class="text-2xl mb-1">💎</div>
                                <div class="font-bold text-blue-600">+${reward.diamonds} Diamonds</div>
                                <div class="text-sm text-gray-600">Premium bonus</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 rounded-lg p-3">
                        <div class="text-sm text-blue-700">
                            🔥 <strong>Login Streak:</strong> ${reward.streak} days
                            ${reward.streak >= 7 ? ' - Amazing dedication!' : ''}
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="text-sm text-gray-700">
                            <div>💰 Total Coins: ${currencyManager.getCoins().toLocaleString()}</div>
                            <div>💎 Total Diamonds: ${currencyManager.getDiamonds().toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            `,
            [
                {
                    text: 'Awesome!',
                    class: 'btn-primary'
                }
            ]
        );
        
    } catch (error) {
        console.error('Error claiming daily reward:', error);
        uxManager.showNotification('Daily reward already claimed', 'info');
    }
}

// Diamond to Coin Conversion System
function showConversionModal() {
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        return;
    }

    const options = currencyManager.getConversionOptions();
    
    uxManager.showModal(
        '💎➡️💰 Convert Diamonds to Coins',
        `
            <div class="space-y-4">
                <div class="text-center mb-4">
                    <p class="text-gray-600">Exchange your premium diamonds for coins to enter arenas!</p>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    ${options.map(option => `
                        <div class="conversion-option ${option.available ? '' : 'disabled'}" 
                             data-diamonds="${option.diamonds}" 
                             data-coins="${option.coins}">
                            <div class="flex items-center justify-between p-4 border rounded-lg ${option.available ? 'border-primary cursor-pointer hover:bg-primary hover:bg-opacity-5' : 'border-gray-300 opacity-50'}">
                                <div class="flex items-center space-x-3">
                                    <div class="text-2xl">${option.bonus ? '🌟' : '💎'}</div>
                                    <div>
                                        <div class="font-semibold">${option.value}</div>
                                        <div class="text-sm text-gray-600">
                                            ${option.diamonds} diamonds → ${option.coins.toLocaleString()} coins
                                        </div>
                                        ${option.bonus ? '<div class="text-xs text-yellow-600 font-medium">⭐ Best Value!</div>' : ''}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm ${option.available ? 'text-green-600' : 'text-red-600'}">
                                        ${option.available ? '✓ Available' : '✗ Insufficient'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="bg-blue-50 rounded-lg p-3">
                    <div class="text-sm text-blue-700">
                        <strong>💡 Tip:</strong> Diamonds are premium currency. Use them wisely!
                    </div>
                </div>
            </div>
        `,
        [
            {
                text: 'Cancel',
                class: 'btn-secondary'
            }
        ]
    );
    
    // Add click handlers to conversion options
    document.querySelectorAll('.conversion-option').forEach(option => {
        if (!option.classList.contains('disabled')) {
            option.addEventListener('click', () => {
                const diamonds = parseInt(option.dataset.diamonds);
                const coins = parseInt(option.dataset.coins);
                confirmConversion(diamonds, coins);
            });
        }
    });
}

function confirmConversion(diamonds, coins) {
    uxManager.showModal(
        '🔄 Confirm Conversion',
        `
            <div class="text-center space-y-4">
                <div class="text-4xl mb-4">💎➡️💰</div>
                <h3 class="text-xl font-bold mb-4">Confirm Diamond Conversion</h3>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">You'll Spend</div>
                            <div class="font-bold text-red-600">-${diamonds} diamonds</div>
                        </div>
                        <div>
                            <div class="text-gray-600">You'll Receive</div>
                            <div class="font-bold text-green-600">+${coins.toLocaleString()} coins</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Diamonds After</div>
                            <div class="font-bold text-primary">${currencyManager.getDiamonds() - diamonds}</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Coins After</div>
                            <div class="font-bold text-primary">${(currencyManager.getCoins() + coins).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-yellow-50 rounded-lg p-3">
                    <div class="text-sm text-yellow-700">
                        ⚠️ This action cannot be undone!
                    </div>
                </div>
            </div>
        `,
        [
            {
                text: 'Cancel',
                class: 'btn-secondary'
            },
            {
                text: 'Convert Now',
                class: 'btn-primary',
                onclick: () => executeConversion(diamonds, coins)
            }
        ]
    );
}

function executeConversion(diamonds, coins) {
    try {
        const result = currencyManager.convertDiamondsToCoins(diamonds);
        
        uxManager.showModal(
            '✅ Conversion Successful!',
            `
                <div class="text-center space-y-4">
                    <div class="text-6xl mb-4">🎉</div>
                    <h3 class="text-xl font-bold mb-4">Conversion Complete!</h3>
                    
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-green-800">
                            <div class="font-bold">✓ Successfully converted!</div>
                            <div class="text-sm mt-2">
                                ${result.diamondsSpent} diamonds → ${result.coinsEarned.toLocaleString()} coins
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="text-sm text-gray-700">
                            <div>💎 Diamonds: ${currencyManager.getDiamonds()}</div>
                            <div>💰 Coins: ${currencyManager.getCoins().toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            `,
            [
                {
                    text: 'Continue Playing',
                    class: 'btn-primary'
                }
            ]
        );
        
    } catch (error) {
        console.error('Conversion failed:', error);
        uxManager.showNotification('Conversion failed: ' + error.message, 'error');
    }
}

// Purchase Diamond System
function showPurchaseModal() {
    if (!currencyManager) {
        console.error('Currency manager not initialized');
        return;
    }

    const options = currencyManager.getPurchaseOptions();
    
    uxManager.showModal(
        '💎 Purchase Diamonds',
        `
            <div class="space-y-4">
                <div class="text-center mb-4">
                    <p class="text-gray-600">Get more diamonds to unlock premium features!</p>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    ${options.map(option => `
                        <div class="purchase-option ${option.popular ? 'popular' : ''}" 
                             data-diamonds="${option.diamonds}" 
                             data-price="${option.price}">
                            <div class="relative p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${option.popular ? 'border-primary border-2' : 'border-gray-300'}">
                                ${option.popular ? '<div class="absolute -top-2 left-4 bg-primary text-white px-2 py-1 rounded text-xs font-bold">POPULAR</div>' : ''}
                                
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-3">
                                        <div class="text-2xl">💎</div>
                                        <div>
                                            <div class="font-semibold">${option.description}</div>
                                            <div class="text-sm text-gray-600">
                                                ${option.diamonds} diamonds
                                                ${option.bonus ? ` + ${option.bonus}` : ''}
                                            </div>
                                            ${option.savings ? `<div class="text-xs text-green-600 font-medium">${option.savings}</div>` : ''}
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-lg font-bold">$${option.price.toFixed(2)}</div>
                                        <div class="text-sm text-gray-500">USD</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="bg-blue-50 rounded-lg p-3">
                    <div class="text-sm text-blue-700">
                        <strong>🔒 Secure:</strong> All transactions are processed securely
                    </div>
                </div>
                
                <div class="bg-yellow-50 rounded-lg p-3">
                    <div class="text-sm text-yellow-700">
                        <strong>⚠️ Demo Mode:</strong> This is a simulation for testing purposes
                    </div>
                </div>
            </div>
        `,
        [
            {
                text: 'Cancel',
                class: 'btn-secondary'
            }
        ]
    );
    
    // Add click handlers to purchase options
    document.querySelectorAll('.purchase-option').forEach(option => {
        option.addEventListener('click', () => {
            const diamonds = parseInt(option.dataset.diamonds);
            const price = parseFloat(option.dataset.price);
            confirmPurchase(diamonds, price);
        });
    });
}

function confirmPurchase(diamonds, price) {
    uxManager.showModal(
        '💳 Confirm Purchase',
        `
            <div class="text-center space-y-4">
                <div class="text-4xl mb-4">💎</div>
                <h3 class="text-xl font-bold mb-4">Confirm Diamond Purchase</h3>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">You'll Receive</div>
                            <div class="font-bold text-blue-600">+${diamonds} diamonds</div>
                        </div>
                        <div>
                            <div class="text-gray-600">You'll Pay</div>
                            <div class="font-bold text-red-600">$${price.toFixed(2)} USD</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Diamonds After</div>
                            <div class="font-bold text-primary">${currencyManager.getDiamonds() + diamonds}</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Bonus</div>
                            <div class="font-bold text-green-600">${diamonds >= 2500 ? (diamonds >= 5000 ? '+500' : '+100') : 'None'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-green-50 rounded-lg p-3">
                    <div class="text-sm text-green-700">
                        🎁 ${diamonds >= 2500 ? 'Bonus diamonds included!' : 'Great value for premium currency!'}
                    </div>
                </div>
            </div>
        `,
        [
            {
                text: 'Cancel',
                class: 'btn-secondary'
            },
            {
                text: 'Purchase',
                class: 'btn-primary',
                onclick: () => executePurchase(diamonds, price)
            }
        ]
    );
}

function executePurchase(diamonds, price) {
    try {
        const result = currencyManager.simulatePurchase(diamonds, price);
        
        uxManager.showModal(
            '✅ Purchase Successful!',
            `
                <div class="text-center space-y-4">
                    <div class="text-6xl mb-4">🎉</div>
                    <h3 class="text-xl font-bold mb-4">Purchase Complete!</h3>
                    
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-green-800">
                            <div class="font-bold">✓ Payment processed successfully!</div>
                            <div class="text-sm mt-2">
                                ${result.diamondsAdded} diamonds added to your account
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="text-sm text-gray-700">
                            <div>💎 Total Diamonds: ${currencyManager.getDiamonds()}</div>
                            <div>💰 Total Coins: ${currencyManager.getCoins().toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 rounded-lg p-3">
                        <div class="text-sm text-blue-700">
                            💡 Remember: You can convert diamonds to coins anytime!
                        </div>
                    </div>
                </div>
            `,
            [
                {
                    text: 'Continue Playing',
                    class: 'btn-primary'
                }
            ]
        );
        
    } catch (error) {
        console.error('Purchase failed:', error);
        uxManager.showNotification('Purchase failed: ' + error.message, 'error');
    }
}

// Export functions for global use
if (typeof window !== 'undefined') {
    window.showConversionModal = showConversionModal;
    window.showPurchaseModal = showPurchaseModal;
    window.startPracticeMode = startPracticeMode;
    window.launchPracticeGame = launchPracticeGame;
    window.updatePracticeStats = updatePracticeStats;
    window.loadPracticeStats = loadPracticeStats;
    window.handleGameResult = handleGameResult;
    window.showDailyRewardModal = showDailyRewardModal;
} 