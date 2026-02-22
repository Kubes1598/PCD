import { useGameStore } from '../store/gameStore';
import { apiService } from '../services/api';

jest.mock('../services/api');
jest.mock('../services/WebSocketService', () => ({
    webSocketService: {
        connect: jest.fn(),
        disconnect: jest.fn(),
        sendMessage: jest.fn(),
    },
}));

const mockedApiService = apiService as jest.Mocked<typeof apiService>;

describe('gameStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useGameStore.getState().resetGame();

        mockedApiService.createAIGame.mockResolvedValue({
            success: true,
            message: 'ok',
            data: {
                game_id: 'game-1',
                player1_id: 'player-1',
                opponent_poison: '🍏',
                game_state: {
                    player1: { owned_candies: Array(12).fill('🍬') },
                    player2: { owned_candies: Array(12).fill('🍭') },
                },
            },
        } as any);
    });

    test('initGame sets state correctly for AI mode', async () => {
        await useGameStore.getState().initGame('ai', 'medium');
        const state = useGameStore.getState();
        expect(state.gameMode).toBe('ai');
        expect(state.difficulty).toBe('medium');
        expect(state.gameStarted).toBe(false); // starts after poison selection
        expect(state.playerCandies.length).toBe(12);
    });

    test('initGame falls back locally when AI API payload is invalid', async () => {
        mockedApiService.createAIGame.mockResolvedValue({ success: false, message: 'bad' } as any);
        await useGameStore.getState().initGame('ai', 'hard');
        const state = useGameStore.getState();
        expect(state.gameMode).toBe('ai');
        expect(state.difficulty).toBe('hard');
        expect(state.playerCandies.length).toBeGreaterThan(0);
        expect(state.opponentCandies.length).toBeGreaterThan(0);
    });

    test('initGame sets state correctly for online mode', async () => {
        await useGameStore.getState().initGame('online', 'easy', 'Dubai');
        const state = useGameStore.getState();
        expect(state.gameMode).toBe('online');
        expect(state.selectedCity).toBe('Dubai');
    });

    test('tickTimer decrements time once game is active', async () => {
        await useGameStore.getState().initGame('ai', 'easy', 'Dubai');
        useGameStore.setState({ gameStarted: true, turnTimeRemaining: 30 });
        const initialTime = useGameStore.getState().turnTimeRemaining;
        useGameStore.getState().tickTimer();
        expect(useGameStore.getState().turnTimeRemaining).toBe(initialTime - 1);
    });

    test('resetGame returns to initial state', async () => {
        await useGameStore.getState().initGame('ai');
        useGameStore.getState().resetGame();
        expect(useGameStore.getState().gameStarted).toBe(false);
        expect(useGameStore.getState().playerCandies).toEqual([]);
    });
});
