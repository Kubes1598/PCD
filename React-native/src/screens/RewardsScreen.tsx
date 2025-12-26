import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Trophy, Gift, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';

const RewardsScreen = ({ navigation }: any) => {
    const quests = [
        { id: 1, title: 'Win 3 Online Duels', progress: 1, total: 3, reward: '500 Coins' },
        { id: 2, title: 'Play with a Friend', progress: 0, total: 1, reward: '10 Diamonds' },
        { id: 3, title: 'Collect 50 Candies', progress: 34, total: 50, reward: '200 Coins' },
    ];

    return (
        <ScreenContainer withGradient={false} style={{ backgroundColor: '#0F172A' }}>
            <LinearGradient
                colors={['#1E293B', '#0F172A'] as any}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft color="#FFF" size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Rewards</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.dailyRewardCard}>
                    <LinearGradient
                        colors={['#8B5CF6', '#4F46E5'] as any}
                        style={styles.dailyGradient}
                    />
                    <View style={styles.dailyInfo}>
                        <Calendar color="#FFF" size={32} />
                        <View style={{ marginLeft: 16 }}>
                            <Text style={styles.dailyTitle}>Daily Reward</Text>
                            <Text style={styles.dailySubtitle}>Day 4 of 7</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.claimButton}>
                        <Text style={styles.claimText}>CLAIM</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Active Quests</Text>
                {quests.map(quest => (
                    <View key={quest.id} style={styles.questCard}>
                        <View style={styles.questHeader}>
                            <Text style={styles.questTitle}>{quest.title}</Text>
                            <Text style={styles.questReward}>{quest.reward}</Text>
                        </View>
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { width: `${(quest.progress / quest.total) * 100}%` }]} />
                        </View>
                        <Text style={styles.progressLabel}>{quest.progress} / {quest.total}</Text>
                    </View>
                ))}
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    dailyRewardCard: {
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
        overflow: 'hidden',
    },
    dailyGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    dailyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dailyTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    dailySubtitle: {
        color: '#DDD6FE',
        fontSize: 14,
    },
    claimButton: {
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    claimText: {
        color: '#4F46E5',
        fontWeight: 'bold',
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    questCard: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    questTitle: {
        color: '#F1F5F9',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    questReward: {
        color: '#10B981',
        fontSize: 14,
        fontWeight: 'bold',
    },
    progressContainer: {
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
    },
    progressLabel: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'right',
    },
});

export default RewardsScreen;
