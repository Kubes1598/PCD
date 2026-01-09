import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { useErrorStore } from '../../store/errorStore';
import { THEME } from '../../utils/theme';
import { moderateScale, scale, verticalScale } from '../../utils/responsive';
import { AlertCircle, X, Info, AlertTriangle } from 'lucide-react-native';

const GlobalErrorToast: React.FC = () => {
    const { errors, clearError } = useErrorStore();

    if (errors.length === 0) return null;

    return (
        <View style={styles.container}>
            {errors.map((error, index) => (
                <ToastItem
                    key={error.id}
                    error={error}
                    index={index}
                    onClear={() => clearError(error.id)}
                />
            ))}
        </View>
    );
};

const ToastItem: React.FC<{ error: any; index: number; onClear: () => void }> = ({ error, onClear }) => {
    const opacity = React.useRef(new Animated.Value(0)).current;
    const translateY = React.useRef(new Animated.Value(-20)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 5,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const getColors = () => {
        switch (error.severity) {
            case 'warning': return { border: '#F59E0B', bg: '#FFFBEB', icon: '#F59E0B' };
            case 'info': return { border: '#3B82F6', bg: '#EFF6FF', icon: '#3B82F6' };
            default: return { border: '#EF4444', bg: '#FEF2F2', icon: '#EF4444' };
        }
    };

    const colors = getColors();

    const getIcon = () => {
        switch (error.severity) {
            case 'warning': return <AlertTriangle size={moderateScale(20)} color={colors.icon} />;
            case 'info': return <Info size={moderateScale(20)} color={colors.icon} />;
            default: return <AlertCircle size={moderateScale(20)} color={colors.icon} />;
        }
    };

    return (
        <Animated.View style={[
            styles.toast,
            { opacity, transform: [{ translateY }], borderLeftColor: colors.border, backgroundColor: colors.bg }
        ]}>
            <View style={styles.iconContainer}>
                {getIcon()}
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.message}>{error.message}</Text>
            </View>
            <TouchableOpacity onPress={onClear} style={styles.closeButton}>
                <X size={moderateScale(18)} color="#94A3B8" />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: verticalScale(60),
        left: scale(16),
        right: scale(16),
        zIndex: 9999,
        gap: verticalScale(12),
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(16),
        borderRadius: moderateScale(12),
        borderLeftWidth: 5,
        // Premium shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    iconContainer: {
        marginRight: scale(12),
    },
    textContainer: {
        flex: 1,
    },
    message: {
        fontSize: moderateScale(14),
        color: '#1E293B',
        fontWeight: '700',
        lineHeight: moderateScale(20),
    },
    closeButton: {
        marginLeft: scale(8),
        padding: scale(4),
    },
});

export default GlobalErrorToast;
