import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import GlobalErrorToast from './src/components/common/GlobalErrorToast';
import BrandSplashScreen from './src/components/common/BrandSplashScreen';
import GlobalModal from './src/components/common/GlobalModal';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

import { useGameStore } from './src/store/gameStore';
import { useAuthStore } from './src/store/authStore';

export default function App() {
    const loadConfig = useGameStore(state => state.loadConfig);
    const initAuth = useAuthStore(state => state.init);
    const [isSplashFinished, setIsSplashFinished] = React.useState(false);

    React.useEffect(() => {
        const prepare = async () => {
            try {
                // Initialize stores in parallel with splash
                await Promise.all([
                    loadConfig(),
                    initAuth(),
                ]);
            } catch (e) {
                console.warn(e);
            }
        };
        prepare();
    }, [loadConfig, initAuth]);

    return (
        <GluestackUIProvider mode="dark">
            <ErrorBoundary>
                <SafeAreaProvider>
                    {!isSplashFinished ? (
                        <BrandSplashScreen onFinish={() => setIsSplashFinished(true)} />
                    ) : (
                        <>
                            <NavigationContainer>
                                <Navigation />
                            </NavigationContainer>
                            <GlobalErrorToast />
                            <GlobalModal />
                        </>
                    )}
                </SafeAreaProvider>
            </ErrorBoundary>
        </GluestackUIProvider>
    );
}
