import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications';

const TYPE_VISUAL = {
  approval_needed: { icon: 'time-outline',          bg: '#FEF3C7', color: '#D97706' },
  approved:        { icon: 'checkmark-circle',      bg: '#DCFCE7', color: '#16A34A' },
  rejected:        { icon: 'close-circle',          bg: '#FEE2E2', color: '#DC2626' },
  reimbursed:      { icon: 'cash-outline',          bg: '#E0F2FE', color: '#0284C7' },
  policy:          { icon: 'information-circle',    bg: '#E0E7FF', color: '#6366F1' },
  comment:         { icon: 'chatbubble-outline',    bg: '#F3F4F6', color: '#6B7280' },
  default:         { icon: 'notifications-outline', bg: '#F3F4F6', color: '#6B7280' },
};
const getVisual = (type) => TYPE_VISUAL[type] || TYPE_VISUAL.default;

const formatRelative = (iso) => {
  const date = new Date(iso);
  const diffMins = Math.floor((Date.now() - date) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const dayBucket = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This week';
  return 'Earlier';
};

function NotificationRow({ item, onPress }) {
  const v = getVisual(item.type);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: v.bg }]}>
        <Ionicons name={v.icon} size={18} color={v.color} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text
            style={[styles.rowTitle, !item.read && styles.rowTitleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.rowTime}>{formatRelative(item.createdAt)}</Text>
        </View>
        <Text style={styles.rowBodyText} numberOfLines={2}>
          {item.body}
        </Text>
      </View>
      {!item.read ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState(
    user?.email || user?.mail || user?.userPrincipalName || ''
  );

  // Resolve the signed-in email (fall back to the stored value like Home does).
  React.useEffect(() => {
    let active = true;
    const fromUser = user?.email || user?.mail || user?.userPrincipalName || '';
    if (fromUser) {
      setEmail(fromUser);
      return;
    }
    (async () => {
      const stored = await AsyncStorage.getItem('user_email');
      if (active && stored) setEmail(stored);
    })();
    return () => { active = false; };
  }, [user]);

  const load = useCallback(async () => {
    if (!email) {
      setItems([]);
      setLoading(false);
      return;
    }
    const res = await fetchNotifications(email);
    if (res.success) setItems(res.items);
    setLoading(false);
  }, [email]);

  // Refetch every time the screen comes into focus (and when email resolves).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const grouped = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const groups = new Map();
    sorted.forEach((item) => {
      const key = dayBucket(item.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return Array.from(groups.entries());
  }, [items]);

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true }))); // optimistic
    if (email) await markAllNotificationsRead(email);
  };

  const handlePress = async (item) => {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      markNotificationRead(item.id); // fire-and-forget
    }
    // TODO: deep-link to the expense using item.expenseId when detail routing is ready.
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.color.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <Text style={styles.headerSubtitle}>
              {unreadCount} new {unreadCount === 1 ? 'notification' : 'notifications'}
            </Text>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={8}>
            <Text style={styles.headerAction}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && grouped.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={tokens.color.accent} />
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-outline" size={28} color={tokens.color.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySub}>
              New approvals, reimbursements, and updates will show up here.
            </Text>
          </View>
        ) : (
          grouped.map(([bucket, list]) => (
            <View key={bucket} style={{ marginBottom: 18 }}>
              <Text style={styles.bucketLabel}>{bucket}</Text>
              <View style={styles.groupCard}>
                {list.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <NotificationRow item={item} onPress={() => handlePress(item)} />
                    {idx < list.length - 1 ? <View style={styles.divider} /> : null}
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.border,
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: tokens.color.text },
  headerSubtitle: { fontSize: 12, color: tokens.color.textMuted, marginTop: 1 },
  headerAction: { fontSize: 13, fontWeight: '500', color: tokens.color.accent, paddingHorizontal: 8 },

  scroll: { padding: 16, paddingBottom: 60 },

  loadingBox: { paddingTop: 80, alignItems: 'center', justifyContent: 'center' },

  bucketLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.color.textSubtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  rowTitleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '500', color: tokens.color.text, marginRight: 8 },
  rowTitleUnread: { fontWeight: '600' },
  rowTime: { fontSize: 11, color: tokens.color.textSubtle, fontWeight: '500' },
  rowBodyText: { fontSize: 13, color: tokens.color.textMuted, lineHeight: 18 },

  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: tokens.color.accent,
    marginLeft: 8, marginTop: 16,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.border,
    marginLeft: 14 + 36 + 12,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: tokens.color.bgMuted,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: tokens.color.text, marginBottom: 4 },
  emptySub: { fontSize: 13, color: tokens.color.textMuted, textAlign: 'center', lineHeight: 18 },
});
