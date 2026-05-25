import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import TopBar from '../components/TopBar';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDate } from '../utils/dateUtils';

import { BASE_URL } from '@env';

// const URL = `${BASE_URL}/master-expense/approver`;
const URL = `${BASE_URL}/master-expense/non-self-approve`;
const MASTER_EXPENSE_BY_ID = `${BASE_URL}/master-expense/by-id`;
const SAP_APPROVAL_API = 'https://magicqa.tatahousing.com/Magicxpi4.13/MgWebRequester.dll?appname=IFSEMS_To_SAP&prgname=HTTP&arguments=-AHTTP_1%23Approval_And_Rejection';

const formatRs = (val) => {
  const num = Number(val);
  if (isNaN(num)) return val || '';
  return 'Rs.' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const statusColorMap = {
  pending: '#2563EB',
  rejected: '#EF4444',
  approved: '#16A34A',
  draft: '#6B7280',
};

const isOverdue = (submissionDate) => {
  if (!submissionDate) return false;
  const submission = new Date(submissionDate);
  const today = new Date();
  const diffTime = today.getTime() - submission.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 7;
};

export default function ApprovalListScreen({ navigation, route }) {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Approve/Reject modal state
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const REJECTION_REASONS = [
    { title: 'Missing or unclear receipt', value: 'missing_receipt' },
    { title: 'Exceeds policy limits', value: 'exceeds_policy' },
    { title: 'Insufficient business justification', value: 'insufficient_justification' },
    { title: 'Incomplete expense information', value: 'incomplete_info' },
    { title: 'Duplicate submission', value: 'duplicate' },
    { title: 'Wrong expense category', value: 'wrong_category' },
    { title: 'Requires additional documentation', value: 'needs_documentation' },
    { title: 'Other (specify in comments)', value: 'other' },
  ];

  const fetchClaims = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Approver email = the currently signed-in user's email.
      let email = user?.mail || user?.email || user?.userPrincipalName;
      if (!email) {
        email = await AsyncStorage.getItem('user_email');
      }
      if (!email) {
        Alert.alert('Error', 'User email not found. Please login again.');
        return;
      }
      console.log('[Approvals] fetching approvals for:', email);

      const response = await fetch(
        `${URL}?email=${encodeURIComponent(email)}`
      );

      const data = await response.json();

      const formatted = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.id,
        email: item.SubmitterEmail,
        title: item.ExpenseTitle,
        submissionDate: `${new Date(item.ExpenseData[0].PostingDate).toLocaleDateString('en-GB')}`,
        amount: item.ExpenseData[0].ItemData.ClaimAmount,
        status: item.ApprovalStatus,
        overdue: isOverdue(item.SubmissionDate),
        invoices: item.ExpenseData || [],
        ExpenseData: item.ExpenseData || [], // Ensure correct key for MasterExpenseScreen
        ApprovalHistory: item.ApprovalHistory || [], // Pass ApprovalHistory
        billDate: `${item.ExpenseData[0].DocumentDate}`,
        requesterName: item.SubmitterEmail,
      }));
      setClaims(formatted);
    } catch (error) {
      console.error('Error fetching claims:', error);
      Alert.alert('Error', 'Unable to load approval requests');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    void fetchClaims();
  }, [fetchClaims, user]);

  // Listen for screen focus and refresh data
  useFocusEffect(
    useCallback(() => {
      // Refresh data whenever the screen comes into focus
      console.log('Screen focused - refreshing claims data');
      void fetchClaims(true);
    }, [fetchClaims])
  );

  const onRefresh = useCallback(() => {
    void fetchClaims(true);
  }, [fetchClaims]);

  // Helpers
  const getBase64FromUrl = async (fileUrl) => {
    try {
      if (!fileUrl) return null;
      if (fileUrl.startsWith('file://') || fileUrl.startsWith('/')) {
        return await FileSystem.readAsStringAsync(fileUrl, { encoding: FileSystem.EncodingType.Base64 });
      }
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('getBase64FromUrl error', e);
      return null;
    }
  };

  const callSAPApprovalAPI = async (claim, action) => {
    // Build minimal payload similar to MasterExpenseScreen
    const fileData = await Promise.all(
      (claim?.invoices || []).map(async (inv, index) => {
        const fileUrl = inv?.File?.[0]?.url || inv?.SasUrl || inv?.imageUri;
        const content = await getBase64FromUrl(fileUrl);
        return {
          content: content || '',
          filename: inv?.File?.[0]?.filename || `invoice-${index}.pdf`,
        };
      })
    );

    const first = (claim?.invoices || [])[0] || {};
    const payload = {
      ExpenseDatas: {
        EMSUniqueId: claim?.id || claim?.ExpenseId || '1116',
        BillNumber: first?.BillNumber || claim?.BillNumber || '1234',
        CompanyCode: first?.CompanyCode || claim?.CompanyCode || '1000',
        // DocumentNumber: first?.ItemData?.DocumentNo || claim?.DocumentNumber || '1900000222',
        DocumentNumber:first?.ItemData?.DocumentNo ?? claim?.DocumentNumber,
        FinancialYear: claim?.FinancialYear || new Date().getFullYear().toString(),
        action,
      },
      File: fileData,
    };

    const res = await axios.post(SAP_APPROVAL_API, payload, { headers: { 'Content-Type': 'application/json' } });
    return res.data;
  };

  const updateMasterExpenseStatus = async (docId, approvalStatus, reasonCode, comment) => {
    // Get approver email from cached employee info first
    let approverEmail = null;

    try {
      const cachedEmployeeInfo = await AsyncStorage.getItem('employee_info');
      if (cachedEmployeeInfo) {
        const employeeData = JSON.parse(cachedEmployeeInfo);
        approverEmail = employeeData?.PrimaryEmail || employeeData?.SubmitterEmail || employeeData?.UserPrincipalName;
      }
    } catch (err) {
      console.warn('Error loading cached employee info:', err);
    }

    // Fallback to auth context or AsyncStorage if not found in cache
    if (!approverEmail) {
      approverEmail = user?.mail || user?.email || user?.userPrincipalName;
      if (!approverEmail) {
        approverEmail = await AsyncStorage.getItem('user_email');
      }
    }

    const body = {
      ApprovalStatus: approvalStatus,
      UpdatedBy: approverEmail || 'Unknown',
      Comments: comment || '',
      RejectionReason: reasonCode || ''
    };
    const res = await fetch(`${MASTER_EXPENSE_BY_ID}/${encodeURIComponent(docId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Status update failed');
    }
    return true;
  };

  const runDecision = async (decision, reasonCode = '', comment = '') => {
    try {
      if (!selectedClaim) return;
      setActionLoading(true);

      const docId = selectedClaim?.id || selectedClaim?.ExpenseId;
      if (!docId) throw new Error('Missing document id');

      const action = decision === 'Approved' ? 'A' : 'R';

      let sapSuccess = false;
      let sapError = null;

      try {
        const sapResponse = await callSAPApprovalAPI(selectedClaim, action);
        const successStatus = (sapResponse?.ExpenseDatas?.SuccessStatus || sapResponse?.SuccessStatus || '').toUpperCase();
        const messagesArr = sapResponse?.ExpenseDatas?.Messages || sapResponse?.Messages || [];
        const joinedMessages = Array.isArray(messagesArr)
          ? messagesArr.map((m) => m?.Message).filter(Boolean).join('\n')
          : '';
        const errorMessage = joinedMessages || sapResponse?.ExpenseDatas?.ErrorMessage || sapResponse?.ErrorMessage || '';

        if (successStatus.includes('ERROR') || (!successStatus.includes('SUCCESS') && errorMessage)) {
          sapError = errorMessage || 'Failed to process in SAP';
          Alert.alert('SAP Error', sapError);
        } else {
          sapSuccess = true;
        }
      } catch (sapErr) {
        console.error('SAP API Error', sapErr);
        sapError = sapErr?.message || 'SAP API connection failed';
        Alert.alert('SAP Error', sapError);
      }

      // If SAP success, use the new decision status
      // If SAP failed, keep as 'Pending' but update backend to log the error
      const finalStatus = sapSuccess ? decision : 'Pending';
      const finalComment = sapSuccess ? comment : `SAP Error: ${sapError}`;

      await updateMasterExpenseStatus(docId, finalStatus, reasonCode, finalComment);

      if (sapSuccess) {
        Alert.alert('Success', `Claim ${decision.toLowerCase()} successfully`);
        setModalVisible(false);
        setSelectedClaim(null);
        setRejectReason('');
        setRejectComment('');
        await fetchClaims(true);
      } else {
        // Just log that we saved the error state
        console.log('Updated status to Pending with SAP error log');
        // We might want to close the modal anyway or let user try again?
        // Let's keep modal open if they want to retry, but we already logged the failure.
        // Actually, typically we close or refresh. Let's refresh to show the log?
        // User requested "add call the api even error occured... send status as Pending"
        // so we have done that.
      }
    } catch (e) {
      console.error('Decision error', e);
      Alert.alert('Error', e?.message || 'Failed to process');
    } finally {
      setActionLoading(false);
    }
  };

  const renderCard = ({ item }) => {
    return (
      <TouchableOpacity
        onPress={() => {
          console.log("item----", item);
          navigation.navigate('MasterExpenseScreen', {
            expenseData: item,
            mode: 'approveRejectView',
          });
        }}
        onLongPress={() => {
          setSelectedClaim(item);
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>{item.title || 'Untitled'}</Text>
            <Text style={styles.cardSubtitle}>{"Bill Date: " + formatDate(item.billDate)}</Text>
            <Text style={styles.requesterText}>
              Requester : {item.requesterName}
            </Text>
            <Text style={styles.cardDate}>{"Submitted on " + formatDate(item.submissionDate)}</Text>
            {item.overdue && item.status?.toLowerCase() === 'pending' && (
              <Text style={styles.overdueText}>Pending more than 7 Days</Text>
            )}
          </View>
          <View style={styles.cardRight}>

            <View style={styles.amountRow}>
              <Text style={styles.cardAmount}>{formatRs(item.amount)}</Text>
            </View>
            <Text
              style={[
                styles.statusText,
                { color: statusColorMap[item.status?.toLowerCase()] || '#374151' },
              ]}
            >
              {item.status
                ? item.status.charAt(0).toUpperCase() + item.status.slice(1)
                : 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopBar />
      <View style={styles.container}>
        <Text style={styles.heading}>Pending Approval Requests</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={claims}
            keyExtractor={(it) => it.id}
            contentContainerStyle={styles.list}
            renderItem={renderCard}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <Text style={styles.noData}>No approval requests.</Text>
            }
          />
        )}
      </View>

      {/* Approve/Reject Sheet */}
      <Modal transparent visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.sheetTitle}>Approve or Reject</Text>

            {/* Reason selector (only used when Rejecting) */}
            <Text style={{ fontSize: 12, color: '#6B7280' }}>Rejection Reason</Text>
            {REJECTION_REASONS.map((r) => (
              <TouchableOpacity key={r.value} style={styles.reasonItem} onPress={() => setRejectReason(r.value)}>
                <Text style={[styles.reasonText, rejectReason === r.value ? styles.selectedReason : null]}>
                  {r.title}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Optional comment */}
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Comments (optional)</Text>
            <TextInput
              style={styles.commentBox}
              placeholder="Add comments for rejection"
              value={rejectComment}
              onChangeText={setRejectComment}
              editable={!actionLoading}
              multiline
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn, { opacity: actionLoading ? 0.6 : 1 }]}
                disabled={actionLoading}
                onPress={() => runDecision('Rejected', rejectReason || 'other', rejectComment)}
              >
                <Text style={styles.actionTextReject}>{actionLoading ? 'Processing...' : 'Reject'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn, { opacity: actionLoading ? 0.6 : 1 }]}
                disabled={actionLoading}
                onPress={() => runDecision('Approved')}
              >
                <Text style={styles.actionTextApprove}>{actionLoading ? 'Processing...' : 'Approve'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    color: '#1F2937',
  },
  list: { paddingTop: 4, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1E7F5',
    padding: 16,
    marginBottom: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLeft: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  overdueText: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  requesterText: { fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: '500' },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cardAmount: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  statusText: { fontSize: 13, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  noData: { textAlign: 'center', marginTop: 40, color: '#6B7280', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#111827' },
  reasonItem: { paddingVertical: 10 },
  reasonText: { fontSize: 14, color: '#1F2937' },
  selectedReason: { color: '#2563EB', fontWeight: '700' },
  commentBox: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 2, marginHorizontal: 4 },
  approveBtn: { borderColor: '#22C55E' },
  rejectBtn: { borderColor: '#EF4444' },
  actionTextApprove: { color: '#22C55E', fontWeight: '700' },
  actionTextReject: { color: '#EF4444', fontWeight: '700' },
});
