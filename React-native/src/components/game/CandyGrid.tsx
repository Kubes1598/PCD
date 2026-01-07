import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import CandyItem from './CandyItem';
import { THEME } from '../../utils/theme';
import { scale, moderateScale, SCREEN_WIDTH } from '../../utils/responsive';

interface CandyGridProps {
    candies: string[];
    title: string;
    onCandyPress?: (candy: string) => void;
    collectedCandies?: string[]; // Treat these as disabled/disappeared
    poisonCandy?: string | null;
    isOpponentGrid?: boolean;
}

const CandyGrid: React.FC<CandyGridProps> = ({
    candies,
    title,
    onCandyPress,
    collectedCandies = [],
    poisonCandy,
    isOpponentGrid = false
}) => {
    return (
        <View style={styles.container}>
            <Text style={[styles.title, isOpponentGrid && styles.titleOpponent]}>
                {title}
            </Text>
            <View style={styles.grid}>
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
                            gridSize={candies.length}
                        />
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: scale(4),
        width: '100%',
    },
    title: {
        fontSize: moderateScale(11),
        fontWeight: '700',
        color: THEME.colors.gray600,
        marginBottom: scale(4),
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    titleOpponent: {
        color: THEME.colors.primary,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        padding: scale(6),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
});

export default CandyGrid;
