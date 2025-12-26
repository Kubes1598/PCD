import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Transaction {
    type: 'earn' | 'spend';
    currency: 'coins' | 'diamonds';
    amount: number;
    description: string;
    timestamp: number;
}

interface CurrencyState {
    coins: number;
    diamonds: number;
    dailyStreak: number;
    lastClaimTimestamp: number;
    transactions: Transaction[];

    // Actions
    addCoins: (amount: number, description: string) => void;
    spendCoins: (amount: number, description: string) => boolean;
    addDiamonds: (amount: number, description: string) => void;
    spendDiamonds: (amount: number, description: string) => boolean;
    claimDailyReward: () => { coins: number; diamonds: number; streak: number } | null;
    canClaimDailyReward: () => boolean;
}

export const useCurrencyStore = create<CurrencyState>()(
    persist(
        (set, get) => ({
            coins: 10000,
            diamonds: 500,
            dailyStreak: 0,
            lastClaimTimestamp: 0,
            transactions: [],

            addCoins: (amount, description) => {
                const newTransaction: Transaction = {
                    type: 'earn',
                    currency: 'coins',
                    amount,
                    description,
                    timestamp: Date.now(),
                };
                set((state) => ({
                    coins: state.coins + amount,
                    transactions: [newTransaction, ...state.transactions].slice(0, 50),
                }));
            },

            spendCoins: (amount, description) => {
                const { coins } = get();
                if (coins < amount) return false;

                const newTransaction: Transaction = {
                    type: 'spend',
                    currency: 'coins',
                    amount,
                    description,
                    timestamp: Date.now(),
                };
                set((state) => ({
                    coins: state.coins - amount,
                    transactions: [newTransaction, ...state.transactions].slice(0, 50),
                }));
                return true;
            },

            addDiamonds: (amount, description) => {
                const newTransaction: Transaction = {
                    type: 'earn',
                    currency: 'diamonds',
                    amount,
                    description,
                    timestamp: Date.now(),
                };
                set((state) => ({
                    diamonds: state.diamonds + amount,
                    transactions: [newTransaction, ...state.transactions].slice(0, 50),
                }));
            },

            spendDiamonds: (amount, description) => {
                const { diamonds } = get();
                if (diamonds < amount) return false;

                const newTransaction: Transaction = {
                    type: 'spend',
                    currency: 'diamonds',
                    amount,
                    description,
                    timestamp: Date.now(),
                };
                set((state) => ({
                    diamonds: state.diamonds - amount,
                    transactions: [newTransaction, ...state.transactions].slice(0, 50),
                }));
                return true;
            },

            canClaimDailyReward: () => {
                const now = Date.now();
                const lastClaim = get().lastClaimTimestamp;
                const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
                return hoursSinceLastClaim >= 24;
            },

            claimDailyReward: () => {
                if (!get().canClaimDailyReward()) return null;

                const { dailyStreak } = get();
                const now = Date.now();
                const lastClaim = get().lastClaimTimestamp;

                // If last claim was more than 48 hours ago, reset streak
                let newStreak = dailyStreak + 1;
                if ((now - lastClaim) / (1000 * 60 * 60) > 48) {
                    newStreak = 1;
                }

                const coinsReward = 100 + (newStreak * 20);
                const diamondsReward = 5 + Math.floor(newStreak / 2);

                const { addCoins, addDiamonds } = get();
                addCoins(coinsReward, `Daily Reward (Day ${newStreak})`);
                addDiamonds(diamondsReward, `Daily Reward (Day ${newStreak})`);

                set({
                    dailyStreak: newStreak,
                    lastClaimTimestamp: now,
                });

                return { coins: coinsReward, diamonds: diamondsReward, streak: newStreak };
            },
        }),
        {
            name: 'pcd-currency-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
