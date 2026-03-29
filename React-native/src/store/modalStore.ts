import { create } from 'zustand';

export type ModalButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

interface ModalState {
    isVisible: boolean;
    title: string;
    message: string;
    buttons: ModalButton[];
    showModal: (title: string, message?: string, buttons?: ModalButton[]) => void;
    hideModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
    isVisible: false,
    title: '',
    message: '',
    buttons: [],
    showModal: (title, message = '', buttons = [{ text: 'OK' }]) => 
        set({ isVisible: true, title, message, buttons }),
    hideModal: () => set({ isVisible: false }),
}));
