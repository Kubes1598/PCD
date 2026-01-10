import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Settings as SettingsIcon, Bell, Shield, Moon, ChevronLeft, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';
import { scale, moderateScale, spacing, radii, platformValue } from '../utils/responsive';

const SettingsScreen = ({ navigation }: any) => {
    const { logout } = useAuth();
    const [notifications, setNotifications] = React.useState(true);
    const [haptics, setHaptics] = React.useState(true);

    return (
        <ScreenContainer withGradient={false} style={{ backgroundColor: '#0F172A' }} withBackButton>
            <LinearGradient
                colors={['#1E293B', '#0F172A'] as any}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingLabelGroup}>
                            <Bell color="#94A3B8" size={moderateScale(20)} />
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
                            <Moon color="#94A3B8" size={moderateScale(20)} />
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
                            <Shield color="#94A3B8" size={moderateScale(20)} />
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => logout()} style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                        <View style={styles.settingLabelGroup}>
                            <LogOut color="#FDA4AF" size={moderateScale(20)} />
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
    content: {
        padding: spacing.lg,
    },
    section: {
        backgroundColor: '#1E293B',
        borderRadius: radii.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        color: '#3B82F6',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: spacing.md,
        letterSpacing: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    settingLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingLabel: {
        color: '#F1F5F9',
        fontSize: moderateScale(16),
        marginLeft: spacing.sm,
    },
    version: {
        textAlign: 'center',
        color: '#475569',
        fontSize: moderateScale(12),
        marginTop: spacing.lg,
    },
});

export default SettingsScreen;
