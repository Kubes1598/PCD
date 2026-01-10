import React, { ReactNode } from 'react';
import { StyleSheet, View, StatusBar, ViewStyle, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../utils/theme';
import { spacing } from '../../utils/responsive';
import { feedbackService } from '../../services/FeedbackService';
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
    // Back button options
    withBackButton?: boolean;
    onBack?: () => void;
}

import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { moderateScale, scale } from '../../utils/responsive';

const ScreenContainer: React.FC<ScreenContainerProps> = ({
    children,
    withGradient = true,
    style,
    edges = ['top', 'bottom'],
    withPadding = false,
    statusBarStyle = 'light',
    withBackButton = false,
    onBack,
}) => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    const handleBack = () => {
        feedbackService.triggerSelection();
        if (onBack) {
            onBack();
        } else if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

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
                    colors={(THEME.gradients as any).background || ['#0F172A', '#1E293B']}
                    style={StyleSheet.absoluteFill}
                />
            )}
            <View style={[styles.container, safeAreaStyle, contentPadding, style]}>
                {withBackButton && (
                    <TouchableOpacity
                        style={[styles.backButton, { top: insets.top || scale(10) }]}
                        onPress={handleBack}
                        activeOpacity={0.7}
                    >
                        <ArrowLeft color="#FFF" size={moderateScale(24)} />
                    </TouchableOpacity>
                )}
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
    backButton: {
        position: 'absolute',
        left: scale(20),
        zIndex: 50,
        width: scale(44),
        height: scale(44),
        borderRadius: moderateScale(22),
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
});

export default ScreenContainer;
