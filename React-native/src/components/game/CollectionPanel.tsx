import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { THEME } from '../../utils/theme';

interface CollectionPanelProps {
    collection: string[];
    playerName: string;
    isOpponent?: boolean;
}

const CollectionPanel: React.FC<CollectionPanelProps> = ({
    collection,
    playerName,
    isOpponent = false
}) => {
    return (
        <View style={[styles.container, isOpponent ? styles.opponentContainer : null]}>
            <View style={styles.header}>
                <Text style={styles.playerName}>{playerName}</Text>
                <View style={[styles.scoreBadge, { backgroundColor: isOpponent ? THEME.colors.danger : THEME.colors.primary }]}>
                    <Text style={styles.scoreText}>{collection.length}</Text>
                </View>
            </View>

            <View style={styles.collectionGrid}>
                {/* Placeholder slots to show empty spots up to 11 */}
                {Array.from({ length: 11 }).map((_, i) => (
                    <View key={i} style={styles.slot}>
                        {collection[i] && (
                            <Text style={styles.candyText}>{collection[i]}</Text>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: THEME.spacing.md,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: THEME.radius.xl,
        ...THEME.shadows.md,
        marginBottom: THEME.spacing.md,
    },
    opponentContainer: {
        borderLeftWidth: 4,
        borderLeftColor: THEME.colors.danger,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: THEME.spacing.sm,
    },
    playerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.colors.primary,
    },
    scoreBadge: {
        backgroundColor: THEME.colors.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreText: {
        color: THEME.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
    collectionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    slot: {
        width: 28,
        height: 28,
        borderRadius: THEME.radius.sm,
        backgroundColor: THEME.colors.gray100,
        borderWidth: 1,
        borderColor: THEME.colors.gray200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    candyText: {
        fontSize: 16,
    },
});

export default CollectionPanel;
