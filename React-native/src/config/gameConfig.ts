/**
 * Game Configuration - Single Source of Truth
 * 
 * This file centralizes all game constants to prevent frontend/backend desync.
 * TODO: Fetch these values from /api/config at app startup for full backend authority.
 */

// Win Condition
export const WIN_THRESHOLD = 11; // Collect 11 candies to win
export const CANDY_COUNT = 12;   // Each player has 12 candies (4x3 grid)

// City/Arena Configuration
export const CITY_CONFIG = {
    Dubai: {
        entryFee: 500,
        prizeAmount: 900,
        turnTimer: 30,
        difficulty: 'easy' as const,
    },
    Cairo: {
        entryFee: 1000,
        prizeAmount: 1800,
        turnTimer: 20,
        difficulty: 'medium' as const,
    },
    Oslo: {
        entryFee: 5000,
        prizeAmount: 9000,
        turnTimer: 10,
        difficulty: 'hard' as const,
    },
} as const;

export type CityName = keyof typeof CITY_CONFIG;

// AI Mode Configuration  
export const AI_CONFIG = {
    easy: { entryFee: 0, prizeAmount: 0 },
    medium: { entryFee: 100, prizeAmount: 180 },
    hard: { entryFee: 250, prizeAmount: 450 },
} as const;

export type Difficulty = keyof typeof AI_CONFIG;

// Initial Player Balances
export const INITIAL_BALANCE = {
    coins: 1000,
    diamonds: 5,
};

// Daily Reward Stages
export const DAILY_REWARDS = [
    { coins: 100, diamonds: 0 },
    { coins: 200, diamonds: 0 },
    { coins: 500, diamonds: 0 },
    { coins: 1000, diamonds: 0 },
    { coins: 0, diamonds: 5 },
];

// Ranking Thresholds
export const RANK_THRESHOLDS = {
    Pro: 10,
    WorldClass: 40,
    Legendary: 100,
    Champion: 200,
};
