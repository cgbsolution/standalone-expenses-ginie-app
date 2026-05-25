import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const CustomDrawerContent = (props) => {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.header}>
        <Ionicons name="person-circle-outline" size={60} color="#fff" />
        <Text style={styles.username}>Lakshit Jain</Text>
      </View>

      <View style={styles.menu}>
        <DrawerItem
          label="Dashboard"
          labelStyle={styles.label}
          icon={() => <Ionicons name="home-outline" size={20} color="#fff" />}
          onPress={() => props.navigation.navigate('Dashboard')}
        />
        <DrawerItem
          label="My Expenses"
          labelStyle={styles.label}
          icon={() => <Ionicons name="wallet-outline" size={20} color="#fff" />}
          onPress={() => props.navigation.navigate('My Expenses')}
        />
        <DrawerItem
          label="History"
          labelStyle={styles.label}
          icon={() => <Ionicons name="time-outline" size={20} color="#fff" />}
          onPress={() => alert('History')}
        />
        <DrawerItem
          label="Notifications"
          labelStyle={styles.label}
          icon={() => <Ionicons name="notifications-outline" size={20} color="#fff" />}
          onPress={() => alert('Notifications')}
        />
        <DrawerItem
          label="Settings"
          labelStyle={styles.label}
          icon={() => <Ionicons name="settings-outline" size={20} color="#fff" />}
          onPress={() => alert('Settings')}
        />
        <DrawerItem
          label="Support"
          labelStyle={styles.label}
          icon={() => <Ionicons name="help-circle-outline" size={20} color="#fff" />}
          onPress={() => alert('Support')}
        />
        <DrawerItem
          label="Log Out"
          labelStyle={styles.label}
          icon={() => <MaterialIcons name="logout" size={20} color="#fff" />}
          onPress={() => alert('Logged Out')}
        />
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0073e6',
    padding: 20,
    alignItems: 'center',
  },
  username: {
    marginTop: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  menu: {
    backgroundColor: '#0073e6',
    flex: 1,
  },
  label: {
    color: '#fff',
    marginLeft: -10,
  },
});

export default CustomDrawerContent;
