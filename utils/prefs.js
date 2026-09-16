// Device-level user preferences, persisted in AsyncStorage.
// Used by the Profile settings rows (Notifications, Appearance) and read by the
// screens that act on them (Home bell badge, app color scheme).

import AsyncStorage from '@react-native-async-storage/async-storage';

export const PREF_KEYS = {
  notifications: 'pref_notifications_enabled',
  appearance: 'pref_appearance', // 'system' | 'light' | 'dark'
};

export async function getNotificationsEnabled() {
  try {
    const v = await AsyncStorage.getItem(PREF_KEYS.notifications);
    return v == null ? true : v === 'true'; // default ON
  } catch {
    return true;
  }
}

export async function setNotificationsEnabled(on) {
  try {
    await AsyncStorage.setItem(PREF_KEYS.notifications, on ? 'true' : 'false');
  } catch {}
}

export async function getAppearance() {
  try {
    const v = await AsyncStorage.getItem(PREF_KEYS.appearance);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export async function setAppearance(value) {
  try {
    await AsyncStorage.setItem(PREF_KEYS.appearance, value);
  } catch {}
}
