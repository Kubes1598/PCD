import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import { Trophy, Frown, Home, RefreshCw } from 'lucide-react-native';
import { THEME } from '../../utils/theme';
import { scale, moderateScale, SCREEN_WIDTH } from '../../utils/responsive';

interface GameResultModalProps {
    visible: boolean;
    winner: 'player' | 'opponent' | 'draw' | null;
    onHome: () => void;
    onRematch: () => void;
    score: number;
    reward?: number;
}

const GameResultModal: React.FC<GameResultModalProps> = ({ visible, winner, onHome, onRematch, score, reward }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const isWin = winner === 'player';
    const isDraw = winner === 'draw';

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
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
            scaleAnim.setValue(0);
            opacity.setValue(0);
        }
    }, [visible]);

    const getStatusColor = () => {
        if (isWin) return THEME.colors.success;
        if (isDraw) return THEME.colors.warning;
        return THEME.colors.danger;
    };

    const getStatusIcon = () => {
        const iconSize = scale(48);
        if (isWin) return <Trophy color={THEME.colors.white} size={iconSize} />;
        if (isDraw) return <RefreshCw color={THEME.colors.white} size={iconSize} />;
        return <Frown color={THEME.colors.white} size={iconSize} />;
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
                    { transform: [{ scale: scaleAnim }], opacity }
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
                            <Home color={THEME.colors.primary} size={scale(18)} />
                            <Text style={styles.secondaryButtonText}>Home</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={onRematch}>
                            <RefreshCw color={THEME.colors.white} size={scale(18)} />
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
        width: SCREEN_WIDTH * 0.85,
        backgroundColor: THEME.colors.white,
        borderRadius: scale(24),
        padding: scale(20),
        alignItems: 'center',
        ...THEME.shadows.lg,
    },
    iconContainer: {
        width: scale(90),
        height: scale(90),
        borderRadius: scale(45),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -scale(65),
        borderWidth: scale(6),
        borderColor: THEME.colors.white,
        ...THEME.shadows.md,
    },
    title: {
        fontSize: moderateScale(26),
        fontWeight: '900',
        color: THEME.colors.primaryDark,
        marginTop: scale(12),
    },
    subtitle: {
        fontSize: moderateScale(14),
        color: THEME.colors.gray600,
        textAlign: 'center',
        marginVertical: scale(10),
        paddingHorizontal: scale(12),
    },
    buttonRow: {
        flexDirection: 'row',
        gap: scale(10),
        width: '100%',
        marginTop: scale(16),
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        height: scale(46),
        backgroundColor: THEME.colors.primary,
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(6),
    },
    buttonText: {
        color: THEME.colors.white,
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: THEME.colors.primary,
    },
    secondaryButtonText: {
        color: THEME.colors.primary,
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    rewardBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingVertical: scale(8),
        paddingHorizontal: scale(16),
        borderRadius: scale(10),
        alignItems: 'center',
        marginBottom: scale(12),
    },
    rewardLabel: {
        fontSize: moderateScale(9),
        fontWeight: 'bold',
        color: THEME.colors.warning,
        letterSpacing: 1,
    },
    rewardValue: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: THEME.colors.primary,
    },
});

export default GameResultModal;
