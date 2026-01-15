// This service handles haptic feedback and sound effects with graceful fallbacks.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Optional: check if Audio is available from expo-av
let Audio: any;
try {
    Audio = require('expo-av').Audio;
} catch (e) { }

export const feedbackService = {
    triggerSelection() {
        if (Platform.OS === 'web') return;
        Haptics.selectionAsync();
    },

    triggerSuccess() {
        if (Platform.OS === 'web') return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        this.playSound('win');
    },

    triggerError() {
        if (Platform.OS === 'web') return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        this.playSound('lose');
    },

    triggerImpact() {
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },

    triggerTick() {
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        this.playSound('tick');
    },

    // Sound placeholders
    async playSound(type: 'pick' | 'win' | 'lose' | 'tick') {
        if (!Audio) return;
        // Logic to load and play sounds would go here if assets were present
        console.log(`🔊 Playing sound: ${type}`);
    }
};
