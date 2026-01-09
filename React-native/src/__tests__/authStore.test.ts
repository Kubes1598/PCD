import { useAuthStore } from '../store/authStore';

describe('authStore', () => {
    beforeEach(() => {
        // Reset the store before each test
        useAuthStore.setState({
            user: { id: 'initial', username: 'Guest' },
            token: null,
            isGuest: true,
            isLoading: false,
            error: null,
        });
    });

    test('initial state is guest', () => {
        const state = useAuthStore.getState();
        expect(state.isGuest).toBe(true);
        expect(state.user?.username).toBe('Guest');
    });

    test('setUser sets user and isGuest false', () => {
        const user = { id: '123', username: 'tester' };
        const token = 'fake-token';
        useAuthStore.getState().setUser(user, token);

        const state = useAuthStore.getState();
        expect(state.user).toEqual(user);
        expect(state.token).toBe(token);
        expect(state.isGuest).toBe(false);
    });

    test('logout resets to guest', () => {
        useAuthStore.getState().setUser({ id: '1', username: 'u' }, 't');
        useAuthStore.getState().logout();

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isGuest).toBe(true);
    });
});
