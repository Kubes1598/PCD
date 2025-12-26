import { Alert } from 'react-native';

/**
 * Global Error Handler for React Native
 * This catches errors outside of the React rendering cycle (e.g., async callbacks, timeouts).
 */

export const setupGlobalErrorHandler = () => {
    // @ts-ignore - ErrorUtils is a global in React Native environment
    const globalHandler = ErrorUtils.getGlobalHandler();

    // @ts-ignore
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        console.error('Captured global error:', error);

        if (isFatal) {
            Alert.alert(
                'Unexpected Error',
                `A fatal error occurred: ${error.message}. The app may need to be restarted.`,
                [{ text: 'OK' }]
            );
        }

        // Pass the error back to the original handler (usually shows red box in development)
        if (globalHandler) {
            globalHandler(error, isFatal);
        }
    });

    // Also catch unhandled promise rejections
    // @ts-ignore
    const rejectionTracking = require('promise/lib/rejection-tracking');
    rejectionTracking.enable({
        allRejections: true,
        onUnhandled: (id: string, error: Error) => {
            console.warn('Unhandled promise rejection:', error);
            // You can add more logic here if needed
        },
        onHandled: (id: string) => {
            console.log('Promise rejection handled:', id);
        },
    });
};
