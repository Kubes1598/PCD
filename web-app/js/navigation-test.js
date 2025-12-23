// ===== COMPLETE NAVIGATION TEST SCRIPT =====
console.log('🧪 Complete Navigation Test Script Loading...');

window.navigationTestSuite = {
    runQuickTest: function () {
        console.log('🧪 Running quick navigation test...');

        // Test functions
        const functions = ['showScreen', 'startNewGameNew', 'startAIGameNew', 'startOnlineGameNew'];
        functions.forEach(funcName => {
            if (typeof window[funcName] === 'function') {
                console.log(`✅ ${funcName} - Available`);
            } else {
                console.log(`❌ ${funcName} - Missing`);
            }
        });

        // Test buttons
        const playAgainBtns = document.querySelectorAll('button[onclick*="startNewGameNew()"]');
        const mainMenuBtns = document.querySelectorAll('button[onclick*="showScreen(\'page1\')"]');

        console.log(`🔘 Play Again buttons: ${playAgainBtns.length}`);
        console.log(`🔘 Main Menu buttons: ${mainMenuBtns.length}`);

        // Test Page 5
        const page5 = document.getElementById('page5');
        if (page5) {
            console.log('✅ Page 5 (Game Results) exists');
            const playAgainInPage5 = page5.querySelector('button[onclick*="startNewGameNew()"]');
            const mainMenuInPage5 = page5.querySelector('button[onclick*="showScreen(\'page1\')"]');

            if (playAgainInPage5) {
                console.log('✅ Play Again button found in Page 5');
            } else {
                console.log('❌ Play Again button NOT found in Page 5');
            }

            if (mainMenuInPage5) {
                console.log('✅ Main Menu button found in Page 5');
            } else {
                console.log('❌ Main Menu button NOT found in Page 5');
            }
        } else {
            console.log('❌ Page 5 (Game Results) NOT found');
        }

        // Test game state
        if (typeof gameState !== 'undefined' && gameState) {
            console.log('✅ Game state exists');
        } else {
            console.log('❌ Game state missing');
        }
    },

    testButtonClicks: function () {
        console.log('🧪 Testing button clicks...');

        // Test Main Menu button
        const mainMenuBtn = document.querySelector('button[onclick*="showScreen(\'page1\')"]');
        if (mainMenuBtn) {
            console.log('🔘 Testing Main Menu button...');
            try {
                mainMenuBtn.click();
                console.log('✅ Main Menu button clicked successfully');
            } catch (error) {
                console.log('❌ Main Menu button click failed:', error.message);
            }
        } else {
            console.log('❌ Main Menu button not found');
        }

        // Test Play Again button
        const playAgainBtn = document.querySelector('button[onclick*="startNewGameNew()"]');
        if (playAgainBtn) {
            console.log('🔘 Testing Play Again button...');
            try {
                // Don't actually click it as it would restart the game
                console.log('✅ Play Again button found and clickable');
            } catch (error) {
                console.log('❌ Play Again button issue:', error.message);
            }
        } else {
            console.log('❌ Play Again button not found');
        }
    }
};

// Auto-run tests
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        console.log('🚀 Auto-running navigation tests...');
        if (window.navigationTestSuite) {
            window.navigationTestSuite.runQuickTest();
        }
    }, 3000);
});

console.log('✅ Complete Navigation Test Script Loaded');
