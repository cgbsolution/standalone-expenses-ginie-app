import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const TopBar = () => {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Menu Button */}
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
          <Ionicons name="menu" size={28} color="#007BDB" /> 
        </TouchableOpacity>

        {/* Stretched Logo */}
        <Image
          source={require('../assets/img.png')}
          style={styles.logo}
          // resizeMode="stretch"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 3,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  menuButton: {
    marginRight: 10,
    zIndex: 1,
  },
  logo: {
    width: width - 100,  // fill screen except space for menu button
    height: 60,         // bigger logo
  },
});

export default TopBar;
