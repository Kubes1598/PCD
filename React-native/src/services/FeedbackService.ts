// This service handles haptic feedback and sound effects with graceful fallbacks.
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

let Audio: any = null;

try {
    Audio = require('expo-av').Audio;
} catch (e) {
    console.log('🔊 Audio not available');
}

const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

export const feedbackService = {
    triggerSelection() {
        ReactNativeHapticFeedback.trigger("selection", hapticOptions);
    },

    triggerSuccess() {
        ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);
    },

    triggerError() {
        ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
    },

    triggerImpact() {
        ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
    },

    triggerTick() {
        ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
        this.playSound('tick');
    },

    // Sound placeholders
    async playSound(type: 'pick' | 'win' | 'lose' | 'tick') {
        if (!Audio) return;
        // Logic to load and play sounds would go here if assets were present
        console.log(`🔊 Playing sound: ${type}`);
    }
};
