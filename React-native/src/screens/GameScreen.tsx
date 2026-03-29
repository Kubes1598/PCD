import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useGame } from '../hooks/useGame';
import ScreenContainer from '../components/layout/ScreenContainer';
import CandyGrid from '../components/game/CandyGrid';
import CollectionPanel from '../components/game/CollectionPanel';
import TurnIndicator from '../components/game/TurnIndicator';
import GameResultModal from '../components/game/GameResultModal';
import { THEME } from '../utils/theme';
import { moderateScale, scale, SCREEN_HEIGHT, verticalScale } from '../utils/responsive';
import { StackNavigationProp } from '@react-navigation/stack';

type GameScreenProps = {
    navigation: StackNavigationProp<any, any>;
};

const GameScreen: React.FC<GameScreenProps> = ({ navigation }) => {
    const game = useGame();

    useEffect(() => {
        // Start the timer tick
        const interval = setInterval(() => {
            game.tickTimer();
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Poison selection phase
    if (game.isSettingPoisonFor && !game.gameEnded) {
        const isOpponent = game.isSettingPoisonFor === 'opponent';
        const title = isOpponent
            ? "PLAYER 2: SELECT POISON"
            : (game.gameMode === 'offline' ? "PLAYER 1: SELECT POISON" : "SELECT YOUR POISON");
        const subtitle = isOpponent
            ? "Player 1, look away! Player 2, pick your target."
            : "The candy your opponent must avoid!";
        const candies = isOpponent ? game.opponentCandies : game.playerCandies;

        return (
            <ScreenContainer>
                <View style={styles.poisonPhase}>
                    <Text style={[styles.title, isOpponent && { color: THEME.colors.danger }]}>
                        {title}
                    </Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>

                    <CandyGrid
                        title={isOpponent ? "PLAYER 2 TRAY" : "PLAYER 1 TRAY"}
                        candies={candies}
                        onCandyPress={(candy) => game.setPoison(candy)}
                        trayType={isOpponent ? "opponent" : "player"}
                    />
                </View>
            </ScreenContainer>
        );
    }

    // Main gameplay - NO SCROLL, everything must fit
    return (
        <ScreenContainer>
            <View style={styles.gameContainer}>
                {/* Turn Indicator - Compact inline */}
                <TurnIndicator
                    isPlayerTurn={game.isPlayerTurn}
                    timeLeft={game.turnTimeRemaining}
                />

                {/* Final Chance Banner */}
                {(game.gameProgress.gamePhase === 'player_reached_11' || game.gameProgress.gamePhase === 'opponent_reached_11') && !game.gameEnded && (
                    <View style={styles.finalChanceBanner}>
                        <Text style={styles.finalChanceText}>⚡ FINAL CHANCE ⚡</Text>
                        <Text style={styles.finalChanceSubtext}>
                            {game.gameProgress.gamePhase === 'player_reached_11' ? "Player 2 can still force a draw!" : "You can still force a draw!"}
                        </Text>
                    </View>
                )}

                {/* Opponent's Collection - Top */}
                <CollectionPanel
                    playerName={game.gameMode === 'offline' ? "Player 2" : "Opponent"}
                    collection={game.opponentCollection}
                    isOpponent
                    isBot={game.gameMode === 'ai'}
                />

                {/* Opponent's Candy Pool - Player picks from here */}
                <CandyGrid
                    title={game.gameMode === 'offline'
                        ? (game.isPlayerTurn ? "🎯 PLAYER 1: PICK FROM PLAYER 2 TRAY" : "PLAYER 2'S TRAY")
                        : "🎯 PICK FROM OPPONENT'S TRAY"
                    }
                    candies={game.opponentCandies}
                    onCandyPress={game.isPlayerTurn ? (c => game.pickCandy(c)) : undefined}
                    collectedCandies={game.playerCollection}
                    trayType="opponent"
                />

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>VS</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Player's Candy Pool - Opponent picks from here (Active for Player 2 in Offline) */}
                <CandyGrid
                    title={game.gameMode === 'offline'
                        ? (!game.isPlayerTurn ? "🎯 PLAYER 2: PICK FROM PLAYER 1 TRAY" : "PLAYER 1'S TRAY")
                        : "YOUR TRAY (Opponent picks here)"
                    }
                    candies={game.playerCandies}
                    onCandyPress={(game.gameMode === 'offline' && !game.isPlayerTurn) ? (c => game.pickCandy(c)) : undefined}
                    collectedCandies={game.opponentCollection}
                    poisonCandy={game.gameMode === 'offline' ? undefined : game.selectedPoison} // Hide poison during Local Duel turn
                    trayType="player"
                />

                {/* Player's Collection - Bottom */}
                <CollectionPanel
                    playerName={game.gameMode === 'offline' ? "Player 1" : "You"}
                    collection={game.playerCollection}
                />

                {/* Game Result Modal */}
                <GameResultModal
                    visible={game.gameEnded}
                    winner={game.gameWinner}
                    winReason={game.winReason}
                    score={game.playerCollection.length}
                    reward={game.lastReward}
                    onHome={() => {
                        game.resetGame();
                        navigation.navigate('DrawerScreens', { screen: 'Home' });
                    }}
                    onRematch={() => {
                        const currentMode = game.gameMode;
                        const currentDiff = game.difficulty;
                        const currentCity = game.selectedCity;
                        game.resetGame();
                        game.initGame(currentMode, currentDiff, currentCity as any);
                    }}
                />

                {/* Reconnecting Overlay */}
                {game.isReconnecting && (
                    <View style={styles.reconnectingOverlay}>
                        <View style={styles.reconnectingBox}>
                            <Text style={styles.reconnectingText}>🔄 Connection lost...</Text>
                            <Text style={styles.reconnectingSubtext}>Attempting to rebind your session. Do not close the app.</Text>
                        </View>
                    </View>
                )}
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    gameContainer: {
        flex: 1,
        paddingHorizontal: scale(12),
        paddingTop: scale(8),
        paddingBottom: scale(8),
        justifyContent: 'space-between',
    },
    poisonPhase: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(20),
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: '900',
        color: THEME.colors.primary,
        marginBottom: scale(4),
        textAlign: 'center',
    },
    subtitle: {
        fontSize: moderateScale(13),
        color: THEME.colors.gray600,
        marginBottom: scale(16),
        textAlign: 'center',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: scale(4),
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
    },
    dividerText: {
        fontSize: moderateScale(10),
        fontWeight: '800',
        color: THEME.colors.primary,
        paddingHorizontal: scale(8),
    },
    reconnectingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    reconnectingBox: {
        backgroundColor: THEME.colors.white,
        padding: scale(20),
        borderRadius: scale(16),
        alignItems: 'center',
        width: '80%',
    },
    reconnectingText: {
        fontSize: moderateScale(18),
        fontWeight: '900',
        color: THEME.colors.primary,
        marginBottom: scale(8),
    },
    reconnectingSubtext: {
        fontSize: moderateScale(14),
        color: THEME.colors.gray600,
        textAlign: 'center',
    },
    finalChanceBanner: {
        backgroundColor: THEME.colors.warning,
        paddingVertical: scale(6),
        alignItems: 'center',
        marginVertical: scale(4),
        borderRadius: scale(8),
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        ...THEME.shadows.sm,
    },
    finalChanceText: {
        fontSize: moderateScale(14),
        fontWeight: '900',
        color: THEME.colors.white,
        letterSpacing: 1,
    },
    finalChanceSubtext: {
        fontSize: moderateScale(10),
        fontWeight: '700',
        color: 'rgba(255,255,255,0.9)',
    },
});

export default GameScreen;
