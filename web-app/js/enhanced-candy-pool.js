// ===== ENHANCED CANDY POOL SYSTEM FOR ONLINE PLAY =====

class EnhancedCandyPoolManager {
    constructor() {
        // Categorized candy pools for balanced gameplay
        this.candyPools = {
            common: [
                '🍎', '🍊', '🍌', '🍇', '🍓', '🍒', '🍑', '🍐', '🍋', '🍉',
                '🥕', '🍅', '🥒', '🧄', '🧅', '🥔', '🌽', '🥖', '🍞', '🥚'
            ],
            uncommon: [
                '🍏', '🍋‍🟩', '🫐', '🥭', '🍈', '🍍', '🥥', '🥑', '🥝', '🫛',
                '🌶️', '🫒', '🥦', '🫑', '🍆', '🥬', '🫜', '🍠', '🧇', '🧀'
            ],
            rare: [
                '🥞', '🧈', '🍖', '🍗', '🌭', '🥩', '🌮', '🌯', '🥙', '🥗',
                '🧆', '🍕', '🫔', '🦴', '🍝', '🍜', '🍥', '🌰', '🍫', '🍵'
            ],
            special: [
                '🍰', '🍬', '🍭', '🍪', '🍩', '🎂', '🧁', '🍯', '🍮', '🥧'
            ]
        };

        // Pool generation rules for balanced gameplay
        this.poolRules = {
            balanced: {
                common: 6,      // 6 common candies (50%)
                uncommon: 4,    // 4 uncommon candies (33%)
                rare: 2,        // 2 rare candies (17%)
                special: 0      // 0 special candies
            },
            competitive: {
                common: 4,      // 4 common candies (33%)
                uncommon: 4,    // 4 uncommon candies (33%)
                rare: 3,        // 3 rare candies (25%)
                special: 1      // 1 special candy (8%)
            },
            expert: {
                common: 2,      // 2 common candies (17%)
                uncommon: 4,    // 4 uncommon candies (33%)
                rare: 4,        // 4 rare candies (33%)
                special: 2      // 2 special candies (17%)
            }
        };

        // City-specific difficulty mapping
        this.cityDifficulty = {
            'Dubai': 'balanced',
            'Cairo': 'competitive', 
            'Oslo': 'expert'
        };

        // Synchronized game sessions
        this.activeSessions = new Map();
        this.sessionCounter = 0;
    }

    // ===== MAIN CANDY POOL GENERATION =====

    generateSynchronizedCandyPools(city = 'Dubai', sessionId = null) {
        console.log(`🍭 Generating synchronized candy pools for ${city}`);
        
        // Create or retrieve session
        if (!sessionId) {
            sessionId = this.createNewSession(city);
        }

        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Generate the master candy pool for this session
        if (!session.masterPool) {
            session.masterPool = this.generateMasterPool(city);
            console.log(`✅ Generated master pool for session ${sessionId}:`, session.masterPool);
        }

        // Distribute candies between players
        const playerAllocation = this.distributePlayerCandies(session.masterPool);
        
        session.player1Candies = playerAllocation.player1;
        session.player2Candies = playerAllocation.player2;
        session.sharedPool = playerAllocation.shared;

        console.log(`🎮 Session ${sessionId} candy allocation:`, {
            masterPool: session.masterPool.length,
            player1: session.player1Candies.length,
            player2: session.player2Candies.length,
            shared: session.sharedPool.length
        });

        return {
            sessionId,
            masterPool: session.masterPool,
            player1Candies: session.player1Candies,
            player2Candies: session.player2Candies,
            sharedPool: session.sharedPool,
            city: session.city,
            difficulty: session.difficulty
        };
    }

    // Generate master candy pool based on city difficulty
    generateMasterPool(city) {
        const difficulty = this.cityDifficulty[city] || 'balanced';
        const rules = this.poolRules[difficulty];
        
        console.log(`🎯 Generating ${difficulty} pool for ${city}:`, rules);
        
        let masterPool = [];
        
        // Add candies by category according to rules
        Object.entries(rules).forEach(([category, count]) => {
            if (count > 0 && this.candyPools[category]) {
                const selectedCandies = this.selectRandomFromCategory(category, count);
                masterPool = masterPool.concat(selectedCandies);
                console.log(`  Added ${count} ${category} candies:`, selectedCandies);
            }
        });

        // Shuffle the master pool
        masterPool = this.shuffleArray(masterPool);
        
        // Add extra candies if needed to reach minimum pool size
        const minPoolSize = 24; // 12 per player
        if (masterPool.length < minPoolSize) {
            const extraNeeded = minPoolSize - masterPool.length;
            const extraCandies = this.selectRandomFromCategory('common', extraNeeded);
            masterPool = masterPool.concat(extraCandies);
            console.log(`  Added ${extraNeeded} extra common candies for minimum pool size`);
        }

        return masterPool;
    }

    // Distribute master pool between two players
    distributePlayerCandies(masterPool) {
        const shuffled = this.shuffleArray([...masterPool]);
        const midPoint = Math.floor(shuffled.length / 2);
        
        return {
            player1: shuffled.slice(0, midPoint),
            player2: shuffled.slice(midPoint),
            shared: [] // Reserved for future features
        };
    }

    // ===== SESSION MANAGEMENT =====

    createNewSession(city) {
        const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
        
        this.activeSessions.set(sessionId, {
            id: sessionId,
            city: city,
            difficulty: this.cityDifficulty[city] || 'balanced',
            createdAt: Date.now(),
            masterPool: null,
            player1Candies: null,
            player2Candies: null,
            sharedPool: null,
            players: [],
            status: 'created'
        });

        console.log(`🆕 Created candy pool session: ${sessionId} for ${city}`);
        return sessionId;
    }

    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    joinSession(sessionId, playerId, playerRole = 'player1') {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (!session.players.includes(playerId)) {
            session.players.push({
                id: playerId,
                role: playerRole,
                joinedAt: Date.now()
            });
        }

        console.log(`👤 Player ${playerId} joined session ${sessionId} as ${playerRole}`);
        return session;
    }

    cleanupOldSessions(maxAge = 3600000) { // 1 hour
        const now = Date.now();
        for (const [sessionId, session] of this.activeSessions) {
            if (now - session.createdAt > maxAge) {
                this.activeSessions.delete(sessionId);
                console.log(`🗑️ Cleaned up old session: ${sessionId}`);
            }
        }
    }

    // ===== UTILITY METHODS =====

    selectRandomFromCategory(category, count) {
        const pool = this.candyPools[category];
        if (!pool || pool.length === 0) {
            console.warn(`⚠️ Category ${category} is empty or doesn't exist`);
            return [];
        }

        const shuffled = this.shuffleArray([...pool]);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // ===== INTEGRATION WITH EXISTING SYSTEMS =====

    // Generate candies for PRD matchmaking system
    generatePRDCandies(city = 'Dubai') {
        console.log(`🎮 PRD: Generating enhanced candies for ${city}`);
        
        const pools = this.generateSynchronizedCandyPools(city);
        
        return {
            playerCandies: pools.player1Candies,
            opponentCandies: pools.player2Candies,
            poisonCandies: pools.player1Candies, // Player chooses poison from their pool
            sessionId: pools.sessionId,
            difficulty: pools.difficulty,
            city: pools.city
        };
    }

    // Generate candies compatible with existing game system
    generateLegacyCompatibleCandies(city = 'Dubai') {
        const enhanced = this.generatePRDCandies(city);
        
        return {
            playerCandies: enhanced.playerCandies,
            opponentCandies: enhanced.opponentCandies,
            poisonCandies: enhanced.poisonCandies
        };
    }

    // ===== BALANCE VALIDATION =====

    validatePoolBalance(candies) {
        const distribution = {
            common: 0,
            uncommon: 0,
            rare: 0,
            special: 0,
            unknown: 0
        };

        candies.forEach(candy => {
            let found = false;
            for (const [category, pool] of Object.entries(this.candyPools)) {
                if (pool.includes(candy)) {
                    distribution[category]++;
                    found = true;
                    break;
                }
            }
            if (!found) distribution.unknown++;
        });

        const total = candies.length;
        const percentages = {};
        Object.entries(distribution).forEach(([category, count]) => {
            percentages[category] = Math.round((count / total) * 100);
        });

        console.log(`📊 Pool balance for ${total} candies:`, percentages);
        return { distribution, percentages, isBalanced: percentages.unknown === 0 };
    }

    // ===== DEBUGGING AND TESTING =====

    getPoolStatistics() {
        const stats = {};
        Object.entries(this.candyPools).forEach(([category, pool]) => {
            stats[category] = {
                count: pool.length,
                samples: pool.slice(0, 3)
            };
        });

        return {
            totalCandyTypes: Object.values(this.candyPools).reduce((sum, pool) => sum + pool.length, 0),
            categories: stats,
            activeSessions: this.activeSessions.size,
            cityDifficulties: this.cityDifficulty
        };
    }

    // Test method for development
    runBalanceTest() {
        console.log('🧪 Running candy pool balance test...');
        
        Object.entries(this.cityDifficulty).forEach(([city, difficulty]) => {
            console.log(`\n🏙️ Testing ${city} (${difficulty}):`);
            const pools = this.generateSynchronizedCandyPools(city);
            
            console.log('Player 1 Balance:');
            this.validatePoolBalance(pools.player1Candies);
            
            console.log('Player 2 Balance:');
            this.validatePoolBalance(pools.player2Candies);
        });
        
        console.log('\n📈 Overall Statistics:');
        console.log(this.getPoolStatistics());
    }
}

// ===== GLOBAL INTEGRATION =====

// Create global instance
let enhancedCandyPool = null;

function getEnhancedCandyPool() {
    if (!enhancedCandyPool) {
        enhancedCandyPool = new EnhancedCandyPoolManager();
    }
    return enhancedCandyPool;
}

// Enhanced version of existing generateUniqueGameCandies function
function generateEnhancedGameCandies(city = 'Dubai') {
    console.log('🍭 Using enhanced candy pool system...');
    
    try {
        const candyPool = getEnhancedCandyPool();
        return candyPool.generateLegacyCompatibleCandies(city);
    } catch (error) {
        console.error('❌ Enhanced candy pool failed, falling back to legacy system:', error);
        
        // Fallback to original system
        if (typeof generateUniqueGameCandies === 'function') {
            return generateUniqueGameCandies();
        } else {
            throw new Error('No candy generation system available');
        }
    }
}

// PRD Integration function
function generatePRDEnhancedCandies(city = 'Dubai') {
    console.log(`🎯 PRD: Generating enhanced candies for ${city}`);
    
    const candyPool = getEnhancedCandyPool();
    const result = candyPool.generatePRDCandies(city);
    
    console.log(`✅ PRD Enhanced candies generated:`, {
        city: result.city,
        difficulty: result.difficulty,
        playerCandies: result.playerCandies.length,
        opponentCandies: result.opponentCandies.length,
        sessionId: result.sessionId
    });
    
    return result;
}

// Export for global use
if (typeof window !== 'undefined') {
    window.EnhancedCandyPoolManager = EnhancedCandyPoolManager;
    window.enhancedCandyPool = enhancedCandyPool;
    window.getEnhancedCandyPool = getEnhancedCandyPool;
    window.generateEnhancedGameCandies = generateEnhancedGameCandies;
    window.generatePRDEnhancedCandies = generatePRDEnhancedCandies;
} 