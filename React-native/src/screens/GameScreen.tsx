import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useGame } from '../hooks/useGame';
import ScreenContainer from '../components/layout/ScreenContainer';
import CandyGrid from '../components/game/CandyGrid';
import CollectionPanel from '../components/game/CollectionPanel';
import TurnIndicator from '../components/game/TurnIndicator';
import GameResultModal from '../components/game/GameResultModal';
import { THEME } from '../utils/theme';
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

    if (game.isSettingPoisonFor && !game.gameEnded) {
        const isOpponent = game.isSettingPoisonFor === 'opponent';
        const title = isOpponent ? "PLAYER 2: SELECT POISON" : (game.gameMode === 'offline' ? "PLAYER 1: SELECT POISON" : "SELECT YOUR POISON");
        const subtitle = isOpponent
            ? "Player 1, look away! Player 2, pick your target."
            : "The candy your opponent must avoid!";
        const candies = isOpponent ? game.opponentCandies : game.playerCandies;

        return (
            <ScreenContainer>
                <View style={styles.center}>
                    <Text style={[styles.title, isOpponent && { color: THEME.colors.secondary }]}>{title}</Text>
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

    return (
        <ScreenContainer>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TurnIndicator
                    isPlayerTurn={game.isPlayerTurn}
                    timeLeft={game.turnTimeRemaining}
                />

                <CollectionPanel
                    playerName="Opponent"
                    collection={game.opponentCollection}
                    isOpponent
                />

                <CandyGrid
                    title="Pick from Opponent's Pool"
                    candies={game.opponentCandies}
                    onCandyPress={game.isPlayerTurn ? game.pickCandy : undefined}
                    collectedCandies={game.playerCollection}
                    isOpponentGrid
                />

                <View style={styles.divider} />

                <CandyGrid
                    title="Your Candy Pool (Opponent picks from here)"
                    candies={game.playerCandies}
                    collectedCandies={game.opponentCollection}
                    poisonCandy={game.selectedPoison}
                />

                <CollectionPanel
                    playerName="You"
                    collection={game.playerCollection}
                />

                <GameResultModal
                    visible={game.gameEnded}
                    winner={game.gameWinner}
                    score={game.playerCollection.length}
                    reward={game.lastReward}
                    onHome={() => {
                        game.resetGame();
                        navigation.navigate('Home');
                    }}
                    onRematch={() => {
                        const currentMode = game.gameMode;
                        const currentDiff = game.difficulty;
                        const currentCity = game.selectedCity;
                        game.resetGame();
                        game.initGame(currentMode, currentDiff, currentCity as any);
                    }}
                />
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        padding: THEME.spacing.md,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: THEME.spacing.xl,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: THEME.colors.primary,
        marginBottom: THEME.spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        color: THEME.colors.gray600,
        marginBottom: THEME.spacing.xl,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: THEME.colors.gray200,
        marginVertical: THEME.spacing.lg,
        opacity: 0.5,
    },
});

export default GameScreen;
