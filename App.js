import React from 'react';
import { Appearance } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { BASE_URL } from '@env';
import { getAppearance } from './utils/prefs';
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

// Startup connectivity self-test. Pings a neutral public site AND the backend
// so the Metro console shows whether the APP has internet at all, vs. the
// backend host being blocked for app traffic (firewall / SSL-inspection proxy).
(async () => {
  console.log('🌐 API BASE_URL =', BASE_URL || '(undefined)');
  const ping = async (url, label) => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const started = Date.now();
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      console.log(`✅ ${label}: HTTP ${res.status} in ${Date.now() - started}ms`);
      return true;
    } catch (e) {
      console.warn(`❌ ${label}: ${e.message} | ${url}`);
      return false;
    }
  };
  // Neutral control: is ANY internet reachable from the app process?
  await ping('https://www.google.com/generate_204', 'internet check');
  // The actual backend:
  if (BASE_URL) await ping(`${BASE_URL}/`, 'backend check');
})();

const Stack = createStackNavigator();

export default function App() {
  // Apply the saved appearance preference (System/Light/Dark) on launch.
  React.useEffect(() => {
    (async () => {
      const a = await getAppearance();
      Appearance.setColorScheme(a === 'system' ? null : a);
    })();
  }, []);

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
