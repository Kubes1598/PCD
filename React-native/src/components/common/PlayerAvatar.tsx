import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle, Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { AVATAR_SVGS } from '../../utils/avatars';

interface PlayerAvatarProps {
    size?: number;
    style?: StyleProp<ViewStyle>;
    bordered?: boolean;
    username?: string;
}

const getAvatarIndex = (username: string = 'Guest'): number => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % AVATAR_SVGS.length;
};

/**
 * A reusable premium 3D Player Avatar component.
 * Selects a random avatar from 10 generated SVGs based on username hash.
 */
const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ size = 40, style, bordered = true, username }) => {
    const avatarIndex = useMemo(() => getAvatarIndex(username), [username]);
    const avatarSvg = AVATAR_SVGS[avatarIndex];

    return (
        <View style={[
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: '#1E293B',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
            },
            bordered && {
                borderWidth: size * 0.05,
                borderColor: '#6366F1',
            },
            style
        ]}>
            <SvgXml xml={avatarSvg} width={size * 0.9} height={size * 0.9} />
        </View>
    );
};

export default PlayerAvatar;
