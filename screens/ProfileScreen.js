import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, signOut, isMicrosoftUser, isEmailUser } = useAuth();

  // Default user data for fallback
  const defaultUserData = {
    avatar: 'https://i.pravatar.cc/150?img=12',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+91 9876543210',
    designation: 'Senior Software Engineer',
    company: 'Tata RE India',
  };

  // Use authenticated user data or fallback to default
  const userData = user ? {
    avatar: user.photoURL || 'https://i.pravatar.cc/150?img=12',
    name: user.displayName || user.email || 'User',
    email: user.mail || user.email || user.mail || user.userPrincipalName || 'user@example.com',
    phone: user.mobilePhone || '+91 9876543210',
    designation: user.jobTitle || 'Software Engineer',
    company: user.officeLocation || 'Tata RE India',
  } : defaultUserData;

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            console.log('🚪 [PROFILE LOGOUT] Logout button pressed');
            try {
              console.log('🚪 [PROFILE LOGOUT] Calling signOut()...');
              // Sign out first to clear auth state
              const result = await signOut();
              console.log('🚪 [PROFILE LOGOUT] signOut() result:', result);
              
              if (result.success) {
                console.log('🚪 [PROFILE LOGOUT] Sign out successful, waiting 150ms...');
                // Small delay to ensure state updates propagate
                await new Promise(resolve => setTimeout(resolve, 150));
                
                console.log('🚪 [PROFILE LOGOUT] Getting root navigator...');
                // Get the root Stack navigator (from App.js)
                let rootNavigator = navigation;
                let depth = 0;
                while (rootNavigator.getParent && depth < 5) {
                  const parent = rootNavigator.getParent();
                  if (!parent || parent === rootNavigator) break;
                  console.log(`🚪 [PROFILE LOGOUT] Navigating up, depth: ${depth}`);
                  rootNavigator = parent;
                  depth++;
                }
                
                console.log('🚪 [PROFILE LOGOUT] Dispatching CommonActions.reset to Splash on root navigator...');
                // Reset the root Stack navigator to Splash screen
                rootNavigator.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Splash' }],
                  })
                );
                console.log('🚪 [PROFILE LOGOUT] Navigation reset dispatched successfully');
              } else {
                console.error('🚪 [PROFILE LOGOUT ERROR] Sign out failed:', result);
                Alert.alert('Error', 'Failed to logout. Please try again.');
              }
            } catch (e) {
              console.error('🚪 [PROFILE LOGOUT ERROR] Logout error:', e);
              console.error('🚪 [PROFILE LOGOUT ERROR] Error stack:', e.stack);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerWrapper}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        <View style={styles.whiteCard}>
          <View style={styles.profileHeader}>
            {/* <Image source={{ uri: userData.avatar }} style={styles.avatar} /> */}
            <View style={styles.infoContainer}>
              <Text style={styles.name}>{userData.name}</Text>
              <Text style={styles.designation}>{userData.designation}</Text>
              <Text style={styles.company}>{userData.company}</Text>
            </View>
            {/* <TouchableOpacity style={styles.editIcon}>
              <MaterialIcons name="edit" size={20} color="#3D586E" />
            </TouchableOpacity> */}
          </View>
        </View>

        <View style={styles.whiteCard}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{userData.email }</Text>

          {/* <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{userData.phone}</Text> */}

          <Text style={styles.label}>Authentication Provider</Text>
          <View style={styles.providerContainer}>
            <Text style={styles.value}>
              {isMicrosoftUser ? 'Microsoft Account' : isEmailUser ? 'Email/Password' : 'Unknown'}
            </Text>
            {isMicrosoftUser && (
              <View style={styles.microsoftBadge}>
                <Text style={styles.badgeText}>🔷 Microsoft</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB', // ✅ matches HomeScreen
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 16,
    paddingBottom: 50,
  },
  headerWrapper: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  designation: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  company: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  editIcon: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  value: {
    color: '#334155',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  providerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  microsoftBadge: {
    backgroundColor: '#0078D4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
