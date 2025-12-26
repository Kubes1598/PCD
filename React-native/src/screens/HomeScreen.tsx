import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Platform } from 'react-native';
import { LogOut, Sword, Globe, Users, X, Gift, Settings, User, Trophy, Coins as CoinIcon, Gem, Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';
import { useGame } from '../hooks/useGame';
import { useCurrencyStore } from '../store/currencyStore';
import { StackNavigationProp } from '@react-navigation/stack';

const { width } = Dimensions.get('window');
const IS_SMALL_DEVICE = width < 375;

type HomeScreenProps = {
    navigation: StackNavigationProp<any, any>;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
    const { user, logout } = useAuth();
    const { initGame, isSearching, startSearching, stopSearching, queuePosition, totalWaiting, gameId } = useGame();
    const { coins, diamonds, claimDailyReward, canClaimDailyReward } = useCurrencyStore();
    const [reward, setReward] = React.useState<{ coins: number, diamonds: number, streak: number } | null>(null);
    const [showArenaSelection, setShowArenaSelection] = React.useState(false);

    useEffect(() => {
        if (gameId && !isSearching) {
            navigation.navigate('Game');
        }
    }, [gameId, isSearching]);

    const handleStartGame = async (mode: 'ai' | 'online' | 'offline', difficulty?: 'easy' | 'medium' | 'hard', arena?: 'Dubai' | 'Cairo' | 'Oslo') => {
        const fees = { easy: 0, medium: 100, hard: 250, online: 500, Dubai: 500, Cairo: 1000, Oslo: 5000 };
        const fee = mode === 'online' ? (arena ? fees[arena] : 500) : (mode === 'ai' && difficulty ? fees[difficulty] : 0);

        if (coins < fee) {
            alert(`Insufficient Coins! You need ${fee} coins to enter.`);
            return;
        }

        if (mode === 'online') {
            if (!arena) {
                setShowArenaSelection(true);
            } else {
                setShowArenaSelection(false);
                startSearching(arena);
            }
        } else {
            await initGame(mode as any, difficulty, arena);
            navigation.navigate('Game');
        }
    };

    return (
        <ScreenContainer withGradient={false} style={{ backgroundColor: '#0F172A' }}>
            {/* Main Background Gradient */}
            <LinearGradient
                colors={['#1E293B', '#0F172A', '#020617'] as any}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Top Profile Header */}
                <View style={styles.topHeader}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatarContainer}>
                            <User color="#CBD5E1" size={24} />
                        </View>
                        <View>
                            <Text style={styles.greetingText}>Welcome back,</Text>
                            <Text style={styles.usernameText}>{user?.username || 'Hunter'}</Text>
                        </View>
                    </View>
                    <View style={styles.topActions}>
                        <TouchableOpacity style={styles.iconCircle}>
                            <Bell color="#F1F5F9" size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => logout()} style={[styles.iconCircle, { marginLeft: 12 }]}>
                            <LogOut color="#FDA4AF" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Balance Row - Modern Premium Badges */}
                <View style={styles.balanceRow}>
                    <View style={styles.balanceBadge}>
                        <LinearGradient
                            colors={['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.1)'] as any}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.badgeGradient}
                        />
                        <View style={[styles.currencyIcon, { backgroundColor: '#F59E0B' }]}>
                            <CoinIcon color="#FFF" size={14} />
                        </View>
                        <Text style={styles.balanceValue}>{coins.toLocaleString()}</Text>
                    </View>

                    <View style={styles.balanceBadge}>
                        <LinearGradient
                            colors={['rgba(6, 182, 212, 0.2)', 'rgba(8, 145, 178, 0.1)'] as any}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.badgeGradient}
                        />
                        <View style={[styles.currencyIcon, { backgroundColor: '#06B6D4' }]}>
                            <Gem color="#FFF" size={14} />
                        </View>
                        <Text style={styles.balanceValue}>{diamonds.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Quick Actions Grid - 2x2 Modern Style */}
                <View style={styles.actionGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#3B82F620' }]}>
                            <User color="#3B82F6" size={24} />
                        </View>
                        <Text style={styles.actionLabel}>Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Friends')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#8B5CF620' }]}>
                            <Users color="#8B5CF6" size={24} />
                        </View>
                        <Text style={styles.actionLabel}>Friends</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Rewards')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#10B98120' }]}>
                            <Trophy color="#10B981" size={24} />
                        </View>
                        <Text style={styles.actionLabel}>Rewards</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => navigation.navigate('Settings')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#64748B20' }]}>
                            <Settings color="#64748B" size={24} />
                        </View>
                        <Text style={styles.actionLabel}>Settings</Text>
                    </TouchableOpacity>
                </View>

                {/* Featured Events - Horizontal Pagination */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>FEATURED EVENTS</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.eventsScroll}
                    decelerationRate="fast"
                    snapToInterval={width - 40}
                >
                    {[
                        { id: 1, title: 'Lunar Festival', prize: '5,000', color: '#FCD34D', type: 'Timed Event' },
                        { id: 2, title: 'Pro League', prize: '10 Diamonds', color: '#60A5FA', type: 'Ranked' },
                    ].map(event => (
                        <TouchableOpacity key={event.id} style={[styles.eventCard, { backgroundColor: event.color + '15' }]}>
                            <LinearGradient
                                colors={[event.color + '20', 'transparent'] as any}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.eventInfo}>
                                <Text style={[styles.eventTypeText, { color: event.color }]}>{event.type}</Text>
                                <Text style={styles.eventTitleText}>{event.title}</Text>
                                <View style={styles.prizeBadge}>
                                    <Trophy color={event.color} size={14} />
                                    <Text style={[styles.prizeText, { color: event.color }]}>{event.prize} Prize</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={[styles.joinBtn, { backgroundColor: event.color }]}>
                                <Text style={styles.joinBtnText}>JOIN</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Main Battle Modes Section */}
                <View style={styles.sectionDivider}>
                    <Text style={styles.sectionTitle}>BATTLE ARENA</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Online Arena Card - Premium Highlight */}
                <TouchableOpacity
                    style={styles.premiumBattleCard}
                    onPress={() => handleStartGame('online')}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={['#4F46E5', '#312E81'] as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.premiumCardBg}
                    />
                    <View style={styles.premiumCardContent}>
                        <View style={styles.premiumCardIcon}>
                            <Globe color="#DDD6FE" size={32} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.battleTitleText}>World Online Duel</Text>
                            <Text style={styles.battleDescText}>Compete for glory and diamonds</Text>
                        </View>
                        <View style={styles.battleCta}>
                            <Text style={styles.ctaText}>PLAY</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Local & AI Grid */}
                <View style={styles.secondaryModesRow}>
                    <TouchableOpacity
                        style={styles.secondaryModeCard}
                        onPress={() => handleStartGame('offline')}
                    >
                        <Users color="#94A3B8" size={24} />
                        <Text style={styles.secondaryModeTitle}>Local Duel</Text>
                        <Text style={styles.secondaryModeSubtitle}>Pass & Play</Text>
                    </TouchableOpacity>

                    <View style={styles.aiModeContainer}>
                        <Text style={styles.aiLabel}>VS COMPUTER</Text>
                        <View style={styles.aiButtonsRow}>
                            {['easy', 'medium', 'hard'].map((level) => (
                                <TouchableOpacity
                                    key={level}
                                    onPress={() => handleStartGame('ai', level as any)}
                                    style={[
                                        styles.aiLevelBtn,
                                        level === 'hard' && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                                    ]}
                                >
                                    <Sword
                                        color={level === 'hard' ? '#EF4444' : level === 'medium' ? '#F59E0B' : '#10B981'}
                                        size={16}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Daily Gift Banner if available */}
                {canClaimDailyReward() && (
                    <TouchableOpacity
                        style={styles.giftBanner}
                        onPress={() => {
                            const res = claimDailyReward();
                            if (res) setReward(res);
                        }}
                    >
                        <LinearGradient
                            colors={['#F59E0B', '#B45309'] as any}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.giftBannerGradient}
                        />
                        <Gift color="#FFF" size={24} />
                        <View style={{ marginLeft: 15, flex: 1 }}>
                            <Text style={styles.giftTitle}>Daily Reward Ready!</Text>
                            <Text style={styles.giftSub}>Claim your free coins & diamonds</Text>
                        </View>
                        <View style={styles.claimBadge}>
                            <Text style={styles.claimBadgeText}>CLAIM</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Matchmaking Overlay */}
            <Modal visible={!!isSearching} transparent={true} animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <Globe color="#6366F1" size={64} />
                        <Text style={styles.modalTitle}>MATCHMAKING</Text>
                        <Text style={styles.modalText}>
                            Position: {queuePosition} • Online: {totalWaiting}
                        </Text>
                        <ActivityIndicator size="large" color="#6366F1" style={{ marginVertical: 30 }} />
                        <TouchableOpacity style={styles.cancelButton} onPress={() => stopSearching()}>
                            <X color="#FFF" size={20} />
                            <Text style={styles.cancelText}>CANCEL SEARCH</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Arena Selection */}
            <Modal visible={!!showArenaSelection} transparent={true} animationType="slide">
                <View style={styles.overlay}>
                    <View style={styles.arenaModal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SELECT ARENA</Text>
                            <TouchableOpacity onPress={() => setShowArenaSelection(false)}>
                                <X color="#94A3B8" size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ width: '100%' }}>
                            {[
                                { name: 'Dubai', fee: 500, prize: 950, timer: 30, emoji: '🏙️', color: '#3B82F6' },
                                { name: 'Cairo', fee: 1000, prize: 1900, timer: 20, emoji: '🏛️', color: '#F59E0B' },
                                { name: 'Oslo', fee: 5000, prize: 9500, timer: 10, emoji: '🏔️', color: '#EF4444' },
                            ].map((arena) => (
                                <TouchableOpacity
                                    key={arena.name}
                                    style={styles.arenaItem}
                                    onPress={() => handleStartGame('online', undefined, arena.name as any)}
                                >
                                    <View style={[styles.arenaItemIcon, { backgroundColor: arena.color + '20' }]}>
                                        <Text style={{ fontSize: 24 }}>{arena.emoji}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 15 }}>
                                        <Text style={[styles.arenaItemName, { color: arena.color }]}>{arena.name}</Text>
                                        <Text style={styles.arenaItemDetails}>Fee: {arena.fee} • Prize: {arena.prize}</Text>
                                    </View>
                                    <View style={styles.arenaTimerBadge}>
                                        <Text style={styles.arenaTimerText}>{arena.timer}s</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Reward Modal */}
            <Modal visible={!!reward} transparent={true} animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <Text style={{ fontSize: 80 }}>🎁</Text>
                        <Text style={styles.modalTitle}>DAILY LOOT!</Text>
                        <Text style={styles.modalText}>You've earned a streak of {reward?.streak} days</Text>

                        <View style={styles.rewardContainer}>
                            <View style={styles.rewardPiece}>
                                <CoinIcon color="#F59E0B" size={24} />
                                <Text style={styles.rewardValueText}>+{reward?.coins}</Text>
                            </View>
                            <View style={styles.rewardPiece}>
                                <Gem color="#06B6D4" size={24} />
                                <Text style={styles.rewardValueText}>+{reward?.diamonds}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.finalClaimBtn} onPress={() => setReward(null)}>
                            <Text style={styles.finalClaimText}>COLLECT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 20 : 40,
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#475569',
    },
    greetingText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    usernameText: {
        color: '#F1F5F9',
        fontSize: 20,
        fontWeight: 'bold',
    },
    topActions: {
        flexDirection: 'row',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#475569',
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        gap: 12,
    },
    balanceBadge: {
        flex: 1,
        height: 54,
        borderRadius: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    badgeGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    currencyIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    balanceValue: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 35,
    },
    actionCard: {
        width: (width - 48 - 12) / 2,
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    actionIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    actionLabel: {
        color: '#CBD5E1',
        fontSize: 13,
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
        marginTop: 10,
    },
    seeAllText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '600',
    },
    eventsScroll: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    eventCard: {
        width: width - 40,
        height: 140,
        borderRadius: 24,
        marginRight: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    eventInfo: {
        flex: 1,
    },
    eventTypeText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    eventTitleText: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 12,
    },
    prizeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    prizeText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    joinBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    joinBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
    },
    sectionDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#6366F1',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        marginRight: 15,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    premiumBattleCard: {
        width: '100%',
        height: 100,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 10,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    premiumCardBg: {
        ...StyleSheet.absoluteFillObject,
    },
    premiumCardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    premiumCardIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    battleTitleText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    battleDescText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    battleCta: {
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    ctaText: {
        color: '#4F46E5',
        fontWeight: '900',
        fontSize: 12,
    },
    secondaryModesRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 25,
    },
    secondaryModeCard: {
        flex: 1,
        backgroundColor: '#1E293B',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    secondaryModeTitle: {
        color: '#F1F5F9',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
    },
    secondaryModeSubtitle: {
        color: '#64748B',
        fontSize: 12,
    },
    aiModeContainer: {
        flex: 1,
        backgroundColor: '#1E293B',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#334155',
        justifyContent: 'center',
    },
    aiLabel: {
        color: '#6366F1',
        fontSize: 10,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
    },
    aiButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    aiLevelBtn: {
        flex: 1,
        height: 40,
        backgroundColor: '#334155',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    giftBanner: {
        width: '100%',
        padding: 20,
        borderRadius: 24,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    giftBannerGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    giftTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    giftSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    claimBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    claimBadgeText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 10,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '90%',
        padding: 30,
        borderRadius: 32,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
        marginTop: 20,
        letterSpacing: 2,
    },
    modalText: {
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 5,
    },
    cancelButton: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 25,
        backgroundColor: '#EF4444',
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelText: {
        color: '#FFF',
        fontWeight: '900',
        marginLeft: 10,
        fontSize: 13,
    },
    arenaModal: {
        width: '90%',
        height: '70%',
        padding: 24,
        borderRadius: 32,
        backgroundColor: '#1E293B',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    arenaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#334155',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#475569',
    },
    arenaItemIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    arenaItemName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    arenaItemDetails: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    arenaTimerBadge: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    arenaTimerText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    rewardContainer: {
        flexDirection: 'row',
        gap: 15,
        marginVertical: 30,
    },
    rewardPiece: {
        padding: 20,
        backgroundColor: '#334155',
        borderRadius: 20,
        alignItems: 'center',
        minWidth: 100,
        borderWidth: 1,
        borderColor: '#475569',
    },
    rewardValueText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        marginTop: 8,
    },
    finalClaimBtn: {
        width: '100%',
        paddingVertical: 18,
        backgroundColor: '#10B981',
        borderRadius: 20,
        alignItems: 'center',
    },
    finalClaimText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 1,
    }
});

export default HomeScreen;
