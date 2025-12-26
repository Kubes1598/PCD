import React, { ReactNode } from 'react';
import { StyleSheet, SafeAreaView, View, StatusBar, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../../utils/theme';

interface ScreenContainerProps {
    children: ReactNode;
    withGradient?: boolean;
    style?: ViewStyle;
    safe?: boolean;
}

const ScreenContainer: React.FC<ScreenContainerProps> = ({
    children,
    withGradient = true,
    style,
    safe = true
}) => {
    const Container = safe ? SafeAreaView : View;

    return (
        <View style={styles.outer}>
            <StatusBar barStyle="dark-content" />
            {withGradient && (
                <LinearGradient
                    colors={THEME.gradients.background as any}
                    style={StyleSheet.absoluteFill}
                />
            )}
            <Container style={[styles.container, style]}>
                {children}
            </Container>
        </View>
    );
};

const styles = StyleSheet.create({
    outer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
});

export default ScreenContainer;
