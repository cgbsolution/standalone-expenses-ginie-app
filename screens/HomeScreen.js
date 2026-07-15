import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@env';
import { confirm, tokens } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fetchUnreadCount } from '../api/notifications';

const API_URL = `${BASE_URL}/master-expense`;
const BRAND = tokens.color.accent;
const HERO_DARK = '#0E1B2C';
const HERO_DARK_2 = '#1A2C42';
const CHART_H = 56; // px height of the hero/month bar charts

// hex (#RGB or #RRGGBB) → rgba() so we can build gradients at any opacity
function withAlpha(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ─────────────── helpers ───────────────
const formatINR = (val, { compact = false } = {}) => {
  const num = Number(val) || 0;
  if (compact) {
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${Math.round(num / 1000)}k`;
    return `₹${num}`;
  }
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatRelative = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
};

const titleCase = (s) =>
  s
    ? s
        .split(/[\s._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ')
    : '';

const resolveDisplayName = (authUser, employeeInfo) => {
  // 1. Current-session auth displayName — always reflects who is logged in NOW
  if (authUser?.displayName) return authUser.displayName;
  if (authUser?.name) return authUser.name;

  // 2. Database employee record (may be cached AsyncStorage data)
  const dbName =
    employeeInfo?.EmployeeName ||
    employeeInfo?.employeeName ||
    employeeInfo?.FullName ||
    employeeInfo?.fullName ||
    employeeInfo?.Name ||
    employeeInfo?.name;
  if (dbName) return dbName;

  // 3. Derive from email local part (title-cased)
  const email = authUser?.email || authUser?.mail || authUser?.userPrincipalName || '';
  if (email) {
    const local = email.split('@')[0];
    const cased = titleCase(local);
    if (cased) return cased;
  }
  return 'there';
};

const getFirstName = (fullName) => {
  if (!fullName || fullName === 'there') return 'there';
  return fullName.trim().split(/\s+/)[0];
};

const CATEGORY_VISUAL = {
  travel:   { icon: 'airplane',     bg: '#E0F2FE', color: '#0284C7' },
  lodging:  { icon: 'bed',          bg: '#FCE7F3', color: '#DB2777' },
  meals:    { icon: 'restaurant',   bg: '#FEF3C7', color: '#D97706' },
  software: { icon: 'laptop',       bg: '#E0E7FF', color: '#6366F1' },
  fuel:     { icon: 'car-sport',    bg: '#DCFCE7', color: '#16A34A' },
  default:  { icon: 'document-text',bg: '#F3F4F6', color: '#6B7280' },
};
const getCategoryVisual = (cat) => {
  const key = (cat || '').toLowerCase().trim();
  return CATEGORY_VISUAL[key] || CATEGORY_VISUAL.default;
};

const STATUS_BADGE = {
  pending:  { bg: '#FFF7ED', color: '#C2410C', label: 'Pending' },
  approved: { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
  rejected: { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
  draft:    { bg: '#F3F4F6', color: '#374151', label: 'Draft' },
};
const getStatusBadge = (status) => {
  const key = (status || '').toLowerCase();
  return STATUS_BADGE[key] || STATUS_BADGE.draft;
};

const extractExpenseInfo = (item) => {
  const exp0 = item.ExpenseData?.[0] || {};
  const itemData = exp0.ItemData || {};
  const amount = item.TotalAmount ?? itemData.ClaimAmount ?? exp0.InvoiceAmount ?? 0;
  const category = exp0.Category || itemData.Category || item.Category || 'default';
  const merchant = item.ExpenseTitle || exp0.VendorCode || 'Untitled';
  const date = item.SubmissionDate || exp0.PostingDate || exp0.DocumentDate;
  return { amount: Number(amount) || 0, category, merchant, date };
};

// ─────────────── sub-components ───────────────
function CategoryChip({ icon, label, amount, color, bg }) {
  return (
    <View style={[styles.chip, { borderColor: tokens.color.border }]}>
      <View style={[styles.chipIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipAmount, { color }]}>{amount}</Text>
    </View>
  );
}

// A single bar that grows in from the baseline with an eased, staggered spring.
function AnimatedBar({ value, color, index, isPeak }) {
  const grow = useSharedValue(0);
  const target = Math.max(5, value * CHART_H);

  useEffect(() => {
    grow.value = withDelay(
      index * 26,
      withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [target, index]);

  const animStyle = useAnimatedStyle(() => ({ height: grow.value }));

  return (
    <View style={styles.barSlot}>
      <Animated.View style={[styles.barOuter, isPeak && styles.barPeak, animStyle]}>
        <LinearGradient
          colors={[
            withAlpha(color, isPeak ? 0.95 : 0.7),
            withAlpha(color, isPeak ? 0.4 : 0.1),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* bright cap on top of each bar for a crisp, candle-like finish */}
        <View
          style={[styles.barTop, { backgroundColor: withAlpha(color, isPeak ? 1 : 0.85) }]}
        />
      </Animated.View>
    </View>
  );
}

// data: array of normalized 0..1 values. Renders gradient bars with the tallest
// bar highlighted, over a faint baseline so even a flat/zero month looks intentional.
function MiniBars({ data, color = '#FFFFFF' }) {
  const peak = useMemo(() => {
    const max = Math.max(...data);
    return max > 0.1 ? data.indexOf(max) : -1; // don't highlight a flat/zero month
  }, [data]);

  return (
    <View style={styles.miniBars}>
      <View style={[styles.baseline, { backgroundColor: withAlpha(color, 0.14) }]} />
      {data.map((v, i) => (
        <AnimatedBar key={i} value={v} color={color} index={i} isPeak={i === peak} />
      ))}
    </View>
  );
}

function HeroCard({ reimbursable, monthlyCap, payoutDate, history }) {
  const [period, setPeriod] = useState('M');
  const pct = monthlyCap > 0 ? Math.min(100, Math.round((reimbursable / monthlyCap) * 100)) : 0;
  const remaining = Math.max(0, monthlyCap - reimbursable);
  const daysLeft = payoutDate
    ? Math.max(0, Math.ceil((payoutDate - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const payoutLabel = payoutDate
    ? payoutDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '—';

  return (
    <LinearGradient
      colors={[HERO_DARK, HERO_DARK_2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroTopRow}>
        <Text style={styles.heroEyebrow}>
          REIMBURSABLE · Q{Math.floor(new Date().getMonth() / 3) + 1}{' '}
          {String(new Date().getFullYear()).slice(2)}
        </Text>
        <View style={styles.periodToggle}>
          {['W', 'M', 'Y'].map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodPill, period === p && styles.periodPillActive]}
            >
              <Text
                style={[
                  styles.periodText,
                  period === p && styles.periodTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.heroAmountRow}>
        <Text style={styles.heroAmount}>
          <Text style={{ opacity: 0.7, fontSize: 20 }}>₹ </Text>
          {Number(reimbursable).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </Text>
        <View style={styles.heroDelta}>
          <Ionicons name="trending-up" size={12} color="#34D399" />
          <Text style={styles.heroDeltaText}>18.4%</Text>
        </View>
      </View>

      <Text style={styles.heroSub}>
        Of {formatINR(monthlyCap)} monthly cap · {pct}% used
      </Text>

      <View style={styles.heroChartWrap}>
        <MiniBars data={history} />
      </View>

      <View style={styles.heroFooter}>
        <View style={styles.heroFooterDot}>
          <Ionicons name="checkmark-circle" size={14} color="#34D399" />
          <Text style={styles.heroFooterText}>Payout {payoutLabel}</Text>
        </View>
        <Text style={styles.heroFooterMeta}>
          {daysLeft !== null ? `${daysLeft} days` : '—'} · {formatINR(remaining)} remaining
        </Text>
      </View>
    </LinearGradient>
  );
}

function QuickAction({ icon, label, bg, color, onPress }) {
  return (
    <TouchableOpacity style={styles.qaTile} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.qaIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function RecentRow({ item, onPress }) {
  const info = extractExpenseInfo(item);
  const cat = getCategoryVisual(info.category);
  const badge = getStatusBadge(item.ApprovalStatus);

  return (
    <TouchableOpacity style={styles.recentRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.recentIcon, { backgroundColor: cat.bg }]}>
        <Ionicons name={cat.icon} size={18} color={cat.color} />
      </View>
      <View style={styles.recentBody}>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {info.merchant}
        </Text>
        <Text style={styles.recentMeta} numberOfLines={1}>
          {String(info.category).charAt(0).toUpperCase() + String(info.category).slice(1)}
          {' · '}
          {formatRelative(info.date)}
        </Text>
      </View>
      <View style={styles.recentRight}>
        <Text style={styles.recentAmount}>{formatINR(info.amount)}</Text>
        <View style={[styles.recentBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.recentBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────── main screen ───────────────
export default function HomeScreen() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigation = useNavigation();
  const { user: authUser } = useAuth();

  // ── auth/user bootstrap ──
  // Resolve current email from auth first (always correct for this session),
  // fall back to AsyncStorage. Discard any cached employee_info whose email
  // doesn't match — it belongs to a previous user.
  useEffect(() => {
    (async () => {
      const sessionEmail =
        authUser?.email || authUser?.mail || authUser?.userPrincipalName || null;
      const storedEmail = await AsyncStorage.getItem('user_email');
      const currentEmail = sessionEmail || storedEmail || null;
      if (currentEmail) setUserEmail(currentEmail);

      const cachedRaw = await AsyncStorage.getItem('employee_info');
      if (!cachedRaw) return;
      try {
        const parsed = JSON.parse(cachedRaw);
        const cachedEmail =
          parsed?.Email || parsed?.email || parsed?.emp_email || parsed?.EmployeeEmail;
        if (
          currentEmail &&
          cachedEmail &&
          String(cachedEmail).toLowerCase() !== String(currentEmail).toLowerCase()
        ) {
          // Stale cache from a different user — drop it.
          await AsyncStorage.removeItem('employee_info');
          return;
        }
        setEmployeeInfo(parsed);
      } catch (_) {
        await AsyncStorage.removeItem('employee_info');
      }
    })();
  }, [authUser]);

  // ── fetch expenses ──
  const fetchExpenses = useCallback(async () => {
    if (!userEmail) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ email: userEmail, approvalStatus: 'All' });
      const resp = await fetch(`${API_URL}?${params.toString()}`);
      const data = await resp.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => { void fetchExpenses(); }, [fetchExpenses]);

  // ── unread notification badge ──
  // Refresh the count whenever Home regains focus (e.g. after visiting the
  // Notifications screen and marking things read).
  useFocusEffect(
    useCallback(() => {
      if (!userEmail) return;
      let active = true;
      (async () => {
        const res = await fetchUnreadCount(userEmail);
        if (active) setUnreadCount(res.count || 0);
      })();
      return () => { active = false; };
    }, [userEmail])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  }, [fetchExpenses]);

  // ── derived data ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonthExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        const info = extractExpenseInfo(e);
        return info.date && new Date(info.date) >= monthStart;
      }),
    [expenses]
  );

  const monthlyTotal = useMemo(
    () => thisMonthExpenses.reduce((sum, e) => sum + extractExpenseInfo(e).amount, 0),
    [thisMonthExpenses]
  );

  const reimbursableTotal = useMemo(
    () =>
      expenses
        .filter((e) => String(e.ApprovalStatus || '').toLowerCase() === 'approved')
        .reduce((sum, e) => sum + extractExpenseInfo(e).amount, 0),
    [expenses]
  );

  const categoryAgg = useMemo(() => {
    const map = new Map();
    thisMonthExpenses.forEach((e) => {
      const info = extractExpenseInfo(e);
      const key = (info.category || 'default').toLowerCase();
      map.set(key, (map.get(key) || 0) + info.amount);
    });
    const arr = Array.from(map.entries())
      .filter(([k]) => k !== 'default')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, total]) => ({ category, total, visual: getCategoryVisual(category) }));
    if (arr.length === 0) {
      return [
        { category: 'travel',   total: 0, visual: CATEGORY_VISUAL.travel },
        { category: 'lodging',  total: 0, visual: CATEGORY_VISUAL.lodging },
        { category: 'meals',    total: 0, visual: CATEGORY_VISUAL.meals },
      ];
    }
    return arr;
  }, [thisMonthExpenses]);

  const recent = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => {
          const da = new Date(extractExpenseInfo(a).date || 0);
          const db = new Date(extractExpenseInfo(b).date || 0);
          return db - da;
        })
        .slice(0, 4),
    [expenses]
  );

  // ── sparkline data (last 20 daily totals, normalized) ──
  const sparkline = useMemo(() => {
    const days = 22;
    const buckets = Array(days).fill(0);
    expenses.forEach((e) => {
      const info = extractExpenseInfo(e);
      if (!info.date) return;
      const d = new Date(info.date);
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += info.amount;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((v) => (v === 0 ? 0.08 : 0.15 + (v / max) * 0.85));
  }, [expenses]);

  // ── navigation ──
  const goToDetail = (item) => {
    const statusKey = (item.ApprovalStatus || '').toLowerCase();
    const mode = statusKey === 'approved' || statusKey === 'rejected' ? 'view' : 'viewSubmit';
    navigation.navigate('MasterExpenseScreen', { expenseData: item, mode });
  };

  const goToChat = () => navigation.navigate('Chat');

  // ── render ──
  const displayName = resolveDisplayName(
    authUser || { email: userEmail },
    employeeInfo
  );
  const firstName = getFirstName(displayName);
  const dateLabel = now
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
  const payoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <Text style={styles.greeting}>
              {getGreeting()}, <Text style={{ color: BRAND }}>{firstName}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={20} color={tokens.color.text} />
            {unreadCount > 0 ? (
              <View style={styles.iconBtnBadge}>
                <Text style={styles.iconBtnBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <View style={[styles.iconBtn, { backgroundColor: '#DCFCE7', marginLeft: 8 }]}>
            <Ionicons name="leaf" size={18} color="#16A34A" />
          </View>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {categoryAgg.map((c, i) => (
            <CategoryChip
              key={c.category + i}
              icon={c.visual.icon}
              label={String(c.category).charAt(0).toUpperCase() + String(c.category).slice(1)}
              amount={formatINR(c.total, { compact: true })}
              color={c.visual.color}
              bg={c.visual.bg}
            />
          ))}
        </ScrollView>

        {/* Hero card */}
        <HeroCard
          reimbursable={reimbursableTotal}
          monthlyCap={25000}
          payoutDate={payoutDate}
          history={sparkline}
        />

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <QuickAction
            icon="camera-outline"
            label="Scan receipt"
            bg="#E0F2FE"
            color="#0284C7"
            onPress={goToChat}
          />
          <QuickAction
            icon="add-circle-outline"
            label="Add manually"
            bg="#FEE2E2"
            color="#DC2626"
            onPress={goToChat}
          />
          <QuickAction
            icon="sparkles-outline"
            label="Ask Genie"
            bg="#FEF3C7"
            color="#D97706"
            onPress={goToChat}
          />
        </View>

        {/* Recent header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Expenses')}>
            <Text style={styles.sectionLink}>See all →</Text>
          </TouchableOpacity>
        </View>

        {/* Recent list */}
        {loading && !refreshing ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={BRAND} />
        ) : recent.length > 0 ? (
          <View style={styles.recentCard}>
            {recent.map((item, i) => (
              <React.Fragment key={item.id || i}>
                <RecentRow item={item} onPress={() => goToDetail(item)} />
                {i < recent.length - 1 ? <View style={styles.recentDivider} /> : null}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={28} color={tokens.color.textSubtle} />
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySub}>
              Scan a receipt or add an expense manually to get started.
            </Text>
          </View>
        )}

        {/* This month */}
        <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>
          This month
        </Text>
        <View style={styles.monthCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.monthEyebrow}>
              SPENT · {now.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.monthAmount}>{formatINR(monthlyTotal)}</Text>
            <View style={styles.monthDelta}>
              <Ionicons name="trending-up" size={12} color="#16A34A" />
              <Text style={styles.monthDeltaText}>18.4% vs last month</Text>
            </View>
          </View>
          <View style={{ width: 96, height: 56, justifyContent: 'flex-end' }}>
            <MiniBars data={sparkline.slice(-12)} color={BRAND} />
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────── styles ───────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { padding: 16, paddingBottom: 120 },

  // header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.color.textSubtle,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  greeting: { fontSize: 22, fontWeight: '600', color: tokens.color.text },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.border,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: tokens.color.danger,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  iconBtnBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: tokens.color.danger,
    borderWidth: 1.5, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnBadgeText: {
    color: '#FFFFFF', fontSize: 9, fontWeight: '700', lineHeight: 11,
  },

  // chips
  chipsRow: { gap: 8, paddingBottom: 16, paddingRight: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  chipIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  chipLabel: { fontSize: 13, fontWeight: '500', color: tokens.color.text, marginRight: 6 },
  chipAmount: { fontSize: 13, fontWeight: '600' },

  // hero
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroEyebrow: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },
  periodToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: 2 },
  periodPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  periodPillActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  periodText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  periodTextActive: { color: '#FFFFFF' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  heroAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', letterSpacing: -0.5 },
  heroDelta: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.18)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, marginLeft: 10,
    gap: 3,
  },
  heroDeltaText: { color: '#34D399', fontSize: 11, fontWeight: '600' },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 },
  heroChartWrap: { height: 56, marginBottom: 12, justifyContent: 'flex-end' },
  miniBars: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: '100%',
    gap: 3,
    position: 'relative',
  },
  baseline: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 1, borderRadius: 1,
  },
  barSlot: {
    flex: 1, height: '100%',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  barOuter: {
    width: '76%', minWidth: 4,
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
    borderBottomLeftRadius: 1, borderBottomRightRadius: 1,
    overflow: 'hidden',
  },
  barPeak: {
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.45, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  barTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, borderRadius: 2,
  },
  heroFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 12,
  },
  heroFooterDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroFooterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  heroFooterMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  // quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  qaTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  qaIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  qaLabel: { fontSize: 12, fontWeight: '500', color: tokens.color.text },

  // section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: tokens.color.text },
  sectionLink: { fontSize: 13, color: BRAND, fontWeight: '500' },

  // recent list
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    overflow: 'hidden',
  },
  recentRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  recentIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  recentBody: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: '600', color: tokens.color.text, marginBottom: 2 },
  recentMeta: { fontSize: 12, color: tokens.color.textMuted },
  recentRight: { alignItems: 'flex-end' },
  recentAmount: { fontSize: 14, fontWeight: '600', color: tokens.color.text, marginBottom: 4 },
  recentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  recentBadgeText: { fontSize: 11, fontWeight: '600' },
  recentDivider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.color.border, marginLeft: 60 },

  // empty
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 24, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.border,
  },
  emptyText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: tokens.color.text },
  emptySub: { marginTop: 4, fontSize: 12, color: tokens.color.textMuted, textAlign: 'center' },

  // this month
  monthCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.border,
  },
  monthEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: tokens.color.textSubtle, marginBottom: 4 },
  monthAmount: { fontSize: 24, fontWeight: '700', color: tokens.color.text, marginBottom: 4 },
  monthDelta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthDeltaText: { fontSize: 12, color: '#16A34A', fontWeight: '500' },
});
