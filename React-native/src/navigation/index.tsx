import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

const RootStack = createStackNavigator();

const Navigation: React.FC = () => {
    return (
        <RootStack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName="App"
        >
            <RootStack.Screen name="App" component={AppNavigator} />
            <RootStack.Screen name="Auth" component={AuthNavigator} />
        </RootStack.Navigator>
    );
};

export default Navigation;
