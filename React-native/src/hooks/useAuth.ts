import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';

export const useAuth = () => {
    const { user, token, isGuest, isLoading, error, setUser, setGuest, logout } = useAuthStore();

    const login = async (email: string, password: string) => {
        try {
            const result = await apiService.login({ email, password });
            if (result.success) {
                setUser(result.data.user, result.data.token);
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
                setUser(result.data.user, result.data.token);
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
