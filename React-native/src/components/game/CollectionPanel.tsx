import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { THEME } from '../../utils/theme';
import { scale, moderateScale, SCREEN_WIDTH } from '../../utils/responsive';

interface CollectionPanelProps {
    collection: string[];
    playerName: string;
    isOpponent?: boolean;
}

// Calculate slot size based on screen width - need to fit 11 slots in a row
const getSlotSize = (): number => {
    const availableWidth = SCREEN_WIDTH - scale(48); // Account for padding
    return Math.min((availableWidth / 11) - scale(3), scale(24)); // Max 24, with gaps
};

const CollectionPanel: React.FC<CollectionPanelProps> = ({
    collection,
    playerName,
    isOpponent = false
}) => {
    const slotSize = getSlotSize();
    const fontSize = slotSize * 0.6;

    return (
        <View style={[styles.container, isOpponent && styles.opponentContainer]}>
            <View style={styles.header}>
                <Text style={[styles.playerName, isOpponent && styles.opponentName]}>
                    {playerName}
                </Text>
                <View style={[
                    styles.scoreBadge,
                    { backgroundColor: isOpponent ? THEME.colors.danger : THEME.colors.primary }
                ]}>
                    <Text style={styles.scoreText}>{collection.length}</Text>
                </View>
            </View>

            <View style={styles.collectionRow}>
                {/* Show 11 slots in a single row */}
                {Array.from({ length: 11 }).map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.slot,
                            { width: slotSize, height: slotSize },
                            collection[i] && styles.slotFilled
                        ]}
                    >
                        {collection[i] && (
                            <Text style={[styles.candyText, { fontSize }]}>
                                {collection[i]}
                            </Text>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: scale(6),
        paddingHorizontal: scale(8),
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: scale(10),
        ...THEME.shadows.sm,
        marginVertical: scale(4),
    },
    opponentContainer: {
        borderLeftWidth: 3,
        borderLeftColor: THEME.colors.danger,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(4),
    },
    playerName: {
        fontSize: moderateScale(12),
        fontWeight: '700',
        color: THEME.colors.primary,
    },
    opponentName: {
        color: THEME.colors.danger,
    },
    scoreBadge: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreText: {
        color: THEME.colors.white,
        fontWeight: 'bold',
        fontSize: moderateScale(11),
    },
    collectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    slot: {
        borderRadius: scale(4),
        backgroundColor: THEME.colors.gray100,
        borderWidth: 1,
        borderColor: THEME.colors.gray200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    slotFilled: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    candyText: {
        textAlign: 'center',
    },
});

export default CollectionPanel;
