import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Trophy, Gift, Calendar, ChevronLeft, Target, Medal, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { scale, moderateScale, spacing, radii, platformValue } from '../utils/responsive';
import { apiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useCurrencyStore } from '../store/currencyStore';

const RewardsScreen = ({ navigation }: any) => {
    const { user, isGuest } = useAuth();
    const { setBalances } = useCurrencyStore();
    const [activeTab, setActiveTab] = useState<'quests' | 'ranking'>('quests');
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [quests, setQuests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [claimingId, setClaimingId] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'ranking') {
            loadLeaderboard();
        } else {
            loadQuests();
        }
    }, [activeTab]);

    const loadQuests = async () => {
        if (!user || isGuest) return;
        setLoading(true);
        try {
            const res = await apiService.getQuests(user.username);
            if (res.success) {
                setQuests(res.data || []);
            }
        } catch (error) {
            console.error('Error loading quests:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await apiService.getLeaderboard('wins');
            if (res && res.success) {
                const data = res.data?.leaderboard || [];
                setLeaderboard(data);
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async (questId: string) => {
        if (!user || isGuest) return;
        setClaimingId(questId);
        try {
            const res = await apiService.claimQuest(user.username, questId);
            if (res.success) {
                Alert.alert('Reward Claimed!', res.message);
                loadQuests();
                // Refresh local currency store
                const stats = await apiService.getPlayerStats(user.username);
                if (stats.success) {
                    setBalances(stats.data.coin_balance, stats.data.diamonds_balance);
                }
            } else {
                Alert.alert('Error', res.message || 'Could not claim reward');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to claim reward');
        } finally {
            setClaimingId(null);
        }
    };

    const renderQuests = () => (
        <>
            <View style={styles.dailyRewardCard}>
                <LinearGradient
                    colors={['#8B5CF6', '#4F46E5'] as any}
                    style={styles.dailyGradient}
                />
                <View style={styles.dailyInfo}>
                    <Calendar color="#FFF" size={moderateScale(32)} />
                    <View style={{ marginLeft: spacing.md }}>
                        <Text style={styles.dailyTitle}>Daily Reward</Text>
                        <Text style={styles.dailySubtitle}>Day 4 of 7</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.claimButton}>
                    <Text style={styles.claimText}>CLAIM</Text>
                </TouchableOpacity>
            </View>

            {isGuest && (
                <View style={styles.loginRequired}>
                    <Target color="#64748B" size={moderateScale(48)} />
                    <Text style={styles.loginRequiredTitle}>Login to track quests</Text>
                    <Text style={styles.loginRequiredDesc}>Create an account to save your progress and claim rewards.</Text>
                    <TouchableOpacity
                        style={styles.loginCta}
                        onPress={() => navigation.navigate('Auth')}
                    >
                        <Text style={styles.loginCtaText}>LOGIN / SIGNUP</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!isGuest && quests.length === 0 && !loading && (
                <View style={styles.emptyQuests}>
                    <CheckCircle2 color="#64748B" size={moderateScale(48)} />
                    <Text style={styles.emptyQuestsTitle}>No active quests</Text>
                    <Text style={styles.emptyQuestsDesc}>Check back later for new challenges!</Text>
                </View>
            )}

            {!isGuest && loading && quests.length === 0 ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
            ) : (
                !isGuest && quests.map(quest => (
                    <View key={quest.id} style={[styles.questCard, quest.is_claimed && styles.claimedQuest]}>
                        <View style={styles.questHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.questTitle}>{quest.title}</Text>
                                <Text style={styles.questDesc}>{quest.description}</Text>
                            </View>
                            <View style={styles.rewardBadge}>
                                <Text style={styles.questReward}>
                                    {quest.reward_coins > 0 ? `+${quest.reward_coins} C` : ''}
                                    {quest.reward_coins > 0 && quest.reward_diamonds > 0 ? ' ' : ''}
                                    {quest.reward_diamonds > 0 ? `+${quest.reward_diamonds} D` : ''}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.questFooter}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${(quest.progress / quest.goal_value) * 100}%` }]} />
                                </View>
                                <Text style={styles.progressLabel}>{quest.progress} / {quest.goal_value}</Text>
                            </View>

                            {quest.is_claimed ? (
                                <View style={styles.claimedBadge}>
                                    <CheckCircle2 color="#10B981" size={moderateScale(20)} />
                                    <Text style={styles.claimedText}>Claimed</Text>
                                </View>
                            ) : quest.is_completed ? (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleClaim(quest.id)}
                                    disabled={claimingId === quest.id}
                                >
                                    {claimingId === quest.id ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Text style={styles.actionButtonText}>CLAIM</Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={[styles.actionButton, { backgroundColor: '#334155' }]}>
                                    <Text style={[styles.actionButtonText, { color: '#64748B' }]}>GO</Text>
                                </View>
                            )}
                        </View>
                    </View>
                ))
            )}
        </>
    );

    const renderRanking = () => (
        <View style={styles.rankingContainer}>
            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 50 }} />
            ) : (
                leaderboard.map((item, index) => (
                    <View key={index} style={styles.rankItem}>
                        <View style={styles.rankLeft}>
                            <View style={[styles.rankBadge, index < 3 && { backgroundColor: ['#F59E0B', '#94A3B8', '#B45309'][index] }]}>
                                <Text style={styles.rankNumber}>{index + 1}</Text>
                            </View>
                            <Text style={styles.rankName}>{item.name || item.username}</Text>
                        </View>
                        <View style={styles.rankRight}>
                            <Trophy color="#F59E0B" size={moderateScale(14)} />
                            <Text style={styles.rankValue}>{item.games_won || 0} Wins</Text>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    return (
        <ScreenContainer withGradient={false} style={{ backgroundColor: '#0F172A' }}>
            <LinearGradient
                colors={['#1E293B', '#0F172A'] as any}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft color="#FFF" size={moderateScale(28)} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Rewards & Ranking</Text>
                <View style={{ width: scale(40) }} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'quests' && styles.activeTab]}
                    onPress={() => setActiveTab('quests')}
                >
                    <Target color={activeTab === 'quests' ? '#FFF' : '#64748B'} size={moderateScale(18)} />
                    <Text style={[styles.tabText, activeTab === 'quests' && styles.activeTabText]}>Quests</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'ranking' && styles.activeTab]}
                    onPress={() => setActiveTab('ranking')}
                >
                    <Trophy color={activeTab === 'ranking' ? '#FFF' : '#64748B'} size={moderateScale(18)} />
                    <Text style={[styles.tabText, activeTab === 'ranking' && styles.activeTabText]}>Ranking</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {activeTab === 'quests' ? renderQuests() : renderRanking()}
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: platformValue(spacing.xxl + spacing.sm, spacing.xxl + spacing.md),
        paddingBottom: spacing.lg,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: moderateScale(20),
        fontWeight: 'bold',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: '#1E293B',
        gap: spacing.xs,
    },
    activeTab: {
        backgroundColor: '#6366F1',
    },
    tabText: {
        color: '#64748B',
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    activeTabText: {
        color: '#FFF',
    },
    content: {
        padding: spacing.lg,
    },
    dailyRewardCard: {
        borderRadius: radii.xl,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xl,
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
        fontSize: moderateScale(18),
        fontWeight: 'bold',
    },
    dailySubtitle: {
        color: '#DDD6FE',
        fontSize: moderateScale(14),
    },
    claimButton: {
        backgroundColor: '#FFF',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.md,
    },
    claimText: {
        color: '#4F46E5',
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginBottom: spacing.md,
    },
    questCard: {
        backgroundColor: '#1E293B',
        borderRadius: radii.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    claimedQuest: {
        opacity: 0.6,
        borderColor: 'transparent',
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    questTitle: {
        color: '#F1F5F9',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    questDesc: {
        color: '#94A3B8',
        fontSize: moderateScale(12),
        marginTop: spacing.xs / 2,
    },
    rewardBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs / 2,
        borderRadius: radii.md,
        height: scale(24),
        justifyContent: 'center',
    },
    questReward: {
        color: '#10B981',
        fontSize: moderateScale(12),
        fontWeight: 'bold',
    },
    questFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    progressContainer: {
        height: scale(6),
        backgroundColor: '#0F172A',
        borderRadius: scale(3),
        overflow: 'hidden',
        marginBottom: spacing.xs / 2,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#6366F1',
    },
    progressLabel: {
        color: '#64748B',
        fontSize: moderateScale(10),
        fontWeight: 'bold',
    },
    actionButton: {
        backgroundColor: '#6366F1',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        minWidth: scale(70),
        alignItems: 'center',
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: moderateScale(12),
        fontWeight: 'bold',
    },
    claimedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    claimedText: {
        color: '#10B981',
        fontSize: moderateScale(12),
        fontWeight: 'bold',
    },
    rankingContainer: {
        gap: spacing.sm,
    },
    rankItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        padding: spacing.md,
        borderRadius: radii.lg,
    },
    rankLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    rankBadge: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankNumber: {
        color: '#FFF',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    },
    rankName: {
        color: '#F1F5F9',
        fontSize: moderateScale(16),
        fontWeight: '500',
    },
    rankRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    rankValue: {
        color: '#F59E0B',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    },
    loginRequired: {
        alignItems: 'center',
        padding: spacing.xxl,
        marginTop: spacing.xl,
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: '#334155',
    },
    loginRequiredTitle: {
        color: '#F1F5F9',
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginTop: spacing.md,
    },
    loginRequiredDesc: {
        color: '#94A3B8',
        fontSize: moderateScale(14),
        textAlign: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
    },
    loginCta: {
        backgroundColor: '#6366F1',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: radii.lg,
    },
    loginCtaText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    emptyQuests: {
        alignItems: 'center',
        padding: spacing.xxl,
        marginTop: spacing.xl,
    },
    emptyQuestsTitle: {
        color: '#F1F5F9',
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginTop: spacing.md,
    },
    emptyQuestsDesc: {
        color: '#94A3B8',
        fontSize: moderateScale(14),
        textAlign: 'center',
        marginTop: spacing.sm,
    },
});

export default RewardsScreen;
