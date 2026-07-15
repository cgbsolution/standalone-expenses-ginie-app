import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { toast, confirm, actionSheet, tokens } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  fetchProfile,
  uploadAvatar,
  updateIntegrationProvider,
} from '../api/userProfile';

const BRAND = tokens.color.accent;
const BRAND_DARK = '#004F94';

// Sign-in providers the user can connect on the Integrations row.
const PROVIDERS = [
  { value: 'microsoft', label: 'Microsoft', icon: 'logo-microsoft' },
  { value: 'google', label: 'Google', icon: 'logo-google' },
  { value: 'email', label: 'Email', icon: 'mail-outline' },
];

function providerLabel(value) {
  return PROVIDERS.find((p) => p.value === value)?.label || 'None';
}

function getInitials(name) {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function StatTile({ value, label }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ icon, iconBg, iconColor, label, value, onPress, isLast, danger }) {
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={onPress}
      >
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={[styles.rowLabel, danger && { color: tokens.color.danger }]}>
          {label}
        </Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {!danger ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={tokens.color.textSubtle}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </TouchableOpacity>
      {!isLast ? <View style={styles.divider} /> : null}
    </>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, signOut, isMicrosoftUser, isEmailUser, updateLocalUser } = useAuth();

  const userData = user
    ? {
        name: user.displayName || user.email || 'User',
        email: user.mail || user.email || user.userPrincipalName || '',
        designation: user.jobTitle || 'Member',
        company: user.officeLocation || user.companyName || '',
      }
    : {
        name: 'Guest User',
        email: '',
        designation: 'Member',
        company: '',
      };

  const initials = getInitials(userData.name);

  // Local view-state, seeded from the auth user then refreshed from the backend.
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);
  const [provider, setProvider] = useState(
    user?.integrationProvider ||
      (isMicrosoftUser ? 'microsoft' : isEmailUser ? 'email' : null),
  );
  const [uploading, setUploading] = useState(false);

  // TODO: wire these to real API data
  const stats = {
    submitted: '—',
    reimbursed: '—',
    avgApproval: '—',
  };

  // Pull the latest avatar + integration provider from the backend on open.
  useEffect(() => {
    let cancelled = false;
    if (!userData.email) return;
    (async () => {
      const res = await fetchProfile(userData.email);
      if (cancelled || !res.success || !res.user) return;
      if (res.user.avatarUrl) setAvatarUrl(res.user.avatarUrl);
      if (res.user.integrationProvider) setProvider(res.user.integrationProvider);
    })();
    return () => {
      cancelled = true;
    };
  }, [userData.email]);

  const persistAvatar = useCallback(
    async (fileUri) => {
      if (!userData.email) {
        toast.error('We could not find your account email.', 'Upload failed');
        return;
      }
      setUploading(true);
      try {
        const res = await uploadAvatar(userData.email, fileUri);
        if (res.success && res.avatarUrl) {
          setAvatarUrl(res.avatarUrl);
          await updateLocalUser({ avatarUrl: res.avatarUrl });
          toast.success('Profile photo updated.', 'Done');
        } else {
          toast.error(res.error || 'Could not upload your photo.', 'Upload failed');
        }
      } finally {
        setUploading(false);
      }
    },
    [userData.email, updateLocalUser],
  );

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Allow photo access to choose a picture.', 'Permission needed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      persistAvatar(result.assets[0].uri);
    }
  }, [persistAvatar]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.error('Allow camera access to take a picture.', 'Permission needed');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      persistAvatar(result.assets[0].uri);
    }
  }, [persistAvatar]);

  const handleAvatarPress = useCallback(async () => {
    if (uploading) return;
    const choice = await actionSheet({
      title: 'Profile photo',
      description: 'Choose how you want to set your picture.',
      options: [
        { label: 'Take photo', icon: 'camera-outline', value: 'camera' },
        { label: 'Choose from library', icon: 'image-outline', value: 'library' },
      ],
      cancelLabel: 'Cancel',
    });
    if (choice?.value === 'camera') takePhoto();
    else if (choice?.value === 'library') pickFromLibrary();
  }, [uploading, takePhoto, pickFromLibrary]);

  const handleIntegrationsPress = useCallback(async () => {
    const choice = await actionSheet({
      title: 'Sign-in provider',
      description: 'Connect the account you use to sign in.',
      options: PROVIDERS.map((p) => ({
        label: p.label,
        icon: p.icon,
        value: p.value,
        detail: p.value === provider ? 'Current' : undefined,
      })),
      cancelLabel: 'Cancel',
    });
    if (!choice?.value || choice.value === provider) return;

    const previous = provider;
    setProvider(choice.value); // optimistic
    const res = await updateIntegrationProvider(userData.email, choice.value);
    if (res.success) {
      await updateLocalUser({ integrationProvider: choice.value });
      toast.success(`Provider set to ${providerLabel(choice.value)}.`, 'Saved');
    } else {
      setProvider(previous); // roll back
      toast.error(res.error || 'Could not update your provider.', 'Update failed');
    }
  }, [provider, userData.email, updateLocalUser]);

  const handleLogout = async () => {
    const ok = await confirm({
      variant: 'destructive',
      title: 'Sign out?',
      message: 'You’ll need to sign in again to access your expenses.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay',
    });
    if (!ok) return;

    try {
      const result = await signOut();
      if (result.success) {
        await new Promise((resolve) => setTimeout(resolve, 150));

        let rootNavigator = navigation;
        let depth = 0;
        while (rootNavigator.getParent && depth < 5) {
          const parent = rootNavigator.getParent();
          if (!parent || parent === rootNavigator) break;
          rootNavigator = parent;
          depth++;
        }

        rootNavigator.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Splash' }],
          })
        );
      } else {
        toast.error('Failed to logout. Please try again.', 'Logout failed');
      }
    } catch (e) {
      console.error('Logout error:', e);
      toast.error('Failed to logout. Please try again.', 'Logout failed');
    }
  };

  const notImplemented = (feature) =>
    toast.info(`${feature} settings are coming soon.`, 'Not available yet');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_DARK} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <LinearGradient
          colors={[BRAND, BRAND_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Profile</Text>
            <TouchableOpacity
              style={styles.heroAction}
              onPress={() => notImplemented('Account')}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.userRow}>
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.8}
              onPress={handleAvatarPress}
              accessibilityLabel="Change profile photo"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              <View style={styles.avatarBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={13} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {userData.name}
              </Text>
              {userData.designation ? (
                <Text style={styles.userMeta} numberOfLines={1}>
                  {userData.designation}
                </Text>
              ) : null}
              {userData.company ? (
                <Text style={styles.userMeta} numberOfLines={1}>
                  {userData.company}
                </Text>
              ) : null}
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatTile value={stats.submitted} label="SUBMITTED" />
            <View style={styles.statDivider} />
            <StatTile value={stats.reimbursed} label="REIMBURSED" />
            <View style={styles.statDivider} />
            <StatTile value={stats.avgApproval} label="AVG APPROVAL" />
          </View>
        </LinearGradient>

        {/* Settings list */}
        <View style={styles.settingsCard}>
          <SettingRow
            icon="notifications-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="Notifications"
            value="On"
            onPress={() => notImplemented('Notifications')}
          />
          <SettingRow
            icon="moon-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="Appearance"
            value="System"
            onPress={() => notImplemented('Appearance')}
          />
          <SettingRow
            icon="grid-outline"
            iconBg="#E0E7FF"
            iconColor="#6366F1"
            label="Integrations"
            value={providerLabel(provider)}
            onPress={handleIntegrationsPress}
            isLast
          />
        </View>

        {/* Sign out card */}
        <View style={styles.signOutCard}>
          <SettingRow
            icon="log-out-outline"
            iconBg="#FEE2E2"
            iconColor={tokens.color.danger}
            label="Sign out"
            onPress={handleLogout}
            isLast
            danger
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },

  // ---- Hero ----
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  heroAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND_DARK,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  userMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
  proBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },

  // ---- Settings list ----
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  signOutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: tokens.color.text,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    color: tokens.color.textMuted,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.border,
    marginLeft: 14 + 32 + 12,
  },
});
