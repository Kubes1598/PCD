import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scale, moderateScale, SCREEN_WIDTH, SCREEN_HEIGHT } from '../../utils/responsive';
import { THEME } from '../../utils/theme';

const CANDIES = ['🍬', '🍭', '🍫', '🍩', '🍪', '🍨'];
const PARTICLE_COUNT = 15;

interface ParticleProps {
    index: number;
}

const FloatingParticle: React.FC<ParticleProps> = ({ index }) => {
    const moveAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0)).current;

    // Random start positions
    const startX = Math.random() * SCREEN_WIDTH;
    const startY = SCREEN_HEIGHT + Math.random() * 100;
    const driftX = (Math.random() - 0.5) * 150;
    const candy = CANDIES[index % CANDIES.length];

    useEffect(() => {
        // Stagger start
        const delay = Math.random() * 2000;

        Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(moveAnim, {
                        toValue: 1,
                        duration: 8000 + Math.random() * 4000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 5000 + Math.random() * 5000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                        Animated.delay(5000),
                        Animated.timing(scaleAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
                    ])
                ])
            ])
        ).start();
    }, []);

    const translateY = moveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -SCREEN_HEIGHT - 200],
    });

    const translateX = moveAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, driftX],
    });

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View
            style={[
                styles.particle,
                {
                    left: startX,
                    top: startY,
                    transform: [
                        { translateY },
                        { translateX },
                        { rotate },
                        { scale: scaleAnim }
                    ],
                    opacity: 0.25
                }
            ]}
        >
            <Text style={{ fontSize: moderateScale(24) }}>{candy}</Text>
        </Animated.View>
    );
};

interface BrandSplashScreenProps {
    onFinish?: () => void;
}

const BrandSplashScreen: React.FC<BrandSplashScreenProps> = ({ onFinish }) => {
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const barWidth = useRef(new Animated.Value(0)).current;
    const contentOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // 1. Logo Enter
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                tension: 10,
                friction: 2,
                useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            })
        ]).start();

        // 2. Progress Bar
        Animated.timing(barWidth, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false, // Layout animation
        }).start();

        // 3. Cleanup/Finish
        const timer = setTimeout(() => {
            Animated.timing(contentOpacity, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }).start(() => {
                if (onFinish) onFinish();
            });
        }, 3200);

        return () => clearTimeout(timer);
    }, []);

    return (
        <Animated.View style={[styles.container, { opacity: contentOpacity }]}>
            <LinearGradient
                colors={['#0F172A', '#1E293B', '#020617']}
                style={StyleSheet.absoluteFill}
            />

            {/* Particle System */}
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
                <FloatingParticle key={i} index={i} />
            ))}

            <View style={styles.centerContent}>
                <Animated.View style={[
                    styles.logoContainer,
                    { transform: [{ scale: logoScale }], opacity: logoOpacity }
                ]}>
                    <View style={styles.gradientCircle}>
                        <LinearGradient
                            colors={['#6366F1', '#4F46E5']}
                            style={styles.logoGradient}
                        />
                        <Text style={styles.logoEmoji}>🍬</Text>
                    </View>
                    <Text style={styles.appName}>POISON CANDY</Text>
                    <Text style={styles.appSubtitle}>DUEL</Text>
                </Animated.View>

                {/* Glassmorphic Loader */}
                <View style={styles.loaderContainer}>
                    <View style={styles.loaderTrack}>
                        <Animated.View
                            style={[
                                styles.loaderFill,
                                {
                                    width: barWidth.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        >
                            <LinearGradient
                                colors={['#A5B4FC', '#6366F1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                    </View>
                    <Text style={styles.loadingText}>INITIALIZING ARENA...</Text>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>PREMIUM MOBILE EDITION</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        zIndex: 9999,
    },
    particle: {
        position: 'absolute',
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: scale(40),
    },
    gradientCircle: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(50),
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        ...THEME.shadows.lg,
        shadowColor: '#6366F1',
    },
    logoGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    logoEmoji: {
        fontSize: moderateScale(48),
    },
    appName: {
        color: '#FFF',
        fontSize: moderateScale(28),
        fontWeight: '900',
        letterSpacing: 4,
        marginTop: scale(20),
        textShadowColor: 'rgba(99, 102, 241, 0.5)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
    },
    appSubtitle: {
        color: '#6366F1',
        fontSize: moderateScale(14),
        fontWeight: 'bold',
        letterSpacing: 8,
        marginTop: scale(4),
    },
    loaderContainer: {
        width: SCREEN_WIDTH * 0.6,
        alignItems: 'center',
        marginTop: scale(20),
    },
    loaderTrack: {
        width: '100%',
        height: scale(4),
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: scale(2),
        overflow: 'hidden',
    },
    loaderFill: {
        height: '100%',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: moderateScale(9),
        fontWeight: 'bold',
        letterSpacing: 2,
        marginTop: scale(12),
    },
    footer: {
        position: 'absolute',
        bottom: scale(40),
    },
    footerText: {
        color: 'rgba(255,255,255,0.2)',
        fontSize: moderateScale(10),
        fontWeight: 'bold',
        letterSpacing: 3,
    }
});

export default BrandSplashScreen;
