import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import SplashScreen from './screens/SplashScreen';
import PhoneAuthScreen from './screens/PhoneAuthScreen';
import MasterExpenseScreen from './screens/MasterExpenseScreen';
import AddScreen from './screens/AddScreen';
import ChatBotScreen from './screens/ChatBotScreen';
import DrawerNavigator from './navigation/DrawerNavigator';
import { InvoiceProvider } from './context/InvoiceContext';
import { AuthProvider } from './context/AuthContext';
import { UIHosts } from './components/ui';

enableScreens();

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <InvoiceProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
                <Stack.Screen name="Main" component={DrawerNavigator} />
                <Stack.Screen name="AddScreen" component={AddScreen} />
                <Stack.Screen name="ChatBot" component={ChatBotScreen} />
                <Stack.Screen name="MasterExpenseScreen" component={MasterExpenseScreen}/>
              </Stack.Navigator>
            </NavigationContainer>
            <UIHosts />
          </InvoiceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
