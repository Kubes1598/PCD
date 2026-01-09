import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, apiService } from '../services/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isGuest: boolean;
    isLoading: boolean;
    error: string | null;

    setGuest: (isGuest: boolean) => void;
    setUser: (user: User | null, token: string | null) => void;
    logout: () => void;
    init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: { id: 'initial', username: 'Guest' },
            token: null,
            isGuest: true,
            isLoading: false,
            error: null,

            setGuest: (isGuest: boolean) => {
                if (isGuest) {
                    const guestId = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
                    set({
                        user: { id: guestId, username: guestId },
                        isGuest: true,
                        token: null,
                    });
                } else {
                    set({ isGuest: false });
                }
            },

            setUser: (user, token) => {
                set({ user, token, isGuest: false, error: null });
            },

            logout: () => {
                set({ user: null, token: null, isGuest: true, error: null });
            },

            init: async () => {
                const { token } = get();
                if (token) {
                    set({ isLoading: true });
                    try {
                        const result = await apiService.verifyToken(token);
                        if (result.success) {
                            set({ user: result.data.user, isGuest: false, isLoading: false });
                        } else {
                            // If token is invalid, fall back to guest but keep a generic guest object
                            get().logout();
                            set({ isLoading: false });
                        }
                    } catch (error) {
                        console.error('Auth sync failed:', error);
                        set({ isLoading: false });
                        // Keep current local state if sync fails (offline support)
                    }
                }
            },
        }),
        {
            name: 'pcd-auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
