import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Users, Trophy, Settings, LogOut, Home, Coins as CoinIcon, Gem, Bell, LogIn } from 'lucide-react-native';
import Coin from '../components/common/Coin';
import PlayerAvatar from '../components/common/PlayerAvatar';
import { useAuth } from '../hooks/useAuth';
import { useCurrencyStore } from '../store/currencyStore';

type DrawerItemProps = {
    label: string;
    icon: React.ReactNode;
    isActive?: boolean;
    onPress: () => void;
};

const DrawerItem: React.FC<DrawerItemProps> = ({ label, icon, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.drawerItem, isActive && styles.drawerItemActive]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
            {icon}
        </View>
        <Text style={[styles.drawerItemLabel, isActive && styles.drawerItemLabelActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const DrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
    const { navigation, state } = props;
    const { user, logout } = useAuth();
    const { coins, diamonds, setBalances } = useCurrencyStore();
    const insets = useSafeAreaInsets();
    const currentRoute = state.routes[state.index]?.name;

    const navigateTo = (screen: string) => {
        navigation.navigate(screen as never);
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1E293B', '#0F172A', '#020617'] as any}
                style={StyleSheet.absoluteFill}
            />
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
            >
                {/* User Profile Section */}
                <View style={styles.profileSection}>
                    <PlayerAvatar size={56} username={user?.username} />
                    <View style={styles.userInfo}>
                        <Text style={styles.welcomeText}>Welcome back,</Text>
                        <Text style={styles.usernameText}>{user?.username || 'Lee'}</Text>
                    </View>
                </View>

                {/* Balance Section */}
                <View style={styles.balanceSection}>
                    <View style={styles.balanceBadge}>
                        <Coin size={24} style={{ marginRight: 6 }} />
                        <Text style={styles.balanceValue}>{coins}</Text>
                    </View>
                    <View style={styles.balanceBadge}>
                        <View style={[styles.currencyIcon, { backgroundColor: '#06B6D4' }]}>
                            <Gem color="#FFF" size={12} />
                        </View>
                        <Text style={styles.balanceValue}>{diamonds}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Navigation Items */}
                <View style={styles.navSection}>
                    <DrawerItem
                        label="Home"
                        icon={<Home color={currentRoute === 'Home' ? '#6366F1' : '#94A3B8'} size={22} />}
                        isActive={currentRoute === 'Home'}
                        onPress={() => navigateTo('Home')}
                    />
                    <DrawerItem
                        label="Profile"
                        icon={<User color={currentRoute === 'Profile' ? '#6366F1' : '#94A3B8'} size={22} />}
                        isActive={currentRoute === 'Profile'}
                        onPress={() => navigateTo('Profile')}
                    />
                    <DrawerItem
                        label="Friends"
                        icon={<Users color={currentRoute === 'Friends' ? '#6366F1' : '#94A3B8'} size={22} />}
                        isActive={currentRoute === 'Friends'}
                        onPress={() => navigateTo('Friends')}
                    />
                    <DrawerItem
                        label="Rewards"
                        icon={<Trophy color={currentRoute === 'Rewards' ? '#6366F1' : '#94A3B8'} size={22} />}
                        isActive={currentRoute === 'Rewards'}
                        onPress={() => navigateTo('Rewards')}
                    />
                    <DrawerItem
                        label="Settings"
                        icon={<Settings color={currentRoute === 'Settings' ? '#6366F1' : '#94A3B8'} size={22} />}
                        isActive={currentRoute === 'Settings'}
                        onPress={() => navigateTo('Settings')}
                    />
                    <DrawerItem
                        label="Notifications"
                        icon={<Bell color={currentRoute === 'Notifications' ? '#6366F1' : '#94A3B8'} size={22} />}
                        isActive={currentRoute === 'Notifications'}
                        onPress={() => navigateTo('Notifications')}
                    />
                </View>
            </DrawerContentScrollView>

            {/* Bottom Auth Button */}
            {!user ? (
                <TouchableOpacity
                    style={[styles.logoutButton, { borderTopColor: 'rgba(99, 102, 241, 0.2)' }]}
                    onPress={() => navigation.navigate('Auth')}
                >
                    <LogIn color="#818CF8" size={20} />
                    <Text style={[styles.logoutText, { color: '#818CF8' }]}>Login / Sign Up</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.logoutButton} onPress={() => {
                    logout();
                    setBalances(1000, 5);
                }}>
                    <LogOut color="#FDA4AF" size={20} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 30,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    avatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#6366F1',
    },
    userInfo: {
        marginLeft: 14,
    },
    welcomeText: {
        color: '#94A3B8',
        fontSize: 13,
    },
    usernameText: {
        color: '#F1F5F9',
        fontSize: 18,
        fontWeight: 'bold',
    },
    balanceSection: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 20,
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    currencyIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6,
    },
    balanceValue: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 20,
        marginBottom: 20,
    },
    navSection: {
        paddingHorizontal: 12,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 4,
    },
    drawerItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    iconWrapperActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    drawerItemLabel: {
        color: '#CBD5E1',
        fontSize: 16,
        fontWeight: '500',
    },
    drawerItemLabelActive: {
        color: '#6366F1',
        fontWeight: '600',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 28,
        marginBottom: Platform.OS === 'ios' ? 30 : 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    logoutText: {
        color: '#FDA4AF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
});

export default DrawerContent;
