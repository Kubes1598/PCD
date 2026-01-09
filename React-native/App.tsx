import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import GlobalErrorToast from './src/components/common/GlobalErrorToast';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

import { useGameStore } from './src/store/gameStore';

export default function App() {
    const loadConfig = useGameStore(state => state.loadConfig);

    React.useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    return (
        <GluestackUIProvider mode="dark">
            <ErrorBoundary>
                <SafeAreaProvider>
                    <NavigationContainer>
                        <Navigation />
                    </NavigationContainer>
                    <GlobalErrorToast />
                </SafeAreaProvider>
            </ErrorBoundary>
        </GluestackUIProvider>
    );
}
