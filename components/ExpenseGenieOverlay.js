import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadExpenseDocument } from '../api/expenseUpload';
import { toast, actionSheet } from './ui';

export default function ExpenseGenieOverlay({ visible, onClose, onSendMessage }) {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const insets = useSafeAreaInsets();
  
  // Tab bar height: 74 + insets.bottom (from BottomTabsNavigator)
  const tabBarHeight = 74 + insets.bottom;

  React.useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleSend = () => {
    // The chat lives in a cross-origin iframe — the parent WebView cannot
    // inject text into it. The only way to actually send a message is to
    // dismiss this overlay and type in the chat below.
    if (message.trim()) {
      setMessage('');
    }
    onClose();
  };

  const handleButtonPress = () => {
    // Orange "1 Click Upload & Submit" button — opens the file picker.
    handleAttach();
  };

  const handleInputFocus = () => {
    // Keep the welcome design visible while the user types.
    // (Old behaviour closed the overlay here — removed by request.)
  };

  const handleAttach = async () => {
    if (uploading) return;
    const pick = await actionSheet({
      title: 'Attach a file',
      description: 'Pick a source for your receipt or document.',
      options: [
        { label: 'Take a photo', icon: 'camera-outline', value: 'camera' },
        { label: 'Choose from gallery', icon: 'images-outline', value: 'gallery' },
        { label: 'Browse files', icon: 'folder-outline', value: 'files' },
      ],
    });
    if (!pick) return;
    if (pick.value === 'camera') pickFromCamera();
    else if (pick.value === 'gallery') pickFromGallery();
    else if (pick.value === 'files') pickFromFiles();
  };

  const doUpload = async (uri, name) => {
    try {
      setUploading(true);
      const result = await uploadExpenseDocument(uri, name || 'attachment');
      setUploading(false);
      if (result.success) {
        toast.success('Your document was submitted.', 'Uploaded');
      } else {
        toast.error(result.error || 'Could not upload the file.', 'Upload failed');
      }
    } catch (err) {
      setUploading(false);
      toast.error(err.message || 'Unexpected error.', 'Upload failed');
    }
  };

  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast.warning('Camera permission is needed.', 'Permission required');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        await doUpload(a.uri, a.fileName || 'camera.jpg');
      }
    } catch (e) {
      toast.error(e.message || 'Could not take photo.', 'Camera error');
    }
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.warning('Gallery permission is needed.', 'Permission required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        await doUpload(a.uri, a.fileName || 'photo.jpg');
      }
    } catch (e) {
      toast.error(e.message || 'Could not pick image.', 'Gallery error');
    }
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        await doUpload(a.uri, a.name || 'file');
      }
    } catch (e) {
      toast.error(e.message || 'Could not pick file.', 'File picker error');
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <KeyboardAvoidingView
        style={[styles.container]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {/* Backdrop - tap to close (doesn't cover tab bar) */}
        <TouchableOpacity
          style={[styles.backdrop]}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
            },
          ]}
          pointerEvents="box-none"
        >
          <View 
            style={styles.content} 
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => {}}
          >
            {/* Top Section with Genie Icon */}
            <View style={styles.topSection}>
              <View style={styles.genieContainer}>
                <View style={styles.genieIcon}>
                  <Image source={require('../assets/genie.png')} style={styles.genieImage} />
                </View>
              </View>

              {/* App Title */}
              <Text style={styles.title}>ExpenseGenie</Text>
            </View>

            {/* Middle Section */}
            <View style={styles.middleSection}>
              {/* Welcome Message */}
              <Text style={styles.welcomeText}>Welcome to ExpenseGenie!</Text>

              {/* Instructional Text */}
              <Text style={styles.instructionText}>
                "Ready to submit your expenses? I've got Your hassle-free expense claim buddy."
              </Text>

              {/* Action Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleButtonPress}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>1 Click Upload & Submit</Text>
              </TouchableOpacity>

              {/* Non-Bill Expense Section */}
              <View style={styles.nonBillSection}>
                <Text style={styles.nonBillHeader}>
                  <Text style={styles.nonBillLabel}>Non-Bill Expense:</Text> Just type
                </Text>
                <Text style={styles.exampleText}>
                  Submit <Text style={styles.boldText}>taxi fare</Text> expense of <Text style={styles.boldText}>Rs. 500</Text> for <Text style={styles.boldText}>15 kms.</Text> from <Text style={styles.boldText}>Chinchpokli</Text> to <Text style={styles.boldText}>Andheri</Text> for <Text style={styles.boldText}>business meeting</Text>
                </Text>
              </View>
            </View>

            {/* Bottom Section - Chat Input */}
            <View style={styles.bottomSection}>
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={handleAttach}
                  disabled={uploading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Ionicons name="attach" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor="#999"
                  value={message}
                  onChangeText={setMessage}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  onFocus={handleInputFocus}
                  {...(Platform.OS === 'web' && {
                    onFocus: (e) => {
                      e.target.style.outline = 'none';
                      e.target.style.boxShadow = 'none';
                      handleInputFocus();
                    }
                  })}
                />
                <TouchableOpacity
                  style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!message.trim()}
                >
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0,
    padding: 20,
    overflow: 'hidden',
    // Remove any potential borders
    ...Platform.select({
      web: {
        outline: 'none',
        outlineWidth: 0,
        outlineStyle: 'none',
        border: 'none',
      },
    }),
  },
  genieImage: {
    width: 100,
    height: 100,
  },
  content: {
    width: '100%',
    height: '100%',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 30,
  },
  middleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'start',
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  genieEmoji: {
    fontSize: 90,
  },
  title: {
    fontSize: 36,
    fontWeight: '500',
    color: '#331859',
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: '#E4842E',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 260,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  nonBillSection: {
    marginTop: 32,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    width: '100%',
  },
  nonBillHeader: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'left',
  },
  nonBillLabel: {
    textDecorationLine: 'underline',
  },
  exampleText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 22,
    textAlign: 'left',
  },
  boldText: {
    fontWeight: 'bold',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 12,
    shadowColor: '#000',
    // Remove any focus borders
    ...Platform.select({
      web: {
        outline: 'none',
        outlineWidth: 0,
        outlineStyle: 'none',
      },
    }),
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 2,
    paddingHorizontal: 4,
    maxHeight: 100,
    // Remove blue border completely
    ...Platform.select({
      web: {
        outline: 'none',
        outlineWidth: 0,
        outlineStyle: 'none',
        borderWidth: 0,
        boxShadow: 'none',
      },
      ios: {
        borderWidth: 0,
      },
      android: {
        borderWidth: 0,
      },
    }),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    // Remove focus border
    ...Platform.select({
      web: {
        outline: 'none',
        outlineWidth: 0,
      },
    }),
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

// Additional web-specific CSS injection to remove blue borders
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    input:focus, textarea:focus, div:focus {
      outline: none !important;
      box-shadow: none !important;
      border-color: #E5E7EB !important;
    }
    
    [data-focus-visible-added]:focus {
      outline: none !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
}