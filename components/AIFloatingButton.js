import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function AIFloatingButton() {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleOpenChat = () => {
    navigation.navigate('ChatBot');
  };

  return (
    <View style={styles.container}>
      {/* Close (X) Button */}
      <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}>
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>

      {/* AI Chat Button */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenChat}>
        <Ionicons name="chatbubbles" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, // adjust as needed
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  fab: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 32,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: '#555',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
