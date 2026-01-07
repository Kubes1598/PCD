import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import DrawerContent from './DrawerContent';

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// Game screen is a full-screen modal, separate from drawer
const GameStack: React.FC = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                ...TransitionPresets.ModalPresentationIOS,
            }}
        >
            <Stack.Screen name="GameScreen" component={GameScreen} />
        </Stack.Navigator>
    );
};

// Main drawer navigator containing all app screens except Game
export const DrawerNavigator: React.FC = () => {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <DrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: 'slide',
                drawerStyle: {
                    width: 300,
                    backgroundColor: 'transparent',
                },
                overlayColor: 'rgba(0, 0, 0, 0.7)',
                swipeEnabled: true,
                swipeEdgeWidth: 50,
            }}
        >
            <Drawer.Screen name="Home" component={HomeScreen} />
            <Drawer.Screen name="Profile" component={ProfileScreen} />
            <Drawer.Screen name="Friends" component={FriendsScreen} />
            <Drawer.Screen name="Rewards" component={RewardsScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
            <Drawer.Screen name="Notifications" component={NotificationsScreen} />
        </Drawer.Navigator>
    );
};

// Root App navigator with drawer + game modal
export const AppNavigator: React.FC = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                ...TransitionPresets.SlideFromRightIOS,
            }}
        >
            <Stack.Screen name="DrawerScreens" component={DrawerNavigator} />
            <Stack.Screen
                name="Game"
                component={GameScreen}
                options={{
                    ...TransitionPresets.ModalPresentationIOS,
                }}
            />
        </Stack.Navigator>
    );
};
