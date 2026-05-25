import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useInvoiceContext } from '../context/InvoiceContext';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@env';

const API_BASE_URL = BASE_URL;
const SUBMITTER_EMAIL = 'ankurmaheshwari@tatarealty.in';
const APPROVER_EMAIL = 'tarunmehrotra@tatarealty.in';

export default function AddScreenMasterView({ navigation, onAddMoreBills }) {
  const { invoices, deleteInvoice, updateInvoice, clearInvoices } = useInvoiceContext();

  const [title, setTitle] = useState('My Expenses');
  const [approverName, setApproverName] = useState('User');
  const [submittedDate, setSubmittedDate] = useState(getToday());

  // Load saved title from AsyncStorage on mount
  useEffect(() => {
    loadSavedTitle();
  }, []);

  // Check title and prompt user if empty when invoices are added
  useEffect(() => {
    if (invoices.length > 0 && !hasCheckedTitle) {
      // Give a small delay to ensure title is loaded
      const timer = setTimeout(() => {
        if (!title || title === 'My Expenses') {
          Alert.alert(
            'Add Expense Title',
            'Please give your expense a title (e.g., "Delhi Trip - October 2024")',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setHasCheckedTitle(true)
              },
              {
                text: 'Add Title',
                onPress: () => {
                  setHasCheckedTitle(true);
                  handleOpenTitleEdit();
                }
              }
            ]
          );
        } else {
          setHasCheckedTitle(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoices.length, title, hasCheckedTitle]);

  // Save title to AsyncStorage whenever it changes
  useEffect(() => {
    if (title) {
      saveTitleToStorage(title);
    }
  }, [title]);

  const loadSavedTitle = async () => {
    try {
      const savedTitle = await AsyncStorage.getItem('expense_title');
      if (savedTitle) {
        setTitle(savedTitle);
        // If a custom title exists, mark as checked
        if (savedTitle !== 'My Expenses') {
          setHasCheckedTitle(true);
        }
      }
    } catch (error) {
      console.error('Error loading title:', error);
    }
  };

  const saveTitleToStorage = async (newTitle) => {
    try {
      await AsyncStorage.setItem('expense_title', newTitle);
      console.log('Title saved to storage:', newTitle);
    } catch (error) {
      console.error('Error saving title:', error);
    }
  };

  const handleOpenTitleEdit = () => {
    setTempTitle(title);
    setShowTitleEditModal(true);
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      setTitle(tempTitle.trim());
      setHasCheckedTitle(true); // Mark as checked after saving
    }
    setShowTitleEditModal(false);
  };

  const handleCancelTitleEdit = () => {
    setShowTitleEditModal(false);
    setTempTitle('');
  };

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editForm, setEditForm] = useState({
    billNumber: '',
    billDate: '',
    billAmount: '',
    claimAmount: '',
    hsnCode: '',
    narration: '',
  });

  // Title editing state
  const [showTitleEditModal, setShowTitleEditModal] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [hasCheckedTitle, setHasCheckedTitle] = useState(false);

  // Media preview state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [previewFileType, setPreviewFileType] = useState(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  function getToday() {
    const d = new Date();
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
  }

  const totalBillAmount = useMemo(() => {
    return invoices.reduce((sum, item) => {
      // Use claimAmount for Non-Bill-Based, billAmount for Bill-Based
      // Handle empty strings and null values properly
      const claimAmt = item.claimAmount && item.claimAmount !== '' ? parseFloat(item.claimAmount) : 0;
      const billAmt = item.billAmount && item.billAmount !== '' ? parseFloat(item.billAmount) : 0;
      const amount = claimAmt || billAmt;
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [invoices]);

  const handleDeleteInvoice = (index) => {
    Alert.alert('Delete Invoice', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteInvoice(index) },
    ]);
  };

  const openMediaPreview = (uri, fileType) => {
    setPreviewUri(uri);
    setPreviewFileType(fileType);
    setPreviewModalVisible(true);
  };

  const closeMediaPreview = () => {
    setPreviewModalVisible(false);
    setPreviewUri(null);
    setPreviewFileType(null);
  };

  const handleEditInvoice = (index) => {
    const invoice = invoices[index];
    setEditingIndex(index);
    setEditingInvoice(invoice); // Store the invoice being edited
    setEditForm({
      billNumber: invoice.billNumber || '',
      billDate: invoice.billDate || '',
      billAmount: invoice.billAmount || '',
      claimAmount: invoice.claimAmount || '',
      hsnCode: invoice.hsnCode || '',
      narration: invoice.narration || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      updateInvoice(editingIndex, editForm);
      setEditModalVisible(false);
      setEditingIndex(null);
      setEditingInvoice(null);
      setEditForm({
        billNumber: '',
        billDate: '',
        billAmount: '',
        claimAmount: '',
        hsnCode: '',
        narration: '',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingIndex(null);
    setEditingInvoice(null);
    setEditForm({
      billNumber: '',
      billDate: '',
      billAmount: '',
      claimAmount: '',
      hsnCode: '',
      narration: '',
    });
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
          DocumentDate: inv.billDate || new Date().toISOString().split('T')[0],
          Currency: inv.currency || "INR",
          BillNumber: inv.billNumber,
          EMSUniqueId: `ems-${Date.now()}-${i}`,
          VendorCode: inv.vendorCode || "vendor-001",
          BusinessPlace: inv.businessPlace || "test-LOC",
          SectionCode: inv.sectionCode || "test-SC",
          Narration: inv.narration,
          InvoiceAmount: parseFloat(inv.billAmount) || parseFloat(inv.claimAmount) || 0,
          SelfApprove: false,
          ItemData: {
            GLCode: inv.glCode || "test-40503021",
            TaxCode: inv.taxCode || "",
            CostCenter: inv.costCenter || "",
            WBS: inv.wbs || "Test-WBS",
            ClaimAmount: parseFloat(inv.claimAmount) || parseFloat(inv.billAmount) || 0,
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
      ApproverEmail: APPROVER_EMAIL,
      SubmitterEmail: SUBMITTER_EMAIL,
      ExpenseFromDate: fromDate.toISOString().split('T')[0],
      ExpenseToDate: toDate.toISOString().split('T')[0],
      ApprovalStatus: status,
      SoftDelete: "No",
      ExpenseData: expenseData,
    };
  };

  const submitMasterExpense = async (status = "Pending") => {
    // Validate invoice count first
    if (invoices.length === 0) {
      Alert.alert('Missing Invoices', 'Please add at least one invoice.');
      return;
    }

    // Check if title is set and valid
    if (!title || title === 'My Expenses' || title.trim() === '') {
      Alert.alert(
        'Title Required',
        'Please add a title for your expense before submitting. This will help identify your expense later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Title',
            onPress: () => handleOpenTitleEdit()
          }
        ]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await buildPayload(status);
      console.log("Submitting Payload:", JSON.stringify(payload, null, 2));
      await axios.post(`${API_BASE_URL}/master-expense`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Clear invoices IMMEDIATELY after successful submission
      console.log('Clearing invoices after submission...');
      await clearInvoices();

      // Reset title check flag for next expense
      setHasCheckedTitle(false);

      // Also clear the saved title
      try {
        await AsyncStorage.removeItem('expense_title');
        setTitle('My Expenses'); // Reset to default title
        console.log('Cleared saved title');
      } catch (err) {
        console.error('Error clearing title:', err);
      }

      Alert.alert(
        'Success',
        `Master expense ${status === 'Draft' ? 'saved as draft' : 'submitted'}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to add screen or show success message
              onAddMoreBills();
            }
          }
        ]
      );
    } catch (err) {
      console.error("Error submitting master expense:", err);
      Alert.alert('Error', 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masterCard}>
        <View style={styles.cardHeader}>
          <TouchableOpacity onPress={handleOpenTitleEdit}>
            <Text style={styles.masterTitle}>
              {title}
              <Ionicons name="create-outline" size={14} color="#fff" style={{ marginLeft: 8 }} />
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.masterText}>Total Cost: ₹{totalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
        <Text style={styles.masterText}>Number of Bills: {invoices.length}</Text>
        <Text style={[styles.approved, { color: '#F59E0B' }]}>
          Draft
        </Text>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={onAddMoreBills}>
        <Ionicons name="add-circle-outline" size={20} color="#006DC7" />
        <Text style={styles.addButtonText}>Add More Bills</Text>
      </TouchableOpacity>

      {invoices.length === 0 ? (
        <Text style={styles.emptyText}>No invoices added.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {invoices.map((invoice, index) => (
            <View key={index} style={styles.invoiceCard}>
              {/* Category */}
              <Text style={styles.categoryText}>{invoice.category || 'Category'}</Text>

              {/* Subcategory */}
              <Text style={styles.subCategoryText}>{invoice.subCategory || 'Subcategory'}</Text>

              {/* Date */}
              <Text style={styles.dateText}>{invoice.billDate || 'Date'}</Text>

              {/* Media Preview Button */}
              {invoice.fileUri && (
                <TouchableOpacity
                  onPress={() => openMediaPreview(invoice.sasUrl || invoice.fileUri, invoice.fileType)}
                  style={styles.mediaPreviewButton}
                >
                  {invoice.fileType === 'pdf' ? (
                    <MaterialIcons name="picture-as-pdf" size={20} color="#3D586E" />
                  ) : (
                    <MaterialIcons name="image" size={20} color="#3D586E" />
                  )}
                </TouchableOpacity>
              )}

              {/* Footer Section - Amount and Icons */}
              <View style={styles.cardFooter}>
                <Text style={styles.amountText}>
                  ₹{parseFloat(invoice.claimAmount || invoice.billAmount || 0).toLocaleString()}
                </Text>
                <View style={styles.cardIcons}>
                  <TouchableOpacity
                    onPress={() => handleEditInvoice(index)}
                    style={styles.iconButton}
                  >
                    <MaterialIcons name="edit" size={18} color="#3D586E" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteInvoice(index)}
                    style={styles.iconButton}
                  >
                    <MaterialIcons name="delete" size={18} color="#3D586E" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: '#64748B', flex: 0.48 }]}
          onPress={() => submitMasterExpense('Draft')}
          disabled={isSubmitting}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: '#3B82F6', flex: 0.48 }]}
          onPress={() => submitMasterExpense('Pending')}
          disabled={isSubmitting}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Edit Invoice Modal */}
      <Modal transparent visible={editModalVisible} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Invoice</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category and Subcategory Display - Read-only */}
              {(editingInvoice?.category || editingInvoice?.subCategory) && (
                <View style={styles.readOnlyInfo}>
                  <View style={styles.readOnlyRow}>
                    <Text style={styles.readOnlyLabel}>Category:</Text>
                    <Text style={styles.readOnlyValue}>{editingInvoice.category || 'N/A'}</Text>
                  </View>
                  <View style={styles.readOnlyRow}>
                    <Text style={styles.readOnlyLabel}>Sub Category:</Text>
                    <Text style={styles.readOnlyValue}>{editingInvoice.subCategory || 'N/A'}</Text>
                  </View>
                </View>
              )}

              {/* Bill Number - Only for Bill-Based */}
              {(editingInvoice?.expenseType === 'Bill-Based' || !editingInvoice?.expenseType) && (
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Bill Number</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.billNumber}
                      onChangeText={(text) => setEditForm({ ...editForm, billNumber: text })}
                      placeholder="Bill Number"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Bill Date</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.billDate}
                      onChangeText={(text) => setEditForm({ ...editForm, billDate: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>
              )}

              {/* Date field for Non-Bill-Based (when not Bill-Based) */}
              {editingInvoice?.expenseType === 'Non-Bill-Based' && (
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Bill Date</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.billDate}
                      onChangeText={(text) => setEditForm({ ...editForm, billDate: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>
              )}

              {/* Amount fields - Different for Bill-Based vs Non-Bill-Based */}
              {(editingInvoice?.expenseType === 'Bill-Based' || !editingInvoice?.expenseType) ? (
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Bill Amount</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.billAmount}
                      onChangeText={(text) => setEditForm({ ...editForm, billAmount: text })}
                      placeholder="Amount"
                      keyboardType="numeric"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Claim Amount</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.claimAmount}
                      onChangeText={(text) => setEditForm({ ...editForm, claimAmount: text })}
                      placeholder="Amount"
                      keyboardType="numeric"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Amount</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.claimAmount}
                      onChangeText={(text) => setEditForm({ ...editForm, claimAmount: text })}
                      placeholder="Enter amount"
                      keyboardType="numeric"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>
              )}

              {/* HSN Code and Narration - Only for Bill-Based */}
              {(editingInvoice?.expenseType === 'Bill-Based' || !editingInvoice?.expenseType) && (
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>HSN Code</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.hsnCode}
                      onChangeText={(text) => setEditForm({ ...editForm, hsnCode: text })}
                      placeholder="HSN Code"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Narration</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.narration}
                      onChangeText={(text) => setEditForm({ ...editForm, narration: text })}
                      placeholder="Narration"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>
              )}

              {/* Comment (for Non-Bill-Based) or Narration (for Bill-Based) */}
              {editingInvoice?.expenseType === 'Non-Bill-Based' && (
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Comment</Text>
                    <TextInput
                      style={[styles.input, styles.commentInput]}
                      value={editForm.narration}
                      onChangeText={(text) => setEditForm({ ...editForm, narration: text })}
                      placeholder="Enter comments"
                      placeholderTextColor="#ccc"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Media Preview Modal */}
      <Modal
        visible={previewModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeMediaPreview}
      >
        <View style={styles.previewModalContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>
              {previewFileType === 'pdf' ? 'PDF Preview' : 'Image Preview'}
            </Text>
            <TouchableOpacity onPress={closeMediaPreview} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.previewContent}>
            {previewFileType === 'pdf' ? (
              <WebView
                source={{ uri: previewUri }}
                style={styles.webView}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#006DC7" />
                    <Text style={styles.loadingText}>Loading PDF...</Text>
                  </View>
                )}
              />
            ) : (
              <Image
                source={{ uri: previewUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Title Edit Modal */}
      <Modal transparent visible={showTitleEditModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCancelTitleEdit} />
          <View style={styles.titleEditModalContainer}>
            <Text style={styles.titleEditModalTitle}>Edit Expense Title</Text>
            <TextInput
              style={styles.titleEditInput}
              value={tempTitle}
              onChangeText={setTempTitle}
              placeholder="Enter expense title"
              placeholderTextColor="#ccc"
              autoFocus
              maxLength={50}
            />
            <View style={styles.titleEditButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelTitleEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTitle}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  masterCard: {
    backgroundColor: '#006DC7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20
  },
  masterTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  },
  masterText: {
    color: '#fff',
    marginTop: 4
  },
  approved: {
    color: '#22C55E',
    fontWeight: 'bold',
    marginTop: 10
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cardIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  addButtonText: {
    color: '#006DC7',
    fontWeight: 'bold',
    marginLeft: 8
  },
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
  titleInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 4,
    borderRadius: 4,
  },
  mediaPreviewButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  // Media Preview Modal Styles
  previewModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  previewContent: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  submitButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 0
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#475569'
  },
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

  // Edit Modal Styles
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  inputColumn: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#333',
  },
  commentInput: {
    minHeight: 80,
  },
  readOnlyInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  readOnlyValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#006DC7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Loading Overlay Styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },

  // Title Edit Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  titleEditModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  titleEditModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  titleEditInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#333',
    marginBottom: 20,
  },
  titleEditButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
