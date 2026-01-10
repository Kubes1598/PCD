import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Users, Search, UserPlus, ChevronLeft, Circle, X, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { scale, moderateScale, spacing, radii, platformValue } from '../utils/responsive';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';

const FriendsScreen = ({ navigation }: any) => {
    const { user, isGuest } = useAuth();
    const [friends, setFriends] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [profileIdInput, setProfileIdInput] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        if (!user || isGuest) return;
        setLoading(true);
        try {
            const res = await apiService.getFriends(user.username);
            if (res.success) {
                setFriends(res.data || []);
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async () => {
        if (!profileIdInput.trim() || !user || isGuest) return;

        let id = profileIdInput.trim();
        // Allow user to omit the prefix if they only type the hex part
        if (!id.startsWith('PCD-')) {
            id = `PCD-${id.toUpperCase()}`;
        } else {
            id = id.toUpperCase();
        }

        setIsAdding(true);
        try {
            const res = await apiService.addFriend(user.username, id);
            if (res.success) {
                Alert.alert('Success', res.message);
                setShowAddModal(false);
                setProfileIdInput('');
                loadFriends();
            } else {
                Alert.alert('Error', res.message || 'Could not find player');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to add friend. Check your connection.');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <ScreenContainer withGradient={false} style={{ backgroundColor: '#0F172A' }} withBackButton>
            <LinearGradient
                colors={['#1E293B', '#0F172A'] as any}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Friends</Text>
                <TouchableOpacity style={styles.addFriendBtn} onPress={() => setShowAddModal(true)}>
                    <UserPlus color="#FFF" size={moderateScale(24)} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search color="#94A3B8" size={moderateScale(20)} />
                    <TextInput
                        placeholder="Search your friends..."
                        placeholderTextColor="#64748B"
                        style={styles.searchInput}
                    />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 50 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {isGuest ? (
                        <View style={styles.loginRequired}>
                            <Users color="#64748B" size={moderateScale(64)} />
                            <Text style={styles.loginRequiredTitle}>Login to play with friends</Text>
                            <Text style={styles.loginRequiredDesc}>Create an account to add friends, see their status, and challenge them to duels.</Text>
                            <TouchableOpacity
                                style={styles.loginCta}
                                onPress={() => navigation.navigate('Auth')}
                            >
                                <Text style={styles.loginCtaText}>LOGIN / SIGNUP</Text>
                            </TouchableOpacity>
                        </View>
                    ) : friends.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Users color="#334155" size={moderateScale(64)} />
                            <Text style={styles.emptyText}>You haven't added any friends yet.</Text>
                            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddModal(true)}>
                                <Text style={styles.emptyButtonText}>Add your first friend</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        friends.map((friend, index) => (
                            <View key={index} style={styles.friendItem}>
                                <View style={styles.friendInfo}>
                                    <View style={styles.friendAvatar}>
                                        <Text style={styles.avatarText}>{(friend.username || 'H')[0]}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.friendName}>{friend.username}</Text>
                                        <View style={styles.statusRow}>
                                            <Circle
                                                fill={friend.status === 'online' ? '#10B981' : (friend.status === 'playing' ? '#3B82F6' : '#64748B')}
                                                color="transparent"
                                                size={moderateScale(8)}
                                            />
                                            <Text style={styles.friendStatus}>{friend.status || 'offline'}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.friendStats}>
                                    <Trophy color="#F59E0B" size={moderateScale(12)} />
                                    <Text style={styles.levelLabel}>{friend.games_won || 0} Wins</Text>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add Friend Modal */}
            <Modal visible={showAddModal} transparent={true} animationType="slide">
                <View style={styles.overlay}>
                    <View style={styles.addModal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ADD FRIEND</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <X color="#94A3B8" size={moderateScale(24)} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSub}>Enter your friend's unique Profile ID to add them.</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. PCD-A1B2"
                            placeholderTextColor="#475569"
                            value={profileIdInput}
                            onChangeText={setProfileIdInput}
                            autoCapitalize="characters"
                        />

                        <TouchableOpacity
                            style={[styles.addButton, !profileIdInput && { opacity: 0.5 }]}
                            onPress={handleAddFriend}
                            disabled={!profileIdInput || isAdding}
                        >
                            {isAdding ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.addButtonText}>ADD FRIEND</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        marginLeft: scale(44), // Offset for back button
    },
    addFriendBtn: {
        padding: spacing.xs,
    },
    searchContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: radii.md,
        paddingHorizontal: spacing.sm,
        height: scale(44),
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        marginLeft: spacing.sm,
        fontSize: moderateScale(16),
    },
    content: {
        padding: spacing.lg,
    },
    sectionTitle: {
        color: '#3B82F6',
        fontSize: moderateScale(12),
        fontWeight: 'bold',
        marginBottom: spacing.md,
        letterSpacing: 1,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        borderRadius: radii.lg,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendAvatar: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    avatarText: {
        color: '#FFF',
        fontSize: moderateScale(20),
        fontWeight: 'bold',
    },
    friendName: {
        color: '#FFF',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs / 2,
    },
    friendStatus: {
        color: '#94A3B8',
        fontSize: moderateScale(12),
        marginLeft: spacing.xs,
        textTransform: 'capitalize',
    },
    levelLabel: {
        color: '#F59E0B',
        fontSize: moderateScale(12),
        fontWeight: 'bold',
    },
    friendStats: {
        alignItems: 'flex-end',
        paddingRight: spacing.xs,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        gap: spacing.md,
    },
    emptyText: {
        color: '#64748B',
        fontSize: moderateScale(16),
        textAlign: 'center',
    },
    emptyButton: {
        backgroundColor: '#6366F1',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
    },
    emptyButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    addModal: {
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: radii.xl,
        padding: spacing.xl,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: moderateScale(20),
        fontWeight: 'bold',
    },
    modalSub: {
        color: '#94A3B8',
        fontSize: moderateScale(14),
        marginBottom: spacing.lg,
    },
    modalInput: {
        backgroundColor: '#0F172A',
        color: '#FFF',
        borderRadius: radii.md,
        padding: spacing.md,
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: spacing.xl,
    },
    addButton: {
        backgroundColor: '#6366F1',
        height: scale(50),
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: moderateScale(16),
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
});

export default FriendsScreen;
