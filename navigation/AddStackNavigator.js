// navigation/AddStackNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddScreen from '../screens/AddScreen';
import MasterExpenseScreen from '../screens/MasterExpenseScreen';

const Stack = createNativeStackNavigator();

export default function AddStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AddHome" component={AddScreen} />
      <Stack.Screen name="MasterExpense" component={MasterExpenseScreen} />
    </Stack.Navigator>
  );
}
