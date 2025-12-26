// This service handles haptic feedback and sound effects with graceful fallbacks.
// To fully enable these, run: npx expo install expo-haptics expo-av

let Haptics: any = null;
let Audio: any = null;

try {
    Haptics = require('expo-haptics');
} catch (e) {
    console.log('📳 Haptics not available');
}

try {
    Audio = require('expo-av').Audio;
} catch (e) {
    console.log('🔊 Audio not available');
}

export const feedbackService = {
    async triggerSelection() {
        if (Haptics) {
            await Haptics.selectionAsync().catch(() => { });
        }
    },

    async triggerSuccess() {
        if (Haptics) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        }
    },

    async triggerError() {
        if (Haptics) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        }
    },

    async triggerImpact() {
        if (Haptics) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        }
    },

    // Sound placeholders
    async playSound(type: 'pick' | 'win' | 'lose' | 'tick') {
        if (!Audio) return;
        // Logic to load and play sounds would go here if assets were present
        console.log(`🔊 Playing sound: ${type}`);
    }
};
