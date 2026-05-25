import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { CommonActions } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomTabsNavigator from './BottomTabsNavigator';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext.js';

const Drawer = createDrawerNavigator();


function CustomDrawerContent({ navigation }) {
  const { user, signOut, isMicrosoftUser, isEmailUser } = useAuth();
  console.log(user);
  
  const DrawerItem = ({ label, iconName, isActive, onPress, showDot }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.drawerItem, isActive && styles.activeItem]}
    >
      <View style={styles.iconLabelWrapper}>
        <MaterialCommunityIcons
          name={iconName}
          size={20}
          color={isActive ? '#007BDB' : '#ffffff'}
        />
        <Text style={[styles.drawerLabel, isActive && styles.activeLabel]}>
          {label}
        </Text>
      </View>
      {showDot && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  return (
    <DrawerContentScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('Profile');
          navigation.closeDrawer(); // 👈 closes drawer after navigation
        }}
      >
        <MaterialCommunityIcons name="account-circle" size={55} color="#fff" />
        <Text style={styles.username}>{user?.displayName || ""}</Text>
      </TouchableOpacity>

      {/* Menu */}
      <View style={styles.menu}>
        <DrawerItem
          label="My Expenses"
          iconName="wallet-outline"
          isActive={true}
          onPress={() => {
            navigation.replace('Main');
            navigation.closeDrawer();
          }}
        />
        {/* <DrawerItem
          label="History"
          iconName="view-list-outline"
          onPress={() => {
            alert('History');
            navigation.closeDrawer();
          }}
        /> */}
        {/* <DrawerItem
          label="Notifications"
          iconName="bell-outline"
          showDot={true}
          onPress={() => {
            navigation.navigate('Notifications');
            navigation.closeDrawer();
          }}
        /> */}
        <DrawerItem
          label="Log Out"
          iconName="logout"
          onPress={async () => {
            console.log('🚪 [LOGOUT] Logout button pressed');
            try {
              console.log('🚪 [LOGOUT] Closing drawer immediately...');
              // Close drawer FIRST before signOut to prevent render errors
              navigation.closeDrawer();
              
              // Small delay to ensure drawer closes
              await new Promise(resolve => setTimeout(resolve, 100));
              
              console.log('🚪 [LOGOUT] Calling signOut()...');
              const result = await signOut();
              console.log('🚪 [LOGOUT] signOut() result:', result);
              
              // Small delay to ensure state updates propagate
              console.log('🚪 [LOGOUT] Waiting 200ms for state to update...');
              await new Promise(resolve => setTimeout(resolve, 200));
              
              console.log('🚪 [LOGOUT] Getting root navigator...');
              // Get the root Stack navigator (from App.js)
              // Traverse up the navigation tree to find the root
              let rootNavigator = navigation;
              let depth = 0;
              while (rootNavigator.getParent && depth < 5) {
                const parent = rootNavigator.getParent();
                if (!parent || parent === rootNavigator) break;
                console.log(`🚪 [LOGOUT] Navigating up, depth: ${depth}`);
                rootNavigator = parent;
                depth++;
              }
              
              console.log('🚪 [LOGOUT] Dispatching CommonActions.reset to Splash on root navigator...');
              // Reset the root Stack navigator to Splash screen
              rootNavigator.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Splash' }],
                })
              );
              console.log('🚪 [LOGOUT] Navigation reset dispatched successfully');
            } catch (e) {
              console.error('🚪 [LOGOUT ERROR] Logout navigation error:', e);
              console.error('🚪 [LOGOUT ERROR] Error stack:', e.stack);
              // Fallback: try alternative navigation method
              try {
                console.log('🚪 [LOGOUT] Attempting fallback navigation...');
                const parent = navigation.getParent();
                if (parent) {
                  parent.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{ name: 'Splash' }],
                    })
                  );
                  console.log('🚪 [LOGOUT] Fallback navigation dispatched');
                } else {
                  console.error('🚪 [LOGOUT ERROR] No parent navigator found for fallback');
                }
              } catch (err) {
                console.error('🚪 [LOGOUT ERROR] Fallback navigation also failed:', err);
                console.error('🚪 [LOGOUT ERROR] Fallback error stack:', err.stack);
              }
            }
          }}
        />
      </View>
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  return (
    
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'transparent',
        drawerStyle: {
          width: '70%',
          backgroundColor: '#007BDB',
        },
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="HomeTabs"
        component={BottomTabsNavigator}
        options={{ title: 'Home' }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Drawer.Navigator>
   
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007BDB',
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  username: {
    marginTop: 8,
    fontSize: 17,
    color: '#fff',
    fontWeight: 'bold',
  },
  menu: {
    flex: 1,
    paddingHorizontal: 18,
    width: '100%',
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  activeItem: {
    backgroundColor: '#fff',
  },
  iconLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerLabel: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 14,
    fontWeight: '500',
  },
  activeLabel: {
    color: '#007BDB',
  },
  dot: {
    width: 7,
    height: 7,
    backgroundColor: '#FFA500',
    borderRadius: 3.5,
    marginLeft: 6,
  },
});
