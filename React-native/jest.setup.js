jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo winter runtime to prevent ReferenceError
jest.mock('expo/src/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('expo/src/winter/installGlobal', () => ({}), { virtual: true });

// Mock expo-modules-core to fix EventEmitter error
jest.mock('expo-modules-core', () => ({
    EventEmitter: jest.fn(() => ({
        addListener: jest.fn(),
        removeAllListeners: jest.fn(),
    })),
    NativeModulesProxy: {},
    requireNativeModule: jest.fn(),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'Light',
        Medium: 'Medium',
        Heavy: 'Heavy',
    },
    NotificationFeedbackType: {
        Success: 'Success',
        Warning: 'Warning',
        Error: 'Error',
    },
}));
