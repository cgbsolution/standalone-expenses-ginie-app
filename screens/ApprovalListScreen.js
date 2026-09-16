import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import TopBar from '../components/TopBar';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDate } from '../utils/dateUtils';
import { toast } from '../components/ui';
import {
  getTenantSlug,
  getTenantPaymentSettings,
  markExpensePaid,
  canRecordPayment,
  isPaid,
} from '../api/payments';

import { BASE_URL } from '@env';

// const URL = `${BASE_URL}/master-expense/approver`;
const URL = `${BASE_URL}/master-expense/non-self-approve`;
// Everything this user approves — used by the "To pay" tab to find the ones
// they've already cleared that still need a payment record.
const APPROVER_URL = `${BASE_URL}/master-expense/approver`;
const MASTER_EXPENSE_BY_ID = `${BASE_URL}/master-expense/by-id`;
// SAP integration removed: approvals now flow Manager → Finance Manager via the backend.

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

  // 'pending' = awaiting my decision. 'topay' = I approved it and Finance still
  // has to record the payment (tenants with no SAP connection).
  const [tab, setTab] = useState('pending');
  const [paySettings, setPaySettings] = useState(null);

  // Approve/Reject modal state
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  // Approval comment modal — the comment is optional ("Skip" approves without one).
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [approveComment, setApproveComment] = useState('');

  // Mark-payment-done modal state
  const [payClaim, setPayClaim] = useState(null);
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
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
        toast.error('User email not found. Please login again.', 'Session error');
        return;
      }
      console.log('[Approvals] fetching approvals for:', email, 'tab:', tab);

      // "Pending" = the approval queue. "To pay" = everything I approve, then
      // narrowed below to the approved-but-unpaid ones.
      const endpoint = tab === 'topay' ? APPROVER_URL : URL;
      const response = await fetch(
        `${endpoint}?email=${encodeURIComponent(email)}`
      );

      const raw = await response.json();
      const data =
        tab === 'topay'
          ? (Array.isArray(raw) ? raw : []).filter(
              (e) => /^approv/i.test(e?.ApprovalStatus || '') && !isPaid(e)
            )
          : raw;

      // Chatbot / no-bill submissions can arrive without line items, and older
      // rows have no ItemData. Reaching straight into ExpenseData[0] threw and
      // took the whole list down with it, so read defensively per row.
      const formatted = (Array.isArray(data) ? data : []).map((item) => {
        const first = Array.isArray(item.ExpenseData) ? item.ExpenseData[0] : null;
        const postingDate = first?.PostingDate;
        const parsedPosting = postingDate ? new Date(postingDate) : null;
        const validPosting = parsedPosting && !isNaN(parsedPosting.getTime());
        return {
          id: item.id,
          email: item.SubmitterEmail,
          title: item.ExpenseTitle,
          submissionDate: validPosting
            ? parsedPosting.toLocaleDateString('en-GB')
            : (item.SubmissionDate || ''),
          amount: first?.ItemData?.ClaimAmount ?? item.TotalAmount ?? 0,
          status: item.ApprovalStatus,
          overdue: isOverdue(item.SubmissionDate),
          invoices: item.ExpenseData || [],
          ExpenseData: item.ExpenseData || [], // Ensure correct key for MasterExpenseScreen
          ApprovalHistory: item.ApprovalHistory || [], // Pass ApprovalHistory
          billDate: first?.DocumentDate || '',
          requesterName: item.SubmitterEmail,
          // Carried through so the payment tab can render/act on it.
          ApproverEmail: item.ApproverEmail,
          ApprovalStatus: item.ApprovalStatus,
          PaymentStatus: item.PaymentStatus,
          PaymentInfo: item.PaymentInfo,
        };
      });
      setClaims(formatted);
    } catch (error) {
      console.error('Error fetching claims:', error);
      toast.error('Unable to load approval requests.', 'Load failed');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [user, tab]);

  useEffect(() => {
    void fetchClaims();
  }, [fetchClaims, user]);

  // Does this tenant let Finance record payments by hand? Decides whether the
  // "To pay" tab exists at all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const slug = await getTenantSlug(user);
      const settings = await getTenantPaymentSettings(slug);
      if (!cancelled) setPaySettings(settings);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const canPayHere = !!paySettings?.manualPaymentEnabled && !paySettings?.sapConnected;

  // If the capability is switched off while the tab is open, fall back so the
  // user isn't stranded on a tab that no longer applies.
  useEffect(() => {
    if (tab === 'topay' && paySettings && !canPayHere) setTab('pending');
  }, [tab, paySettings, canPayHere]);

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
    };
    if (approvalStatus === 'Rejected' && reasonCode) {
      body.RejectionReason = reasonCode;
    }

    const res = await fetch(`${MASTER_EXPENSE_BY_ID}/${encodeURIComponent(docId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', accept: '*/*' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* empty/204 */ }
    if (!res.ok) {
      throw new Error(parsed?.error || parsed?.message || text || `Status update failed (${res.status})`);
    }
    return parsed || true;
  };

  // Approve/reject without SAP. The backend's 2-level workflow decides whether
  // an "Approved" submit finalises the expense or just forwards it to the
  // finance manager (in which case ApprovalStatus stays "Pending" and
  // approver_email moves to the finance manager).
  const runDecision = async (decision, reasonCode = '', comment = '') => {
    try {
      if (!selectedClaim) return;
      setActionLoading(true);

      const docId = selectedClaim?.id || selectedClaim?.ExpenseId;
      if (!docId) throw new Error('Missing document id');

      const updated = await updateMasterExpenseStatus(docId, decision, reasonCode, comment);
      const resultingStatus = updated?.ApprovalStatus || decision;

      let title = decision === 'Approved' ? 'Approved' : 'Rejected';
      let body = `Claim ${decision.toLowerCase()} successfully.`;
      if (decision === 'Approved' && resultingStatus === 'Pending') {
        title = 'Forwarded to Finance';
        body = 'Your approval has been recorded. The claim is now pending Finance Manager review.';
      } else if (decision === 'Approved' && resultingStatus === 'Approved') {
        title = 'Finalised';
        body = 'Claim has been fully approved.';
      }

      toast.success(body, title);
      setModalVisible(false);
      setSelectedClaim(null);
      setRejectReason('');
      setRejectComment('');
      setApproveModalVisible(false);
      setApproveComment('');
      await fetchClaims(true);
    } catch (e) {
      console.error('Decision error', e);
      toast.error(e?.message || 'Failed to process.', 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const runMarkPaid = async () => {
    if (!payClaim) return;
    try {
      setActionLoading(true);
      const email =
        user?.mail || user?.email || user?.userPrincipalName ||
        (await AsyncStorage.getItem('user_email'));

      const res = await markExpensePaid({
        id: payClaim.id,
        updatedBy: email,
        reference: payReference.trim(),
        note: payNote.trim(),
      });
      if (!res.success) throw new Error(res.error);

      toast.success('Payment has been recorded for this claim.', 'Payment done');
      setPayClaim(null);
      setPayReference('');
      setPayNote('');
      await fetchClaims(true);
    } catch (e) {
      console.error('Mark paid error', e);
      toast.error(e?.message || 'Could not record the payment.', 'Payment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const renderCard = ({ item }) => {
    const payTab = tab === 'topay';
    return (
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('MasterExpenseScreen', {
            expenseData: item,
            mode: payTab ? 'view' : 'approveRejectView',
          });
        }}
        onLongPress={() => {
          if (payTab) return; // approve/reject doesn't apply to already-approved claims
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

            {payTab && canRecordPayment(user, item) ? (
              <TouchableOpacity
                style={styles.payBtn}
                disabled={actionLoading}
                onPress={() => {
                  setPayClaim(item);
                  setPayReference('');
                  setPayNote('');
                }}
              >
                <Text style={styles.payBtnText}>Mark paid</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopBar />
      <View style={styles.container}>
        <Text style={styles.heading}>
          {tab === 'topay' ? 'Awaiting Payment' : 'Pending Approval Requests'}
        </Text>

        {/* Only tenants without SAP get a manual payment step, and only when a
            super-admin has enabled it — otherwise this tab doesn't exist. */}
        {canPayHere ? (
          <View style={styles.tabRow}>
            {[
              { key: 'pending', label: 'To approve' },
              { key: 'topay', label: 'To pay' },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabPill, tab === t.key && styles.tabPillActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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
              <Text style={styles.noData}>
                {tab === 'topay'
                  ? 'Nothing awaiting payment.'
                  : 'No approval requests.'}
              </Text>
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
                onPress={() => {
                  setApproveComment('');
                  setModalVisible(false);
                  setApproveModalVisible(true);
                }}
              >
                <Text style={styles.actionTextApprove}>{actionLoading ? 'Processing...' : 'Approve'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approval comment sheet — comment optional, "Skip" approves without one */}
      <Modal
        transparent
        visible={approveModalVisible}
        animationType="slide"
        onRequestClose={() => setApproveModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.sheetTitle}>Approve this claim?</Text>
            <Text style={styles.payHint}>
              Add a comment for the approval record, or skip it. Your comment is saved in the
              claim's approval history.
            </Text>

            <Text style={styles.payLabel}>Approval comment (optional)</Text>
            <TextInput
              style={styles.commentBox}
              placeholder="e.g. Verified against policy, receipts attached"
              value={approveComment}
              onChangeText={setApproveComment}
              editable={!actionLoading}
              multiline
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn, { borderColor: '#CBD5E1', opacity: actionLoading ? 0.6 : 1 }]}
                disabled={actionLoading}
                onPress={() => runDecision('Approved', '', '')}
              >
                <Text style={[styles.actionTextReject, { color: '#475569' }]}>
                  {actionLoading ? 'Processing...' : 'Skip'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.approveBtn,
                  { opacity: actionLoading || !approveComment.trim() ? 0.5 : 1 },
                ]}
                disabled={actionLoading || !approveComment.trim()}
                onPress={() => runDecision('Approved', '', approveComment.trim())}
              >
                <Text style={styles.actionTextApprove}>
                  {actionLoading ? 'Processing...' : 'Approve'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              disabled={actionLoading}
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => setApproveModalVisible(false)}
            >
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Record payment (tenants without SAP) */}
      <Modal
        transparent
        visible={!!payClaim}
        animationType="slide"
        onRequestClose={() => setPayClaim(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.sheetTitle}>Record payment</Text>
            <Text style={styles.payHint}>
              Confirms that “{payClaim?.title || 'this claim'}” has been paid to{' '}
              {payClaim?.requesterName || 'the employee'}. This is a manual record — it does not
              move money.
            </Text>

            <Text style={styles.payLabel}>Reference (UTR / cheque / voucher no.)</Text>
            <TextInput
              style={styles.commentBox}
              placeholder="Optional"
              value={payReference}
              onChangeText={setPayReference}
              editable={!actionLoading}
            />

            <Text style={styles.payLabel}>Note</Text>
            <TextInput
              style={styles.commentBox}
              placeholder="Optional"
              value={payNote}
              onChangeText={setPayNote}
              editable={!actionLoading}
              multiline
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn, { opacity: actionLoading ? 0.6 : 1 }]}
                disabled={actionLoading}
                onPress={() => setPayClaim(null)}
              >
                <Text style={styles.actionTextReject}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn, { opacity: actionLoading ? 0.6 : 1 }]}
                disabled={actionLoading}
                onPress={runMarkPaid}
              >
                <Text style={styles.actionTextApprove}>
                  {actionLoading ? 'Saving...' : 'Confirm payment'}
                </Text>
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

  tabRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#FFFFFF' },

  payBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  payBtnText: { color: '#16A34A', fontWeight: '700', fontSize: 12 },
  payHint: { fontSize: 12, color: '#6B7280', marginBottom: 12, lineHeight: 17 },
  payLabel: { fontSize: 12, color: '#6B7280', marginTop: 8 },
});
