import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@env';
import MicrosoftAuthService from '../services/MicrosoftAuthService';
import { isFirebaseConfigured, isGoogleOAuthConfigured } from '../config/firebase';

const LOCAL_USER_KEY = 'local_auth_user';
const API_BASE = BASE_URL || 'http://localhost:5000';
console.log('🌐 [AUTH] API_BASE at bundle time =', API_BASE);

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize authentication state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1) Local email/password session takes precedence — no token refresh needed.
      const stored = await AsyncStorage.getItem(LOCAL_USER_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setIsAuthenticated(true);
          setUser(parsed);
          return;
        } catch {
          await AsyncStorage.removeItem(LOCAL_USER_KEY);
        }
      }

      // 2) Microsoft OAuth session — refresh /me profile.
      const hasStoredAuth = await MicrosoftAuthService.loadStoredAuth();

      if (hasStoredAuth) {
        try {
          // Always fetch fresh profile on app open
          const accessToken = MicrosoftAuthService.getAccessToken();
          if (!accessToken) {
            throw new Error('Missing access token');
          }
          const freshProfile = await MicrosoftAuthService.getUserProfile(accessToken);
          // Persist refreshed profile
          await MicrosoftAuthService.storeUserProfile(freshProfile);
          setIsAuthenticated(true);
          setUser(freshProfile);
        } catch (e) {
          console.error('Failed to refresh user profile on app open:', e);
          // Clear storage and reset auth state on any error
          await MicrosoftAuthService.signOut();
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setError('Failed to initialize authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithMicrosoft = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await MicrosoftAuthService.signIn();
      
      if (result.success) {
        setIsAuthenticated(true);
        setUser(result.user);
        return { success: true, user: result.user };
      } else if (result.cancelled) {
        return { success: false, cancelled: true };
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Microsoft sign-in error:', error);
      setError(error.message || 'Sign-in failed');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      if (!password) {
        throw new Error('Password is required');
      }

      const loginUrl = `${API_BASE}/auth/login`;
      console.log('🌐 [AUTH] POST', loginUrl);
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password');
      }

      await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(data.user));
      await AsyncStorage.setItem('user_email', data.user.email || '');

      setIsAuthenticated(true);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Email sign-in error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    if (!isFirebaseConfigured() || !isGoogleOAuthConfigured()) {
      const msg =
        'Google sign-in is not configured yet. Paste your Firebase + Google OAuth client IDs into config/firebase.js.';
      setError(msg);
      return { success: false, error: msg };
    }
    // Real implementation goes here once Firebase is wired:
    //   1. Use expo-auth-session/providers/google to obtain an id_token.
    //   2. Pass it to firebase/auth: signInWithCredential(auth, GoogleAuthProvider.credential(id_token)).
    //   3. On success, fetch user profile and call setUser + setIsAuthenticated.
    const msg = 'Google sign-in stub: Firebase config is in place but the auth flow has not been wired yet.';
    setError(msg);
    return { success: false, error: msg };
  };

  const signOut = async () => {
    console.log('🔐 [AUTH CONTEXT] signOut() called');
    try {
      console.log('🔐 [AUTH CONTEXT] Setting isLoading to true...');
      setIsLoading(true);
      setError(null);
      
      console.log('🔐 [AUTH CONTEXT] Calling MicrosoftAuthService.signOut()...');
      // Clear local-email session if present
      await AsyncStorage.removeItem(LOCAL_USER_KEY);
      // Always clear Microsoft auth storage (tokens, profile, email)
      await MicrosoftAuthService.signOut();
      console.log('🔐 [AUTH CONTEXT] MicrosoftAuthService.signOut() completed');
      
      console.log('🔐 [AUTH CONTEXT] Setting isAuthenticated to false...');
      setIsAuthenticated(false);
      console.log('🔐 [AUTH CONTEXT] Setting user to null...');
      setUser(null);
      
      console.log('🔐 [AUTH CONTEXT] signOut() completed successfully');
      return { success: true };
    } catch (error) {
      console.error('🔐 [AUTH CONTEXT ERROR] Sign-out error:', error);
      console.error('🔐 [AUTH CONTEXT ERROR] Error stack:', error.stack);
      setError(error.message || 'Sign-out failed');
      return { success: false, error: error.message };
    } finally {
      console.log('🔐 [AUTH CONTEXT] Setting isLoading to false...');
      setIsLoading(false);
      console.log('🔐 [AUTH CONTEXT] signOut() finally block completed. isAuthenticated:', isAuthenticated, ', isLoading:', isLoading);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const refreshAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const hasStoredAuth = await MicrosoftAuthService.loadStoredAuth();
      
      if (hasStoredAuth) {
        const authState = MicrosoftAuthService.getAuthState();
        setIsAuthenticated(authState.isAuthenticated);
        setUser(authState.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth refresh error:', error);
      setError('Failed to refresh authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    // State
    isAuthenticated,
    user,
    isLoading,
    error,
    
    // Actions
    signInWithMicrosoft,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    clearError,
    refreshAuth,
    
    // Utilities
    isMicrosoftUser: user?.authProvider !== 'email',
    isEmailUser: user?.authProvider === 'email',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
