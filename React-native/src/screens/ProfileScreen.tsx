import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { User, Trophy, Star, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';

const ProfileScreen = ({ navigation }: any) => {
    const { user } = useAuth();

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
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileInfo}>
                    <View style={styles.avatarContainer}>
                        <User color="#CBD5E1" size={64} />
                    </View>
                    <Text style={styles.username}>{user?.username || 'Hunter'}</Text>
                    <Text style={styles.rank}>Platimum Rank</Text>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Trophy color="#F59E0B" size={24} />
                        <Text style={styles.statValue}>1,234</Text>
                        <Text style={styles.statLabel}>Wins</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Star color="#3B82F6" size={24} />
                        <Text style={styles.statValue}>4.8</Text>
                        <Text style={styles.statLabel}>Rating</Text>
                    </View>
                </View>
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
    profileInfo: {
        alignItems: 'center',
        marginBottom: 30,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#3B82F6',
    },
    username: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    rank: {
        color: '#94A3B8',
        fontSize: 16,
        marginTop: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        backgroundColor: '#1E293B',
        width: '48%',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
    },
    statValue: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        color: '#94A3B8',
        fontSize: 14,
    },
});

export default ProfileScreen;
