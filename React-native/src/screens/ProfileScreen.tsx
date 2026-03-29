import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { User, Trophy, Star, ChevronLeft, Copy, Target, TrendingUp, LogIn, UserPlus, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import PlayerAvatar from '../components/common/PlayerAvatar';
import { THEME } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';
import { useCurrencyStore } from '../store/currencyStore';
import { scale, moderateScale, spacing, radii, platformValue } from '../utils/responsive';
import { apiService } from '../services/api';
import { useModalStore } from '../store/modalStore';

const ProfileScreen = ({ navigation }: any) => {
    const { user, isGuest, logout } = useAuth();
    const { setBalances } = useCurrencyStore();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [user, isGuest])
    );

    const loadStats = async () => {
        if (!user || isGuest) return;
        setLoading(true);
        try {
            const res = await apiService.getPlayerStats(user.username);
            if (res.success) {
                setStats(res.data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (stats?.profile_id) {
            // Mock clipboard functionality for now
            useModalStore.getState().showModal('Copied', `Profile ID ${stats.profile_id} copied to clipboard!`);
        }
    };

    const handleLogout = () => {
        useModalStore.getState().showModal(
            "Log Out",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out",
                    style: "destructive",
                    onPress: () => {
                        logout();
                        setBalances(1000, 5); // Reset to guest balances
                    }
                }
            ]
        );
    };

    const handleRemoveAds = () => {
        if (isGuest) {
            useModalStore.getState().showModal(
                "Sign Up Required",
                "Please sign up or log in to remove ads.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign Up", onPress: () => navigation.navigate('Auth') }
                ]
            );
            return;
        }
        // TODO: Integrate with in-app purchases
        useModalStore.getState().showModal("Remove Ads", "In-App Purchase coming soon! 🚀");
    };

    const winRate = stats && stats.games_played > 0
        ? ((stats.games_won / stats.games_played) * 100).toFixed(1)
        : '0.0';

    return (
        <ScreenContainer withGradient={false} style={{ backgroundColor: '#0F172A' }} withBackButton>
            <LinearGradient
                colors={['#1E293B', '#0F172A'] as any}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Profile</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 100 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {isGuest ? (
                        <View style={styles.guestContainer}>
                            <View style={styles.guestIconContainer}>
                                <User color="#94A3B8" size={moderateScale(48)} />
                            </View>
                            <Text style={styles.guestTitle}>Join the Battle!</Text>
                            <Text style={styles.guestSubtitle}>Sign up to save your progress, earn diamonds, and climb the global rankings.</Text>

                            <TouchableOpacity
                                style={styles.authButton}
                                onPress={() => navigation.navigate('Auth')}
                            >
                                <LinearGradient
                                    colors={['#6366F1', '#4F46E5'] as any}
                                    style={styles.authButtonGradient}
                                >
                                    <UserPlus color="#FFF" size={moderateScale(20)} />
                                    <Text style={styles.authButtonText}>Sign Up / Log In</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.authButton, { marginTop: spacing.md }]}
                                onPress={handleRemoveAds}
                            >
                                <LinearGradient
                                    colors={['#F59E0B', '#D97706'] as any}
                                    style={styles.authButtonGradient}
                                >
                                    <Star color="#FFF" size={moderateScale(20)} />
                                    <Text style={styles.authButtonText}>Remove Ads</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={styles.profileInfo}>
                                <PlayerAvatar size={scale(110)} username={user?.username} />
                                <Text style={styles.username}>{user?.username || 'Hunter'}</Text>

                                <TouchableOpacity style={styles.badgeContainer} onPress={copyToClipboard}>
                                    <Text style={styles.profileIdText}>{stats?.profile_id || '#PCD-XXXX'}</Text>
                                    <Copy color="#94A3B8" size={moderateScale(14)} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                    <Trophy color="#F59E0B" size={moderateScale(24)} />
                                    <Text style={styles.statValue}>{stats?.games_won || 0}</Text>
                                    <Text style={styles.statLabel}>Wins</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Target color="#3B82F6" size={moderateScale(24)} />
                                    <Text style={styles.statValue}>{stats?.games_played || 0}</Text>
                                    <Text style={styles.statLabel}>Games</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <TrendingUp color="#10B981" size={moderateScale(24)} />
                                    <Text style={styles.statValue}>{winRate}%</Text>
                                    <Text style={styles.statLabel}>Win Rate</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Star color="#8B5CF6" size={moderateScale(24)} />
                                    <Text style={styles.statValue}>
                                        {stats?.rank === 'Champion' ? `${stats?.stars}★` : `${stats?.rank} ${stats?.tier || ''}`}
                                    </Text>
                                    <Text style={styles.statLabel}>Rank</Text>
                                </View>
                            </View>

                            <View style={styles.recentActivity}>
                                <Text style={styles.sectionTitle}>Recent Achievements</Text>
                                <View style={styles.emptyActivity}>
                                    <Text style={styles.emptyText}>Win online duels to earn unique badges!</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.logoutButton}
                                onPress={handleLogout}
                            >
                                <LogOut color="#FDA4AF" size={moderateScale(20)} />
                                <Text style={styles.logoutButtonText}>Log Out</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.removeAdsButton}
                                onPress={handleRemoveAds}
                            >
                                <Star color="#F59E0B" size={moderateScale(20)} />
                                <Text style={styles.removeAdsButtonText}>Remove Ads ⭐</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            )}
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
    content: {
        padding: spacing.lg,
    },
    profileInfo: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatarContainer: {
        width: scale(110),
        height: scale(110),
        borderRadius: scale(55),
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 3,
        borderColor: '#3B82F6',
        ...THEME.shadows.md,
    },
    username: {
        color: '#FFF',
        fontSize: moderateScale(24),
        fontWeight: 'bold',
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.full,
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    profileIdText: {
        color: '#94A3B8',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    statCard: {
        backgroundColor: '#1E293B',
        width: '47%',
        padding: spacing.lg,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...THEME.shadows.sm,
    },
    statValue: {
        color: '#FFF',
        fontSize: moderateScale(22),
        fontWeight: 'bold',
        marginTop: spacing.xs,
    },
    statLabel: {
        color: '#94A3B8',
        fontSize: moderateScale(14),
    },
    recentActivity: {
        marginTop: spacing.sm,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        marginBottom: spacing.md,
    },
    emptyActivity: {
        backgroundColor: '#1E293B',
        padding: spacing.xl,
        borderRadius: radii.lg,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#334155',
    },
    emptyText: {
        color: '#64748B',
        fontSize: moderateScale(14),
        textAlign: 'center',
    },
    guestContainer: {
        backgroundColor: '#1E293B',
        padding: spacing.xl,
        borderRadius: radii.xl,
        alignItems: 'center',
        marginTop: spacing.xl,
        borderWidth: 1,
        borderColor: '#334155',
    },
    guestIconContainer: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    guestTitle: {
        color: '#FFF',
        fontSize: moderateScale(22),
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    guestSubtitle: {
        color: '#94A3B8',
        fontSize: moderateScale(14),
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: moderateScale(20),
    },
    authButton: {
        width: '100%',
        borderRadius: radii.lg,
        overflow: 'hidden',
    },
    authButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    authButtonText: {
        color: '#FFF',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        gap: spacing.sm,
    },
    logoutButtonText: {
        color: '#FDA4AF',
        fontSize: moderateScale(16),
        fontWeight: '600',
    },
    removeAdsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        gap: spacing.sm,
    },
    removeAdsButtonText: {
        color: '#F59E0B',
        fontSize: moderateScale(15),
        fontWeight: '600',
    },
});

export default ProfileScreen;
