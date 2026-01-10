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

// Calculate responsive candy size based on a fixed 4x3 grid (12 candies)
// Calculate responsive candy size based on a fixed 4x3 grid (12 candies)
const getCandySize = (): number => {
    const screenPadding = scale(16) * 2;
    const gridPadding = scale(8) * 2;
    const columns = 4;
    const totalSpacing = scale(4) * (columns - 1); // Spacing between items

    const availableWidth = SCREEN_WIDTH - screenPadding - gridPadding - totalSpacing;
    const candyWidth = Math.floor(availableWidth / columns);

    // Dynamic height based on screen ratio to ensure 4 rows fit
    const targetHeight = Math.floor(SCREEN_HEIGHT * 0.075);

    return Math.min(candyWidth, targetHeight);
};

const CandyItem: React.FC<CandyItemProps> = ({
    candy,
    onPress,
    isPoison,
    disabled,
    style
}) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    const candySize = getCandySize();
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
        margin: 0,
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
