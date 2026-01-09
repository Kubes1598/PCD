import React, { ReactNode } from 'react';
import { StyleSheet, View, StatusBar, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../utils/theme';
import { spacing } from '../../utils/responsive';
import ErrorBoundary from '../common/ErrorBoundary';

interface ScreenContainerProps {
    children: ReactNode;
    withGradient?: boolean;
    style?: ViewStyle;
    // Safe area options
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
    // Padding options
    withPadding?: boolean;
    // Status bar style
    statusBarStyle?: 'light' | 'dark';
}

const ScreenContainer: React.FC<ScreenContainerProps> = ({
    children,
    withGradient = true,
    style,
    edges = ['top', 'bottom'],
    withPadding = false,
    statusBarStyle = 'light',
}) => {
    const insets = useSafeAreaInsets();

    // Calculate safe area padding based on edges prop
    const safeAreaStyle: ViewStyle = {
        paddingTop: edges.includes('top') ? insets.top : 0,
        paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        paddingLeft: edges.includes('left') ? insets.left : 0,
        paddingRight: edges.includes('right') ? insets.right : 0,
    };

    // Optional content padding
    const contentPadding: ViewStyle = withPadding ? {
        paddingHorizontal: spacing.md,
    } : {};

    return (
        <View style={styles.outer}>
            <StatusBar
                barStyle={statusBarStyle === 'light' ? 'light-content' : 'dark-content'}
                backgroundColor="transparent"
                translucent={Platform.OS === 'android'}
            />
            {withGradient && (
                <LinearGradient
                    colors={THEME.gradients.background as any}
                    style={StyleSheet.absoluteFill}
                />
            )}
            <View style={[styles.container, safeAreaStyle, contentPadding, style]}>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    outer: {
        flex: 1,
        backgroundColor: '#0F172A', // Fallback dark background
    },
    container: {
        flex: 1,
    },
});

export default ScreenContainer;
