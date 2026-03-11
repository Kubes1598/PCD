import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, LogIn, UserPlus, Smartphone } from 'lucide-react-native';
import ScreenContainer from '../components/layout/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { feedbackService } from '../services/FeedbackService';
import { apiService } from '../services/api';
import { scale, moderateScale, spacing, radii, SCREEN_WIDTH, isSmallDevice } from '../utils/responsive';

type AuthScreenProps = {
    navigation: any;
};

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation, route }: any) => {
    const { user, login, register, loginWithGoogle, loginWithApple, guestLogin, isLoading, isGuest } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [oauthStatus, setOauthStatus] = useState({ google: false, apple: false });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Check which OAuth providers are available
        checkOAuthStatus();
    }, []);

    const checkOAuthStatus = async () => {
        try {
            const result = await apiService.getOAuthStatus();
            if (result.success && result.data) {
                setOauthStatus({
                    google: result.data.google,
                    apple: result.data.apple
                });
            }
        } catch (error) {
            console.log('OAuth status check failed, using defaults');
        }
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        feedbackService.triggerSelection();

        try {
            let result;
            if (isLogin) {
                result = await login(email, password);
            } else {
                // Front-end validation for stronger password policy
                if (!validatePassword(password)) {
                    feedbackService.triggerError();
                    Alert.alert(
                        'Weak Password',
                        'Password must be at least 8 characters long and include:\n• Uppercase & Lowercase letters\n• Numbers\n• Symbols (e.g. !@#$)',
                        [{ text: 'OK' }]
                    );
                    return;
                }

                // If user is currently a guest, pass their ID for data transfer
                const guestId = isGuest ? user?.id : undefined;
                result = await register(email, password, username, guestId);
            }

            if (result.success) {
                feedbackService.triggerSuccess();
                if (result.message?.includes('transferred')) {
                    Alert.alert('Success', result.message, [{ text: 'Great!', onPress: () => navigation.navigate('App') }]);
                } else {
                    navigation.navigate('App');
                }
            } else {
                feedbackService.triggerError();
                Alert.alert('Error', result.message || 'Authentication failed');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        feedbackService.triggerSelection();

        try {
            // NOTE: In production, you would use Google Sign-In SDK here:
            // import { GoogleSignin } from '@react-native-google-signin/google-signin';
            // const { idToken } = await GoogleSignin.signIn();
            // const result = await loginWithGoogle(idToken);

            // For now, show "not configured" message
            Alert.alert(
                'Google Sign-In',
                'Google Sign-In is not configured yet.\n\nTo enable it:\n1. Create a Google Cloud project\n2. Add your OAuth Client ID to the backend .env file\n3. Install @react-native-google-signin/google-signin',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            feedbackService.triggerError();
            Alert.alert('Error', error.message || 'Google sign-in failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAppleSignIn = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        feedbackService.triggerSelection();

        try {
            // NOTE: In production, you would use Apple Authentication here:
            // import * as AppleAuthentication from 'expo-apple-authentication';
            // const credential = await AppleAuthentication.signInAsync({...});
            // const result = await loginWithApple(credential.identityToken, credential.authorizationCode, credential.fullName);

            // For now, show "not configured" message
            Alert.alert(
                'Apple Sign-In',
                'Apple Sign-In is not configured yet.\n\nTo enable it:\n1. Enroll in Apple Developer Program\n2. Configure Sign in with Apple\n3. Add your credentials to the backend .env file',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            feedbackService.triggerError();
            Alert.alert('Error', error.message || 'Apple sign-in failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGuestLogin = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        feedbackService.triggerSelection();

        try {
            const result = await guestLogin();
            if (result.success) {
                feedbackService.triggerSuccess();
                navigation.navigate('App');
            } else {
                feedbackService.triggerError();
                Alert.alert('Error', result.message || 'Guest login failed');
            }
        } catch (error: any) {
            feedbackService.triggerError();
            Alert.alert('Error', error.message || 'Guest login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const validatePassword = (pass: string) => {
        const hasUpper = /[A-Z]/.test(pass);
        const hasLower = /[a-z]/.test(pass);
        const hasNumber = /[0-9]/.test(pass);
        const hasSymbol = /[^A-Za-z0-9]/.test(pass);
        return pass.length >= 8 && hasUpper && hasLower && hasNumber && hasSymbol;
    };

    const isButtonDisabled = isLoading || isSubmitting;

    return (
        <ScreenContainer withGradient={false} statusBarStyle="light" withBackButton>
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
                                onPress={() => {
                                    feedbackService.triggerSelection();
                                    setIsLogin(true);
                                }}
                            >
                                <LogIn color={isLogin ? '#6366F1' : '#64748B'} size={moderateScale(18)} />
                                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Login</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, !isLogin && styles.tabActive]}
                                onPress={() => {
                                    feedbackService.triggerSelection();
                                    setIsLogin(false);
                                }}
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
                            style={[styles.submitButton, isButtonDisabled && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={isButtonDisabled}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={isButtonDisabled ? ['#475569', '#374151'] : ['#6366F1', '#4F46E5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitGradient}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitText}>
                                        {isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or continue with</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* OAuth Buttons */}
                        <View style={styles.oauthContainer}>
                            {/* Google Sign-In */}
                            <TouchableOpacity
                                style={[styles.oauthButton, styles.googleButton]}
                                onPress={handleGoogleSignIn}
                                disabled={isButtonDisabled}
                            >
                                <Text style={styles.googleIcon}>G</Text>
                                <Text style={styles.oauthText}>Google</Text>
                            </TouchableOpacity>

                            {/* Apple Sign-In (iOS only) */}
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={[styles.oauthButton, styles.appleButton]}
                                    onPress={handleAppleSignIn}
                                    disabled={isButtonDisabled}
                                >
                                    <Text style={styles.appleIcon}></Text>
                                    <Text style={styles.appleText}>Apple</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Guest Button */}
                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleGuestLogin}
                            disabled={isButtonDisabled}
                        >
                            <Smartphone color="#6366F1" size={moderateScale(18)} />
                            <Text style={styles.guestText}>Continue as Guest</Text>
                        </TouchableOpacity>

                        {/* Guest Info */}
                        <Text style={styles.guestInfo}>
                            Guests can play online & see rankings,{'\n'}but quests require an account.
                        </Text>
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
    submitButtonDisabled: {
        opacity: 0.7,
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
        fontSize: moderateScale(12),
    },
    oauthContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    oauthButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        gap: spacing.xs,
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
    },
    googleIcon: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#4285F4',
    },
    oauthText: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#1F2937',
    },
    appleButton: {
        backgroundColor: '#000000',
    },
    appleIcon: {
        fontSize: moderateScale(18),
        color: '#FFFFFF',
    },
    appleText: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    guestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        gap: spacing.xs,
    },
    guestText: {
        color: '#6366F1',
        fontSize: moderateScale(16),
        fontWeight: '600',
    },
    guestInfo: {
        color: '#64748B',
        fontSize: moderateScale(11),
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});

export default AuthScreen;
