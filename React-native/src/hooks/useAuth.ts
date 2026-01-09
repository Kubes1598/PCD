import { useAuthStore } from '../store/authStore';
import { useCurrencyStore } from '../store/currencyStore';
import { apiService } from '../services/api';

export const useAuth = () => {
    const { user, token, isGuest, isLoading, error, setUser, setGuest, logout } = useAuthStore();
    const { setBalances } = useCurrencyStore();

    const login = async (email: string, password: string) => {
        try {
            const result = await apiService.login({ email, password });
            if (result.success) {
                const userData = result.data.user;
                setUser(userData, result.data.token);
                // Sync currency
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            return { success: false, message: err.message || 'Login failed' };
        }
    };

    const register = async (email: string, password: string, username: string) => {
        try {
            const result = await apiService.register({ email, password, username });
            if (result.success) {
                const userData = result.data.user;
                setUser(userData, result.data.token);
                // Sync currency
                if (userData.coin_balance !== undefined) {
                    setBalances(userData.coin_balance, userData.diamonds_balance || 0);
                }
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err: any) {
            return { success: false, message: err.message || 'Registration failed' };
        }
    };

    return {
        user,
        token,
        isGuest,
        isLoading,
        error,
        login,
        register,
        logout,
        continueAsGuest: () => setGuest(true),
    };
};
