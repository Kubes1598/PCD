// ===== BUTTON MANAGER - HANDLES BUTTON LOADING STATES =====

class ButtonManager {
    constructor() {
        this.buttonStates = new Map();
        this.originalButtonData = new Map();
    }

    // ===== SET BUTTON LOADING STATE =====
    setLoading(buttonElement, loadingText = 'Loading...', loadingIcon = '⏳') {
        if (!buttonElement) return;

        const buttonId = this._getButtonId(buttonElement);
        
        // Store original button data
        if (!this.originalButtonData.has(buttonId)) {
            this.originalButtonData.set(buttonId, {
                innerHTML: buttonElement.innerHTML,
                disabled: buttonElement.disabled,
                className: buttonElement.className,
                onclick: buttonElement.onclick
            });
        }

        // Set loading state
        buttonElement.disabled = true;
        buttonElement.innerHTML = `
            <span class="loading-spinner" style="display: inline-block; width: 20px; height: 20px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span>
            ${loadingText}
        `;
        
        // Add loading class
        buttonElement.classList.add('btn-loading');
        
        // Remove click handler temporarily
        buttonElement.onclick = null;
        
        this.buttonStates.set(buttonId, 'loading');
        console.log(`🔄 Button ${buttonId} set to loading state`);
    }

    // ===== RESTORE BUTTON TO ORIGINAL STATE =====
    restore(buttonElement) {
        if (!buttonElement) return;

        const buttonId = this._getButtonId(buttonElement);
        const originalData = this.originalButtonData.get(buttonId);
        
        if (originalData) {
            buttonElement.innerHTML = originalData.innerHTML;
            buttonElement.disabled = originalData.disabled;
            buttonElement.className = originalData.className;
            buttonElement.onclick = originalData.onclick;
            
            // Remove loading class
            buttonElement.classList.remove('btn-loading');
            
            this.buttonStates.set(buttonId, 'normal');
            console.log(`✅ Button ${buttonId} restored to normal state`);
        }
    }

    // ===== SET BUTTON SUCCESS STATE =====
    setSuccess(buttonElement, successText = 'Success!', successIcon = '✅', duration = 2000) {
        if (!buttonElement) return;

        const buttonId = this._getButtonId(buttonElement);
        
        // Set success state
        buttonElement.disabled = true;
        buttonElement.innerHTML = `
            <span style="margin-right: 8px;">${successIcon}</span>
            ${successText}
        `;
        
        // Add success class
        buttonElement.classList.add('btn-success');
        
        this.buttonStates.set(buttonId, 'success');
        console.log(`✅ Button ${buttonId} set to success state`);
        
        // Auto-restore after duration
        setTimeout(() => {
            this.restore(buttonElement);
        }, duration);
    }

    // ===== SET BUTTON ERROR STATE =====
    setError(buttonElement, errorText = 'Error!', errorIcon = '❌', duration = 3000) {
        if (!buttonElement) return;

        const buttonId = this._getButtonId(buttonElement);
        
        // Set error state
        buttonElement.disabled = false; // Allow retry
        buttonElement.innerHTML = `
            <span style="margin-right: 8px;">${errorIcon}</span>
            ${errorText}
        `;
        
        // Add error class
        buttonElement.classList.add('btn-error');
        
        this.buttonStates.set(buttonId, 'error');
        console.log(`❌ Button ${buttonId} set to error state`);
        
        // Auto-restore after duration
        setTimeout(() => {
            this.restore(buttonElement);
        }, duration);
    }

    // ===== GET BUTTON STATE =====
    getState(buttonElement) {
        if (!buttonElement) return 'unknown';
        const buttonId = this._getButtonId(buttonElement);
        return this.buttonStates.get(buttonId) || 'normal';
    }

    // ===== UTILITY METHODS =====
    _getButtonId(buttonElement) {
        return buttonElement.id || 
               buttonElement.className || 
               buttonElement.textContent?.trim() || 
               Math.random().toString(36).substring(2, 9);
    }

    // ===== ENHANCED BUTTON CLICK HANDLER =====
    async handleButtonClick(buttonElement, asyncAction, options = {}) {
        const {
            loadingText = 'Loading...',
            loadingIcon = '⏳',
            successText = 'Success!',
            successIcon = '✅',
            errorText = 'Error!',
            errorIcon = '❌',
            successDuration = 2000,
            errorDuration = 3000,
            preventMultipleClicks = true
        } = options;

        // Prevent multiple clicks if specified
        if (preventMultipleClicks && this.getState(buttonElement) === 'loading') {
            console.log('⚠️ Button click prevented - already loading');
            return;
        }

        try {
            // Set loading state
            this.setLoading(buttonElement, loadingText, loadingIcon);
            
            // Execute async action
            const result = await asyncAction();
            
            // Set success state
            this.setSuccess(buttonElement, successText, successIcon, successDuration);
            
            return result;
            
        } catch (error) {
            console.error('❌ Button action failed:', error);
            
            // Set error state
            this.setError(buttonElement, errorText, errorIcon, errorDuration);
            
            // Re-throw error for handling by caller
            throw error;
        }
    }

    // ===== RESET ALL BUTTONS =====
    resetAll() {
        this.buttonStates.clear();
        this.originalButtonData.clear();
        
        // Remove all loading/success/error classes
        const buttons = document.querySelectorAll('.btn-loading, .btn-success, .btn-error');
        buttons.forEach(button => {
            button.classList.remove('btn-loading', 'btn-success', 'btn-error');
            button.disabled = false;
        });
        
        console.log('🔄 All buttons reset');
    }
}

// ===== ENHANCED BUTTON WRAPPER FUNCTIONS =====

// Create global button manager
window.buttonManager = new ButtonManager();

// Enhanced wrapper functions with button feedback
async function startAIGameWithFeedback(difficulty, buttonElement) {
    return await buttonManager.handleButtonClick(buttonElement, async () => {
        return await gameInitializer.start('ai', { difficulty });
    }, {
        loadingText: `Starting ${difficulty} AI game...`,
        successText: 'Game Started!',
        errorText: 'Failed to start'
    });
}

async function startOnlineGameWithFeedback(city, cost, buttonElement) {
    return await buttonManager.handleButtonClick(buttonElement, async () => {
        return await gameInitializer.start('online', { city, cost });
    }, {
        loadingText: `Connecting to ${city}...`,
        successText: 'Connected!',
        errorText: 'Connection failed'
    });
}

async function startFriendsGameWithFeedback(gameId, buttonElement) {
    return await buttonManager.handleButtonClick(buttonElement, async () => {
        return await gameInitializer.start('friends', { gameId });
    }, {
        loadingText: 'Creating room...',
        successText: 'Room created!',
        errorText: 'Failed to create'
    });
}

async function startNewGameWithFeedback(buttonElement) {
    return await buttonManager.handleButtonClick(buttonElement, async () => {
        return await startNewGameNew();
    }, {
        loadingText: 'Restarting game...',
        successText: 'Game restarted!',
        errorText: 'Restart failed'
    });
}

// Export enhanced functions globally
window.startAIGameWithFeedback = startAIGameWithFeedback;
window.startOnlineGameWithFeedback = startOnlineGameWithFeedback;
window.startFriendsGameWithFeedback = startFriendsGameWithFeedback;
window.startNewGameWithFeedback = startNewGameWithFeedback;

console.log('✅ ButtonManager loaded successfully'); 