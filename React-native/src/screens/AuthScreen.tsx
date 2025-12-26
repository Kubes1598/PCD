import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import ScreenContainer from '../components/layout/ScreenContainer';
import { THEME } from '../utils/theme';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';

type AuthScreenProps = {
    navigation: StackNavigationProp<any, any>;
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
        <ScreenContainer style={styles.center}>
            <View style={styles.card}>
                <Text style={styles.title}>Poison Candy Duel</Text>
                <Text style={styles.subtitle}>Mobile Edition</Text>

                <View style={styles.tabs}>
                    <TouchableOpacity onPress={() => setIsLogin(true)}>
                        <Text style={[styles.tab, isLogin ? styles.activeTab : null]}>Login</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsLogin(false)}>
                        <Text style={[styles.tab, !isLogin ? styles.activeTab : null]}>Sign Up</Text>
                    </TouchableOpacity>
                </View>

                {!isLogin && (
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Pick a nickname"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="your@email.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>{isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}</Text>
                </TouchableOpacity>

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
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: THEME.spacing.xl,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: THEME.spacing.xxl,
        borderRadius: THEME.radius.xxl,
        borderWidth: 3,
        borderColor: THEME.colors.carton,
        alignItems: 'center',
        width: '100%',
        ...THEME.shadows.lg,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: THEME.colors.primary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: THEME.colors.gray600,
        marginBottom: THEME.spacing.xl,
    },
    button: {
        backgroundColor: THEME.colors.primary,
        paddingVertical: THEME.spacing.md,
        paddingHorizontal: THEME.spacing.xl,
        borderRadius: THEME.radius.lg,
        ...THEME.shadows.md,
    },
    buttonText: {
        color: THEME.colors.white,
        fontWeight: 'bold' as const,
        fontSize: 18,
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: THEME.spacing.xl,
        backgroundColor: THEME.colors.gray100,
        borderRadius: THEME.radius.md,
        padding: 4,
    },
    tab: {
        paddingVertical: THEME.spacing.sm,
        paddingHorizontal: THEME.spacing.lg,
        borderRadius: THEME.radius.sm,
        color: THEME.colors.gray500,
        fontWeight: '600',
    },
    activeTab: {
        backgroundColor: THEME.colors.white,
        color: THEME.colors.primary,
        ...THEME.shadows.sm,
    },
    inputContainer: {
        width: '100%',
        marginBottom: THEME.spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.colors.gray700,
        marginBottom: THEME.spacing.xs,
    },
    input: {
        width: '100%',
        height: 48,
        backgroundColor: THEME.colors.white,
        borderWidth: 1,
        borderColor: THEME.colors.gray200,
        borderRadius: THEME.radius.md,
        paddingHorizontal: THEME.spacing.md,
    },
    guestButton: {
        marginTop: THEME.spacing.xl,
    },
    guestText: {
        color: THEME.colors.primaryLight,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

export default AuthScreen;
