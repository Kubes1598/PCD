import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import CandyItem from './CandyItem';
import { THEME } from '../../utils/theme';

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
            <Text style={styles.title}>{title}</Text>
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
                            style={styles.candyItem}
                        />
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: THEME.spacing.md,
        width: '100%',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.colors.primary,
        marginBottom: THEME.spacing.sm,
        paddingHorizontal: THEME.spacing.xs,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        padding: THEME.spacing.sm,
        borderRadius: THEME.radius.lg,
        borderWidth: 1,
        borderColor: THEME.colors.carton,
    },
    candyItem: {
        width: '21%', // Roughly 4 per row
        aspectRatio: 1,
    },
});

export default CandyGrid;
