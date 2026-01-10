import { create } from 'zustand';
import { Alert } from 'react-native';
import { apiService } from '../services/api';
import { generateCandyPool } from '../services/candyPool';
import { webSocketService, MatchmakingMessage } from '../services/WebSocketService';
import { feedbackService } from '../services/FeedbackService';
import { useCurrencyStore } from './currencyStore';
import { useAuthStore } from './authStore';
import { WIN_THRESHOLD, CANDY_COUNT, CITY_CONFIG, AI_CONFIG, CityName, Difficulty } from '../config/gameConfig';

export type GameMode = 'ai' | 'online' | 'friends' | 'offline';

interface GameProgress {
    playerReached11First: boolean;
    opponentReached11First: boolean;
    playerGotChance: boolean;
    opponentGotChance: boolean;
    gamePhase: 'normal' | 'player_reached_11' | 'opponent_reached_11' | 'both_reached_11';
}

interface GameState {
    gameId: string | null;
    gameMode: GameMode;
    difficulty: Difficulty;
    selectedCity: CityName | null;
    isPlayerTurn: boolean;
    gameStarted: boolean;
    gameEnded: boolean;
    gameWinner: 'player' | 'opponent' | 'draw' | null;
    winReason: 'poison' | 'collection' | 'timeout' | 'disconnect' | null;

    playerCandies: string[];
    opponentCandies: string[];
    playerCollection: string[];
    opponentCollection: string[];

    selectedPoison: string | null;
    opponentPoison: string | null;

    playerScore: number;
    opponentScore: number;

    turnTimeRemaining: number;
    gameProgress: GameProgress;
    isSearching: boolean;
    queuePosition: number;
    totalWaiting: number;
    lastReward: number;
    opponentId: string | null;
    isReconnecting: boolean;
    matchFound: boolean;
    isSettingPoisonFor: 'player' | 'opponent' | null;
    searchTimeout?: NodeJS.Timeout | null;

    // Dynamic Config (fetched from backend)
    config: {
        winThreshold: number;
        candyCount: number;
        cityConfig: typeof CITY_CONFIG;
        aiConfig: typeof AI_CONFIG;
    };

    // Actions
    loadConfig: () => Promise<void>;
    initGame: (mode: GameMode, difficulty?: Difficulty, city?: CityName) => Promise<void>;
    startSearching: (arena?: CityName) => void;
    stopSearching: () => void;
    setPoison: (candy: string) => Promise<void>;
    pickCandy: (candy: string, isRemote?: boolean) => Promise<void>;
    resetGame: () => void;
    tickTimer: () => void;
    setIsReconnecting: (val: boolean) => void;
}

const DEFAULT_PROGRESS: GameProgress = {
    playerReached11First: false,
    opponentReached11First: false,
    playerGotChance: false,
    opponentGotChance: false,
    gamePhase: 'normal',
};

const checkWinCondition = (state: GameState): {
    hasWinner: boolean;
    winner?: 'player' | 'opponent' | 'draw';
    isDraw?: boolean;
    switchToPlayer?: boolean;
    switchToOpponent?: boolean;
    message: string;
} => {
    const p1Count = state.playerCollection.length;
    const p2Count = state.opponentCollection.length;
    const { winThreshold } = state.config;

    // A draw occurs IF both have winThreshold candies
    if (p1Count === winThreshold && p2Count === winThreshold) {
        return { hasWinner: true, winner: 'draw', isDraw: true, message: `🤝 It's a DRAW! Both collected ${winThreshold} candies.` };
    }

    // If one player reaches winThreshold, the other gets a final chance IF they can still reach winThreshold
    if (p1Count === winThreshold || p2Count === winThreshold) {
        const whoReached11 = p1Count === winThreshold ? 'player' : 'opponent';
        const loserCount = p1Count === winThreshold ? p2Count : p1Count;

        // Count how many safe candies remain in the OTHER player's pool
        const otherPool = p1Count === winThreshold ? state.playerCandies : state.opponentCandies;
        const otherCollection = p1Count === winThreshold ? state.opponentCollection : state.playerCollection;
        const poison = p1Count === winThreshold ? state.selectedPoison : state.opponentPoison;

        const remainingSafeInOtherPool = otherPool.filter(c => !otherCollection.includes(c) && c !== poison).length;

        if (loserCount + remainingSafeInOtherPool >= winThreshold) {
            // Still possible to draw
            return {
                hasWinner: false,
                switchToOpponent: whoReached11 === 'player',
                switchToPlayer: whoReached11 === 'opponent',
                message: whoReached11 === 'player' ? `Player 1 reached ${winThreshold}! Player 2 final chance...` : `Player 2 reached ${winThreshold}! Player 1 final chance...`
            };
        } else {
            // Impossible to reach winThreshold
            return {
                hasWinner: true,
                winner: whoReached11,
                message: whoReached11 === 'player' ? `🎉 Player 1 Wins! Collected ${winThreshold} candies.` : `🎉 Player 2 Wins! Collected ${winThreshold} candies.`
            };
        }
    }

    return { hasWinner: false, message: "Game continues..." };
};

export const useGameStore = create<GameState>((set, get) => ({
    gameId: null,
    gameMode: 'ai',
    difficulty: 'easy',
    selectedCity: null,
    isPlayerTurn: true,
    gameStarted: false,
    gameEnded: false,
    gameWinner: null,
    winReason: null,
    playerCandies: [],
    opponentCandies: [],
    playerCollection: [],
    opponentCollection: [],
    selectedPoison: null,
    opponentPoison: null,
    playerScore: 0,
    opponentScore: 0,
    turnTimeRemaining: 30, // Standard 30s turn
    gameProgress: { ...DEFAULT_PROGRESS },
    isSearching: false,
    queuePosition: 0,
    totalWaiting: 0,
    lastReward: 0,
    isSettingPoisonFor: null,
    opponentId: null,
    isReconnecting: false,
    matchFound: false,
    config: {
        winThreshold: WIN_THRESHOLD,
        candyCount: CANDY_COUNT,
        cityConfig: CITY_CONFIG,
        aiConfig: AI_CONFIG,
    },

    loadConfig: async () => {
        try {
            const data = await apiService.getGameConfig();
            if (data) {
                set((state) => ({
                    config: {
                        winThreshold: data.win_threshold || state.config.winThreshold,
                        candyCount: data.candy_count || state.config.candyCount,
                        cityConfig: data.city_config || state.config.cityConfig,
                        aiConfig: data.ai_config || state.config.aiConfig,
                    }
                }));
            }
        } catch (error) {
            console.error('Failed to load game config:', error);
        }
    },

    initGame: async (mode, difficulty = 'easy', city = 'Dubai') => {
        const { aiConfig, cityConfig } = get().config;
        // For online mode, the backend handles fee deduction authoritatively.
        // For AI mode, we deduct locally since there's no backend interaction.
        const fee = mode === 'ai' ? aiConfig[difficulty].entryFee : 0;
        const timerLimit = mode === 'online' ? cityConfig[city].turnTimer : 30;

        if (fee > 0) {
            const success = useCurrencyStore.getState().spendCoins(fee, `${mode.toUpperCase()} Entry Fee`);
            if (!success) return;
        }

        const { player, opponent } = generateCandyPool(city);

        set({
            gameMode: mode,
            difficulty,
            selectedCity: city,
            gameStarted: false,
            gameEnded: false,
            turnTimeRemaining: timerLimit,
            gameProgress: { ...DEFAULT_PROGRESS },
            playerCandies: player,
            opponentCandies: opponent,
            isSettingPoisonFor: 'player',
            selectedPoison: null,
            opponentPoison: null,
            playerCollection: [],
            opponentCollection: [],
            isPlayerTurn: true, // Always start with P1 turn
            matchFound: false,
        });

        // For AI mode, we'll randomize opponent poison later or now
        if (mode === 'ai') {
            set({ opponentPoison: opponent[Math.floor(Math.random() * opponent.length)] });
        }
    },

    startSearching: (arena = 'Dubai') => {
        const { cityConfig } = get().config;
        const cityInfo = cityConfig[arena];
        if (!cityInfo) return;

        const playerId = `player_${Date.now()}`;
        set({ isSearching: true, difficulty: cityInfo.difficulty });

        webSocketService.connect(playerId, (data: MatchmakingMessage) => {
            if (data.type === 'queue_status') {
                set({ queuePosition: data.position || 0, totalWaiting: data.total_waiting || 0 });
            } else if (data.type === 'match_found') {
                // Clear simulation timer if real match found
                const { searchTimeout } = get();
                if (searchTimeout) clearTimeout(searchTimeout);

                set({ matchFound: true });

                set({
                    isSearching: false,
                    gameId: data.game_id || null,
                    isPlayerTurn: data.your_role === 'player1',
                    playerCandies: data.game_state.player1.owned_candies,
                    opponentCandies: data.game_state.player2.owned_candies,
                    gameMode: 'online',
                    turnTimeRemaining: cityInfo.turnTimer,
                    isSettingPoisonFor: 'player',
                    opponentId: data.opponent_id || null
                });

                // Sync balance from backend (fee was deducted server-side)
                const user = useAuthStore.getState().user;
                if (user) {
                    apiService.getBalance(user.username).then((res: any) => {
                        if (res.success) {
                            useCurrencyStore.getState().setBalances(res.data.coin_balance, res.data.diamonds_balance);
                        }
                    }).catch(() => { });
                }
            } else if (data.type === 'match_poison') {
                set({ opponentPoison: data.candy });
                if (get().selectedPoison) {
                    set({ gameStarted: true, isSettingPoisonFor: null });
                }
            } else if (data.type === 'match_move') {
                get().pickCandy(data.move!, true); // true indicates it's a remote move
            } else if (data.type === 'opponent_disconnected') {
                feedbackService.triggerError();
                set({ gameEnded: true, gameWinner: 'player', gameStarted: false, winReason: 'disconnect' });
                alert('Opponent disconnected! You win by default.');
            } else if (data.type === 'timer_sync') {
                if (data.seconds !== undefined) {
                    set({ turnTimeRemaining: data.seconds });
                }
            } else if (data.type === 'timer_expired') {
                const { gameEnded } = get();
                if (!gameEnded) {
                    set({ turnTimeRemaining: 0 });
                }
            } else if (data.type === 'game_over') {
                const { user } = useAuthStore.getState();
                const isWinner = data.winner_id === user?.id;

                set({
                    gameEnded: true,
                    gameWinner: isWinner ? 'player' : 'opponent',
                    winReason: data.reason as any || 'collection',
                    gameStarted: false,
                    turnTimeRemaining: 0
                });

                if (data.reason === 'timeout') {
                    const message = isWinner
                        ? `You win! Opponent timed out. Prize: ${data.prize} coins.`
                        : "Game Over. You timed out.";
                    alert(message);
                }

                if (user) {
                    apiService.getBalance(user.username).then((res: any) => {
                        if (res.success) {
                            useCurrencyStore.getState().setBalances(res.data.coin_balance, res.data.diamonds_balance);
                        }
                    }).catch(() => { });
                }
            }
        }, (status) => {
            const { gameStarted, gameEnded } = get();
            if (status === 'connecting' && gameStarted && !gameEnded) {
                set({ isReconnecting: true });
            } else if (status === 'connected') {
                set({ isReconnecting: false });
                const player_name = useAuthStore.getState().user?.username || 'Guest';
                webSocketService.sendMessage({ type: 'join_queue', player_name, city: arena });
            }
        });

        // SIMULATED MATCHMAKING FALLBACK
        const timeout = setTimeout(() => {
            if (get().isSearching) {
                Alert.alert(
                    "No match found",
                    "We couldn't find a real opponent. Would you like to play against the AI to keep the fun going?",
                    [
                        {
                            text: "Keep Waiting",
                            style: "cancel"
                        },
                        {
                            text: "Play AI",
                            onPress: () => {
                                console.log('🤖 Starting simulated AI match.');
                                get().stopSearching();
                                get().initGame('ai', cityInfo.difficulty as any, arena);
                            }
                        }
                    ]
                );
            }
        }, 60000);

        // We'll need to store this timeout to clear it
        set({ searchTimeout: timeout });
    },

    stopSearching: () => {
        const { searchTimeout } = get();
        if (searchTimeout) clearTimeout(searchTimeout);

        webSocketService.sendMessage({ type: 'leave_queue' });
        webSocketService.disconnect();
        set({ isSearching: false, queuePosition: 0, totalWaiting: 0 });
    },

    setPoison: async (candy) => {
        const { gameMode, isSettingPoisonFor, opponentCandies, gameId, opponentId } = get();

        if (isSettingPoisonFor === 'player') {
            set({ selectedPoison: candy });

            if (gameMode === 'offline') {
                // Switch to Player 2 (Opponent) selection
                set({ isSettingPoisonFor: 'opponent' });
            } else {
                // Single player or Online
                set({ isSettingPoisonFor: null, gameStarted: true });
                if (gameMode === 'online' && opponentId) {
                    webSocketService.sendMessage({
                        type: 'match_poison',
                        target_id: opponentId,
                        candy: candy
                    });
                    // If we already have opponent poison (received via WS), start game
                    if (get().opponentPoison) {
                        set({ gameStarted: true, isSettingPoisonFor: null });
                    }
                }
            }
        } else if (isSettingPoisonFor === 'opponent') {
            set({
                opponentPoison: candy,
                isSettingPoisonFor: null,
                gameStarted: true
            });
        }
    },

    pickCandy: async (candy, isRemote = false) => {
        const state = get();
        if (state.gameEnded) return;

        const { opponentId } = state;

        let newPlayerCollection = [...state.playerCollection];
        let newOpponentCollection = [...state.opponentCollection];

        if (state.isPlayerTurn) {
            if (candy === state.opponentPoison) {
                feedbackService.triggerError();
                set({ gameEnded: true, gameWinner: 'opponent', winReason: 'poison' });
                return;
            }
            feedbackService.triggerSelection();
            if (!newPlayerCollection.includes(candy)) newPlayerCollection.push(candy);
        } else {
            if (candy === state.selectedPoison) {
                feedbackService.triggerSuccess();
                set({ gameEnded: true, gameWinner: 'player', winReason: 'poison' });
                return;
            }
            if (!newOpponentCollection.includes(candy)) newOpponentCollection.push(candy);
        }

        const winResult = checkWinCondition({ ...state, playerCollection: newPlayerCollection, opponentCollection: newOpponentCollection });

        if (winResult.hasWinner) {
            const winner = winResult.winner;
            if (winner === 'player') {
                feedbackService.triggerSuccess();
                const { aiConfig, cityConfig } = get().config;
                const prize = state.gameMode === 'online' && state.selectedCity ? cityConfig[state.selectedCity].prizeAmount : aiConfig[state.difficulty].prizeAmount;
                useCurrencyStore.getState().addCoins(prize, `Victory Reward (${state.gameMode})`);
                set({ lastReward: prize });

                // Report Win
                const auth = useAuthStore.getState();
                if (auth.user && !auth.isGuest) {
                    apiService.updatePlayerStats({ player_name: auth.user.username, won: true });
                }
            } else if (winner === 'draw') {
                set({ lastReward: 0 });
                // No prize for draw for now, or maybe 50%? Let's stay simple.
            } else {
                set({ lastReward: 0 });
                feedbackService.triggerError();
                // Report Loss
                const auth = useAuthStore.getState();
                if (auth.user && !auth.isGuest) {
                    apiService.updatePlayerStats({ player_name: auth.user.username, won: false });
                }
            }
            set({
                gameEnded: true,
                gameWinner: winner || null,
                opponentCollection: newOpponentCollection,
                winReason: winner === 'draw' ? null : 'collection'
            });
            return;
        }

        // Switch turns
        const nextPlayerTurn = winResult.switchToOpponent ? false : (winResult.switchToPlayer ? true : !state.isPlayerTurn);
        const timerLimits = { Dubai: 30, Cairo: 20, Oslo: 10 };
        const nextTimer = state.gameMode === 'online' && state.selectedCity ? timerLimits[state.selectedCity] : 30;

        set({
            playerCollection: newPlayerCollection,
            opponentCollection: newOpponentCollection,
            isPlayerTurn: nextPlayerTurn,
            turnTimeRemaining: nextTimer
        });

        // Send move to opponent if online and it's our turn
        if (state.gameMode === 'online' && state.opponentId && !isRemote) {
            webSocketService.sendMessage({
                type: 'match_move',
                target_id: state.opponentId,
                move: candy
            });
        }

        // AI Logic
        if (!nextPlayerTurn && state.gameMode === 'ai') {
            setTimeout(async () => {
                const s = get();
                if (s.gameEnded) return;

                try {
                    const result = await apiService.getAIMove({
                        player_candies: s.playerCandies,
                        opponent_collection: s.opponentCollection,
                        player_poison: s.selectedPoison!,
                        difficulty: s.difficulty
                    });

                    if (result && result.choice) {
                        get().pickCandy(result.choice);
                    }
                } catch (error) {
                    console.error("AI Error:", error);
                    // Fallback to random if AI fails
                    const avail = s.playerCandies.filter(c => !s.opponentCollection.includes(c));
                    if (avail.length > 0) {
                        get().pickCandy(avail[Math.floor(Math.random() * avail.length)]);
                    }
                }
            }, 1000);
        }
    },

    resetGame: () => {
        set({
            gameId: null,
            gameStarted: false,
            gameEnded: false,
            gameWinner: null,
            winReason: null,
            playerCandies: [],
            opponentCandies: [],
            playerCollection: [],
            opponentCollection: [],
            selectedPoison: null,
            opponentPoison: null,
            isSettingPoisonFor: null,
            gameProgress: { ...DEFAULT_PROGRESS },
            matchFound: false,
        });
    },

    tickTimer: () => {
        const { turnTimeRemaining, gameEnded, isPlayerTurn, gameMode, selectedCity } = get();
        if (gameEnded || !get().gameStarted) return;

        if (turnTimeRemaining > 0) {
            set({ turnTimeRemaining: turnTimeRemaining - 1 });
        } else {
            const nextPlayerTurn = !isPlayerTurn;
            const { cityConfig } = get().config;
            const limit = gameMode === 'online' && selectedCity ? cityConfig[selectedCity].turnTimer : 30;

            set({ isPlayerTurn: nextPlayerTurn, turnTimeRemaining: limit });

            if (!nextPlayerTurn && gameMode === 'ai') {
                const s = get();
                // We'll call the backend AI here too for parity if we want, or just pick random to keep it simple for timeout.
                const avail = s.playerCandies.filter(c => !s.opponentCollection.includes(c));
                if (avail.length > 0) {
                    const nonP = avail.filter(c => c !== s.selectedPoison);
                    // Use simple random or call get().pickCandy('') which handles AI
                    get().pickCandy(avail[Math.floor(Math.random() * avail.length)]);
                }
            }
        }
    },
    setIsReconnecting: (val) => set({ isReconnecting: val }),
}));
