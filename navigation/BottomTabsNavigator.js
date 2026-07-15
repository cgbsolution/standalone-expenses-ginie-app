import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import MyClaimsScreen from '../screens/MyClaimsScreen';
import ApprovalListScreen from '../screens/ApprovalListScreen';
import ChatBotScreen from '../screens/ChatBotScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CustomTabBar from './CustomTabBar';

const Tab = createBottomTabNavigator();

export default function BottomTabsNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIconActive: 'home',
          tabBarIconInactive: 'home-outline',
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={MyClaimsScreen}
        options={{
          tabBarLabel: 'Expenses',
          tabBarIconActive: 'document-text',
          tabBarIconInactive: 'document-text-outline',
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatBotScreen}
        options={{
          tabBarVariant: 'fab',
        }}
      />
      <Tab.Screen
        name="Approvals"
        component={ApprovalListScreen}
        options={{
          tabBarLabel: 'Approvals',
          tabBarIconActive: 'shield-checkmark',
          tabBarIconInactive: 'shield-checkmark-outline',
          tabBarBadgeDot: true,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIconActive: 'person',
          tabBarIconInactive: 'person-outline',
        }}
      />
    </Tab.Navigator>
  );
}
