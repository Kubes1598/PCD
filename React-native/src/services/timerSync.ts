import { BASE_URL } from './api';

class TimerSyncService {
    private offset: number = 0;
    private isInitialized: boolean = false;

    async initialize() {
        try {
            const startTime = Date.now();
            const response = await fetch(`${BASE_URL}/health`); // Assuming health returns server time or similar
            const endTime = Date.now();

            // If the API doesn't return server time, we can't do full NTP, 
            // but we can estimate round trip and assume server is relatively synced.
            // For now, let's assume local time is master or we get it from a header.

            const serverTimeHeader = response.headers.get('Date');
            if (serverTimeHeader) {
                const serverTime = new Date(serverTimeHeader).getTime();
                const latency = (endTime - startTime) / 2;
                this.offset = (serverTime + latency) - endTime;
            }

            this.isInitialized = true;
            console.log('⏰ Timer sync initialized with offset:', this.offset);
        } catch (error) {
            console.warn('❌ Timer sync failed, falling back to local time');
        }
    }

    getSyncTime() {
        return Date.now() + this.offset;
    }
}

export const timerSyncService = new TimerSyncService();
