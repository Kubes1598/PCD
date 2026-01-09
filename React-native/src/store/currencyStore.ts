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
    dailyRewardStage: number;
    lastClaimTimestamp: number;
    transactions: Transaction[];

    // Actions
    addCoins: (amount: number, description: string) => void;
    spendCoins: (amount: number, description: string) => boolean;
    addDiamonds: (amount: number, description: string) => void;
    spendDiamonds: (amount: number, description: string) => boolean;
    claimDailyReward: () => { coins: number; diamonds: number; nextStage: number, cycleCompleted: boolean } | null;
    canClaimDailyReward: () => boolean;
    setBalances: (coins: number, diamonds: number) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
    persist(
        (set, get) => ({
            coins: 1000,
            diamonds: 5,
            dailyStreak: 0,
            dailyRewardStage: 1,
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
                const { dailyRewardStage, lastClaimTimestamp } = get();
                // If we are in the middle of a stage (2-5), we can always claim.
                if (dailyRewardStage > 1) return true;

                // Stage 1: Check 24h cooldown
                const now = Date.now();
                const hoursSinceLastClaim = (now - lastClaimTimestamp) / (1000 * 60 * 60);
                return hoursSinceLastClaim >= 24;
            },

            claimDailyReward: () => {
                if (!get().canClaimDailyReward()) return null;

                const { dailyRewardStage, lastClaimTimestamp } = get();
                const now = Date.now();

                // stage rewards: 100, 200, 500, 1000 coins, 5 diamonds
                const rewards = [100, 200, 500, 1000, 5];
                const amount = rewards[dailyRewardStage - 1];
                const isDiamond = dailyRewardStage === 5;

                const { addCoins, addDiamonds } = get();
                if (isDiamond) {
                    addDiamonds(amount, `Daily Reward Stage ${dailyRewardStage}`);
                } else {
                    addCoins(amount, `Daily Reward Stage ${dailyRewardStage}`);
                }

                const cycleCompleted = dailyRewardStage === 5;
                const nextStage = cycleCompleted ? 1 : dailyRewardStage + 1;

                set({
                    dailyRewardStage: nextStage,
                    lastClaimTimestamp: cycleCompleted ? now : lastClaimTimestamp,
                });

                return {
                    coins: isDiamond ? 0 : amount,
                    diamonds: isDiamond ? amount : 0,
                    nextStage,
                    cycleCompleted
                };
            },

            setBalances: (coins, diamonds) => {
                set({ coins, diamonds });
            },
        }),
        {
            name: 'pcd-currency-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
