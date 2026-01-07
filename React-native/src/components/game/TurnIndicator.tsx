import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { User, Bot, Clock } from 'lucide-react-native';
import { THEME } from '../../utils/theme';
import { scale, moderateScale, SCREEN_WIDTH } from '../../utils/responsive';

interface TurnIndicatorProps {
    isPlayerTurn: boolean;
    timeLeft: number;
}

const TurnIndicator: React.FC<TurnIndicatorProps> = ({ isPlayerTurn, timeLeft }) => {
    const isLowTime = timeLeft <= 5;

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

            {/* Timer - Right side - Compact circular badge */}
            <View style={[styles.timerBadge, isLowTime && styles.timerLow]}>
                <Clock color={isLowTime ? '#FFF' : '#94A3B8'} size={scale(10)} />
                <Text style={[styles.timerText, isLowTime && styles.timerTextLow]}>
                    {timeLeft}s
                </Text>
            </View>
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
        paddingHorizontal: scale(8),
        paddingVertical: scale(4),
        borderRadius: scale(12),
        gap: scale(3),
    },
    timerLow: {
        backgroundColor: '#EF4444',
    },
    timerText: {
        color: '#94A3B8',
        fontWeight: 'bold',
        fontSize: moderateScale(11),
    },
    timerTextLow: {
        color: '#FFF',
    },
});

export default TurnIndicator;
