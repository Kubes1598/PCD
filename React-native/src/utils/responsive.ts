import { Dimensions, PixelRatio, Platform } from 'react-native';

// Get device dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breakpoints (based on common device widths)
export const breakpoints = {
    sm: 375,   // iPhone SE, small Android
    md: 414,   // iPhone 14, standard Android
    lg: 768,   // iPad, tablets
};

// Base dimensions (design based on iPhone 14)
const BASE_WIDTH = 414;
const BASE_HEIGHT = 896;

// Get current device size category
export const getDeviceSize = (): 'sm' | 'md' | 'lg' => {
    if (SCREEN_WIDTH < breakpoints.sm) return 'sm';
    if (SCREEN_WIDTH < breakpoints.lg) return 'md';
    return 'lg';
};

// Check if device is small
export const isSmallDevice = (): boolean => SCREEN_WIDTH < breakpoints.sm;

// Check if device is tablet
export const isTablet = (): boolean => SCREEN_WIDTH >= breakpoints.lg;

/**
 * Scale a size based on screen width
 * Good for horizontal dimensions, margins, paddings
 */
export const scale = (size: number): number => {
    return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Scale a size based on screen height
 * Good for vertical dimensions, heights
 */
export const verticalScale = (size: number): number => {
    return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Moderate scale with a resize factor
 * Good for text sizes and elements that shouldn't scale too drastically
 * @param size - The base size
 * @param factor - How much to scale (0 = no scaling, 1 = full scaling). Default: 0.5
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
    return size + (scale(size) - size) * factor;
};

/**
 * Get a responsive value based on device size
 * @param sm - Value for small devices
 * @param md - Value for medium devices
 * @param lg - Value for large devices (optional, defaults to md)
 */
export const responsiveValue = <T>(sm: T, md: T, lg?: T): T => {
    const deviceSize = getDeviceSize();
    switch (deviceSize) {
        case 'sm':
            return sm;
        case 'lg':
            return lg ?? md;
        default:
            return md;
    }
};

/**
 * Get font size that respects user's accessibility settings
 */
export const scaledFontSize = (size: number): number => {
    const scale = PixelRatio.getFontScale();
    return moderateScale(size) * Math.min(scale, 1.3); // Cap at 130% for readability
};

/**
 * Platform-specific value
 */
export const platformValue = <T>(ios: T, android: T): T => {
    return Platform.OS === 'ios' ? ios : android;
};

// Common responsive spacing values
export const spacing = {
    xs: scale(4),
    sm: scale(8),
    md: scale(16),
    lg: scale(24),
    xl: scale(32),
    xxl: scale(48),
};

// Common responsive border radii
export const radii = {
    sm: scale(8),
    md: scale(12),
    lg: scale(16),
    xl: scale(24),
    full: 9999,
};

// Responsive icon sizes
export const iconSizes = {
    sm: moderateScale(16),
    md: moderateScale(20),
    lg: moderateScale(24),
    xl: moderateScale(32),
};

// Re-export dimensions for convenience
export { SCREEN_WIDTH, SCREEN_HEIGHT };
