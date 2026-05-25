import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import ApprovalListScreen from '../screens/ApprovalListScreen';
import ExpenseChatWebView from '../components/ExpenseChatWebView';

const Tab = createBottomTabNavigator();

export default function BottomTabsNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="Chat"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E5E5',
            height: 74 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            textAlign: 'center',
          },
        }}
      >
        <Tab.Screen
          name="Chat"
          component={ExpenseChatWebView}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "chatbubble" : "chatbubble-outline"} color={color} size={24} />
            ),
            tabBarLabel: ({ color }) => (
              <Text style={{ color, fontSize: 12, textAlign: 'center', fontWeight: 'normal' }}>
                Chat
              </Text>
            ),
            lazy: false,
          }}
        />
        <Tab.Screen
          name="My Claims"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} color={color} size={24} />
            ),
            tabBarLabel: ({ color }) => (
              <Text style={{ color, fontSize: 12, textAlign: 'center', fontWeight: 'normal' }}>
                My Claims
              </Text>
            ),
          }}
        />

        <Tab.Screen
          name="Pending Approvals"
          component={ApprovalListScreen}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <FontAwesome5 name="wallet" color={color} size={22} solid={focused} />
            ),
            tabBarLabel: ({ color }) => (
              <Text
                style={{ color, fontSize: 12, textAlign: 'center', fontWeight: 'normal' }}
                numberOfLines={2}
                ellipsizeMode="clip"
              >
                Pending{'\n'}Approvals
              </Text>
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
});
