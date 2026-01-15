/**
 * API Service - Production Ready
 * 
 * Handles all HTTP communication with the backend.
 * Includes proper error handling and token management.
 */

import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { getFriendlyError, isAuthError } from '../utils/errorMapping';

// Use your machine's local IP to connect from simulators and physical devices
const DEV_MACHINE_IP = '192.168.8.248';
export const BASE_URL = `http://${DEV_MACHINE_IP}:8000`;

const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 15000, // 15 seconds
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Request Interceptor - Add auth token to all requests
 */
apiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Response Interceptor - Handle errors globally with token refresh
 */
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Import error store dynamically to avoid circular dependency
        const { useErrorStore } = require('../store/errorStore');
        const showError = useErrorStore.getState().showError;
        const originalRequest = error.config;

        // Handle 401 - Token expired/invalid
        if (isAuthError(error)) {
            const authStore = useAuthStore.getState();

            // Only attempt refresh if we had a token and haven't already retried
            if (authStore.token && !originalRequest._retry) {
                originalRequest._retry = true;

                // Try to refresh the token
                const refreshToken = authStore.refreshToken;
                if (refreshToken) {
                    try {
                        console.log('🔄 Attempting to refresh token...');
                        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
                            refresh_token: refreshToken
                        });

                        if (response.data?.success && response.data?.data?.token) {
                            const newToken = response.data.data.token;

                            // Update the stored token
                            authStore.setToken(newToken);

                            // Retry the original request with new token
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            console.log('✅ Token refreshed successfully, retrying request...');
                            return apiClient(originalRequest);
                        }
                    } catch (refreshError) {
                        console.log('❌ Token refresh failed:', refreshError);
                    }
                }

                // Refresh failed or no refresh token - logout
                console.log('🔒 Token refresh failed. Logging out...');
                authStore.logout();
                showError('Your session expired. Please log in again.', 'warning');
            }

            return Promise.reject(error);
        }

        // Get user-friendly error message
        const friendlyError = getFriendlyError(error);

        // Determine severity based on status
        const status = error.response?.status;
        let severity: 'error' | 'warning' | 'info' = 'warning';

        if (!error.response || status >= 500) {
            severity = 'error';
        } else if (status === 429) {
            severity = 'info'; // Rate limiting is informational
        }

        // Show error to user
        const message = friendlyError.description
            ? `${friendlyError.message}: ${friendlyError.description}`
            : friendlyError.message;

        showError(message, severity);

        return Promise.reject(error);
    }
);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface User {
    id: string;
    username: string;
    name?: string;
    email?: string;
    coin_balance?: number;
    diamonds_balance?: number;
    games_played?: number;
    games_won?: number;
    profile_id?: string;
    rank?: string;
    tier?: string;
}

export interface Game {
    id: string;
    player1_name: string;
    player2_name: string;
    player1_candies: string[];
    player2_candies: string[];
    status: string;
    created_at: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error_code?: string;
}

// =============================================================================
// API SERVICE
// =============================================================================

export const apiService = {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================

    register: async (data: { email: string; password: string; username: string; initial_coins?: number; initial_diamonds?: number }): Promise<ApiResponse> => {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },

    login: async (data: { email: string; password: string }): Promise<ApiResponse> => {
        const response = await apiClient.post('/auth/login', data);
        return response.data;
    },

    logout: async (): Promise<ApiResponse> => {
        try {
            const response = await apiClient.post('/auth/logout');
            return response.data;
        } catch (error) {
            // Even if logout fails on server, clear local state
            return { success: true, message: 'Logged out locally' };
        }
    },

    verifyToken: async (token: string): Promise<ApiResponse> => {
        const response = await apiClient.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    },

    refreshToken: async (refreshToken: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/auth/refresh', {
            refresh_token: refreshToken,
        });
        return response.data;
    },

    // =========================================================================
    // OAUTH AUTHENTICATION
    // =========================================================================

    /**
     * Check which OAuth providers are configured on the backend.
     * Frontend uses this to show/hide OAuth buttons.
     */
    getOAuthStatus: async (): Promise<ApiResponse<{ google: boolean; apple: boolean; email: boolean; guest: boolean }>> => {
        try {
            const response = await apiClient.get('/auth/oauth/status');
            return response.data;
        } catch (error) {
            // Fallback if endpoint doesn't exist
            return { success: true, message: '', data: { google: false, apple: false, email: true, guest: true } };
        }
    },

    /**
     * Authenticate with Google ID token.
     * @param idToken - Google ID token from Google Sign-In SDK
     */
    googleAuth: async (idToken: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/auth/google', { id_token: idToken });
        return response.data;
    },

    /**
     * Authenticate with Apple Sign-In.
     * @param identityToken - Apple identity token
     * @param authorizationCode - Apple authorization code
     * @param user - User info (only available on first sign-in)
     */
    appleAuth: async (identityToken: string, authorizationCode: string, user?: { name?: { firstName?: string; lastName?: string }; email?: string }): Promise<ApiResponse> => {
        const response = await apiClient.post('/auth/apple', {
            identity_token: identityToken,
            authorization_code: authorizationCode,
            user,
        });
        return response.data;
    },

    /**
     * Create a guest session.
     * Guest users can play online and see leaderboards but not access quests.
     */
    guestAuth: async (deviceId?: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/auth/guest', { device_id: deviceId });
        return response.data;
    },

    // =========================================================================
    // GAMES
    // =========================================================================

    createGame: async (playerData: { player1_name: string; player2_name: string }): Promise<ApiResponse> => {
        const response = await apiClient.post('/games', playerData);
        return response.data;
    },

    getGame: async (gameId: string): Promise<ApiResponse> => {
        const response = await apiClient.get(`/games/${gameId}/state`);
        return response.data;
    },

    setPoison: async (gameId: string, playerId: string, poisonChoice: string): Promise<ApiResponse> => {
        const response = await apiClient.post(`/games/${gameId}/poison`, {
            player_id: playerId,
            poison_candy: poisonChoice,
        });
        return response.data;
    },

    pickCandy: async (gameId: string, player: string, candyChoice: string): Promise<ApiResponse> => {
        const response = await apiClient.post(`/games/${gameId}/pick`, {
            player,
            candy_choice: candyChoice,
        });
        return response.data;
    },

    getGameStatus: async (gameId: string): Promise<ApiResponse> => {
        const response = await apiClient.get(`/games/status/${gameId}`);
        return response.data;
    },

    startGame: async (gameId: string, playerId: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/games/start', {
            game_id: gameId,
            player_id: playerId,
        });
        return response.data;
    },

    // =========================================================================
    // PLAYERS & SOCIAL
    // =========================================================================

    getPlayerStats: async (playerName: string): Promise<ApiResponse> => {
        const response = await apiClient.get(`/players/${encodeURIComponent(playerName)}/stats`);
        return response.data;
    },

    getFriends: async (playerName: string): Promise<ApiResponse> => {
        const response = await apiClient.get(`/players/${encodeURIComponent(playerName)}/friends`);
        return response.data;
    },

    addFriend: async (playerName: string, profileId: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/players/friends/add', {
            player_name: playerName,
            friend_profile_id: profileId,
        });
        return response.data;
    },

    getProfileById: async (profileId: string): Promise<ApiResponse> => {
        const response = await apiClient.get(`/players/profile/${encodeURIComponent(profileId)}`);
        return response.data;
    },

    getLeaderboard: async (sortBy: string = 'wins', limit: number = 20): Promise<ApiResponse> => {
        const response = await apiClient.get(`/players/leaderboard/${sortBy}?limit=${limit}`);
        return response.data;
    },

    getQuests: async (playerName: string): Promise<ApiResponse> => {
        const response = await apiClient.get(`/players/${encodeURIComponent(playerName)}/quests`);
        return response.data;
    },

    claimQuest: async (playerName: string, questId: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/players/quests/claim', {
            player_name: playerName,
            quest_id: questId,
        });
        return response.data;
    },

    updatePlayerStats: async (data: { player_name: string; won: boolean }): Promise<ApiResponse> => {
        const response = await apiClient.post('/players/stats', data);
        return response.data;
    },

    getBalance: async (playerName: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/players/balance', {
            player_name: playerName
        });
        return response.data;
    },

    // =========================================================================
    // MATCHMAKING
    // =========================================================================

    joinMatchmaking: async (playerName: string, city: string): Promise<ApiResponse> => {
        const response = await apiClient.post('/matchmaking/join', {
            player_name: playerName,
            city: city,
        });
        return response.data;
    },

    leaveMatchmaking: async (playerId: string): Promise<ApiResponse> => {
        const response = await apiClient.post(`/matchmaking/leave/${playerId}`);
        return response.data;
    },

    getMatchmakingStatus: async (): Promise<ApiResponse> => {
        const response = await apiClient.get('/matchmaking/status');
        return response.data;
    },

    // =========================================================================
    // AI & CONFIG
    // =========================================================================

    getGameConfig: async (): Promise<any> => {
        try {
            const response = await apiClient.get('/api/config');
            return response.data;
        } catch (error) {
            // Return default config if endpoint not available
            console.log('Using default game config');
            return null;
        }
    },

    getAIMove: async (data: {
        player_candies: string[];
        opponent_collection: string[];
        player_poison: string;
        difficulty: string;
    }): Promise<any> => {
        const response = await apiClient.post('/ai/move', data);
        return response.data;
    },

    // =========================================================================
    // HEALTH
    // =========================================================================

    checkHealth: async (): Promise<{ status: string }> => {
        try {
            const response = await apiClient.get('/health');
            return response.data;
        } catch (error) {
            return { status: 'offline' };
        }
    },
};

export default apiClient;
