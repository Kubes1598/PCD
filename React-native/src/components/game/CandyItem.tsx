import React from 'react';
import { StyleSheet, Text, TouchableOpacity, Animated, ViewStyle } from 'react-native';
import { THEME } from '../../utils/theme';
import { feedbackService } from '../../services/FeedbackService';

interface CandyItemProps {
    candy: string;
    onPress?: () => void;
    isPoison?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

const CandyItem: React.FC<CandyItemProps> = ({ candy, onPress, isPoison, disabled, style }) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (disabled) {
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.2,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.parallel([
                    Animated.timing(scale, {
                        toValue: 0.8,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.5,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        } else {
            scale.setValue(1);
            opacity.setValue(1);
        }
    }, [disabled]);

    const handlePressIn = () => {
        if (disabled) return;
        feedbackService.triggerSelection();
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (disabled) return;
        Animated.spring(scale, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View style={[
            styles.container,
            isPoison ? styles.poisonContainer : null,
            disabled ? styles.disabledContainer : null,
            style,
            { transform: [{ scale }], opacity }
        ]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || !onPress}
                activeOpacity={0.8}
                style={styles.button}
            >
                <Text style={[styles.candyText, disabled && styles.disabledText]}>
                    {candy}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 60,
        height: 60,
        margin: THEME.spacing.xs,
        backgroundColor: THEME.colors.white,
        borderRadius: THEME.radius.md,
        borderWidth: 2,
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
        backgroundColor: THEME.colors.gray100,
    },
    disabledContainer: {
        backgroundColor: THEME.colors.gray100,
        borderColor: THEME.colors.gray300,
        opacity: 0.5,
    },
    candyText: {
        fontSize: 28,
    },
    disabledText: {
        opacity: 0.3,
    },
});

export default CandyItem;
