// ===== API CONFIGURATION =====
const API_CONFIG = {
    baseURL: 'http://localhost:8000',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
};

// ===== API CLIENT CLASS =====
class APIClient {
    constructor(config = API_CONFIG) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout;
        this.retryAttempts = config.retryAttempts;
        this.retryDelay = config.retryDelay;
        this.isOnline = navigator.onLine;

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            showNotification('Connection restored!', 'success');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            showNotification('Connection lost. Working offline...', 'warning');
        });
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Check if online for non-GET requests
        if (!this.isOnline && options.method !== 'GET') {
            throw new Error('No internet connection. Please check your connection and try again.');
        }

        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    ...config,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data;

            } catch (error) {
                lastError = error;

                if (attempt < this.retryAttempts) {
                    console.warn(`API request failed (attempt ${attempt}/${this.retryAttempts}):`, error.message);
                    await this.delay(this.retryDelay * attempt);
                } else {
                    console.error('API request failed after all retries:', error.message);
                }
            }
        }

        throw lastError;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== GAME API METHODS =====

    async createGame(playerData) {
        try {
            const response = await this.request('/games', {
                method: 'POST',
                body: JSON.stringify(playerData)
            });

            showNotification('Game created successfully!', 'success');
            return response;
        } catch (error) {
            showNotification('Failed to create game. Please try again.', 'error');
            throw error;
        }
    }

    async getGame(gameId) {
        try {
            return await this.request(`/games/${gameId}`);
        } catch (error) {
            showNotification('Failed to load game data.', 'error');
            throw error;
        }
    }

    async setPoison(gameId, player, poisonChoice) {
        try {
            const response = await this.request(`/games/${gameId}/poison`, {
                method: 'POST',
                body: JSON.stringify({
                    player: player,
                    poison_choice: poisonChoice
                })
            });

            showNotification('Poison choice confirmed!', 'success');
            return response;
        } catch (error) {
            showNotification('Failed to set poison. Please try again.', 'error');
            throw error;
        }
    }

    async pickCandy(gameId, player, candyChoice) {
        try {
            const response = await this.request(`/games/${gameId}/pick`, {
                method: 'POST',
                body: JSON.stringify({
                    player: player,
                    candy_choice: candyChoice
                })
            });

            if (response.picked_poison) {
                soundManager.play('error');
            } else {
                soundManager.play('success');
            }

            return response;
        } catch (error) {
            showNotification('Failed to pick candy. Please try again.', 'error');
            soundManager.play('error');
            throw error;
        }
    }

    async getHealth() {
        try {
            return await this.request('/health');
        } catch (error) {
            console.warn('Health check failed:', error.message);
            return { status: 'offline' };
        }
    }

    async getGameHistory(limit = 10) {
        try {
            return await this.request(`/games?limit=${limit}`);
        } catch (error) {
            console.warn('Failed to load game history:', error.message);
            return [];
        }
    }
}

// ===== OFFLINE STORAGE =====
class OfflineStorage {
    constructor() {
        this.storageKey = 'pcd_offline_data';
        this.queue = this.loadQueue();
    }

    loadQueue() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            return [];
        }
    }

    saveQueue() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    addToQueue(action, data) {
        this.queue.push({
            id: Date.now(),
            action,
            data,
            timestamp: new Date().toISOString()
        });
        this.saveQueue();
    }

    async processQueue() {
        if (!navigator.onLine || this.queue.length === 0) {
            return;
        }

        const processed = [];

        for (const item of this.queue) {
            try {
                await this.processQueueItem(item);
                processed.push(item.id);
            } catch (error) {
                console.error('Failed to process queue item:', error);
                break; // Stop processing on first failure
            }
        }

        // Remove processed items
        this.queue = this.queue.filter(item => !processed.includes(item.id));
        this.saveQueue();

        if (processed.length > 0) {
            showNotification(`Synced ${processed.length} offline actions`, 'success');
        }
    }

    async processQueueItem(item) {
        const api = new APIClient();

        switch (item.action) {
            case 'createGame':
                return await api.createGame(item.data);
            case 'setPoison':
                return await api.setPoison(item.data.gameId, item.data.player, item.data.poison);
            case 'pickCandy':
                return await api.pickCandy(item.data.gameId, item.data.player, item.data.candy);
            default:
                console.warn('Unknown queue action:', item.action);
        }
    }

    clearQueue() {
        this.queue = [];
        this.saveQueue();
    }
}

// ===== MOCK DATA FOR OFFLINE MODE =====
class MockAPI {
    constructor() {
        this.games = new Map();
        this.gameCounter = 1;
    }

    generateGameId() {
        return `offline-game-${this.gameCounter++}`;
    }

    generateCandies(count = 12) {
        // Use the same candy types as main game (user-specified set)
        const candyTypes = [
            '🍏', '🍋', '🍇', '🍒', '🍎', '🍓', '🍑', '🍐', '🍌',
            '🫐', '🥭', '🍊', '🍉', '🍈', '🍍', '🥥', '🥑', '🥒', '🥕',
            '🥝', '🌶️', '🫒', '🍅', '🥦', '🫑', '🧄', '🍆', '🥬',
            '🌽', '🧅', '🥔', '🍠', '🥖', '🍞', '🥚', '🧇', '🧀',
            '🥞', '🧈', '🍖', '🍗', '🌭', '🥩', '🌮', '🌯', '🥙', '🥗',
            '🧆', '🍕', '🫔', '🦴', '🍝', '🍜', '🍥', '🍰', '🍬', '🍭',
            '🍪', '🍩', '🌰', '🍫', '🍵'
        ];

        const masterPoolSet = new Set();
        const shuffled = [...candyTypes].sort(() => Math.random() - 0.5);

        for (const candy of shuffled) {
            if (masterPoolSet.size >= count) break;
            masterPoolSet.add(candy);
        }

        return Array.from(masterPoolSet);
    }

    async createGame(playerData) {
        const gameId = this.generateGameId();
        const game = {
            id: gameId,
            player1_name: playerData.player1_name,
            player2_name: playerData.player2_name,
            player1_candies: this.generateCandies(),
            player2_candies: this.generateCandies(),
            status: 'setup',
            created_at: new Date().toISOString()
        };

        this.games.set(gameId, game);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return game;
    }

    async getGame(gameId) {
        await new Promise(resolve => setTimeout(resolve, 200));

        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        return game;
    }

    async setPoison(gameId, player, poisonChoice) {
        await new Promise(resolve => setTimeout(resolve, 300));

        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        game[`${player}_poison`] = poisonChoice;
        game.status = 'playing';

        return { success: true };
    }

    async pickCandy(gameId, player, candyChoice) {
        await new Promise(resolve => setTimeout(resolve, 400));

        const game = this.games.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        // Simple logic - 10% chance of picking poison
        const pickedPoison = Math.random() < 0.1;

        return {
            picked_poison: pickedPoison,
            candy: candyChoice,
            game_over: pickedPoison
        };
    }

    async getHealth() {
        return { status: 'offline', mode: 'mock' };
    }
}

// ===== GLOBAL API INSTANCE =====
const api = new APIClient();
const offlineStorage = new OfflineStorage();
const mockAPI = new MockAPI();

// ===== API WRAPPER FUNCTIONS =====
async function createGameAPI(playerData) {
    try {
        if (navigator.onLine) {
            const result = await api.createGame(playerData);
            return result;
        } else {
            // Use mock API when offline
            const result = await mockAPI.createGame(playerData);
            offlineStorage.addToQueue('createGame', playerData);
            showNotification('Playing offline - data will sync when online', 'warning');
            return result;
        }
    } catch (error) {
        console.error('Create game failed:', error);
        // Fallback to mock API
        const result = await mockAPI.createGame(playerData);
        showNotification('Using offline mode', 'warning');
        return result;
    }
}

async function getGameAPI(gameId) {
    try {
        if (navigator.onLine && !gameId.startsWith('offline-')) {
            return await api.getGame(gameId);
        } else {
            return await mockAPI.getGame(gameId);
        }
    } catch (error) {
        console.error('Get game failed:', error);
        return await mockAPI.getGame(gameId);
    }
}

async function setPoisonAPI(gameId, player, poisonChoice) {
    try {
        if (navigator.onLine && !gameId.startsWith('offline-')) {
            return await api.setPoison(gameId, player, poisonChoice);
        } else {
            const result = await mockAPI.setPoison(gameId, player, poisonChoice);
            if (navigator.onLine) {
                offlineStorage.addToQueue('setPoison', { gameId, player, poison: poisonChoice });
            }
            return result;
        }
    } catch (error) {
        console.error('Set poison failed:', error);
        const result = await mockAPI.setPoison(gameId, player, poisonChoice);
        offlineStorage.addToQueue('setPoison', { gameId, player, poison: poisonChoice });
        return result;
    }
}

async function pickCandyAPI(gameId, player, candyChoice) {
    try {
        if (navigator.onLine && !gameId.startsWith('offline-')) {
            return await api.pickCandy(gameId, player, candyChoice);
        } else {
            const result = await mockAPI.pickCandy(gameId, player, candyChoice);
            if (navigator.onLine) {
                offlineStorage.addToQueue('pickCandy', { gameId, player, candy: candyChoice });
            }
            return result;
        }
    } catch (error) {
        console.error('Pick candy failed:', error);
        const result = await mockAPI.pickCandy(gameId, player, candyChoice);
        offlineStorage.addToQueue('pickCandy', { gameId, player, candy: candyChoice });
        return result;
    }
}

async function checkAPIHealth() {
    try {
        const health = await api.getHealth();
        return health.status === 'healthy';
    } catch (error) {
        return false;
    }
}

// ===== CONNECTION MONITORING =====
let connectionCheckInterval;

function startConnectionMonitoring() {
    connectionCheckInterval = setInterval(async () => {
        const isHealthy = await checkAPIHealth();

        if (isHealthy && navigator.onLine) {
            // Process any queued offline actions
            await offlineStorage.processQueue();
        }
    }, 30000); // Check every 30 seconds
}

function stopConnectionMonitoring() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
}

// ===== ERROR HANDLING =====
function handleAPIError(error, context = '') {
    console.error(`API Error ${context}:`, error);

    if (error.message.includes('fetch')) {
        showNotification('Network error. Please check your connection.', 'error');
    } else if (error.message.includes('timeout')) {
        showNotification('Request timed out. Please try again.', 'error');
    } else if (error.message.includes('HTTP 4')) {
        showNotification('Invalid request. Please try again.', 'error');
    } else if (error.message.includes('HTTP 5')) {
        showNotification('Server error. Please try again later.', 'error');
    } else {
        showNotification('Something went wrong. Please try again.', 'error');
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    startConnectionMonitoring();

    // Process any pending offline actions
    if (navigator.onLine) {
        setTimeout(() => {
            offlineStorage.processQueue();
        }, 2000);
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopConnectionMonitoring();
});

// ===== EXPORT FOR GLOBAL ACCESS =====
window.apiClient = api;
window.offlineStorage = offlineStorage;
window.mockAPI = mockAPI;