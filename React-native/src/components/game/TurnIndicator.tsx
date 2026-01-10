import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { User, Bot, Clock } from 'lucide-react-native';
import { THEME } from '../../utils/theme';
import { feedbackService } from '../../services/FeedbackService';
import { scale, moderateScale, SCREEN_WIDTH } from '../../utils/responsive';
import { Animated } from 'react-native';

interface TurnIndicatorProps {
    isPlayerTurn: boolean;
    timeLeft: number;
}

const TurnIndicator: React.FC<TurnIndicatorProps> = ({ isPlayerTurn, timeLeft }) => {
    const bounceAnim = React.useRef(new Animated.Value(1)).current;

    const isWarningTime = timeLeft <= 10;
    const isCriticalTime = timeLeft <= 5;

    React.useEffect(() => {
        if (isCriticalTime) {
            feedbackService.triggerTick();
            // "Jumping" pulse animation
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: 1.25,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(bounceAnim, {
                    toValue: 1,
                    friction: 3,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            bounceAnim.setValue(1);
        }
    }, [timeLeft, isCriticalTime]);

    return (
        <View style={styles.container}>
            {/* Turn Info - Left side */}
            <View style={[styles.turnBadge, isPlayerTurn ? styles.playerTurn : styles.opponentTurn]}>
                {isPlayerTurn ? (
                    <User color={THEME.colors.white} size={scale(14)} />
                ) : (
                    <Bot color={THEME.colors.white} size={scale(14)} />
                )}
                <Text style={styles.turnText}>
                    {isPlayerTurn ? 'YOUR TURN' : 'OPPONENT'}
                </Text>
            </View>

            {/* Timer - Right side - High visibility */}
            <Animated.View style={[
                styles.timerBadge,
                isWarningTime && styles.timerWarning,
                { transform: [{ scale: bounceAnim }] }
            ]}>
                <Clock color={isWarningTime ? '#FFF' : '#94A3B8'} size={scale(14)} />
                <Text style={[styles.timerText, isWarningTime && styles.timerTextWarning]}>
                    {timeLeft}s
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(8),
    },
    turnBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
        borderRadius: scale(20),
        gap: scale(4),
    },
    playerTurn: {
        backgroundColor: THEME.colors.success,
    },
    opponentTurn: {
        backgroundColor: THEME.colors.danger,
    },
    turnText: {
        color: THEME.colors.white,
        fontWeight: '800',
        fontSize: moderateScale(11),
        letterSpacing: 0.5,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        paddingHorizontal: scale(12),
        paddingVertical: scale(6),
        borderRadius: scale(12),
        gap: scale(4),
        minWidth: scale(45),
        justifyContent: 'center',
    },
    timerWarning: {
        backgroundColor: '#EF4444',
    },
    timerText: {
        color: '#94A3B8',
        fontWeight: '900',
        fontSize: moderateScale(14),
    },
    timerTextWarning: {
        color: '#FFF',
    },
});

export default TurnIndicator;
