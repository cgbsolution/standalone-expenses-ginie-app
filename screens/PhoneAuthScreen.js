import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import genieLogo from '../assets/iconginie1.png';
import googleLogo from '../assets/google.png';
import { toast } from '../components/ui';

function MicrosoftSquaresLogo({ size = 18 }) {
  const cell = (size - 2) / 2;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[mlStyles.row]}>
        <View style={[mlStyles.square, { width: cell, height: cell, backgroundColor: '#F35325' }]} />
        <View style={[mlStyles.square, { width: cell, height: cell, backgroundColor: '#81BC06', marginLeft: 2 }]} />
      </View>
      <View style={[mlStyles.row, { marginTop: 2 }]}>
        <View style={[mlStyles.square, { width: cell, height: cell, backgroundColor: '#05A6F0' }]} />
        <View style={[mlStyles.square, { width: cell, height: cell, backgroundColor: '#FFBA08', marginLeft: 2 }]} />
      </View>
    </View>
  );
}

const mlStyles = StyleSheet.create({
  row: { flexDirection: 'row' },
  square: { borderRadius: 1 },
});

export default function PhoneAuthScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const {
    signInWithEmail,
    signInWithMicrosoft,
    signInWithGoogle,
    isLoading,
    error,
    clearError,
  } = useAuth();

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      toast.warning('Enter an email and password.', 'Missing details');
      return;
    }
    clearError();
    const result = await signInWithEmail(email.trim(), password);
    if (result.success) {
      navigation.replace('Main');
    } else {
      toast.error(result.error || 'Invalid email or password.', 'Sign-in failed');
    }
  };

  const handleMicrosoftLogin = async () => {
    clearError();
    const result = await signInWithMicrosoft();
    if (result.success) {
      navigation.replace('Main');
    } else if (!result.cancelled) {
      toast.error(result.error || 'Please try again.', 'Microsoft sign-in failed');
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    const result = await signInWithGoogle();
    if (result.success) {
      navigation.replace('Main');
    } else {
      toast.error(result.error || 'Could not sign in with Google.', 'Google sign-in');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={genieLogo} style={styles.logo} resizeMode="contain" />

          <Text style={styles.title}>Sign in to your{'\n'}Account</Text>
          <Text style={styles.subtitle}>Enter your email and password to log in</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9AA0A6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="••••••••"
              placeholderTextColor="#9AA0A6"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#5F6368"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleEmailLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerWrapper}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, isLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Image source={googleLogo} style={styles.googleLogoImg} resizeMode="contain" />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, isLoading && styles.buttonDisabled]}
            onPress={handleMicrosoftLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <View style={styles.socialIconWrap}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#5F6368" />
              ) : (
                <MicrosoftSquaresLogo size={22} />
              )}
            </View>
            <Text style={styles.socialButtonText}>Continue with Microsoft</Text>
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  logo: {
    width: 96,
    height: 96,
    marginTop: 16,
    marginBottom: 28,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0B1220',
    marginBottom: 10,
    lineHeight: 44,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 20,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 18,
    justifyContent: 'center',
  },
  primaryButton: {
    height: 56,
    backgroundColor: '#2A6BFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  dividerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 14,
    color: '#9CA3AF',
    fontSize: 13,
  },
  socialButton: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  socialIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  googleLogoImg: {
    width: 22,
    height: 22,
    marginRight: 14,
  },
  socialButtonText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
  },
});
