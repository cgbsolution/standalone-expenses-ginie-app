import React, { useState, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import TopBar from '../components/TopBar';
import { useInvoiceContext } from '../context/InvoiceContext';
import { Appbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from "@env";
import * as Linking from 'expo-linking';
import { WebView } from 'react-native-webview';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { generateApprovalTrailPDF, generateApprovalTrailHTML } from '../utils/pdfUtils';
import * as Sharing from 'expo-sharing';
import { toast, confirm } from '../components/ui';
const API_BASE_URL = BASE_URL;
const URL = `${BASE_URL}/master-expense/by-id`;
// SAP integration removed: approvals now flow Manager → Finance Manager via the backend.

// Zoomable Image Component
const ZoomableImage = ({ uri, onLoadStart, onLoadEnd }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      } else if (scale.value > 3) {
        scale.value = withTiming(3);
        savedScale.value = 3;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={pinchGesture}>
        <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.Image
            source={{ uri }}
            style={[{ width: '100%', height: '100%', resizeMode: 'contain' }, animatedStyle]}
            onLoadStart={onLoadStart}
            onLoadEnd={onLoadEnd}
          />
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export default function MasterExpenseScreen({ navigation, route, isAppBarVisible = true }) {
  const { expenseData, mode } = route?.params || {};
  const isViewMode = mode === 'view';

  const { user } = useAuth();
  const { invoices, deleteInvoice, setInvoices, clearInvoices } = useInvoiceContext();

  // Clear context data when this screen loses focus (to prevent data persistence)
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Only clear if we're viewing API data (not from AddScreen)
        if (expenseData?.ExpenseData?.length) {
          console.log('Clearing context data on screen blur');
          clearInvoices();
        }
      };
    }, [expenseData])
  );

  // Extract data from API response structure
  const apiData = expenseData?.ExpenseData?.[0];
  const apiTitle = expenseData?.ExpenseTitle || expenseData?.title || 'Test';
  const apiApprover = expenseData?.ApproverEmail || '';
  const apiSubmissionDate = expenseData?.SubmissionDate
    ? new Date(expenseData.SubmissionDate).toLocaleDateString('en-GB')
    : getToday();
  const apiTotalAmount = expenseData?.InvoiceAmount || expenseData?.TotalAmount || expenseData?.InvoiceAmount || 0;
  const apiStatus = expenseData?.ApprovalStatus || expenseData?.status || 'Pending';

  const [title, setTitle] = useState(apiTitle);
  const [approverName, setApproverName] = useState(apiApprover);
  const [submittedDate, setSubmittedDate] = useState(apiSubmissionDate);

  const [isModalVisible, setModalVisible] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [tempApprover, setTempApprover] = useState(approverName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [imagePreviewUri, setImagePreviewUri] = useState(null);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [documentUri, setDocumentUri] = useState(null);
  const [documentHtml, setDocumentHtml] = useState(null);
  const [isDocumentModalVisible, setDocumentModalVisible] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPreviewingTrail, setIsPreviewingTrail] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isApprovalHistoryExpanded, setIsApprovalHistoryExpanded] = useState(false);

  // Email addresses from AsyncStorage
  const [submitterEmail, setSubmitterEmail] = useState(null);
  const [approverEmail, setApproverEmail] = useState(null);

  // Get expenses for display
  const allExpenses = useMemo(() => {
    return expenseData ? [expenseData] : [];
  }, [expenseData]);

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
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

  function getToday() {
    const d = new Date();
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
  }

  useEffect(() => {
    console.log("expenseData", expenseData);
    console.log("Amount of the invoice", expenseData?.InvoiceAmount);

    // If we have API data (from HomeScreen), convert it to invoice format
    if (expenseData?.ExpenseData?.length) {
      const convertedInvoices = expenseData.ExpenseData.map((item, index) => ({
        id: `${expenseData.id}-${index}`,
        category: item.category || 'Travel', // Default category
        subCategory: item.subCategory || 'Business Travel',
        billNumber: item.BillNumber,
        billDate: item.DocumentDate,
        billAmount: item.InvoiceAmount?.toString(),
        claimAmount: item.ItemData?.ClaimAmount?.toString(),
        hsnCode: item.ItemData?.HSNCode?.toString(),
        narration: item.Narration || 'Business expense',
        imageUri: item.File?.[0]?.url || null,
        sasUrl: item.SasUrl || item.File?.[0]?.url,
        uploadStatus: item.UploadStatus || 'success',
        timestamp: expenseData.SubmissionDate,
        // Additional fields for display
        vendorName: 'Vendor',
        transactionDate: item.DocumentDate,
        description: item.Narration,
        fileName: item.File?.[0]?.filename || `invoice-${index}.jpg`,
        fileUrl: item.File?.[0]?.blob_url || item.File?.[0]?.url || null,
        files: item.File || [],
      }));
      setInvoices(convertedInvoices);
    } else if (expenseData?.invoices?.length) {
      // Fallback for old format
      setInvoices(expenseData.invoices);
    } else {
      // If no expenseData, clear invoices to prevent showing stale data
      setInvoices([]);
    }
  }, [expenseData]);

  // Fetch email addresses from AsyncStorage on mount
  useEffect(() => {
    const loadEmails = async () => {
      const exp = allExpenses[0] || {};
      setSubmitterEmail(
        exp.email ||
        exp.SubmitterEmail ||
        exp.PrimaryEmail ||
        exp.UserPrincipalName ||
        null
      );
      
      // try {
      //   // Fetch submitter email (logged-in user)
      //   const storedSubmitterEmail = await AsyncStorage.getItem('user_email');
      //   console.log("storedSubmitterEmail", storedSubmitterEmail);
      //   if (storedSubmitterEmail) {
      //     setSubmitterEmail(storedSubmitterEmail);
      //   } else {
      //     console.warn('No submitter email found in AsyncStorage');
      //   }

      //   // For approver email, use from expenseData if available, otherwise try AsyncStorage
      //   if (apiApprover) {
      //     setApproverEmail(apiApprover);
      //   } else {
      //     // Try to get approver email from AsyncStorage if available
      //     const storedApproverEmail = await AsyncStorage.getItem('approver_email');
      //     if (storedApproverEmail) {
      //       setApproverEmail(storedApproverEmail);
      //     }
      //   }
      // } catch (err) {
      //   console.error('Error loading emails:', err);
      // }
    };
    loadEmails();
  }, [allExpenses]);

  // Calculate total amount from invoices
  const totalBillAmount = useMemo(() => {
    // First try to use the total from expenseData
    if (expenseData?.InvoiceAmount || expenseData?.TotalAmount) {
      return expenseData.InvoiceAmount || expenseData.TotalAmount;
    }

    // Otherwise calculate from invoices array
    return invoices.reduce((sum, item) => {
      // Try multiple possible field names for amount
      const claimAmt = item.claimAmount && item.claimAmount !== '' ? parseFloat(item.claimAmount) : 0;
      const billAmt = item.billAmount && item.billAmount !== '' ? parseFloat(item.billAmount) : 0;
      const invoiceAmt = item.InvoiceAmount && item.InvoiceAmount !== '' ? parseFloat(item.InvoiceAmount) : 0;

      const amount = billAmt || invoiceAmt;
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [expenseData, invoices]);

  const handleSaveEdit = () => {
    setTitle(tempTitle);
    setApproverName(tempApprover);
    setSubmittedDate(getToday());
    setModalVisible(false);
  };

  const handleDeleteInvoice = async (index) => {
    const ok = await confirm({
      variant: 'destructive',
      title: 'Delete this invoice?',
      message: 'This invoice will be removed from your expense. You can re-add it later.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
    });
    if (ok) deleteInvoice(index);
  };

  const getBase64FromUri = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (err) {
      console.error("Error converting file to base64:", err);
      return null;
    }
  };

  const buildPayload = async (status) => {
    const expenseData = await Promise.all(
      invoices.map(async (inv, i) => {
        // For budget check, use base64 image
        let base64Image = null;
        if (inv.imageUri) {
          base64Image = await getBase64FromUri(inv.imageUri);
        }

        // For final submission, use SAS URL if available
        const fileData = inv.sasUrl
          ? [{ url: inv.sasUrl, filename: inv.fileName || `invoice-${i}.jpg` }]
          : base64Image
            ? [{ content: base64Image, filename: inv.fileName || `invoice-${i}.jpg` }]
            : [];

        return {
          CompanyCode: inv.companyCode || `test-${i + 1000}`,
          PostingDate: new Date().toISOString().split('T')[0],
          DocumentDate: inv.transactionDate || new Date().toISOString().split('T')[0],
          Currency: inv.currency || "INR",
          BillNumber: inv.billNumber,
          EMSUniqueId: `ems-${Date.now()}-${i}`,
          VendorCode: inv.vendorCode || "vendor-001",
          BusinessPlace: inv.businessPlace || "test-LOC",
          SectionCode: inv.sectionCode || "test-SC",
          Narration: inv.description,
          InvoiceAmount: parseFloat(inv.billAmount) || 0,
          SelfApprove: false,
          ItemData: {
            GLCode: inv.glCode || "test-40503021",
            TaxCode: inv.taxCode || "G0",
            CostCenter: inv.costCenter || "Test-CC",
            WBS: inv.wbs || "Test-WBS",
            ClaimAmount: parseFloat(inv.billAmount) || 0,
            HSNCode: inv.hsnCode || "123456",
            DocumentNo: inv.documentNo || `${1900000000 + i}`,
          },
          File: fileData,
          // Add upload status for debugging
          UploadStatus: inv.uploadStatus || "not_uploaded",
          SasUrl: inv.sasUrl || null,
        };
      })
    );


    return {
      ExpenseTitle: title,
      ExpenseId: "",
      ApproverEmail: approverEmail || apiApprover || '',
      SubmitterEmail: submitterEmail || '',
      ApprovalStatus: status,
      SoftDelete: "No",
      ExpenseData: expenseData,
    };
  };

  const submitMasterExpense = async (status = "Pending") => {
    if (!title || !approverName || invoices.length === 0) {
      toast.warning('Please fill all fields and add at least one invoice.', 'Missing fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await buildPayload(status);
      console.log("Submitting Payload:", JSON.stringify(payload, null, 2));
      await axios.post(`${API_BASE_URL}/master-expense`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success(
        status === 'Draft' ? 'Your expense was saved as draft.' : 'Your expense was submitted for approval.',
        status === 'Draft' ? 'Draft saved' : 'Submitted'
      );
      clearInvoices();
      navigation.navigate('My Claims');
    } catch (err) {
      console.error("Error submitting master expense:", err);
      toast.error('We couldn’t submit your expense. Please try again.', 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PUT /master-expense/by-id/:id — the backend decides whether this approval
  // finalises the expense or just forwards it to the finance manager.
  const updateMasterExpenseStatus = async (docId, approvalStatus, reasonCode, comment) => {
    if (!docId) throw new Error('Missing master-expense document id');
    if (!approvalStatus) throw new Error('Missing approval status');

    const updatedBy =
      user?.mail || user?.email || user?.userPrincipalName ||
      (await AsyncStorage.getItem('user_email')) || '';

    const body = {
      ApprovalStatus: approvalStatus,
      UpdatedBy: updatedBy,
      Comments: comment || '',
    };
    if (approvalStatus === 'Rejected' && reasonCode) {
      body.RejectionReason = reasonCode;
    }

    console.log('Updating backend status with body:', JSON.stringify(body, null, 2));

    const res = await fetch(`${URL}/${encodeURIComponent(docId)}`, {
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

  // Get base64 content from file URL
  const getBase64FromUrl = async (fileUrl) => {
    try {
      if (!fileUrl) return null;

      // If it's a local file, read it
      if (fileUrl.startsWith('file://') || fileUrl.startsWith('/')) {
        // const base64 = await FileSystem.readAsStringAsync(fileUrl, {
        //   encoding: 'base64',
        // });
        const file = new FileSystem.File(fileUrl); // Create a file object
        const base64 = await file.base64();
        return base64;
      }

      // If it's a remote URL, fetch it
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]; // Remove data:application/...;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting file to base64:', error);
      return null;
    }
  };

  // Get document ID from expense data
  const getDocIdFromExpense = (expense) => {
    return expense?.id || expense?.ExpenseId || null;
  };

  // Run status update — no SAP. The backend handles the 2-level approval flow:
  //   submit → manager (level 1) → finance manager (level 2) → final Approved.
  // The backend decides whether this approval finalises the expense or just
  // forwards it to the finance manager; the client always sends ApprovalStatus:'Approved'.
  const runStatusUpdate = async (newStatus, reasonCode, comment) => {
    try {
      setActionError("");
      if (newStatus === 'Approved') setIsApproving(true);
      else setIsRejecting(true);

      const docId = getDocIdFromExpense(expenseData);
      if (!docId) throw new Error("Could not resolve document id");

      const updated = await updateMasterExpenseStatus(docId, newStatus, reasonCode, comment, null);

      const resultingStatus = updated?.ApprovalStatus || newStatus;
      let title = newStatus === 'Approved' ? 'Approved' : 'Rejected';
      let body = `Claim has been ${newStatus.toLowerCase()} successfully.`;
      if (newStatus === 'Approved' && resultingStatus === 'Pending') {
        title = 'Forwarded to Finance';
        body = 'Your approval has been recorded. The claim is now pending Finance Manager review.';
      } else if (newStatus === 'Approved' && resultingStatus === 'Approved') {
        title = 'Finalised';
        body = 'Claim has been fully approved.';
      }

      toast.success(body, title);
      navigation.goBack();
    } catch (e) {
      toast.error(e?.message || 'Failed to update status.', 'Action failed');
    } finally {
      setIsApproving(false);
      setIsRejecting(false);
    }
  };

  const approveClaim = async () => {
    const ok = await confirm({
      title: 'Approve this claim?',
      message: 'Once approved, this claim will be forwarded to the next approver in the chain.',
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
    });
    if (ok) runStatusUpdate('Approved');
  };

  const rejectClaim = () => {
    setRejectModalVisible(true);
  };

  const openImagePreview = (uri) => {
    setImagePreviewUri(uri);
    setImageModalVisible(true);
  };

  // Receipts live in a PRIVATE Supabase bucket, so the backend stores each file
  // as an S3 URI (e.g. "s3://expense_receipt/<folder>/<file>"). Ask the backend
  // to mint a short-lived HTTPS signed URL we can actually open.
  const resolveSignedUrl = async (rawPath) => {
    try {
      const resp = await fetch(
        `${API_BASE_URL}/storage/sign?path=${encodeURIComponent(rawPath)}`
      );
      if (!resp.ok) {
        console.warn('[resolveSignedUrl] sign failed:', resp.status);
        return null;
      }
      const data = await resp.json();
      return data?.url || null;
    } catch (e) {
      console.warn('[resolveSignedUrl] error:', e.message);
      return null;
    }
  };

  const handleOpenFile = async (fileUrl) => {
    if (!fileUrl) {
      toast.error('No file URL available.', 'Cannot open file');
      return;
    }

    if (typeof fileUrl === 'string' && /^local:\/\//i.test(fileUrl)) {
      toast.warning(
        'This file was uploaded through the chat and is stored privately. The chat host needs to expose it via HTTPS before the app can preview it.',
        'File not accessible'
      );
      return;
    }

    try {
      setIsPreviewingTrail(true); // Reuse previewing state for file loading spinner

      // Detect type from the ORIGINAL path — signed URLs carry a ?token=... that
      // hides the extension.
      const isImage = /\.(jpeg|jpg|gif|png)(\?|$)/i.test(fileUrl);
      const isPdf = /\.pdf(\?|$)/i.test(fileUrl);

      // Resolve to an openable HTTPS URL. s3:// (and any non-http) values go
      // through the backend signer; real https URLs pass straight through.
      let finalUrl = fileUrl;
      if (!/^https?:\/\//i.test(fileUrl)) {
        finalUrl = await resolveSignedUrl(fileUrl);
        if (!finalUrl) {
          toast.error('Could not get a link to this file. Please try again.', 'Open failed');
          return;
        }
      }

      if (isImage) {
        openImagePreview(finalUrl);
      } else if (isPdf) {
        // Use Google Docs Viewer to preview PDF in WebView (prevents download)
        const googleDocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(finalUrl)}`;
        setDocumentUri(googleDocsUrl);
        setDocumentModalVisible(true);
      } else {
        Linking.openURL(finalUrl).catch(err => {
          console.error('Failed to open URL:', err);
          toast.error('Could not open file.', 'Open failed');
        });
      }
    } catch (e) {
      console.error("Error opening file:", e);
      toast.error('Failed to open file.', 'Open failed');
    } finally {
      setIsPreviewingTrail(false);
    }
  };

  const closeDocumentPreview = () => {
    setDocumentUri(null);
    setDocumentHtml(null);
    setDocumentModalVisible(false);
  };

  const handleViewApprovalTrail = async () => {
    try {
      setIsPreviewingTrail(true);
      let empInfo = {};
      if (submitterEmail) {
        try {
          const url = `https://ocr-validations-hnh3e7g2bkhhf6hq.southeastasia-01.azurewebsites.net/employee-info?emp_email=${encodeURIComponent(submitterEmail)}`;
          const resp = await fetch(url);
          if (resp.ok) empInfo = await resp.json();
        } catch (e) { console.error('Error fetching employee info for view:', e); }
      }
      const html = generateApprovalTrailHTML(expenseData, empInfo);
      setDocumentUri(null);
      setDocumentHtml(html);
      setDocumentModalVisible(true);
    } catch (err) {
      console.error('Error rendering approval trail:', err);
      toast.error('Failed to render approval trail.', 'Preview failed');
    } finally {
      setIsPreviewingTrail(false);
    }
  };




  const closeImagePreview = () => {
    setImagePreviewUri(null);
    setImageModalVisible(false);
  };

  const handlePreviewApprovalTrail = async () => {
    try {
      setIsPreviewingTrail(true);
      console.log('Generating Approval Trail PDF for preview...');

      // 1. Fetch employee info
      // const submitterEmail = expenseData?.SubmitterEmail || expenseData?.ExpenseDatas?.SubmitterEmail || '';
      console.log('submitterEmail pdf', submitterEmail);
      let empInfo = {};
      if (submitterEmail) {
        try {
          const url = `https://ocr-validations-hnh3e7g2bkhhf6hq.southeastasia-01.azurewebsites.net/employee-info?emp_email=${encodeURIComponent(submitterEmail)}`;
          const resp = await fetch(url);
          if (resp.ok) empInfo = await resp.json();
        } catch (e) { console.error('Error fetching employee info for preview:', e); }
      }

      // 2. Generate PDF
      const pdfUri = await generateApprovalTrailPDF(expenseData, empInfo);
      
      // 3. Share/View
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Approval Trail PDF',
          UTI: 'com.adobe.pdf'
        });
      } else {
        toast.warning('File sharing is not supported on this device.', 'Sharing not available');
      }
    } catch (err) {
      console.error('Error sharing approval trail PDF:', err);
      toast.error('Failed to generate or share PDF.', 'PDF failed');
    } finally {
      setIsPreviewingTrail(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return '#22C55E';
      case 'Rejected': return '#EF4444';
      case 'Pending': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const edges = isAppBarVisible ? ['top'] : [];
  console.log("All expenses----", allExpenses);

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>

      {isAppBarVisible && (
        <Appbar style={{ backgroundColor: '#006DC7' }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Expense Details" />
        </Appbar>
      )}

      <ScrollView contentContainerStyle={styles.container}>
        {/* Display expenses */}
        {allExpenses.length > 0 ? (
          allExpenses.map((expense, expenseIndex) => {
            console.log("expense-----", allExpenses);
            console.log("expense data in the index-----", expense);
            console.log("Email of the user----", allExpenses[0].email);
            const expTitle = expense?.ExpenseTitle || expense?.title || 'Expense';
            const expTotal = expense?.ExpenseData?.[0]?.ItemData.ClaimAmount || expense?.TotalAmount || expense.invoices[0].ItemData.ClaimAmount;
            const invoiceAmount = expense?.ExpenseData?.[0]?.InvoiceAmount || expense.invoices[0].ItemData.ClaimAmount || expense?.TotalAmount;
            console.log("expTotal-----", JSON.stringify(expTotal));
            console.log("expense?.SubmissionDate", expense?.billDate);
            console.log("expense?.ExpenseFromDate", expense?.ExpenseFromDate);
            console.log("Conveyance expense", expense?.invoices?.[0]?.ConveyanceDetails);
            console.log("Conveyance type---", typeof (expense?.invoices?.[0]?.ConveyanceDetails))
            const expSubmissionDate = formatDate(expense?.submissionDate) || formatDate(expense?.ExpenseData?.[0]?.PostingDate);
            // const expBillDate = formatDate(expense?.billDate) || formatDate(expense?.ExpenseFromDate);
           const expBillDate = formatDate(expense?.ExpenseData?.[0]?.DocumentDate);
            const expConveyanceDetails = expense?.invoices?.[0]?.ConveyanceDetails || expense?.ExpenseData?.[0]?.ConveyanceDetails || expense?.ExpenseData?.[0]?.ItemData?.ConveyanceDetails;
            console.log("expConveyanceDetails", expConveyanceDetails);
            const selfApprove = expense?.invoices?.[0]?.SelfApprove || expense?.ExpenseData?.[0]?.SelfApprove;
            console.log("history.....", expenseData?.ApprovalHistory);
            // ? expense?.ExpenseFromDate
            // : new Date().toLocaleDateString('en-GB', {
            //   weekday: 'short',
            //   day: 'numeric',
            //   month: 'short',
            //   year: 'numeric'
            // });
            const expApprover = expense?.ApproverEmail || '';
            const expStatus = expense?.ApprovalStatus || expense?.status || 'Pending';
            const expDocNo = expense?.ExpenseData?.[0]?.ItemData?.DocumentNo || expense?.invoices?.[0].ItemData?.DocumentNo ||'N/A';
            const rawNarration = expense?.ExpenseData?.[0]?.Narration || expense?.invoices?.[0]?.Narration || '';
            const expNarration = rawNarration && rawNarration.trim() && rawNarration.trim().toLowerCase() !== 'business expense' ? rawNarration.trim() : '';
            console.log("expDocNo", expense );
            const isPending = expStatus.toLowerCase() === 'pending';
            const showButtons = mode === 'approveRejectView';

            return (
              <View key={expense.id || expenseIndex} style={{ marginBottom: 24 }}>
                <View style={styles.masterCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.masterTitle}>{expTitle}</Text>
                  </View>
                  <Text style={styles.masterText}>Invoice Amount: ₹{invoiceAmount.toLocaleString() || expense}</Text>
                  <Text style={styles.masterText}>Claim Amount: ₹{expTotal.toLocaleString() || expense}</Text>
                  <Text style={styles.masterText}>Submission Date: {expSubmissionDate}</Text>
                  <Text style={styles.masterText}>Bill Date: {expBillDate}</Text>
                 {selfApprove ===true? null : <Text style={styles.masterText}>{showButtons ? "Requester: " : "Approver: "}{expense?.ApproverEmail || (showButtons ? expense?.email : 'N/A')}</Text>}
                  <Text style={styles.masterText}>Document Number: {expDocNo}</Text>
                  {expNarration ? <Text style={styles.masterText}>Narration: {expNarration}</Text> : null}
                 {selfApprove ===true? <Text style={[styles.approved, { color: getStatusColor(expStatus), marginTop: 8 }]}>Self Approved</Text>: <Text style={[styles.approved, { color: getStatusColor(expStatus), marginTop: 8 }]}>
                    {expStatus}
                  </Text>}
                </View>

                {/* Conveyance Details Section */}
                {expConveyanceDetails && Object.keys(expConveyanceDetails).length > 0 && expConveyanceDetails !== undefined && (
                  <View style={styles.conveyanceCard}>
                    <Text style={styles.conveyanceTitle}>Conveyance Details</Text>

                    <View style={styles.conveyanceRow}>
                      <Text style={styles.conveyanceLabel}>From:</Text>
                      <Text style={styles.conveyanceValue}>{expConveyanceDetails.FromLocation || expConveyanceDetails.from_location}</Text>
                    </View>

                    <View style={styles.conveyanceRow}>
                      <Text style={styles.conveyanceLabel}>To:</Text>
                      <Text style={styles.conveyanceValue}>{expConveyanceDetails.ToLocation || expConveyanceDetails.to_location}</Text>
                    </View>

                    <View style={styles.conveyanceRow}>
                      <Text style={styles.conveyanceLabel}>Distance:</Text>
                      <Text style={styles.conveyanceValue}>{expConveyanceDetails.DistanceTravelledKm || expConveyanceDetails.km_travelled} km</Text>
                    </View>

                    <View style={styles.conveyanceRow}>
                      <Text style={styles.conveyanceLabel}>Purpose:</Text>
                      <Text style={styles.conveyanceValue}>{expConveyanceDetails.Purpose || expConveyanceDetails.purpose}</Text>
                    </View>

                    {/* <View style={styles.conveyanceRow}>
                      <Text style={styles.conveyanceLabel}>Amount:</Text>
                      <Text style={styles.conveyanceValue}>₹{expConveyanceDetails.TotalAmount || expConveyanceDetails.total_amount}</Text>
                    </View> */}
                  </View>
                )}


                {/* Files Section */}
                {expense?.ExpenseData?.[0]?.File &&expense?.ExpenseData?.[0]?.File.length > 0 && (
                  <View style={styles.filesCard}>
                    <Text style={styles.conveyanceTitle}>Attached Files</Text>
                    {expense?.ExpenseData?.[0]?.File.map((file, fIndex) => {
                      const fileUrl = file.blob_url || file.url || file.sas_url || file.sasUrl || file.SasUrl || file.path || file.link;
                      const isApprovalTrail = (file.filename || '').toLowerCase().includes('approvaltrail');
                      const onPressFile = () => {
                        if (isApprovalTrail) {
                          handleViewApprovalTrail();
                          return;
                        }
                        if (!fileUrl) {
                          console.log('Attached file has no URL field. File object:', file);
                        }
                        handleOpenFile(fileUrl);
                      };
                      return (
                        <TouchableOpacity
                          key={fIndex}
                          style={styles.fileRow}
                          onPress={onPressFile}
                        >
                          <MaterialIcons name="attach-file" size={20} color="#006DC7" />
                          <Text style={styles.fileName}>{file.filename || `Attachment ${fIndex + 1}`}</Text>
                          <MaterialIcons name="open-in-new" size={16} color="#64748B" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}


                 {/* Approval History Section */}
                 {expenseData?.ApprovalHistory && expenseData.ApprovalHistory.length > 0 && (
                  <View style={styles.historyCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setIsApprovalHistoryExpanded(prev => !prev)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isApprovalHistoryExpanded ? 12 : 0 }}
                    >
                      <Text style={[styles.conveyanceTitle, { marginBottom: 0 }]}>Approval History</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {false && (
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation && e.stopPropagation(); handleViewApprovalTrail(); }}
                            style={{ padding: 4, marginRight: 4 }}
                          >
                            <MaterialIcons name="picture-as-pdf" size={24} color="#006DC7" />
                          </TouchableOpacity>
                        )}
                        <MaterialIcons
                          name={isApprovalHistoryExpanded ? 'remove' : 'add'}
                          size={24}
                          color="#006DC7"
                        />
                      </View>
                    </TouchableOpacity>
                    {isApprovalHistoryExpanded && expenseData.ApprovalHistory.map((history, hIndex) => (
                      <View key={hIndex} style={styles.historyItem}>
                        {Object.entries(history).map(([key, value]) => {
                          if (value === null || value === undefined || value === "") return null;
                          // Hide From/To from on-screen approval history (kept in data for PDF/audit trail)
                          if (key.toLowerCase() === 'from' || key.toLowerCase() === 'to') return null;

                          // Custom formatting for common keys
                          let displayValue = value;
                          if (key.toLowerCase().includes('at') || key.toLowerCase().includes('date')) {
                            displayValue = formatDate(value);
                          } else if (Array.isArray(value)) {
                            displayValue = value.join('\n');
                          } else if (typeof value === 'object') {
                            displayValue = JSON.stringify(value);
                          }

                          const isLongValue = Array.isArray(value) || (typeof value === 'string' && value.length > 50) || key === 'ChangesMade';

                          return (
                            <View key={key} style={[styles.historyRow, isLongValue && styles.historyRowColumn]}>
                              <Text style={[styles.historyLabel, isLongValue && styles.historyLabelFull]}>
                                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:
                              </Text>
                              <Text style={[styles.historyValue, isLongValue && styles.historyValueFull]}>
                                {String(displayValue)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                )}

                {/* Approve/Reject buttons right after blue card */}
                {showButtons && isPending && (
                  <View style={{ marginTop: 16 }}>
                    {
                    __DEV__ && 
                    (
                       <TouchableOpacity
                         style={[
                           styles.outlinedButton,
                           {
                             borderColor: '#006DC7',
                             marginBottom: 12,
                             opacity: (isApproving || isRejecting || isPreviewingTrail) ? 0.6 : 1
                           }
                         ]}
                         onPress={handlePreviewApprovalTrail}
                         disabled={isApproving || isRejecting || isPreviewingTrail}
                       >
                         <Text style={[styles.outlinedButtonText, { color: '#006DC7' }]}>
                           {isPreviewingTrail ? 'Processing...' : 'Review & Share Transaction Trail'}
                         </Text>
                       </TouchableOpacity>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <TouchableOpacity
                        style={[
                          styles.outlinedButton,
                          {
                            borderColor: '#EF4444',
                            flex: 1,
                            opacity: (isApproving || isRejecting || isPreviewingTrail) ? 0.6 : 1
                          }
                        ]}
                        onPress={() => {
                          rejectClaim();
                        }}
                        disabled={isApproving || isRejecting || isPreviewingTrail}
                      >
                        <Text style={[styles.outlinedButtonText, { color: '#EF4444' }]}>
                          {isRejecting ? 'Processing...' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.outlinedButton,
                          {
                            borderColor: '#22C55E',
                            flex: 1,
                            opacity: (isApproving || isRejecting || isPreviewingTrail) ? 0.6 : 1
                          }
                        ]}
                        onPress={() => {
                          approveClaim();
                        }}
                        disabled={isApproving || isRejecting || isPreviewingTrail}
                      >
                        <Text style={[styles.outlinedButtonText, { color: '#22C55E' }]}>
                          {isApproving ? 'Processing...' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontSize: 16 }}>No expenses found</Text>
          </View>
        )}

        {(mode === 'viewSubmit' || mode === 'view' || mode === 'approveRejectView') ? (
          <View style={{ marginTop: 20 }}>
            {/* <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#3B82F6', flex: 1 }]}
              onPress={() => submitMasterExpense('Pending')}
            >
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity> */}
          </View>
        ) : (
          <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
            {/* <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#64748B', flex: 0.48 }]}
              onPress={() => submitMasterExpense('Draft')}
            >
              <Text style={styles.submitText}>Save</Text>
            </TouchableOpacity> */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#3B82F6', flex: 0.48 }]}
              onPress={() => submitMasterExpense('Pending')}
            >
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {(isSubmitting || isApproving || isRejecting || isPreviewingTrail) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 10 }}>
            {isSubmitting ? 'Submitting...' : 'Processing...'}
          </Text>
        </View>
      )}

      <Modal transparent visible={isModalVisible} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Master Info</Text>
            <TextInput style={styles.input} value={tempTitle} onChangeText={setTempTitle} placeholder="Title" />
            <TextInput style={styles.input} value={tempApprover} onChangeText={setTempApprover} placeholder="Approver" />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
              <Text style={styles.submitText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reject reasons modal */}
      <Modal transparent visible={rejectModalVisible} animationType="slide" onRequestClose={() => setRejectModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackground}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Select Rejection Reason</Text>
                {REJECTION_REASONS.map((r) => (
                  <TouchableOpacity key={r.value} style={{ paddingVertical: 8 }} onPress={() => setRejectReason(r.value)}>
                    <Text style={{ color: rejectReason === r.value ? '#2563EB' : '#111827', fontWeight: rejectReason === r.value ? '700' : '400' }}>{r.title}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  value={rejectComment}
                  onChangeText={setRejectComment}
                  placeholder="Comments (optional)"
                  multiline
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TouchableOpacity
                    disabled={isRejecting}
                    style={[styles.outlinedButton, { borderColor: '#EF4444', flex: 1, opacity: isRejecting ? 0.6 : 1 }]}
                    onPress={() => {
                      setRejectModalVisible(false);
                      runStatusUpdate('Rejected', rejectReason || 'other', rejectComment);
                    }}
                  >
                    <Text style={[styles.outlinedButtonText, { color: '#EF4444' }]}>{isRejecting ? 'Processing...' : 'Reject'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={isRejecting}
                    style={[styles.outlinedButton, { borderColor: '#CBD5E1', flex: 1, opacity: isRejecting ? 0.6 : 1 }]}
                    onPress={() => setRejectModalVisible(false)}
                  >
                    <Text style={[styles.outlinedButtonText, { color: '#111827' }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={isImageModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, zIndex: 1 }}>
            <TouchableOpacity onPress={closeImagePreview}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 18, marginLeft: 10 }}>Image Preview</Text>
          </View>
          {imagePreviewUri && (
            <View style={{ flex: 1 }}>
              {isImageLoading && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                   <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}
              <ZoomableImage 
                uri={imagePreviewUri} 
                onLoadStart={() => setIsImageLoading(true)}
                onLoadEnd={() => setIsImageLoading(false)}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={isDocumentModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <TouchableOpacity onPress={closeDocumentPreview}>
              <Ionicons name="arrow-back" size={28} color="#000" />
            </TouchableOpacity>
            <Text style={{ color: '#000', fontSize: 18, marginLeft: 10 }}>Document Preview</Text>
          </View>
          {(documentUri || documentHtml) && (
             <WebView
               source={documentHtml ? { html: documentHtml } : { uri: documentUri }}
               originWhitelist={["*"]}
               style={{ flex: 1 }}
               startInLoadingState={true}
               renderLoading={() => <ActivityIndicator size="large" color="#006DC7" style={{position: 'absolute', top: '50%', left: '50%'}} />}
             />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 60 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginLeft: 10 },
  masterCard: { backgroundColor: '#006DC7', borderRadius: 12, padding: 16, marginBottom: 20 },
  masterTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textDecorationLine: 'underline' },
  masterText: { color: '#fff', marginTop: 4 },
  approved: { color: '#22C55E', fontWeight: 'bold', marginTop: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardIcons: { flexDirection: 'row' },
  addButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, backgroundColor: '#fff', marginBottom: 16, alignSelf: 'flex-start' },
  addButtonText: { color: '#006DC7', fontWeight: 'bold', marginLeft: 8 },
  invoiceCard: {
    width: 250,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginRight: 16,
    borderColor: '#E0F2FE',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subCategoryText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  mediaPreviewButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  cardIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  invoiceImage: { width: '100%', height: 150, borderRadius: 8, marginTop: 10 },
  submitButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 0 },
  submitText: { color: '#fff', fontWeight: 'bold' },
  outlinedButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 0,
    backgroundColor: 'transparent',
    borderWidth: 2,
    marginHorizontal: 4,
  },
  outlinedButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#475569' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalBackground: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', padding: 10, borderRadius: 8, marginBottom: 10 },
  saveButton: { backgroundColor: '#006DC7', padding: 12, borderRadius: 10, alignItems: 'center' },

  // Upload Status Indicator
  uploadStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  uploadStatusText: {
    fontSize: 12,
    color: '#22C55E',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Conveyance Details Styles
  conveyanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  conveyanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  conveyanceRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  conveyanceLabel: {
    fontSize: 14,
    color: '#64748B',
    width: 80,
    fontWeight: '500',
  },
  conveyanceValue: {
    fontSize: 14,
    color: '#0F172A',
    flex: 1,
    fontWeight: '500',
  },
  
  // Files Styles
  filesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  fileName: {
    flex: 1,
    marginLeft: 8,
    color: '#006DC7',
    fontSize: 14,
    fontWeight: '500',
  },

  // History Styles
  historyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyItem: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  historyRowColumn: {
    flexDirection: 'column',
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    width: 135,
    marginRight: 8,
  },
  historyLabelFull: {
    width: '100%',
    marginBottom: 4,
  },
  historyValue: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
    fontWeight: '500',
    lineHeight: 18,
  },
  historyValueFull: {
    marginTop: 2,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#E2E8F0',
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  historyDate: {
    fontSize: 12,
    color: '#64748B',
  },
  historyBy: {
    fontSize: 13,
  },
  historyComment: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  historyReason: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 2,
    fontWeight: '500',
  },
});
