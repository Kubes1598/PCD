import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { Menu, Sword, Globe, Users, X, Gift, User, Coins as CoinIcon, Gem, Monitor, Trophy, Target, UserPlus, Wifi, WifiOff, Gamepad2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { useGame } from '../hooks/useGame';
import { useCurrencyStore } from '../store/currencyStore';
import { THEME } from '../utils/theme';
import { useErrorStore } from '../store/errorStore';
import { feedbackService } from '../services/FeedbackService';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { scale, moderateScale, spacing, radii, SCREEN_WIDTH, isSmallDevice, platformValue } from '../utils/responsive';
import { apiService } from '../services/api';
import { CITY_CONFIG, AI_CONFIG } from '../config/gameConfig';

type HomeScreenProps = {
    navigation: DrawerNavigationProp<any, any>;
};

const ServerStatusBadge = () => {
    const { errors } = useErrorStore();
    const hasError = errors.some(e => e.severity === 'error');
    const hasWarning = errors.some(e => e.severity === 'warning');

    const statusColor = hasError ? '#EF4444' : hasWarning ? '#F59E0B' : '#10B981';
    const StatusIcon = hasError ? WifiOff : Wifi;

    return (
        <View style={[styles.statusBadge, { borderColor: statusColor + '40' }]}>
            <StatusIcon color={statusColor} size={scale(14)} />
            <Text style={[styles.statusText, { color: statusColor }]}>
                {hasError ? 'Offline' : hasWarning ? 'Unstable' : 'Online'}
            </Text>
        </View>
    );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
    const { user, isGuest } = useAuth();
    const { initGame, isSearching, startSearching, stopSearching, queuePosition, totalWaiting, gameId, matchFound, clearMatchFound } = useGame();
    const { coins, diamonds, claimDailyReward, canClaimDailyReward } = useCurrencyStore();
    const [reward, setReward] = React.useState<{ coins: number, diamonds: number, nextStage: number, cycleCompleted: boolean } | null>(null);
    const [showArenaSelection, setShowArenaSelection] = React.useState(false);
    const [showDifficultySelection, setShowDifficultySelection] = React.useState(false);
    const [showGuestSignupModal, setShowGuestSignupModal] = React.useState(false);
    const [stats, setStats] = React.useState<any>(null);

    useEffect(() => {
        if (user && !isGuest) {
            loadStats();
        }
    }, [user, isGuest]);

    const loadStats = async () => {
        if (!user || isGuest) return;
        try {
            const res = await apiService.getPlayerStats(user.username);
            if (res.success) {
                setStats(res.data);
            }
        } catch (error) {
            console.error('Error loading stats on home:', error);
        }
    };

    // Auto-navigate to game after match is found with a brief delay
    useEffect(() => {
        if (matchFound && gameId) {
            // Haptic feedback for match found
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Show "MATCH FOUND!" for 1.5s then navigate to game
            const timeout = setTimeout(() => {
                clearMatchFound(); // Clear the modal state
                navigation.navigate('Game');
            }, 1500);
            return () => clearTimeout(timeout);
        }
    }, [matchFound, gameId]);

    const handleStartGame = async (mode: 'ai' | 'online' | 'offline', difficulty?: 'easy' | 'medium' | 'hard', arena?: 'Dubai' | 'Cairo' | 'Oslo') => {
        // Use config values instead of hardcoded fees
        let fee = 0;
        if (mode === 'online' && arena) {
            fee = CITY_CONFIG[arena]?.entryFee || 500;
        } else if (mode === 'ai' && difficulty) {
            fee = AI_CONFIG[difficulty]?.entryFee || 0;
        }

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
        } else if (mode === 'ai') {
            setShowDifficultySelection(false);
            await initGame(mode as any, difficulty, arena);
            navigation.navigate('Game');
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
                {/* Top Header - Hamburger Menu (Left) | Profile Icon with Username (Right) */}
                <View style={styles.topHeader}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => {
                            feedbackService.triggerSelection();
                            navigation.openDrawer();
                        }}
                    >
                        <Menu color="#F1F5F9" size={moderateScale(24)} />
                    </TouchableOpacity>

                    {/* Server Status Badge */}
                    <ServerStatusBadge />

                    <TouchableOpacity
                        style={styles.profileSection}
                        onPress={() => {
                            feedbackService.triggerSelection();
                            navigation.navigate('Profile');
                        }}
                    >
                        <View style={styles.avatarContainer}>
                            <User color="#CBD5E1" size={moderateScale(20)} />
                        </View>
                        <Text style={styles.usernameText}>{user?.username || 'Lee'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Currency Balance Row - 15px */}
                <View style={styles.balanceRow}>
                    <View style={styles.balanceBadge}>
                        <CoinIcon color="#F59E0B" size={scale(15)} />
                        <Text style={styles.balanceValue}>{coins}</Text>
                    </View>
                    <View style={styles.balanceBadge}>
                        <Gem color="#06B6D4" size={scale(15)} />
                        <Text style={styles.balanceValue}>{diamonds}</Text>
                    </View>
                    {stats?.rank && (
                        <View style={[styles.balanceBadge, { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                            <Trophy color="#8B5CF6" size={scale(15)} />
                            <Text style={[styles.balanceValue, { color: '#C084FC' }]}>
                                {stats.rank === 'Champion' ? `${stats.stars}★` : `${stats.rank} ${stats.tier || ''}`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Main Battle Modes Section */}
                <View style={styles.sectionDivider}>
                    <Text style={styles.sectionTitle}>BATTLE ARENA</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Online Arena Card - Premium Highlight */}
                <TouchableOpacity
                    style={styles.premiumBattleCard}
                    onPress={() => {
                        feedbackService.triggerSelection();
                        handleStartGame('online');
                    }}
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
                            <Globe color="#DDD6FE" size={moderateScale(32)} />
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
                        onPress={() => {
                            feedbackService.triggerSelection();
                            handleStartGame('offline');
                        }}
                    >
                        <Users color="#94A3B8" size={moderateScale(24)} />
                        <Text style={styles.secondaryModeTitle}>Local Duel</Text>
                        <Text style={styles.secondaryModeSubtitle}>Pass & Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryModeCard}
                        onPress={() => {
                            feedbackService.triggerSelection();
                            setShowDifficultySelection(true);
                        }}
                    >
                        <Monitor color="#94A3B8" size={moderateScale(24)} />
                        <Text style={styles.secondaryModeTitle}>VS Computer</Text>
                        <Text style={styles.secondaryModeSubtitle}>Select Difficulty</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick Access Section - Ranking, Quests, Friends */}
                <View style={styles.quickAccessRow}>
                    <TouchableOpacity
                        style={styles.quickAccessCard}
                        onPress={() => {
                            feedbackService.triggerSelection();
                            navigation.navigate('Rewards');
                        }}
                    >
                        <View style={[styles.quickAccessIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <Trophy color="#F59E0B" size={moderateScale(20)} />
                        </View>
                        <Text style={styles.quickAccessLabel}>Ranking</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickAccessCard}
                        onPress={() => {
                            feedbackService.triggerSelection();
                            navigation.navigate('Rewards');
                        }}
                    >
                        <View style={[styles.quickAccessIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                            <Target color="#6366F1" size={moderateScale(20)} />
                        </View>
                        <Text style={styles.quickAccessLabel}>Quests</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickAccessCard}
                        onPress={() => {
                            feedbackService.triggerSelection();
                            navigation.navigate('Friends');
                        }}
                    >
                        <View style={[styles.quickAccessIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                            <UserPlus color="#10B981" size={moderateScale(20)} />
                        </View>
                        <Text style={styles.quickAccessLabel}>Friends</Text>
                    </TouchableOpacity>
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
                        <Gift color="#FFF" size={moderateScale(24)} />
                        <View style={{ marginLeft: spacing.md, flex: 1 }}>
                            <Text style={styles.giftTitle}>Claim Reward!</Text>
                            <Text style={styles.giftSub}>Tap to claim next stage</Text>
                        </View>
                        <View style={styles.claimBadge}>
                            <Text style={styles.claimBadgeText}>CLAIM</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Matchmaking Overlay */}
            <Modal visible={!!isSearching || matchFound} transparent={true} animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <Globe color={matchFound ? THEME.colors.success : "#6366F1"} size={moderateScale(64)} />
                        <Text style={styles.modalTitle}>
                            {matchFound ? "🎮 MATCH FOUND!" : "MATCHMAKING"}
                        </Text>
                        <Text style={styles.modalText}>
                            {matchFound
                                ? "Entering arena... Get ready to pick your poison!"
                                : `Position: ${queuePosition} • Online: ${totalWaiting}`}
                        </Text>
                        <ActivityIndicator
                            size="large"
                            color={matchFound ? THEME.colors.success : "#6366F1"}
                            style={{ marginVertical: spacing.xl }}
                        />

                        {!matchFound && (
                            <TouchableOpacity style={styles.cancelButton} onPress={() => stopSearching()}>
                                <X color="#FFF" size={moderateScale(20)} />
                                <Text style={styles.cancelText}>CANCEL SEARCH</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Arena Selection */}
            {/* (Omitted for brevity, but I will keep it in the final file) */}

            {/* Difficulty Selection Modal */}
            <Modal visible={!!showDifficultySelection} transparent={true} animationType="slide">
                <View style={styles.overlay}>
                    <View style={styles.difficultyModal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SELECT DIFFICULTY</Text>
                            <TouchableOpacity onPress={() => setShowDifficultySelection(false)}>
                                <X color="#94A3B8" size={moderateScale(24)} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.difficultyOptions}>
                            {[
                                { level: 'easy' as const, label: 'Easy', color: '#10B981', desc: 'Relaxed gameplay' },
                                { level: 'medium' as const, label: 'Medium', color: '#F59E0B', desc: 'Balanced challenge' },
                                { level: 'hard' as const, label: 'Hard', color: '#EF4444', desc: 'Expert mode' },
                            ].map((diff) => {
                                const aiConfig = AI_CONFIG[diff.level];
                                return (
                                    <TouchableOpacity
                                        key={diff.level}
                                        style={[styles.difficultyItem, { borderColor: diff.color + '40' }]}
                                        onPress={() => handleStartGame('ai', diff.level as any)}
                                    >
                                        <View style={[styles.difficultyIcon, { backgroundColor: diff.color + '20' }]}>
                                            <Sword color={diff.color} size={moderateScale(24)} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                                            <Text style={[styles.difficultyLabel, { color: diff.color }]}>{diff.label}</Text>
                                            <Text style={styles.difficultyDesc}>{diff.desc}</Text>
                                        </View>
                                        {aiConfig.entryFee > 0 && (
                                            <View style={styles.difficultyFee}>
                                                <CoinIcon color="#F59E0B" size={moderateScale(12)} />
                                                <Text style={styles.difficultyFeeText}>{aiConfig.entryFee}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={{ marginTop: spacing.lg, padding: spacing.md, alignItems: 'center' }}
                            onPress={() => setShowDifficultySelection(false)}
                        >
                            <Text style={{ color: '#94A3B8', fontSize: moderateScale(14), fontWeight: '600' }}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Reward Modal */}
            {reward && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={styles.overlay}>
                        <View style={styles.modal}>
                            <LinearGradient
                                colors={['#1E293B', '#0F172A'] as any}
                                style={StyleSheet.absoluteFill}
                            />
                            <Gift color="#F59E0B" size={moderateScale(64)} />
                            <Text style={styles.modalTitle}>DAILY REWARD</Text>
                            <Text style={styles.modalText}>You received:</Text>

                            <View style={styles.rewardRow}>
                                {reward.coins > 0 && (
                                    <View style={styles.rewardItem}>
                                        <CoinIcon color="#F59E0B" size={moderateScale(24)} />
                                        <Text style={styles.rewardAmount}>+{reward.coins}</Text>
                                    </View>
                                )}
                                {reward.diamonds > 0 && (
                                    <View style={styles.rewardItem}>
                                        <Gem color="#06B6D4" size={moderateScale(24)} />
                                        <Text style={styles.rewardAmount}>+{reward.diamonds}</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.modalText}>
                                {reward.cycleCompleted
                                    ? "Final stage claimed! Reset in 24h."
                                    : `Stage ${reward.nextStage - 1} claimed! Tap again for more.`}
                            </Text>

                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: '#F59E0B', borderColor: '#B45309', marginTop: spacing.lg }]}
                                onPress={() => setReward(null)}
                            >
                                <Text style={[styles.cancelText, { color: '#FFF' }]}>
                                    {reward.cycleCompleted ? "DISMISS" : "AWESOME!"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Arena Selection Modal */}
            <Modal visible={showArenaSelection} transparent={true} animationType="slide">
                <View style={styles.overlay}>
                    <View style={styles.difficultyModal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SELECT ARENA</Text>
                            <TouchableOpacity onPress={() => setShowArenaSelection(false)}>
                                <X color="#94A3B8" size={moderateScale(24)} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.difficultyOptions}>
                            {(['Dubai', 'Cairo', 'Oslo'] as const).map((cityName) => {
                                const cityConfig = CITY_CONFIG[cityName];
                                const color = cityName === 'Dubai' ? '#F59E0B' : cityName === 'Cairo' ? '#3B82F6' : '#8B5CF6';
                                const desc = cityName === 'Dubai' ? 'Standard Arena' : cityName === 'Cairo' ? 'Pro Arena' : 'Elite Arena';
                                return (
                                    <TouchableOpacity
                                        key={cityName}
                                        style={[styles.difficultyItem, { borderColor: color + '40' }]}
                                        onPress={() => handleStartGame('online', undefined, cityName)}
                                    >
                                        <View style={[styles.difficultyIcon, { backgroundColor: color + '20' }]}>
                                            <Globe color={color} size={moderateScale(24)} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                                            <Text style={[styles.difficultyLabel, { color }]}>{cityName}</Text>
                                            <Text style={styles.difficultyDesc}>{desc}</Text>
                                        </View>
                                        <View style={styles.difficultyFee}>
                                            <Text style={styles.difficultyFeeText}>Fee: {cityConfig.entryFee}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={{ marginTop: spacing.lg, padding: spacing.md, alignItems: 'center' }}
                            onPress={() => setShowArenaSelection(false)}
                        >
                            <Text style={{ color: '#94A3B8', fontSize: moderateScale(14), fontWeight: '600' }}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Guest Signup Prompt Modal */}
            <Modal visible={showGuestSignupModal} transparent={true} animationType="slide">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A'] as any}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={[styles.premiumCardIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)', marginBottom: spacing.lg }]}>
                            <UserPlus color="#6366F1" size={moderateScale(32)} />
                        </View>

                        <Text style={styles.modalTitle}>PLAY ONLINE</Text>
                        <Text style={[styles.modalText, { textAlign: 'center', marginBottom: spacing.xl }]}>
                            Create an account to battle worldwide!{"\n\n"}
                            We'll save your <Text style={{ fontWeight: 'bold', color: '#F59E0B' }}>{coins} Coins</Text> and <Text style={{ fontWeight: 'bold', color: '#06B6D4' }}>{diamonds} Diamonds</Text> to your new account.
                        </Text>

                        <TouchableOpacity
                            style={[styles.battleCta, { backgroundColor: '#6366F1', width: '100%', paddingVertical: spacing.md, alignItems: 'center' }]}
                            onPress={() => {
                                setShowGuestSignupModal(false);
                                navigation.navigate('Auth', { initialCoins: coins, initialDiamonds: diamonds });
                            }}
                        >
                            <Text style={[styles.ctaText, { color: '#FFF', fontSize: moderateScale(16) }]}>CREATE ACCOUNT</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ marginTop: spacing.lg }}
                            onPress={() => setShowGuestSignupModal(false)}
                        >
                            <Text style={{ color: '#94A3B8', fontSize: moderateScale(14) }}>Maybe Later</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: spacing.lg,
        paddingTop: platformValue(spacing.lg, spacing.xl),
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    menuButton: {
        width: scale(44),
        height: scale(44),
        borderRadius: radii.md,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#475569',
    },
    profileSection: {
        alignItems: 'center',
    },
    avatarContainer: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#6366F1',
        marginBottom: spacing.xs,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.full,
        borderWidth: 1,
        gap: 6,
    },
    statusText: {
        fontSize: moderateScale(11),
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    usernameText: {
        color: '#F1F5F9',
        fontSize: moderateScale(12),
        fontWeight: '600',
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        gap: spacing.lg,
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.lg,
        gap: spacing.xs,
    },
    balanceValue: {
        color: '#FFF',
        fontSize: scale(18),
        fontWeight: '800',
    },
    sectionDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        color: '#6366F1',
        fontSize: moderateScale(12),
        fontWeight: '900',
        letterSpacing: 2,
        marginRight: spacing.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    premiumBattleCard: {
        width: '100%',
        height: scale(100),
        borderRadius: radii.xl,
        overflow: 'hidden',
        marginBottom: spacing.lg,
        elevation: 10,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: scale(10) },
        shadowOpacity: 0.3,
        shadowRadius: scale(20),
    },
    premiumCardBg: {
        ...StyleSheet.absoluteFillObject,
    },
    premiumCardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    premiumCardIcon: {
        width: scale(56),
        height: scale(56),
        borderRadius: radii.lg,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    battleTitleText: {
        color: '#FFF',
        fontSize: moderateScale(18),
        fontWeight: 'bold',
    },
    battleDescText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: moderateScale(12),
    },
    battleCta: {
        backgroundColor: '#FFF',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.md,
    },
    ctaText: {
        color: '#4F46E5',
        fontWeight: '900',
        fontSize: moderateScale(12),
    },
    secondaryModesRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    secondaryModeCard: {
        flex: 1,
        backgroundColor: '#1E293B',
        borderRadius: radii.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#334155',
    },
    secondaryModeTitle: {
        color: '#F1F5F9',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    secondaryModeSubtitle: {
        color: '#94A3B8',
        fontSize: moderateScale(12),
        marginTop: 2,
    },
    quickAccessRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    quickAccessCard: {
        flex: 1,
        backgroundColor: '#1E293B',
        borderRadius: radii.lg,
        padding: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    quickAccessIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    quickAccessLabel: {
        color: '#CBD5E1',
        fontSize: moderateScale(11),
        fontWeight: '600',
    },
    giftBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: radii.xl,
        overflow: 'hidden',
        marginBottom: spacing.xl,
    },
    giftBannerGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    giftTitle: {
        color: '#FFF',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    giftSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: moderateScale(12),
    },
    claimBadge: {
        backgroundColor: '#FFF',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.md,
    },
    claimBadgeText: {
        color: '#B45309',
        fontWeight: '900',
        fontSize: moderateScale(12),
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '90%',
        padding: spacing.xl,
        borderRadius: radii.xl,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalTitle: {
        color: '#FFF',
        fontSize: moderateScale(24),
        fontWeight: '900',
        marginTop: spacing.lg,
        letterSpacing: 2,
    },
    modalText: {
        color: '#94A3B8',
        fontSize: moderateScale(16),
        marginTop: spacing.sm,
    },
    rewardRow: {
        flexDirection: 'row',
        marginVertical: spacing.lg,
        gap: spacing.xl,
    },
    rewardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    rewardAmount: {
        color: '#FFF',
        fontSize: moderateScale(20),
        fontWeight: 'bold',
    },
    streakText: {
        color: '#10B981',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        marginBottom: spacing.lg,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        gap: spacing.sm,
    },
    cancelText: {
        color: '#F87171',
        fontWeight: 'bold',
        fontSize: moderateScale(14),
    },
    difficultyModal: {
        width: '90%',
        padding: spacing.lg,
        borderRadius: radii.xl,
        backgroundColor: '#1E293B',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    difficultyOptions: {
        gap: spacing.sm,
    },
    difficultyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: '#334155',
        borderRadius: radii.xl,
        borderWidth: 1,
    },
    difficultyIcon: {
        width: scale(48),
        height: scale(48),
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    difficultyLabel: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
    },
    difficultyDesc: {
        color: '#94A3B8',
        fontSize: moderateScale(12),
        marginTop: 2,
    },
    difficultyFee: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.full,
        gap: 4,
    },
    difficultyFeeText: {
        color: '#F59E0B',
        fontSize: moderateScale(12),
        fontWeight: 'bold',
    },
});

export default HomeScreen;
