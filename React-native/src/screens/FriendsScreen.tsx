import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Users, Search, UserPlus, ChevronLeft, Circle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';

const FriendsScreen = ({ navigation }: any) => {
    const dummyFriends = [
        { id: 1, name: 'Shadow Hunter', status: 'online', level: 42 },
        { id: 2, name: 'Candy Queen', status: 'playing', level: 38 },
        { id: 3, name: 'Pixel Knight', status: 'offline', level: 25 },
        { id: 4, name: 'Dragon Bane', status: 'online', level: 50 },
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
                <Text style={styles.headerTitle}>Friends</Text>
                <TouchableOpacity style={styles.backButton}>
                    <UserPlus color="#FFF" size={24} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search color="#94A3B8" size={20} />
                    <TextInput
                        placeholder="Search players..."
                        placeholderTextColor="#64748B"
                        style={styles.searchInput}
                    />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>MY FRIENDS ({dummyFriends.length})</Text>
                {dummyFriends.map(friend => (
                    <View key={friend.id} style={styles.friendItem}>
                        <View style={styles.friendInfo}>
                            <View style={styles.friendAvatar}>
                                <Text style={styles.avatarText}>{friend.name[0]}</Text>
                            </View>
                            <View>
                                <Text style={styles.friendName}>{friend.name}</Text>
                                <View style={styles.statusRow}>
                                    <Circle
                                        fill={friend.status === 'online' ? '#10B981' : (friend.status === 'playing' ? '#3B82F6' : '#64748B')}
                                        color="transparent"
                                        size={8}
                                    />
                                    <Text style={styles.friendStatus}>{friend.status}</Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.levelLabel}>LVL {friend.level}</Text>
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
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        marginLeft: 10,
        fontSize: 16,
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        color: '#3B82F6',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 16,
        letterSpacing: 1,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    friendName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    friendStatus: {
        color: '#94A3B8',
        fontSize: 12,
        marginLeft: 4,
        textTransform: 'capitalize',
    },
    levelLabel: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: '#F59E0B20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
});

export default FriendsScreen;
