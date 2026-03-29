import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

interface BotAvatarProps {
    size?: number;
    style?: StyleProp<ViewStyle>;
    imageStyle?: StyleProp<ImageStyle>;
    bordered?: boolean;
}

/**
 * A reusable premium 3D Bot Avatar component.
 */
const BotAvatar: React.FC<BotAvatarProps> = ({ size = 40, style, imageStyle, bordered = true }) => {
    return (
        <View style={[
            {
                width: size,
                height: size,
                borderRadius: size * 0.2, // More square for a robot look
                backgroundColor: '#1E293B',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
            },
            bordered && {
                borderWidth: size * 0.05,
                borderColor: '#A855F7', // Purple/Bot theme
            },
            style
        ]}>
            <Image
                source={require('../../../assets/bot_avatar.jpg')}
                style={[
                    {
                        width: size,
                        height: size,
                    },
                    imageStyle
                ]}
                resizeMode="cover"
            />
        </View>
    );
};

export default BotAvatar;
