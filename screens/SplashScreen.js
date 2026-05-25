import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { isAuthenticated, isLoading } = useAuth();

  console.log('🎬 [SPLASH] SplashScreen component rendered - isLoading:', isLoading, ', isAuthenticated:', isAuthenticated);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

  }, [fadeAnim]);

  // Navigate when auth initialization completes
  useEffect(() => {
    console.log('🎬 [SPLASH] Navigation effect triggered - isLoading:', isLoading, ', isAuthenticated:', isAuthenticated);
    if (isLoading) {
      console.log('🎬 [SPLASH] Still loading, waiting...');
      return;
    }
    if (isAuthenticated) {
      console.log('🎬 [SPLASH] User is authenticated, navigating to Main...');
      navigation.replace('Main');
      console.log('🎬 [SPLASH] Navigation to Main completed');
    } else {
      console.log('🎬 [SPLASH] User is NOT authenticated, navigating to PhoneAuth...');
      navigation.replace('PhoneAuth');
      console.log('🎬 [SPLASH] Navigation to PhoneAuth completed');
    }
  }, [isAuthenticated, isLoading, navigation]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ActivityIndicator size="large" color="#003366" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
  width: 300,
  height: 300,
},
});
