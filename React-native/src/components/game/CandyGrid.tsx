import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import CandyItem from './CandyItem';
import { THEME } from '../../utils/theme';
import { scale, moderateScale, SCREEN_WIDTH } from '../../utils/responsive';

interface CandyGridProps {
    candies: string[];
    title: string;
    onCandyPress?: (candy: string) => void;
    collectedCandies?: string[];
    poisonCandy?: string | null;
    trayType?: 'player' | 'opponent';
}

const CandyGrid: React.FC<CandyGridProps> = ({
    candies,
    title,
    onCandyPress,
    collectedCandies = [],
    poisonCandy,
    trayType = 'player'
}) => {
    const isOpponent = trayType === 'opponent';

    return (
        <View style={styles.container}>
            <Text style={[styles.title, isOpponent && styles.titleOpponent]}>
                {title}
            </Text>
            <View style={[
                styles.grid,
                isOpponent ? styles.gridOpponent : styles.gridPlayer
            ]}>
                {candies.map((candy, index) => {
                    const isCollected = collectedCandies.includes(candy);
                    const isPoison = candy === poisonCandy;

                    return (
                        <CandyItem
                            key={`${candy}-${index}`}
                            candy={candy}
                            onPress={onCandyPress ? () => onCandyPress(candy) : undefined}
                            isPoison={isPoison}
                            disabled={isCollected}
                        />
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: scale(2),
        width: '100%',
    },
    title: {
        fontSize: moderateScale(11),
        fontWeight: '800',
        color: THEME.colors.gray600,
        marginBottom: scale(4),
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        textAlign: 'center',
    },
    titleOpponent: {
        color: THEME.colors.danger,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(4),
        borderRadius: scale(12),
        borderWidth: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        minHeight: scale(100),
    },
    gridPlayer: {
        backgroundColor: 'rgba(59, 130, 246, 0.05)', // Subtle blue
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    gridOpponent: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)', // Subtle red
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
});

export default CandyGrid;
