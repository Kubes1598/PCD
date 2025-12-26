import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Settings as SettingsIcon, Bell, Shield, Moon, ChevronLeft, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';

const SettingsScreen = ({ navigation }: any) => {
    const { logout } = useAuth();
    const [notifications, setNotifications] = React.useState(true);
    const [haptics, setHaptics] = React.useState(true);

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
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingLabelGroup}>
                            <Bell color="#94A3B8" size={20} />
                            <Text style={styles.settingLabel}>Notifications</Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: '#334155', true: '#3B82F6' }}
                        />
                    </View>
                    <View style={styles.settingItem}>
                        <View style={styles.settingLabelGroup}>
                            <Moon color="#94A3B8" size={20} />
                            <Text style={styles.settingLabel}>Haptic Feedback</Text>
                        </View>
                        <Switch
                            value={haptics}
                            onValueChange={setHaptics}
                            trackColor={{ false: '#334155', true: '#3B82F6' }}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingLabelGroup}>
                            <Shield color="#94A3B8" size={20} />
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => logout()} style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                        <View style={styles.settingLabelGroup}>
                            <LogOut color="#FDA4AF" size={20} />
                            <Text style={[styles.settingLabel, { color: '#FDA4AF' }]}>Logout</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={styles.version}>Version 1.0.0 (Beta)</Text>
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
    section: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 16,
        letterSpacing: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    settingLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingLabel: {
        color: '#F1F5F9',
        fontSize: 16,
        marginLeft: 12,
    },
    version: {
        textAlign: 'center',
        color: '#475569',
        fontSize: 12,
        marginTop: 20,
    },
});

export default SettingsScreen;
