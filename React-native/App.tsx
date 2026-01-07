import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/common/ErrorBoundary';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

export default function App() {
    return (
        <GluestackUIProvider mode="dark">
            <ErrorBoundary>
                <SafeAreaProvider>
                    <NavigationContainer>
                        <Navigation />
                    </NavigationContainer>
                </SafeAreaProvider>
            </ErrorBoundary>
        </GluestackUIProvider>
    );
}
