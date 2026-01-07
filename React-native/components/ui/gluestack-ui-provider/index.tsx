import React, { ReactNode } from 'react';
import { View } from 'react-native';

interface GluestackUIProviderProps {
    mode?: 'light' | 'dark';
    children: ReactNode;
}

export const GluestackUIProvider: React.FC<GluestackUIProviderProps> = ({
    mode = 'dark',
    children,
}) => {
    // For now, this is a simple wrapper.
    // GluestackUI v3 with NativeWind uses CSS for theming.
    return <>{children}</>;
};

export default GluestackUIProvider;
