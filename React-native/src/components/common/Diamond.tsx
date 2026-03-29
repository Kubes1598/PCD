import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface DiamondProps {
    size?: number;
    style?: StyleProp<ViewStyle>;
}

const Diamond: React.FC<DiamondProps> = ({ size = 24, style }) => {
    return (
        <View style={style}>
            <Svg height={size} width={size} viewBox="0 0 24 24">
                {/* Top face */}
                <Path fill="#CFFAFE" d="M6,4 L18,4 L12,9 Z" />
                {/* Top left face */}
                <Path fill="#22D3EE" d="M6,4 L12,9 L2,9 Z" />
                {/* Top right face */}
                <Path fill="#06B6D4" d="M18,4 L22,9 L12,9 Z" />
                {/* Bottom left face */}
                <Path fill="#0EA5E9" d="M2,9 L12,9 L12,21 Z" />
                {/* Bottom right face */}
                <Path fill="#0284C7" d="M22,9 L12,21 L12,9 Z" />
            </Svg>
        </View>
    );
};

export default Diamond;
