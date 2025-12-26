import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Modal, Dimensions } from 'react-native';
import { Trophy, Frown, Home, RefreshCw } from 'lucide-react-native';
import { THEME } from '../../utils/theme';

const { width } = Dimensions.get('window');

interface GameResultModalProps {
    visible: boolean;
    winner: 'player' | 'opponent' | 'draw' | null;
    onHome: () => void;
    onRematch: () => void;
    score: number;
    reward?: number;
}

const GameResultModal: React.FC<GameResultModalProps> = ({ visible, winner, onHome, onRematch, score, reward }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const isWin = winner === 'player';
    const isDraw = winner === 'draw';

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scale.setValue(0);
            opacity.setValue(0);
        }
    }, [visible]);

    const getStatusColor = () => {
        if (isWin) return THEME.colors.success;
        if (isDraw) return THEME.colors.warning;
        return THEME.colors.danger;
    };

    const getStatusIcon = () => {
        if (isWin) return <Trophy color={THEME.colors.white} size={64} />;
        if (isDraw) return <RefreshCw color={THEME.colors.white} size={64} />;
        return <Frown color={THEME.colors.white} size={64} />;
    };

    const getStatusTitle = () => {
        if (isWin) return 'VICTORY!';
        if (isDraw) return 'DRAW';
        return 'DEFEAT';
    };

    const getStatusSubtitle = () => {
        if (isWin) return `Amazing! You collected ${score} candies!`;
        if (isDraw) return "It's a draw! Both players reached 11!";
        return `Better luck next time! You got ${score} candies.`;
    };

    return (
        <Modal visible={!!visible} transparent={true} animationType="none">
            <View style={styles.overlay}>
                <Animated.View style={[
                    styles.modal,
                    { transform: [{ scale }], opacity }
                ]}>
                    <View style={[styles.iconContainer, { backgroundColor: getStatusColor() }]}>
                        {getStatusIcon()}
                    </View>

                    <Text style={styles.title}>{getStatusTitle()}</Text>
                    <Text style={styles.subtitle}>{getStatusSubtitle()}</Text>

                    {isWin && reward ? (
                        <View style={styles.rewardBox}>
                            <Text style={styles.rewardLabel}>REWARD EARNED</Text>
                            <Text style={styles.rewardValue}>+{reward} Coins</Text>
                        </View>
                    ) : null}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onHome}>
                            <Home color={THEME.colors.primary} size={20} />
                            <Text style={styles.secondaryButtonText}>Home</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={onRematch}>
                            <RefreshCw color={THEME.colors.white} size={20} />
                            <Text style={styles.buttonText}>Rematch</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: width * 0.85,
        backgroundColor: THEME.colors.white,
        borderRadius: THEME.radius.xxl,
        padding: THEME.spacing.xl,
        alignItems: 'center',
        ...THEME.shadows.lg,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -THEME.spacing.xxl - 40,
        borderWidth: 8,
        borderColor: THEME.colors.white,
        ...THEME.shadows.md,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: THEME.colors.primaryDark,
        marginTop: THEME.spacing.lg,
    },
    subtitle: {
        fontSize: 16,
        color: THEME.colors.gray600,
        textAlign: 'center',
        marginVertical: THEME.spacing.md,
        paddingHorizontal: THEME.spacing.md,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: THEME.spacing.md,
        width: '100%',
        marginTop: THEME.spacing.lg,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        height: 55,
        backgroundColor: THEME.colors.primary,
        borderRadius: THEME.radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    buttonText: {
        color: THEME.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: THEME.colors.primary,
    },
    secondaryButtonText: {
        color: THEME.colors.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    rewardBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: THEME.radius.md,
        alignItems: 'center',
        marginBottom: THEME.spacing.lg,
    },
    rewardLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: THEME.colors.warning,
        letterSpacing: 1,
    },
    rewardValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.colors.primary,
    },
});

export default GameResultModal;
