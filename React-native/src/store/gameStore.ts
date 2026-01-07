import { create } from 'zustand';
import { apiService } from '../services/api';
import { generateCandyPool } from '../services/candyPool';
import { webSocketService, MatchmakingMessage } from '../services/WebSocketService';
import { feedbackService } from '../services/FeedbackService';
import { useCurrencyStore } from './currencyStore';

export type GameMode = 'ai' | 'online' | 'friends' | 'offline';
export type Difficulty = 'easy' | 'medium' | 'hard';

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
    selectedCity: 'Dubai' | 'Cairo' | 'Oslo' | null;
    isPlayerTurn: boolean;
    gameStarted: boolean;
    gameEnded: boolean;
    gameWinner: 'player' | 'opponent' | 'draw' | null;

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
    isSettingPoisonFor: 'player' | 'opponent' | null;
    opponentId: string | null;

    // Actions
    initGame: (mode: GameMode, difficulty?: Difficulty, city?: 'Dubai' | 'Cairo' | 'Oslo') => Promise<void>;
    startSearching: (arena?: 'Dubai' | 'Cairo' | 'Oslo') => void;
    stopSearching: () => void;
    setPoison: (candy: string) => Promise<void>;
    pickCandy: (candy: string, isRemote?: boolean) => Promise<void>;
    resetGame: () => void;
    tickTimer: () => void;
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
    winner?: 'player' | 'opponent';
    isDraw?: boolean;
    switchToPlayer?: boolean;
    switchToOpponent?: boolean;
    message: string;
} => {
    const p1Count = state.playerCollection.length;
    const p2Count = state.opponentCollection.length;

    // Total candies in game = 12 (P1) + 12 (P2) = 24
    // Poisons = 2 (one per player)
    // Safe candies = 22
    // Goal = 11 safe candies

    const allCollectedCount = p1Count + p2Count;
    const totalPickableRemaining = 24 - allCollectedCount;

    // Case 1: Draw (Both reached 11 - only poisons usually remain)
    if (p1Count === 11 && p2Count === 11) {
        return { hasWinner: false, isDraw: true, message: "🤝 Draw! Both players collected 11 candies!" };
    }

    // Case 2: One player reached 11 - Apply Math-Based Final Chance
    if (p1Count === 11 || p2Count === 11) {
        const winnerCandidate = p1Count === 11 ? 'player' : 'opponent';
        const loserCandidateCount = p1Count === 11 ? p2Count : p1Count;

        // Calculate max possible safe candies for the lagging player
        // If it's Player's turn and Opponent reached 11, Player gets (totalPickableRemaining+1)/2 turns
        // If it's Opponent's turn and Player reached 11, Opponent gets (totalPickableRemaining+1)/2 turns
        // Because the one who didn't just pick gets the next turn.
        const futureTurns = Math.ceil(totalPickableRemaining / 2);
        const maxPossibleForLoser = loserCandidateCount + futureTurns;

        if (maxPossibleForLoser >= 11) {
            // Opponent can still reach 11 - Game continues to Final Chance phase
            const message = winnerCandidate === 'player'
                ? "🎉 You reached 11! Opponent gets final chance..."
                : "💔 Opponent reached 11! You get final chance...";

            return {
                hasWinner: false,
                switchToOpponent: winnerCandidate === 'player',
                switchToPlayer: winnerCandidate === 'opponent',
                message
            };
        } else {
            // Opponent cannot mathematically reach 11
            return {
                hasWinner: true,
                winner: winnerCandidate,
                message: winnerCandidate === 'player'
                    ? "🎉 You win! Collected all safe candies!"
                    : "💔 Opponent wins! Collected all safe candies!"
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

    initGame: async (mode, difficulty = 'easy', city = 'Dubai') => {
        const fees = { easy: 0, medium: 100, hard: 250, online: 500 };
        const cityFees = { Dubai: 500, Cairo: 1000, Oslo: 5000 };
        const timerLimits = { Dubai: 30, Cairo: 20, Oslo: 10 };

        const fee = mode === 'online' ? cityFees[city] : (mode === 'ai' ? fees[difficulty] : 0);
        const timerLimit = mode === 'online' ? timerLimits[city] : 30;

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
            isSettingPoisonFor: 'player', // Start poison selection for P1
            selectedPoison: null,
            opponentPoison: null,
            playerCollection: [],
            opponentCollection: []
        });

        // For AI mode, we'll randomize opponent poison later or now
        if (mode === 'ai') {
            set({ opponentPoison: opponent[Math.floor(Math.random() * opponent.length)] });
        }
    },

    startSearching: (arena = 'Dubai') => {
        const fees = { Dubai: 500, Cairo: 1000, Oslo: 5000 };
        const fee = fees[arena];

        const success = useCurrencyStore.getState().spendCoins(fee, `${arena.toUpperCase()} Entry Fee`);
        if (!success) return;

        const playerId = `player_${Date.now()}`;
        set({ isSearching: true, difficulty: arena === 'Oslo' ? 'hard' : (arena === 'Cairo' ? 'medium' : 'easy') });

        webSocketService.connect(playerId, (data: MatchmakingMessage) => {
            if (data.type === 'queue_status') {
                set({ queuePosition: data.position || 0, totalWaiting: data.total_waiting || 0 });
            } else if (data.type === 'match_found') {
                set({
                    isSearching: false,
                    gameId: data.game_id || null,
                    isPlayerTurn: data.your_role === 'player1',
                    playerCandies: data.game_state.player1.owned_candies,
                    opponentCandies: data.game_state.player2.owned_candies,
                    gameMode: 'online',
                    turnTimeRemaining: arena === 'Oslo' ? 10 : (arena === 'Cairo' ? 20 : 30),
                    isSettingPoisonFor: 'player',
                    opponentId: data.opponent_id || null
                });
                // DO NOT disconnect here, we need it for move signaling
            } else if (data.type === 'match_poison') {
                set({ opponentPoison: data.candy });
                if (get().selectedPoison) {
                    set({ gameStarted: true, isSettingPoisonFor: null });
                }
            } else if (data.type === 'match_move') {
                get().pickCandy(data.move!, true); // true indicates it's a remote move
            } else if (data.type === 'opponent_disconnected') {
                feedbackService.triggerError();
                set({ gameEnded: true, gameWinner: 'player', gameStarted: false });
                alert('Opponent disconnected! You win by default.');
            }
        });

        webSocketService.sendMessage({ type: 'join_queue', player_name: 'Player', city: arena });
    },

    stopSearching: () => {
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
                set({ gameEnded: true, gameWinner: 'opponent' });
                return;
            }
            if (!newPlayerCollection.includes(candy)) newPlayerCollection.push(candy);
        } else {
            if (candy === state.selectedPoison) {
                set({ gameEnded: true, gameWinner: 'player' });
                return;
            }
            if (!newOpponentCollection.includes(candy)) newOpponentCollection.push(candy);
        }

        const winResult = checkWinCondition({ ...state, playerCollection: newPlayerCollection, opponentCollection: newOpponentCollection });

        if (winResult.hasWinner) {
            if (winResult.winner === 'player') {
                feedbackService.triggerSuccess();
                const prizes = { easy: 50, medium: 200, hard: 500 };
                const cityPrizes = { Dubai: 950, Cairo: 1900, Oslo: 9500 };
                const prize = state.gameMode === 'online' && state.selectedCity ? cityPrizes[state.selectedCity] : prizes[state.difficulty];
                useCurrencyStore.getState().addCoins(prize, `Victory Reward (${state.gameMode})`);
                set({ lastReward: prize });
            } else {
                set({ lastReward: 0 });
                feedbackService.triggerError();
            }
            set({ gameEnded: true, gameWinner: winResult.winner || null, playerCollection: newPlayerCollection, opponentCollection: newOpponentCollection });
            return;
        }

        if (winResult.isDraw) {
            set({ gameEnded: true, gameWinner: 'draw', playerCollection: newPlayerCollection, opponentCollection: newOpponentCollection });
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
            setTimeout(() => {
                const s = get();
                if (s.gameEnded) return;
                const avail = s.playerCandies.filter(c => !s.opponentCollection.includes(c));
                if (avail.length === 0) return;
                const nonP = avail.filter(c => c !== s.selectedPoison);
                const diff = s.difficulty;
                const prob = diff === 'hard' ? 1 : diff === 'medium' ? 0.9 : 0.7;
                const choice = (nonP.length > 0 && Math.random() < prob) ? nonP[Math.floor(Math.random() * nonP.length)] : avail[Math.floor(Math.random() * avail.length)];
                get().pickCandy(choice);
            }, 1000);
        }
    },

    resetGame: () => {
        set({
            gameId: null,
            gameStarted: false,
            gameEnded: false,
            gameWinner: null,
            playerCandies: [],
            opponentCandies: [],
            playerCollection: [],
            opponentCollection: [],
            selectedPoison: null,
            opponentPoison: null,
            isSettingPoisonFor: null,
            gameProgress: { ...DEFAULT_PROGRESS }
        });
    },

    tickTimer: () => {
        const { turnTimeRemaining, gameEnded, isPlayerTurn, gameMode, selectedCity } = get();
        if (gameEnded || !get().gameStarted) return;

        if (turnTimeRemaining > 0) {
            set({ turnTimeRemaining: turnTimeRemaining - 1 });
        } else {
            const nextPlayerTurn = !isPlayerTurn;
            const timerLimits = { Dubai: 30, Cairo: 20, Oslo: 10 };
            const limit = gameMode === 'online' && selectedCity ? timerLimits[selectedCity] : 30;

            set({ isPlayerTurn: nextPlayerTurn, turnTimeRemaining: limit });

            if (!nextPlayerTurn && gameMode === 'ai') {
                const s = get();
                const avail = s.playerCandies.filter(c => !s.opponentCollection.includes(c));
                if (avail.length > 0) {
                    const nonP = avail.filter(c => c !== s.selectedPoison);
                    const diff = s.difficulty;
                    const prob = diff === 'hard' ? 1 : diff === 'medium' ? 0.9 : 0.7;
                    const choice = (nonP.length > 0 && Math.random() < prob)
                        ? nonP[Math.floor(Math.random() * nonP.length)]
                        : avail[Math.floor(Math.random() * avail.length)];
                    get().pickCandy(choice);
                }
            }
        }
    },
}));
