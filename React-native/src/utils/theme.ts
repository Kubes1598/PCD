export const COLORS = {
    primary: '#8B4513', // Saddle Brown
    primaryDark: '#5D2F0A',
    primaryLight: '#A0612A',
    secondary: '#DFE0DC', // Sage Green
    secondaryDark: '#C5D4C1',
    secondaryLight: '#F2F8F0',

    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',

    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',

    // Special colors for the "carton" theme
    carton: '#D2B48C',
    brownLight: '#DEB887',
    accent: '#CD853F',
} as const;

export const GRADIENTS = {
    primary: [COLORS.primary, '#da6a1a'] as [string, string],
    secondary: ['#da6a1a', COLORS.accent] as [string, string],
    carton: [COLORS.carton, COLORS.brownLight, COLORS.carton] as [string, string, string],
    background: ['#F5E6D3', '#E6D7C3', '#D7C8B3'] as [string, string, string],
    button3D: [COLORS.brownLight, COLORS.carton, '#da6a1a', COLORS.primaryDark] as [string, string, string, string],
} as const;

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 24,
    xxl: 32,
} as const;

export const RADIUS = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
} as const;

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    '3d': {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
    },
} as const;

export const THEME = {
    colors: COLORS,
    gradients: GRADIENTS,
    spacing: SPACING,
    radius: RADIUS,
    shadows: SHADOWS,
} as const;

export type ThemeType = typeof THEME;
export type ColorType = keyof typeof COLORS;
