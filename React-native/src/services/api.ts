import axios from 'axios';
import { Platform } from 'react-native';
// Note: We'll import the store dynamically or after it's defined to avoid circular dependency
// But for now, let's assume standard import if potential for circularity is low
import { useAuthStore } from '../store/authStore';

// Use your machine's local IP to connect from simulators and physical devices
// Machine IP: 192.168.8.248
const DEV_MACHINE_IP = '192.168.8.248';
export const BASE_URL = `http://${DEV_MACHINE_IP}:8000`;

const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor
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

import { getFriendlyError } from '../utils/errorMapping';

// Add response interceptor
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const { useErrorStore } = require('../store/errorStore');
        const show = useErrorStore.getState().showError;

        const friendlyError = getFriendlyError(error);

        // Show the message, and optional description if severity is error
        const fullMessage = friendlyError.description
            ? `${friendlyError.message}: ${friendlyError.description}`
            : friendlyError.message;

        const severity = error.response?.status >= 500 || !error.response ? 'error' : 'warning';

        show(fullMessage, severity);

        return Promise.reject(error);
    }
);

export interface User {
    id: string;
    username: string;
    email?: string;
    coin_balance?: number;
    diamonds_balance?: number;
    total_wins?: number;
    total_games?: number;
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

export const apiService = {
    // Auth
    register: async (data: any) => {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },
    login: async (data: any) => {
        const response = await apiClient.post('/auth/login', data);
        return response.data;
    },
    verifyToken: async (token: string) => {
        const response = await apiClient.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    },

    // Games
    createGame: async (playerData: any) => {
        const response = await apiClient.post('/games', playerData);
        return response.data;
    },
    getGame: async (gameId: string) => {
        const response = await apiClient.get(`/games/${gameId}`);
        return response.data;
    },
    setPoison: async (gameId: string, player: string, poisonChoice: string) => {
        const response = await apiClient.post(`/games/${gameId}/poison`, {
            player,
            poison_choice: poisonChoice,
        });
        return response.data;
    },
    pickCandy: async (gameId: string, player: string, candyChoice: string) => {
        const response = await apiClient.post(`/games/${gameId}/pick`, {
            player,
            candy_choice: candyChoice,
        });
        return response.data;
    },

    // Players & Friends
    getPlayerStats: async (playerName: string) => {
        const response = await apiClient.get(`/players/${playerName}/stats`);
        return response.data;
    },
    getFriends: async (playerName: string) => {
        const response = await apiClient.get(`/players/${playerName}/friends`);
        return response.data;
    },
    addFriend: async (playerName: string, profileId: string) => {
        const response = await apiClient.post('/players/friends/add', {
            player_name: playerName,
            friend_profile_id: profileId,
        });
        return response.data;
    },
    getProfileById: async (profileId: string) => {
        const response = await apiClient.get(`/players/profile/${profileId}`);
        return response.data;
    },
    getLeaderboard: async (sortBy: string = 'wins', limit: number = 20) => {
        const response = await apiClient.get(`/leaderboard/${sortBy}?limit=${limit}`);
        return response.data;
    },
    getQuests: async (playerName: string) => {
        const response = await apiClient.get(`/players/${playerName}/quests`);
        return response.data;
    },
    claimQuest: async (playerName: string, questId: string) => {
        const response = await apiClient.post('/players/quests/claim', {
            player_name: playerName,
            quest_id: questId,
        });
        return response.data;
    },
    updatePlayerStats: async (data: { player_name: string, won: boolean }) => {
        const response = await apiClient.post('/players/stats', data);
        return response.data;
    },
    getBalance: async (playerName: string) => {
        const response = await apiClient.post('/players/balance', { player_name: playerName });
        return response.data;
    },
    getGameConfig: async () => {
        const response = await apiClient.get('/api/config');
        return response.data;
    },
    getAIMove: async (data: { player_candies: string[], opponent_collection: string[], player_poison: string, difficulty: string }) => {
        const response = await apiClient.post('/ai/move', data);
        return response.data;
    },

    // Health
    checkHealth: async () => {
        try {
            const response = await apiClient.get('/health');
            return response.data;
        } catch (error) {
            return { status: 'offline' };
        }
    },
};

export default apiClient;
