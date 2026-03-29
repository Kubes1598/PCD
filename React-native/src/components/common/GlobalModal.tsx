import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useModalStore } from '../../store/modalStore';
import { THEME } from '../../utils/theme';
import { scale, moderateScale, spacing, radii } from '../../utils/responsive';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const GlobalModal = () => {
    const { isVisible, title, message, buttons, hideModal } = useModalStore();

    if (!isVisible) return null;

    // Determine icon and color based on title (heuristics for generic styling)
    let Icon = Info;
    let iconColor = '#3B82F6';
    let gradientColors = ['#1E293B', '#0F172A'] as any;

    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('error') || lowerTitle.includes('failed') || lowerTitle.includes('invalid')) {
        Icon = AlertCircle;
        iconColor = '#EF4444';
        gradientColors = ['#2C1919', '#1A0B0B'] as any;
    } else if (lowerTitle.includes('success') || lowerTitle.includes('claimed') || lowerTitle.includes('matched')) {
        Icon = CheckCircle2;
        iconColor = '#10B981';
        gradientColors = ['#152F23', '#0A1A12'] as any;
    } else if (lowerTitle.includes('warning') || lowerTitle.includes('surrender') || lowerTitle.includes('forfeit')) {
        Icon = AlertCircle;
        iconColor = '#F59E0B';
        gradientColors = ['#2F2415', '#1A1308'] as any;
    }

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="fade"
            onRequestClose={hideModal}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                
                <View style={styles.modalContainer}>
                    <LinearGradient
                        colors={gradientColors}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    
                    <View style={styles.content}>
                        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
                            <Icon color={iconColor} size={scale(32)} />
                        </View>
                        
                        <Text style={styles.title}>{title}</Text>
                        {!!message && <Text style={styles.message}>{message}</Text>}
                        
                        <View style={styles.buttonContainer}>
                            {buttons.map((btn, index) => {
                                const isDestructive = btn.style === 'destructive';
                                const isCancel = btn.style === 'cancel';
                                
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.button,
                                            isDestructive && styles.destructiveButton,
                                            isCancel && styles.cancelButton,
                                            buttons.length > 1 && { flex: 1, marginHorizontal: spacing.xs }
                                        ]}
                                        onPress={() => {
                                            hideModal();
                                            if (btn.onPress) btn.onPress();
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[
                                            styles.buttonText,
                                            isDestructive && styles.destructiveText,
                                            isCancel && styles.cancelText
                                        ]}>
                                            {btn.text}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: spacing.xl,
    },
    modalContainer: {
        width: width - scale(40),
        maxWidth: 400,
        borderRadius: radii.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        ...THEME.shadows.lg,
    },
    content: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    iconContainer: {
        width: scale(64),
        height: scale(64),
        borderRadius: scale(32),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        color: '#FFF',
        fontSize: moderateScale(22),
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    message: {
        color: '#94A3B8',
        fontSize: moderateScale(15),
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
    },
    button: {
        backgroundColor: '#6366F1',
        paddingVertical: scale(14),
        paddingHorizontal: spacing.xl,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: scale(120),
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    destructiveButton: {
        backgroundColor: '#EF4444',
    },
    buttonText: {
        color: '#FFF',
        fontSize: moderateScale(16),
        fontWeight: 'bold',
    },
    cancelText: {
        color: '#E2E8F0',
    },
    destructiveText: {
        color: '#FFF',
    },
});

export default GlobalModal;
