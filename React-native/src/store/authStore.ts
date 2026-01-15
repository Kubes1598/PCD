import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, apiService } from '../services/api';

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;  // For automatic token refresh
    isGuest: boolean;
    isLoading: boolean;
    error: string | null;

    setGuest: (isGuest: boolean) => void;
    setUser: (user: User | null, token: string | null, refreshToken?: string | null) => void;
    setToken: (token: string) => void;  // Update token without changing user
    logout: () => void;
    init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: { id: 'initial', username: 'Guest' },
            token: null,
            refreshToken: null,
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
                        refreshToken: null,
                    });
                } else {
                    set({ isGuest: false });
                }
            },

            setUser: (user, token, refreshToken = null) => {
                set({ user, token, refreshToken, isGuest: false, error: null });
            },

            setToken: (token: string) => {
                // Update only the access token (used after refresh)
                set({ token });
            },

            logout: () => {
                set({ user: null, token: null, refreshToken: null, isGuest: true, error: null });
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
                    } catch (error: any) {
                        console.error('Auth sync failed:', error);
                        set({ isLoading: false });

                        // If we get a 401, the token is definitely invalid/expired, so clear it
                        if (error?.response?.status === 401) {
                            get().logout();
                        }
                        // For other errors (like 500 or timeout), we keep the local state for offline support
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
