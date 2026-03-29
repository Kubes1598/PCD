import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface PoisonProps {
    size?: number;
    style?: StyleProp<ImageStyle>;
}

/**
 * A reusable premium 3D Toxic Skull component using the custom asset.
 */
const Poison: React.FC<PoisonProps> = ({ size = 24, style }) => {
    return (
        <Image
            source={require('../../../assets/poison.png')}
            style={[
                {
                    width: size,
                    height: size,
                },
                style
            ]}
            resizeMode="contain"
        />
    );
};

export default Poison;
