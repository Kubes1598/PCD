import { create } from 'zustand';

export type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorMessage {
    id: string;
    message: string;
    severity: ErrorSeverity;
}

interface ErrorState {
    errors: ErrorMessage[];
    showError: (message: string, severity?: ErrorSeverity) => void;
    clearError: (id: string) => void;
    clearAll: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
    errors: [],
    showError: (message, severity = 'error') => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
            errors: [...state.errors, { id, message, severity }]
        }));

        // Auto-clear after 5 seconds
        setTimeout(() => {
            set((state) => ({
                errors: state.errors.filter((e) => e.id !== id)
            }));
        }, 5000);
    },
    clearError: (id) => set((state) => ({
        errors: state.errors.filter((e) => e.id !== id)
    })),
    clearAll: () => set({ errors: [] }),
}));
