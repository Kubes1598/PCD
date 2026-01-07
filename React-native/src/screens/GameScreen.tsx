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
                    <Text style={[styles.title, isOpponent && { color: THEME.colors.secondary }]}>
                        {title}
                    </Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>

                    <CandyGrid
                        title={isOpponent ? "Player 2's Pool" : "Player 1's Pool"}
                        candies={candies}
                        onCandyPress={(candy) => game.setPoison(candy)}
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

                {/* Opponent's Collection - Top */}
                <CollectionPanel
                    playerName="Opponent"
                    collection={game.opponentCollection}
                    isOpponent
                />

                {/* Opponent's Candy Pool - Player picks from here */}
                <CandyGrid
                    title="Pick from Opponent's Pool"
                    candies={game.opponentCandies}
                    onCandyPress={game.isPlayerTurn ? game.pickCandy : undefined}
                    collectedCandies={game.playerCollection}
                    isOpponentGrid
                />

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>VS</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Player's Candy Pool - Opponent picks from here */}
                <CandyGrid
                    title="Your Pool (Opponent picks here)"
                    candies={game.playerCandies}
                    collectedCandies={game.opponentCollection}
                    poisonCandy={game.selectedPoison}
                />

                {/* Player's Collection - Bottom */}
                <CollectionPanel
                    playerName="You"
                    collection={game.playerCollection}
                />

                {/* Game Result Modal */}
                <GameResultModal
                    visible={game.gameEnded}
                    winner={game.gameWinner}
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
});

export default GameScreen;
