import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Bell, ChevronLeft, Inbox, Sword, UserPlus, Gift, Trash2, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { scale, moderateScale, spacing, radii, platformValue } from '../utils/responsive';

type NotificationType = 'game_invite' | 'friend_request' | 'system' | 'reward';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    time: string;
    isRead: boolean;
}

const NotificationsScreen = ({ navigation }: any) => {
    const [notifications, setNotifications] = useState<Notification[]>([
        {
            id: '1',
            type: 'game_invite',
            title: 'WickedGamer Invited You',
            message: 'Join a high-stakes duel in Cairo Arena!',
            time: '2m ago',
            isRead: false,
        },
        {
            id: '2',
            type: 'reward',
            title: 'Quest Completed',
            message: 'You have earned 500 coins for "Beginner Duelist"!',
            time: '1h ago',
            isRead: false,
        },
        {
            id: '3',
            type: 'friend_request',
            title: 'Friend Request',
            message: 'ShadowMaster wants to be your friend.',
            time: '3h ago',
            isRead: true,
        },
        {
            id: '4',
            type: 'system',
            title: 'System Update',
            message: 'Version 1.0.4 is now live. Check out the new Oslo Arena!',
            time: '1d ago',
            isRead: true,
        },
    ]);

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    };

    const deleteNotification = (id: string) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'game_invite': return <Sword color="#EF4444" size={moderateScale(20)} />;
            case 'friend_request': return <UserPlus color="#3B82F6" size={moderateScale(20)} />;
            case 'reward': return <Gift color="#F59E0B" size={moderateScale(20)} />;
            default: return <Bell color="#6366F1" size={moderateScale(20)} />;
        }
    };

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
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity onPress={markAllAsRead}>
                    <CheckCircle2 color="#94A3B8" size={moderateScale(22)} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Inbox color="#334155" size={moderateScale(48)} />
                        </View>
                        <Text style={styles.emptyTitle}>All caught up!</Text>
                        <Text style={styles.emptySubtitle}>No new notifications for you</Text>
                    </View>
                ) : (
                    notifications.map((notif) => (
                        <View key={notif.id} style={[styles.notifCard, !notif.isRead && styles.unreadCard]}>
                            <View style={[styles.iconContainer, { backgroundColor: `${styles.notifCard.backgroundColor}` }]}>
                                {getIcon(notif.type)}
                            </View>
                            <View style={styles.notifBody}>
                                <View style={styles.notifHeader}>
                                    <Text style={[styles.notifTitle, !notif.isRead && styles.unreadText]}>{notif.title}</Text>
                                    <Text style={styles.notifTime}>{notif.time}</Text>
                                </View>
                                <Text style={styles.notifMessage}>{notif.message}</Text>

                                <View style={styles.actionsRow}>
                                    {notif.type === 'game_invite' && (
                                        <TouchableOpacity style={styles.joinButton}>
                                            <Text style={styles.joinText}>JOIN NOW</Text>
                                        </TouchableOpacity>
                                    )}
                                    {notif.type === 'friend_request' && (
                                        <TouchableOpacity style={[styles.joinButton, { backgroundColor: '#312E81' }]}>
                                            <Text style={styles.joinText}>ACCEPT</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => deleteNotification(notif.id)}
                                    >
                                        <Trash2 color="#94A3B8" size={moderateScale(16)} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {!notif.isRead && <View style={styles.unreadDot} />}
                        </View>
                    ))
                )}
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
    content: {
        padding: spacing.lg,
    },
    notifCard: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: radii.xl,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        position: 'relative',
    },
    unreadCard: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    unreadDot: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6366F1',
    },
    iconContainer: {
        width: scale(44),
        height: scale(44),
        borderRadius: radii.lg,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    notifBody: {
        flex: 1,
    },
    notifHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    notifTitle: {
        color: '#CBD5E1',
        fontSize: moderateScale(15),
        fontWeight: '600',
        flex: 1,
        marginRight: spacing.sm,
    },
    unreadText: {
        color: '#F1F5F9',
        fontWeight: 'bold',
    },
    notifTime: {
        color: '#64748B',
        fontSize: moderateScale(12),
    },
    notifMessage: {
        color: '#94A3B8',
        fontSize: moderateScale(13),
        lineHeight: 18,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        gap: spacing.md,
    },
    joinButton: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.md,
    },
    joinText: {
        color: '#FFF',
        fontSize: moderateScale(11),
        fontWeight: 'bold',
    },
    deleteButton: {
        padding: 4,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        color: '#F1F5F9',
        fontSize: moderateScale(20),
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        color: '#64748B',
        fontSize: moderateScale(14),
    },
});

export default NotificationsScreen;
