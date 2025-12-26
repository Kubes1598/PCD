import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { User, Bot } from 'lucide-react-native';
import { THEME } from '../../utils/theme';

interface TurnIndicatorProps {
    isPlayerTurn: boolean;
    timeLeft: number;
}

const TurnIndicator: React.FC<TurnIndicatorProps> = ({ isPlayerTurn, timeLeft }) => {
    return (
        <View style={[styles.container, isPlayerTurn ? styles.playerTurn : styles.opponentTurn]}>
            <View style={styles.content}>
                {isPlayerTurn ? (
                    <User color={THEME.colors.white} size={24} />
                ) : (
                    <Bot color={THEME.colors.white} size={24} />
                )}
                <Text style={styles.turnText}>
                    {isPlayerTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
                </Text>
            </View>

            <View style={styles.timerContainer}>
                <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: THEME.spacing.md,
        borderRadius: THEME.radius.lg,
        marginVertical: THEME.spacing.sm,
        ...THEME.shadows.md,
    },
    playerTurn: {
        backgroundColor: THEME.colors.success,
    },
    opponentTurn: {
        backgroundColor: THEME.colors.danger,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    turnText: {
        color: THEME.colors.white,
        fontWeight: '900',
        fontSize: 18,
        marginLeft: THEME.spacing.sm,
    },
    timerContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        paddingHorizontal: THEME.spacing.sm,
        paddingVertical: THEME.spacing.xs,
        borderRadius: THEME.radius.sm,
    },
    timerText: {
        color: THEME.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default TurnIndicator;
