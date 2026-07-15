import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import { confirm } from '../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@env';

const API_URL = `${BASE_URL}/master-expense`;
const SAP_CHECK_STATUS_API =
  'https://magicqa.tatahousing.com/Magicxpi4.13/MgWebRequester.dll?appname=IFSEMS_To_SAP&prgname=HTTP&arguments=-AHTTP_1%23Check_Status';

// Module-level cache so all expense cards share results
const sapStatusCache = new Map();
const sapInflight = new Map();

async function fetchSapStatusForExpense(item) {
  const exp0 = item.ExpenseData?.[0];
  const itemData = exp0?.ItemData;
  const documentNumber = itemData?.DocumentNo;
  if (!documentNumber) return null;

  if (sapStatusCache.has(documentNumber)) return sapStatusCache.get(documentNumber);
  if (sapInflight.has(documentNumber)) return sapInflight.get(documentNumber);

  const payload = {
    ExpenseDatas: {
      EMSUniqueId: String(exp0?.EMSUniqueId || ''),
      BillNumber: String(exp0?.BillNumber || ''),
      CompanyCode: String(exp0?.CompanyCode || ''),
      DocumentNumber: String(documentNumber),
      FinancialYear: String(itemData?.FinancialYear || ''),
    },
  };

  const promise = (async () => {
    try {
      const resp = await fetch(SAP_CHECK_STATUS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) { data = null; }
      const result = data?.ExpenseDatas || null;
      sapStatusCache.set(documentNumber, result);
      return result;
    } finally {
      sapInflight.delete(documentNumber);
    }
  })();

  sapInflight.set(documentNumber, promise);
  return promise;
}

const formatRs = (val) => {
  const num = Number(val);
  if (isNaN(num)) return val || '';
  return 'Rs.' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const statusColors = {
  approved: '#166534',
  rejected: '#991B1B',
  pending: '#1D4ED8',
  draft: '#374151',
};

const StatusTabs = ({ selected, onSelect }) => {
  const tabs = ['All', 'Pending', 'Approved', 'Rejected', 'Draft'];
  const { width } = useWindowDimensions();
  const scale = Math.min(1, Math.max(0.88, width / 390));
  const fs = Math.round(14 * scale);
  const padV = Math.round(8 * scale);
  const padH = Math.round(14 * scale);

  return (
    <View style={styles.tabsOuterWrap}>
      <View style={styles.segmentOuter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScrollable}
        >
          {tabs.map((label) => {
            const active = selected === label;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => onSelect(label)}
                activeOpacity={0.85}
                style={styles.segmentTap}
              >
                {active ? (
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.segmentPillActive, { paddingVertical: padV, paddingHorizontal: padH }]}
                  >
                    <Text style={[styles.segmentTextActive, { fontSize: fs }]}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.segmentPill, { paddingVertical: padV, paddingHorizontal: padH }]}>
                    <Text style={[styles.segmentText, { fontSize: fs }]}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const ExpenseCard = ({ item, onView, onEdit, onDelete }) => {
  const statusKey = (item.ApprovalStatus || '').toLowerCase();
  const badgeColor = statusColors[statusKey] || '#374151';

  const documentNo = item.ExpenseData?.[0]?.ItemData?.DocumentNo;
  const [sapStatus, setSapStatus] = useState(() => sapStatusCache.get(documentNo) || null);
  const [isFetchingSap, setIsFetchingSap] = useState(false);

  useEffect(() => {
    if (!documentNo) {
      setSapStatus(null);
      return;
    }
    if (sapStatusCache.has(documentNo)) {
      setSapStatus(sapStatusCache.get(documentNo));
      return;
    }
    let cancelled = false;
    setIsFetchingSap(true);
    fetchSapStatusForExpense(item)
      .then((res) => { if (!cancelled) setSapStatus(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsFetchingSap(false); });
    return () => { cancelled = true; };
  }, [documentNo]);

  const sapStatusText = !documentNo
    ? 'N/A'
    : isFetchingSap
      ? 'Loading...'
      : (sapStatus?.Status && String(sapStatus.Status).trim() !== '' ? sapStatus.Status : 'N/A');

  const isDraft = statusKey === 'draft';
  const isApproved = statusKey === 'approved';
  const isRejected = statusKey === 'rejected';
  const showEdit = isDraft;
  const showDelete = isDraft;

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{item.ExpenseTitle || 'Untitled'}</Text>
        {item.ExpenseData?.[0]?.SelfApprove === true ? null : (
          <Text style={styles.cardSub}>Approver : {item.ApproverEmail || 'N/A'}</Text>
        )}
        <Text style={styles.cardSub}>Document No: {item.ExpenseData?.[0]?.ItemData?.DocumentNo || 'N/A'}</Text>
        <Text style={styles.cardSub}>Sap Status: {sapStatusText}</Text>
        {item.SubmissionDate && (
          <Text style={styles.cardSub}>
            Claim Date : {new Date(item.SubmissionDate).toLocaleDateString('en-GB')}
          </Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={styles.cardAmount}>
          {formatRs(item.TotalAmount || item.ExpenseData?.[0]?.ItemData?.ClaimAmount || 0)}
        </Text>
        {item.ExpenseData?.[0]?.SelfApprove === true && item.ApprovalStatus === 'Approved' ? (
          <Text style={[styles.statusText, { color: badgeColor }]}>Self Approved</Text>
        ) : (
          <Text style={[styles.statusText, { color: badgeColor }]}>
            {item.ApprovalStatus || 'N/A'}
          </Text>
        )}

        <View style={styles.iconsRow}>
          <TouchableOpacity onPress={onView} style={styles.iconButton}>
            <MaterialIcons
              name="visibility"
              size={22}
              color={isApproved || isRejected ? '#6B7280' : '#374151'}
            />
          </TouchableOpacity>
          {showEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.iconButton}>
              <MaterialIcons name="edit" size={22} color="#374151" />
            </TouchableOpacity>
          )}
          {showDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
              <MaterialIcons name="delete" size={22} color="#374151" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default function MyClaimsScreen() {
  const [expenses, setExpenses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      try {
        const email = await AsyncStorage.getItem('user_email');
        if (email) setUserEmail(email);
      } catch (err) {
        console.error('Error loading user email:', err);
      }
    })();
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (!userEmail) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        email: userEmail,
        approvalStatus: selectedStatus,
      });
      const resp = await fetch(`${API_URL}?${params.toString()}`);
      const data = await resp.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching master expenses:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, userEmail]);

  useEffect(() => { void fetchExpenses(); }, [fetchExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  }, [fetchExpenses]);

  const handleView = (item) => {
    const statusKey = (item.ApprovalStatus || '').toLowerCase();
    if (statusKey === 'approved' || statusKey === 'rejected') {
      navigation.navigate('MasterExpenseScreen', { expenseData: item, mode: 'view' });
    } else {
      navigation.navigate('MasterExpenseScreen', { expenseData: item, mode: 'viewSubmit' });
    }
  };

  const handleEdit = (item) => {
    const statusKey = (item.ApprovalStatus || '').toLowerCase();
    if (statusKey === 'draft' || statusKey === 'pending') {
      navigation.navigate('MasterExpenseScreen', { expenseData: item, mode: 'edit' });
    }
  };

  const handleDelete = async (item) => {
    const statusKey = (item.ApprovalStatus || '').toLowerCase();
    if (statusKey !== 'draft' && statusKey !== 'pending') return;
    const ok = await confirm({
      variant: 'destructive',
      title: 'Delete this expense?',
      message: `“${item.ExpenseTitle || 'This expense'}” will be permanently removed.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
    });
    if (ok) {
      console.log('Deleting expense:', item.id);
      fetchExpenses();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopBar />
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />
      <View style={styles.container}>
        <Text style={styles.welcome}>Welcome Back!</Text>
        <Text style={styles.sectionTitle}>All Expenses</Text>

        <StatusTabs selected={selectedStatus} onSelect={setSelectedStatus} />

        {loading && !refreshing ? (
          <ActivityIndicator size="large" style={{ marginTop: 30 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            keyboardShouldPersistTaps="handled"
          >
            {expenses.length > 0 ? (
              expenses.map((item) => (
                <ExpenseCard
                  key={item.id}
                  item={item}
                  onView={() => handleView(item)}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))
            ) : (
              <Text style={styles.noData}>No expenses found.</Text>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, paddingHorizontal: 16 },
  welcome: { fontSize: 18, fontWeight: '600', marginTop: 16, color: '#111827' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 12, color: '#111827' },

  tabsOuterWrap: { paddingBottom: 8 },
  segmentOuter: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 4,
  },
  segmentScrollable: { paddingHorizontal: 6 },
  segmentTap: { borderRadius: 999, marginHorizontal: 1 },
  segmentPill: { borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  segmentPillActive: { borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  segmentText: { fontWeight: '700', color: '#374151' },
  segmentTextActive: { fontWeight: '700', color: '#FFFFFF' },

  scroll: { paddingBottom: 140 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderColor: '#D1E0F0',
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  iconsRow: { flexDirection: 'row', marginTop: 6 },
  iconButton: { marginHorizontal: 4 },
  statusText: { fontSize: 13, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  noData: { textAlign: 'center', marginTop: 30, color: '#6B7280', fontSize: 14 },
});
