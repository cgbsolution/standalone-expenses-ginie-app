import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AuthTestComponent() {
  const { 
    isAuthenticated, 
    user, 
    signInWithMicrosoft, 
    signInWithEmail, 
    signOut, 
    isLoading, 
    error 
  } = useAuth();

  const handleTestMicrosoftAuth = async () => {
    try {
      const result = await signInWithMicrosoft();
      if (result.success) {
        Alert.alert('Success', 'Microsoft authentication successful!');
      } else if (result.cancelled) {
        Alert.alert('Cancelled', 'Microsoft authentication was cancelled.');
      } else {
        Alert.alert('Error', result.error || 'Microsoft authentication failed.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleTestEmailAuth = async () => {
    try {
      const result = await signInWithEmail('test@example.com', 'password123');
      if (result.success) {
        Alert.alert('Success', 'Email authentication successful!');
      } else {
        Alert.alert('Error', result.error || 'Email authentication failed.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleTestSignOut = async () => {
    try {
      const result = await signOut();
      if (result.success) {
        Alert.alert('Success', 'Sign out successful!');
      } else {
        Alert.alert('Error', result.error || 'Sign out failed.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusText, isAuthenticated ? styles.authenticated : styles.notAuthenticated]}>
          {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
        </Text>
      </View>

      {isAuthenticated && user && (
        <View style={styles.userInfo}>
          <Text style={styles.userLabel}>User Info:</Text>
          <Text style={styles.userText}>Name: {user.displayName || user.email || 'Unknown'}</Text>
          <Text style={styles.userText}>Email: {user.email || user.mail || user.userPrincipalName || 'Unknown'}</Text>
          <Text style={styles.userText}>Provider: {user.authProvider || 'Microsoft'}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.microsoftButton]} 
          onPress={handleTestMicrosoftAuth}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Loading...' : 'Test Microsoft Auth'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.emailButton]} 
          onPress={handleTestEmailAuth}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Loading...' : 'Test Email Auth'}
          </Text>
        </TouchableOpacity>

        {isAuthenticated && (
          <TouchableOpacity 
            style={[styles.button, styles.signOutButton]} 
            onPress={handleTestSignOut}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Loading...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  authenticated: {
    color: '#4CAF50',
  },
  notAuthenticated: {
    color: '#F44336',
  },
  userInfo: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  userLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userText: {
    fontSize: 12,
    marginBottom: 2,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  microsoftButton: {
    backgroundColor: '#0078D4',
  },
  emailButton: {
    backgroundColor: '#4CAF50',
  },
  signOutButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
