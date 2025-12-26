import axios from 'axios';
import { Platform } from 'react-native';

// Use local IP for physical devices if needed, or localhost for simulator
export const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface User {
    id: string;
    username: string;
    email?: string;
    balance?: number;
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
