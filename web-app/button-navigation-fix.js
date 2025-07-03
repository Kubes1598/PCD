// ===== BUTTON NAVIGATION FIX SCRIPT =====
console.log('🔧 Button Navigation Fix Script Loading...');

// Fix for potential navigation issues
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Applying button navigation fixes...');
    
    // Ensure all navigation functions are available globally
    window.fixButtonNavigation = function() {
        console.log('🔧 Running button navigation fixes...');
        
        // Fix 1: Ensure showScreen function is working
        if (typeof showScreen !== 'function') {
            console.log('❌ showScreen function missing! Redefining...');
            window.showScreen = function(screenId) {
                console.log(`🔧 Fixed showScreen switching to: ${screenId}`);
                
                // Hide all screens
                document.querySelectorAll('.screen').forEach(screen => {
                    screen.classList.remove('active');
                });
                
                // Show target screen
                const targetScreen = document.getElementById(screenId);
                if (targetScreen) {
                    targetScreen.classList.add('active');
                    console.log(`✅ Successfully switched to ${screenId}`);
                } else {
                    console.error(`❌ Screen ${screenId} not found`);
                }
            };
        }
        
        // Fix 2: Ensure startNewGameNew function is working
        if (typeof startNewGameNew !== 'function') {
            console.log('❌ startNewGameNew function missing! Redefining...');
            window.startNewGameNew = async function() {
                console.log('🔧 Fixed startNewGameNew function called');
                
                // Basic restart logic
                if (typeof gameState !== 'undefined' && gameState) {
                    const currentMode = gameState.gameMode || 'ai';
                    const currentDifficulty = gameState.aiDifficulty || 'easy';
                    
                    console.log(`🔧 Restarting ${currentMode} game`);
                    
                    // Reset game state
                    gameState.gameStarted = false;
                    gameState.gameEnded = false;
                    gameState.selectedPoison = null;
                    gameState.playerCandies = [];
                    gameState.opponentCandies = [];
                    gameState.playerCollection = [];
                    gameState.opponentCollection = [];
                    gameState.round = 0;
                    
                    // Close any modals
                    if (typeof closeModal === 'function') {
                        closeModal();
                    }
                    
                    // Restart appropriate game mode
                    if (currentMode === 'ai' || currentMode === 'offline') {
                        if (typeof startAIGameNew === 'function') {
                            await startAIGameNew(currentDifficulty);
                        } else {
                            showScreen('page7'); // Go to AI selection
                        }
                    } else if (currentMode === 'online') {
                        showScreen('page2'); // Go to city selection
                    } else if (currentMode === 'friends') {
                        showScreen('page6'); // Go to friends mode
                    } else {
                        showScreen('page7'); // Default to AI selection
                    }
                } else {
                    console.log('🔧 No game state, returning to main menu');
                    showScreen('page1');
                }
            };
        }
        
        // Fix 3: Add click handlers to all buttons that might not be working
        const buttonFixes = [
            {
                selector: 'button[onclick*="startNewGameNew()"]',
                handler: () => {
                    console.log('🔧 Play Again button clicked');
                    if (typeof startNewGameNew === 'function') {
                        startNewGameNew();
                    } else {
                        console.log('🔧 startNewGameNew not found, falling back to page7');
                        showScreen('page7');
                    }
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page1\')"]',
                handler: () => {
                    console.log('🔧 Main Menu button clicked');
                    if (typeof closeModal === 'function') {
                        closeModal();
                    }
                    showScreen('page1');
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page2\')"]',
                handler: () => {
                    console.log('🔧 Play Online button clicked');
                    showScreen('page2');
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page7\')"]',
                handler: () => {
                    console.log('🔧 Play Offline button clicked');
                    showScreen('page7');
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page6\')"]',
                handler: () => {
                    console.log('🔧 Play with Friends button clicked');
                    showScreen('page6');
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page11\')"]',
                handler: () => {
                    console.log('🔧 Profile button clicked');
                    showScreen('page11');
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page9\')"]',
                handler: () => {
                    console.log('🔧 Rewards button clicked');
                    showScreen('page9');
                }
            },
            {
                selector: 'button[onclick*="showScreen(\'page10\')"]',
                handler: () => {
                    console.log('🔧 Rankings button clicked');
                    showScreen('page10');
                }
            }
        ];
        
        // Apply fixes to all buttons
        buttonFixes.forEach(fix => {
            const buttons = document.querySelectorAll(fix.selector);
            buttons.forEach(button => {
                // Add backup event listener
                button.addEventListener('click', (e) => {
                    console.log(`🔧 Backup handler for: ${fix.selector}`);
                    fix.handler();
                });
            });
            
            if (buttons.length > 0) {
                console.log(`✅ Fixed ${buttons.length} buttons for ${fix.selector}`);
            }
        });
        
        // Fix 4: Ensure all AI difficulty buttons work
        const aiButtons = document.querySelectorAll('[onclick*="startAIGameNew"]');
        aiButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const onclick = button.getAttribute('onclick');
                const match = onclick.match(/startAIGameNew\(['"]([^'"]+)['"]\)/);
                if (match) {
                    const difficulty = match[1];
                    console.log(`🔧 AI ${difficulty} button clicked`);
                    if (typeof startAIGameNew === 'function') {
                        startAIGameNew(difficulty);
                    } else {
                        console.log('🔧 startAIGameNew not found, initializing AI game');
                        if (typeof gameState !== 'undefined' && gameState) {
                            gameState.gameMode = 'ai';
                            gameState.aiDifficulty = difficulty;
                            showScreen('page4'); // Go to poison selection
                        }
                    }
                }
            });
        });
        
        // Fix 5: Ensure all city selection buttons work
        const cityButtons = document.querySelectorAll('[onclick*="startOnlineGameNew"]');
        cityButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const onclick = button.getAttribute('onclick');
                const match = onclick.match(/startOnlineGameNew\(['"]([^'"]+)['"],\s*(\d+)\)/);
                if (match) {
                    const city = match[1];
                    const cost = parseInt(match[2]);
                    console.log(`🔧 ${city} online game button clicked (${cost} coins)`);
                    if (typeof startOnlineGameNew === 'function') {
                        startOnlineGameNew(city, cost);
                    } else {
                        console.log('🔧 startOnlineGameNew not found, initializing online game');
                        if (typeof gameState !== 'undefined' && gameState) {
                            gameState.gameMode = 'online';
                            gameState.selectedCity = city;
                            gameState.gameCost = cost;
                            showScreen('page4'); // Go to poison selection
                        }
                    }
                }
            });
        });
        
        console.log('✅ Button navigation fixes applied successfully');
    };
    
    // Auto-apply fixes
    fixButtonNavigation();
});

// Test function for navigation
window.testNavigation = function() {
    console.log('🧪 Testing navigation...');
    
    const testSequence = [
        { screen: 'page1', name: 'Main Menu' },
        { screen: 'page2', name: 'City Selection' },
        { screen: 'page1', name: 'Back to Main Menu' },
        { screen: 'page7', name: 'AI Selection' },
        { screen: 'page1', name: 'Back to Main Menu' },
        { screen: 'page6', name: 'Friends Mode' },
        { screen: 'page1', name: 'Back to Main Menu' },
        { screen: 'page11', name: 'Profile' },
        { screen: 'page1', name: 'Back to Main Menu' }
    ];
    
    let currentTest = 0;
    
    function runNextTest() {
        if (currentTest >= testSequence.length) {
            console.log('✅ Navigation test completed');
            return;
        }
        
        const test = testSequence[currentTest];
        console.log(`🧪 Testing ${test.name} (${test.screen})`);
        
        if (typeof showScreen === 'function') {
            showScreen(test.screen);
            console.log(`✅ ${test.name} navigation successful`);
        } else {
            console.log(`❌ ${test.name} navigation failed - showScreen not available`);
        }
        
        currentTest++;
        setTimeout(runNextTest, 1000);
    }
    
    runNextTest();
};

console.log('✅ Button Navigation Fix Script Loaded'); 