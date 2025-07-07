// ===== TIMER SYNCHRONIZATION MANAGER - PRD COMPLIANT =====
// Implements NTP-based timer synchronization within 100ms variance

class TimerSynchronizationManager {
    constructor() {
        this.serverTimeOffset = 0;
        this.networkLatency = 0;
        this.lastSyncTime = null;
        this.syncInterval = null;
        this.syncFrequency = 30000; // Sync every 30 seconds
        this.maxVariance = 100; // PRD: Maximum 100ms variance
        this.syncHistory = [];
        this.maxHistorySize = 10;
        this.isInitialized = false;
        
        console.log('⏰ Timer Synchronization Manager initialized');
    }
    
    // PRD: Initialize timer synchronization
    async initialize() {
        console.log('⏰ Initializing timer synchronization...');
        
        try {
            // Perform initial synchronization
            await this.performSync();
            
            // Start periodic synchronization
            this.startPeriodicSync();
            
            this.isInitialized = true;
            console.log('✅ Timer synchronization initialized successfully');
            
            return {
                success: true,
                offset: this.serverTimeOffset,
                latency: this.networkLatency
            };
            
        } catch (error) {
            console.error('❌ Failed to initialize timer synchronization:', error);
            throw error;
        }
    }
    
    // Perform time synchronization with server
    async performSync() {
        const syncAttempts = 3;
        const syncResults = [];
        
        console.log('⏰ Performing time synchronization...');
        
        for (let i = 0; i < syncAttempts; i++) {
            try {
                const result = await this.singleSyncAttempt();
                syncResults.push(result);
                
                // Small delay between attempts
                if (i < syncAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.warn(`⚠️ Sync attempt ${i + 1} failed:`, error);
            }
        }
        
        if (syncResults.length === 0) {
            throw new Error('All synchronization attempts failed');
        }
        
        // Calculate best offset from multiple attempts
        this.calculateBestOffset(syncResults);
        
        // Store in history
        this.addToSyncHistory({
            timestamp: Date.now(),
            offset: this.serverTimeOffset,
            latency: this.networkLatency,
            attempts: syncResults.length
        });
        
        console.log(`✅ Sync complete: offset ${this.serverTimeOffset}ms, latency ${this.networkLatency}ms`);
    }
    
    // Single synchronization attempt
    async singleSyncAttempt() {
        const startTime = performance.now();
        const clientTime = Date.now();
        
        try {
            // Call server time endpoint
            const response = await fetch('http://localhost:8000/api/time', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const endTime = performance.now();
            const networkLatency = (endTime - startTime) / 2;
            
            if (!response.ok) {
                throw new Error(`Server time request failed: ${response.status}`);
            }
            
            const data = await response.json();
            const serverTime = data.timestamp;
            const receiveTime = Date.now();
            
            // Calculate offset accounting for network latency
            const adjustedServerTime = serverTime + networkLatency;
            const offset = adjustedServerTime - receiveTime;
            
            return {
                offset: offset,
                latency: networkLatency,
                serverTime: serverTime,
                clientTime: clientTime,
                receiveTime: receiveTime,
                roundTripTime: endTime - startTime
            };
            
        } catch (error) {
            console.error('❌ Sync attempt failed:', error);
            throw error;
        }
    }
    
    // Calculate best offset from multiple sync attempts
    calculateBestOffset(syncResults) {
        if (syncResults.length === 1) {
            this.serverTimeOffset = syncResults[0].offset;
            this.networkLatency = syncResults[0].latency;
            return;
        }
        
        // Sort by latency (prefer lower latency results)
        syncResults.sort((a, b) => a.latency - b.latency);
        
        // Use median offset for stability
        const offsets = syncResults.map(r => r.offset);
        const latencies = syncResults.map(r => r.latency);
        
        this.serverTimeOffset = this.calculateMedian(offsets);
        this.networkLatency = this.calculateMedian(latencies);
        
        // PRD: Check variance requirement
        const maxOffset = Math.max(...offsets);
        const minOffset = Math.min(...offsets);
        const variance = maxOffset - minOffset;
        
        if (variance > this.maxVariance) {
            console.warn(`⚠️ Timer variance (${variance}ms) exceeds PRD limit (${this.maxVariance}ms)`);
        } else {
            console.log(`✅ Timer variance (${variance}ms) within PRD limit (${this.maxVariance}ms)`);
        }
    }
    
    // Calculate median value
    calculateMedian(array) {
        const sorted = [...array].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        } else {
            return sorted[middle];
        }
    }
    
    // Start periodic synchronization
    startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            try {
                await this.performSync();
            } catch (error) {
                console.error('❌ Periodic sync failed:', error);
            }
        }, this.syncFrequency);
        
        console.log(`⏰ Periodic sync started (every ${this.syncFrequency / 1000}s)`);
    }
    
    // Get synchronized timestamp
    getSynchronizedTime() {
        if (!this.isInitialized) {
            console.warn('⚠️ Timer sync not initialized, using local time');
            return Date.now();
        }
        
        return Date.now() + this.serverTimeOffset;
    }
    
    // Get high-precision synchronized timestamp
    getHighPrecisionSyncTime() {
        if (!this.isInitialized) {
            return performance.now();
        }
        
        return performance.now() + this.serverTimeOffset;
    }
    
    // Schedule synchronized event
    scheduleSynchronizedEvent(callback, delay, eventName = 'event') {
        const syncTime = this.getSynchronizedTime();
        const targetTime = syncTime + delay;
        const localTargetTime = targetTime - this.serverTimeOffset;
        const localDelay = localTargetTime - Date.now();
        
        console.log(`⏰ Scheduling ${eventName} in ${delay}ms (local delay: ${localDelay}ms)`);
        
        if (localDelay <= 0) {
            // Execute immediately if time has passed
            callback();
        } else {
            setTimeout(callback, localDelay);
        }
        
        return {
            syncTime: syncTime,
            targetTime: targetTime,
            localDelay: localDelay
        };
    }
    
    // PRD: Synchronize game start between players
    async synchronizeGameStart(players, startDelay = 3000) {
        console.log('🎮 Synchronizing game start...');
        
        const syncTime = this.getSynchronizedTime();
        const gameStartTime = syncTime + startDelay;
        
        // Notify all players of synchronized start time
        const syncMessage = {
            type: 'synchronized-start',
            startTime: gameStartTime,
            delay: startDelay,
            timestamp: syncTime
        };
        
        // Send to all players (implementation depends on connection type)
        if (typeof webrtcP2PManager !== 'undefined' && webrtcP2PManager) {
            webrtcP2PManager.sendGameMessage(syncMessage);
        }
        
        // Schedule local start
        return this.scheduleSynchronizedEvent(() => {
            this.handleSynchronizedGameStart();
        }, startDelay, 'game start');
    }
    
    // Handle synchronized game start
    handleSynchronizedGameStart() {
        console.log('🎮 Synchronized game start triggered');
        
        if (typeof gameState !== 'undefined') {
            gameState.gameStarted = true;
            gameState.gameStartTime = this.getSynchronizedTime();
        }
        
        if (typeof startGameTimer === 'function') {
            startGameTimer();
        }
        
        if (typeof showNotification === 'function') {
            showNotification('🎮 Game started! (Synchronized)', 'success', 2000);
        }
    }
    
    // Add sync result to history
    addToSyncHistory(syncData) {
        this.syncHistory.push(syncData);
        
        // Keep only recent history
        if (this.syncHistory.length > this.maxHistorySize) {
            this.syncHistory.shift();
        }
        
        this.lastSyncTime = Date.now();
    }
    
    // Get synchronization statistics
    getSyncStats() {
        if (this.syncHistory.length === 0) {
            return {
                initialized: this.isInitialized,
                currentOffset: this.serverTimeOffset,
                currentLatency: this.networkLatency,
                lastSync: this.lastSyncTime,
                history: []
            };
        }
        
        const offsets = this.syncHistory.map(h => h.offset);
        const latencies = this.syncHistory.map(h => h.latency);
        
        return {
            initialized: this.isInitialized,
            currentOffset: this.serverTimeOffset,
            currentLatency: this.networkLatency,
            lastSync: this.lastSyncTime,
            averageOffset: offsets.reduce((a, b) => a + b, 0) / offsets.length,
            averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            maxOffset: Math.max(...offsets),
            minOffset: Math.min(...offsets),
            offsetVariance: Math.max(...offsets) - Math.min(...offsets),
            syncCount: this.syncHistory.length,
            withinPRDVariance: (Math.max(...offsets) - Math.min(...offsets)) <= this.maxVariance,
            history: this.syncHistory
        };
    }
    
    // PRD: Validate timer synchronization quality
    validateSyncQuality() {
        const stats = this.getSyncStats();
        
        const issues = [];
        
        if (!stats.initialized) {
            issues.push('Timer synchronization not initialized');
        }
        
        if (stats.offsetVariance > this.maxVariance) {
            issues.push(`Offset variance (${stats.offsetVariance}ms) exceeds PRD limit (${this.maxVariance}ms)`);
        }
        
        if (stats.currentLatency > 500) {
            issues.push(`High network latency (${stats.currentLatency}ms) may affect sync quality`);
        }
        
        if (this.lastSyncTime && (Date.now() - this.lastSyncTime) > this.syncFrequency * 2) {
            issues.push('Synchronization is overdue');
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            stats: stats
        };
    }
    
    // Stop synchronization
    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.isInitialized = false;
        console.log('⏰ Timer synchronization stopped');
    }
    
    // Restart synchronization
    async restart() {
        console.log('⏰ Restarting timer synchronization...');
        this.stop();
        await this.initialize();
    }
}

// Global timer sync manager instance
let timerSyncManager = null;

// Initialize timer synchronization
async function initializeTimerSync() {
    if (!timerSyncManager) {
        timerSyncManager = new TimerSynchronizationManager();
        await timerSyncManager.initialize();
        console.log('✅ Timer Synchronization Manager initialized');
    }
    return timerSyncManager;
}

// Get synchronized time (convenience function)
function getSyncTime() {
    if (timerSyncManager) {
        return timerSyncManager.getSynchronizedTime();
    }
    return Date.now();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TimerSynchronizationManager, initializeTimerSync, getSyncTime };
} 