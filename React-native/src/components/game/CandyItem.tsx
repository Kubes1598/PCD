import React from 'react';
import { StyleSheet, Text, TouchableOpacity, Animated, ViewStyle, Dimensions } from 'react-native';
import { THEME } from '../../utils/theme';
import { feedbackService } from '../../services/FeedbackService';
import { scale, SCREEN_WIDTH, SCREEN_HEIGHT } from '../../utils/responsive';

interface CandyItemProps {
    candy: string;
    onPress?: () => void;
    isPoison?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    gridSize?: number; // Number of candies to determine sizing
}

// Calculate responsive candy size based on screen and grid
const getCandySize = (gridSize: number = 11): number => {
    // For the gameplay screen, we need to fit everything without scrolling
    // Calculate based on available width for a 4-column grid with gaps
    const availableWidth = SCREEN_WIDTH - scale(32); // 16px padding on each side
    const columns = Math.min(4, Math.ceil(Math.sqrt(gridSize)));
    const gaps = (columns + 1) * scale(4);
    const candyWidth = (availableWidth - gaps) / columns;

    // Also check height constraints for iPhone 14 Pro Max and smaller
    // We need 2 candy grids + 2 collection panels + turn indicator to fit
    const maxCandyHeight = SCREEN_HEIGHT * 0.065; // ~6.5% of screen height per candy

    return Math.min(candyWidth * 0.9, maxCandyHeight);
};

const CandyItem: React.FC<CandyItemProps> = ({
    candy,
    onPress,
    isPoison,
    disabled,
    style,
    gridSize = 11
}) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    const candySize = getCandySize(gridSize);
    const fontSize = candySize * 0.5; // Emoji takes 50% of candy container

    React.useEffect(() => {
        if (disabled) {
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 0.9,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.4,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        } else {
            scaleAnim.setValue(1);
            opacity.setValue(1);
        }
    }, [disabled]);

    const handlePressIn = () => {
        if (disabled) return;
        feedbackService.triggerSelection();
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (disabled) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View style={[
            styles.container,
            { width: candySize, height: candySize },
            isPoison && styles.poisonContainer,
            disabled && styles.disabledContainer,
            style,
            { transform: [{ scale: scaleAnim }], opacity }
        ]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || !onPress}
                activeOpacity={0.8}
                style={styles.button}
            >
                <Text style={[styles.candyText, { fontSize }, disabled && styles.disabledText]}>
                    {candy}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: scale(2),
        backgroundColor: THEME.colors.white,
        borderRadius: scale(8),
        borderWidth: 1.5,
        borderColor: THEME.colors.gray200,
        ...THEME.shadows.sm,
        overflow: 'hidden',
    },
    button: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    poisonContainer: {
        borderColor: THEME.colors.danger,
        borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    disabledContainer: {
        backgroundColor: THEME.colors.gray100,
        borderColor: THEME.colors.gray300,
    },
    candyText: {
        textAlign: 'center',
    },
    disabledText: {
        opacity: 0.35,
    },
});

export default CandyItem;
