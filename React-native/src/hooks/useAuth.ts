import { useAuthStore } from '../store/authStore';
import { useCurrencyStore } from '../store/currencyStore';
import { apiService } from '../services/api';

export const useAuth = () => {
    const { user, token, isGuest, isLoading, error, setUser, setGuest, logout } = useAuthStore();
    const { setBalances } = useCurrencyStore();

    /**
     * Email/Password Login
     */
    const login = async (email: string, password: string) => {
        try {
            const result = await apiService.login({ email, password });
            if (result.success) {
                const userData = result.data.user;
                setUser(userData, result.data.token, result.data.refresh_token);
                // Sync currency
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'Login failed';
            console.log('❌ Login failed:', message);
            return { success: false, message };
        }
    };

    /**
     * Email/Password Registration
     */
    const register = async (email: string, password: string, username: string, guestId?: string) => {
        try {
            const result = await apiService.register({
                email,
                password,
                username,
                guest_id: guestId
            });
            if (result.success) {
                const userData = result.data.user;
                setUser(userData, result.data.token, result.data.refresh_token);
                // Sync currency
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'Registration failed';
            console.log('❌ Registration failed:', message);
            return { success: false, message };
        }
    };

    /**
     * Google Sign-In
     * @param idToken - Google ID token from Google Sign-In SDK
     */
    const loginWithGoogle = async (idToken: string) => {
        try {
            const result = await apiService.googleAuth(idToken);
            if (result.success) {
                const userData = result.data.user;
                setUser(userData, result.data.token, result.data.refresh_token);
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            // Handle "not configured" gracefully
            if (err.response?.status === 503) {
                return { success: false, message: 'Google Sign-In is not available yet. Please use email or guest login.' };
            }
            return { success: false, message: err.message || 'Google sign-in failed' };
        }
    };

    /**
     * Apple Sign-In
     * @param identityToken - Apple identity token
     * @param authorizationCode - Apple authorization code
     * @param user - User info (only on first sign-in)
     */
    const loginWithApple = async (identityToken: string, authorizationCode: string, user?: any) => {
        try {
            const result = await apiService.appleAuth(identityToken, authorizationCode, user);
            if (result.success) {
                const userData = result.data.user;
                setUser(userData, result.data.token, result.data.refresh_token);
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            // Handle "not configured" gracefully
            if (err.response?.status === 503) {
                return { success: false, message: 'Apple Sign-In is not available yet. Please use email or guest login.' };
            }
            return { success: false, message: err.message || 'Apple sign-in failed' };
        }
    };

    /**
     * Guest Login (via backend API - creates server-side guest session)
     * 
     * Persistent: If device_id is available, guest progress is saved and restored
     */
    const guestLogin = async () => {
        try {
            // Get persistent device ID (see gameStore.ts getDeviceId utility)
            // Import dynamically to avoid circular dependencies
            let deviceId: string | undefined;
            try {
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                deviceId = await AsyncStorage.getItem('pcd_device_id');
                if (!deviceId) {
                    deviceId = 'dev_' + Math.random().toString(36).substring(2, 11);
                    await AsyncStorage.setItem('pcd_device_id', deviceId);
                }
            } catch {
                deviceId = undefined; // Fallback to ephemeral guest
            }

            const result = await apiService.guestAuth(deviceId);
            if (result.success) {
                const userData = result.data.user;
                // Mark as guest in local store as well
                setUser({ ...userData, isGuest: true }, result.data.token, result.data.refresh_token);
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }

                // Check if restored or new
                const isRestored = result.message?.includes('back');
                if (isRestored) {
                    console.log('✅ Guest session restored with saved progress');
                }

                return { success: true, message: result.message };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            // Fallback to local-only guest if server unavailable
            console.log('Guest API failed, using local guest mode:', err.message);
            setGuest(true);
            return { success: true, message: 'Welcome, Guest!' };
        }
    };

    /**
     * Continue as Guest (local-only, no server call - legacy support)
     */
    const continueAsGuest = () => {
        setGuest(true);
    };

    return {
        user,
        token,
        isGuest,
        isLoading,
        error,
        // Classic auth
        login,
        register,
        logout,
        // OAuth auth
        loginWithGoogle,
        loginWithApple,
        // Guest auth
        guestLogin,
        continueAsGuest,
    };
};
