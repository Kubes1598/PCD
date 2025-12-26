import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCcw } from 'lucide-react-native';
import { THEME } from '../../utils/theme';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <AlertTriangle color={THEME.colors.danger} size={64} />
                    <Text style={styles.title}>Oops! Something went wrong.</Text>
                    <Text style={styles.message}>
                        The app encountered an unexpected error.
                    </Text>
                    {this.state.error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{this.state.error.message}</Text>
                        </View>
                    )}
                    <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                        <RefreshCcw color={THEME.colors.white} size={20} />
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: THEME.colors.gray50,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: THEME.colors.primaryDark,
        marginTop: 20,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: THEME.colors.gray600,
        marginTop: 10,
        textAlign: 'center',
        marginBottom: 20,
    },
    errorBox: {
        width: '100%',
        padding: 15,
        backgroundColor: THEME.colors.gray100,
        borderRadius: THEME.radius.md,
        borderWidth: 1,
        borderColor: THEME.colors.danger,
        marginBottom: 30,
    },
    errorText: {
        fontSize: 12,
        color: THEME.colors.danger,
        textAlign: 'left',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: THEME.radius.full,
        gap: 8,
    },
    buttonText: {
        color: THEME.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default ErrorBoundary;
