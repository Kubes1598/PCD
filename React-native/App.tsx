import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/common/ErrorBoundary';

export default function App() {
    return (
        <ErrorBoundary>
            <SafeAreaProvider>
                <NavigationContainer>
                    <Navigation />
                </NavigationContainer>
            </SafeAreaProvider>
        </ErrorBoundary>
    );
}
