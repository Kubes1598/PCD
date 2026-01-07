import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, LogIn, UserPlus } from 'lucide-react-native';
import ScreenContainer from '../components/layout/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { scale, moderateScale, spacing, radii, SCREEN_WIDTH, isSmallDevice } from '../utils/responsive';

type AuthScreenProps = {
    navigation: any;
};

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
    const { login, register, continueAsGuest, isLoading } = useAuth();
    const [isLogin, setIsLogin] = React.useState(true);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [username, setUsername] = React.useState('');

    const handleSubmit = async () => {
        let result;
        if (isLogin) {
            result = await login(email, password);
        } else {
            result = await register(email, password, username);
        }

        if (result.success) {
            navigation.navigate('App');
        } else {
            alert(result.message);
        }
    };

    return (
        <ScreenContainer withGradient={false} statusBarStyle="light">
            <LinearGradient
                colors={['#1E293B', '#0F172A', '#020617'] as any}
                style={StyleSheet.absoluteFill}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.headerSection}>
                        <Text style={styles.logo}>🍬</Text>
                        <Text style={styles.title}>Poison Candy Duel</Text>
                        <Text style={styles.subtitle}>Mobile Edition</Text>
                    </View>

                    {/* Auth Card */}
                    <View style={styles.card}>
                        {/* Tabs */}
                        <View style={styles.tabs}>
                            <TouchableOpacity
                                style={[styles.tab, isLogin && styles.tabActive]}
                                onPress={() => setIsLogin(true)}
                            >
                                <LogIn color={isLogin ? '#6366F1' : '#64748B'} size={moderateScale(18)} />
                                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Login</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, !isLogin && styles.tabActive]}
                                onPress={() => setIsLogin(false)}
                            >
                                <UserPlus color={!isLogin ? '#6366F1' : '#64748B'} size={moderateScale(18)} />
                                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Username field (signup only) */}
                        {!isLogin && (
                            <View style={styles.inputContainer}>
                                <View style={styles.inputIcon}>
                                    <User color="#64748B" size={moderateScale(18)} />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Username"
                                    placeholderTextColor="#64748B"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        {/* Email field */}
                        <View style={styles.inputContainer}>
                            <View style={styles.inputIcon}>
                                <Mail color="#64748B" size={moderateScale(18)} />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Email address"
                                placeholderTextColor="#64748B"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Password field */}
                        <View style={styles.inputContainer}>
                            <View style={styles.inputIcon}>
                                <Lock color="#64748B" size={moderateScale(18)} />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#64748B"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#6366F1', '#4F46E5'] as any}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitGradient}
                            >
                                <Text style={styles.submitText}>
                                    {isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Guest Button */}
                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={() => {
                                continueAsGuest();
                                navigation.navigate('App');
                            }}
                        >
                            <Text style={styles.guestText}>Continue as Guest</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    logo: {
        fontSize: moderateScale(64),
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: moderateScale(28),
        fontWeight: '900',
        color: '#F1F5F9',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: moderateScale(16),
        color: '#94A3B8',
        marginTop: spacing.xs,
    },
    card: {
        backgroundColor: '#1E293B',
        borderRadius: radii.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#334155',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        borderRadius: radii.md,
        padding: scale(4),
        marginBottom: spacing.lg,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        gap: spacing.xs,
    },
    tabActive: {
        backgroundColor: '#1E293B',
    },
    tabText: {
        color: '#64748B',
        fontSize: moderateScale(14),
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#6366F1',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: radii.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#334155',
    },
    inputIcon: {
        paddingHorizontal: spacing.md,
    },
    input: {
        flex: 1,
        height: scale(50),
        color: '#F1F5F9',
        fontSize: moderateScale(16),
        paddingRight: spacing.md,
    },
    submitButton: {
        borderRadius: radii.md,
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    submitGradient: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    submitText: {
        color: '#FFF',
        fontSize: moderateScale(16),
        fontWeight: '700',
        letterSpacing: 1,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#334155',
    },
    dividerText: {
        color: '#64748B',
        paddingHorizontal: spacing.md,
        fontSize: moderateScale(14),
    },
    guestButton: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    guestText: {
        color: '#6366F1',
        fontSize: moderateScale(16),
        fontWeight: '600',
    },
});

export default AuthScreen;
