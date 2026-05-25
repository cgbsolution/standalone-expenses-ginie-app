import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { File, Paths } from "expo-file-system";
import TopBar from "../components/TopBar";
import { SafeAreaView } from "react-native-safe-area-context";
// Removed multi-bill master view flow
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadExpenseDocument, storeUploadedUrl, getUploadedUrl } from "../api/expenseUpload";
import { WebView } from "react-native-webview";
import { getCurrentFinancialYear } from '../services/FinancialYearUtils';
import { BASE_URL } from '@env';

// APIs
const PROCESS_EXPENSE_API =
  "https://ocr-validations-hnh3e7g2bkhhf6hq.southeastasia-01.azurewebsites.net/process-expense-with-grade";
const BUDGET_CHECK_API =
  "https://magicqa.tatahousing.com/Magicxpi4.13/MgWebRequester.dll?appname=IFSEMS_To_SAP&prgname=HTTP&arguments=-AHTTP_1%23Budget_CheckingAndBlocking";
const API_BASE_URL = BASE_URL;

// Category and Subcategory data
const CATEGORY_OPTIONS = [
  { label: "Select Category", value: "" },
  { label: "Local Conveyance", value: "Local Conveyance" },
  { label: "Food Expenses", value: "Food Expenses" },
  { label: "Communication", value: "Communication" },
];

const SUBCATEGORY_OPTIONS = {
  "Local Conveyance": [
    { label: "Select Sub-Category", value: "" },
    {
      label: "Local Conveyance-Four Wheeler",
      value: "Local Conveyance-Four Wheeler",
    },
    {
      label: "Local Conveyance-Two Wheeler",
      value: "Local Conveyance-Two Wheeler",
    },
    {
      label: "Local Conveyance-Cab/Auto charges",
      value: "Local Conveyance-Cab/Auto charges",
    },
  ],
  "Food Expenses": [
    { label: "Select Sub-Category", value: "" },
    { label: "Refreshment Expenses", value: "Refreshment Expenses" },
    { label: "Business Promotion", value: "Business Promotion" },
  ],
  Communication: [
    { label: "Select Sub-Category", value: "" },
    { label: "Telephone Reimbursement", value: "Telephone Reimbursement" },
    { label: "Wifi Reimbursement", value: "Wifi Reimbursement" },
  ],
};

export default function EditExpenseScreen({ navigation }) {
  const nav = useNavigation();
  const [expenseType, setExpenseType] = useState("Bill-Based"); // "Bill-Based" or "Non-Bill-Based"
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [narration, setNarration] = useState("");

  // Conveyance fields for non-bill-based expenses
  const [distanceTravelled, setDistanceTravelled] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showConveyanceDetails, setShowConveyanceDetails] = useState(false);

  //const [policyFlags, setPolicyFlags] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState(null); // 'image' or 'pdf'
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  // Single-step submission, no master view
  const [uploadStatus, setUploadStatus] = useState(null);
  const [sasUrl, setSasUrl] = useState(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [pdfBase64, setPdfBase64] = useState(null);
  const scrollViewRef = useRef(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressLogs, setProgressLogs] = useState([]);

  // OCR result storage
  const [ocrExpense, setOcrExpense] = useState(null);
  const [ocrEnvelope, setOcrEnvelope] = useState(null);

  // iOS picker modals
  const [showCategoryPickerModal, setShowCategoryPickerModal] = useState(false);
  const [showSubCategoryPickerModal, setShowSubCategoryPickerModal] =
    useState(false);

  // Date picker modal
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Single-step: no invoice context aggregation

  // Handle category change and reset subcategory
  const handleCategoryChange = (selectedCategory) => {
    setCategory(selectedCategory);
    setSubCategory(""); // Reset subcategory when category changes
    if (Platform.OS === "ios") {
      setShowCategoryPickerModal(false);
    }
  };

  const handleSubCategoryChange = (selectedSubCategory) => {
    setSubCategory(selectedSubCategory);
    if (Platform.OS === "ios") {
      setShowSubCategoryPickerModal(false);
    }
  };

  // Date picker handlers
  const handleDateChange = (event, date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type !== "dismissed" && date) {
      const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD format
      setBillDate(formattedDate);
      setSelectedDate(date);
    }
    if (Platform.OS === "ios") {
      // For iOS, we keep the modal open until user confirms
      if (event.type === "dismissed") {
        setShowDatePicker(false);
      }
    }
  };

  const onDatePickerPress = () => {
    // If billDate already has a value, use it, otherwise use today's date
    if (billDate) {
      const dateParts = billDate.split("-");
      setSelectedDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
    }
    setShowDatePicker(true);
  };

  const confirmDateIOS = () => {
    const formattedDate = selectedDate.toISOString().split("T")[0];
    setBillDate(formattedDate);
    setShowDatePicker(false);
  };

  // Reset form when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Reset form when screen focused
      setExpenseType("Bill-Based");
      setCategory("");
      setSubCategory("");
      setBillNumber("");
      setBillDate("");
      setBillAmount("");
      setClaimAmount("");
      setHsnCode("");
      setNarration("");
      setSelectedImage(null);
      setSelectedFile(null);
      setFileType(null);
      setSasUrl(null);
      setUploadStatus(null);
      setPdfLoadError(false);
      setPdfBase64(null);
      setOcrExpense(null);
      setOcrEnvelope(null);

      // Reset conveyance fields
      setDistanceTravelled("");
      setOrigin("");
      setDestination("");
      setPurpose("");
      setShowConveyanceDetails(false);

      // Attempt to prefetch employee info
      (async () => {
        try {
          const storedEmail = await AsyncStorage.getItem('user_email');
          if (storedEmail) {
            await fetchAndCacheEmployeeInfo(storedEmail);
          }
        } catch (e) {
          console.warn('Prefetch employee info failed:', e);
        }
      })();
    }, [])
  );

  const fetchAndCacheEmployeeInfo = async (email) => {
    try {
      const url = `https://ocr-validations-hnh3e7g2bkhhf6hq.southeastasia-01.azurewebsites.net/employee-info?emp_email=${encodeURIComponent(email)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error('Failed to fetch employee info');
      }
      const data = await resp.json();
      setEmployeeInfo(data);
      return data;
    } catch (e) {
      console.error('employee-info error:', e);
      throw e;
    }
  };

  // Progress helpers
  const showProgress = () => {
    setProgressLogs([]);
    setProgressVisible(true);
  };
  const hideProgress = () => {
    setProgressVisible(false);
  };
  const logProgress = (msg) => {
    console.log('[Progress]', msg);
    setProgressLogs((prev) => [...prev, msg]);
  };

  const pickImage = async (fromCamera = false) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return Alert.alert("Permission required");

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1 });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      setSelectedFile(result.assets[0].uri);
      setFileType("image");
      setPdfLoadError(false); // Reset PDF load error when image is selected
      setModalVisible(false);
    }
  };

  // TODO: Implement PDF base64 conversion for WebView preview later
  /*
  const convertPdfToBase64 = async (fileUri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:application/pdf;base64,${base64}`;
    } catch (error) {
      console.error('Error converting PDF to base64:', error);
      return null;
    }
  };
  */

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file.uri);
        setFileType("pdf");
        setSelectedImage(null); // Clear image if PDF is selected
        setPdfLoadError(false); // Reset PDF load error for new file
        setPdfBase64(null); // Reset base64
        setModalVisible(false);

        // TODO: Convert PDF to base64 for WebView preview later
        // For now, just show the filename
      }
    } catch (error) {
      console.error("Error picking PDF:", error);
      Alert.alert("Error", "Failed to pick PDF file");
    }
  };

  // Budget Check API
  const handleBudgetCheck = async (expense, item) => {
    try {
      setLoading(true);

      let base64Image = "";
      console.log("selectedFile", selectedFile);
      if (selectedFile) {
        try {
          // Read file as base64
          base64Image = await FileSystem.readAsStringAsync(selectedFile, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log("base64Image length:", base64Image.length);
        } catch (error) {
          console.error("Error reading file:", error);
          Alert.alert(
            "Error",
            "Failed to read the selected file. Please try again."
          );
          setLoading(false);
          return;
        }
      }

      const today = new Date().toISOString().split("T")[0];

      // Determine expense type and conveyance details
      const expenseType = selectedFile ? "Bill-Based" : "Non-Bill-Based";
      const conveyanceDetails =
        showConveyanceDetails &&
          (distanceTravelled || origin || destination || purpose)
          ? {
            DistanceTravelledKm: parseFloat(distanceTravelled) || 0,
            Origin: origin || "",
            Destination: destination || "",
            Purpose: purpose || "",
          }
          : null;

      const payload = {
        ExpenseData: {
          CompanyCode: expense.CompanyCode || "1000",
          PostingDate:
            expense.PostingDate || expense.DocumentDate || billDate || today,
          DocumentDate: expense.DocumentDate || billDate || today,
          Currency: expense.Currency || "INR",
          BillNumber: expense.BillNumber || billNumber,
          EMSUniqueId: expense.EMSUniqueId || "4131",
          VendorCode: expense.VendorCode || "0000100401",
          SectionCode: expense.SectionCode || "1000",
          Narration: expense.Narration || narration,
          InvoiceAmount: Number(expense.InvoiceAmount) || Number(billAmount),
          SelfApprove: expense.SelfApprove || true,
          ExpenseType: expenseType, // Add expense type
          ConveyanceDetails: conveyanceDetails, // Add conveyance details
          ItemData: {
            GLCode: item.GLCode || "40203061",
            TaxCode: item.TaxCode || "G0",
            CostCenter: item.CostCenter || "1000COIT02",
            ClaimAmount: Number(item.ClaimAmount) || Number(claimAmount),
            HSNCode: item.HSNCode ? parseInt(item.HSNCode, 10) : (hsnCode ? parseInt(hsnCode, 10) : 998221),
            FinancialYear: getCurrentFinancialYear() || "2025-2026",
          },
          File: [
            {
              content: base64Image,
              filename: selectedFile
                ? selectedFile.split("/").pop()
                : fileType === "pdf"
                  ? "bill.pdf"
                  : "bill.jpg",
            },
          ],
        },
      };

      // Log request in readable format
      console.log("=== Budget Check Request ===");
      console.log(JSON.stringify(payload, null, 2));

      const response = await fetch(BUDGET_CHECK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();

      // Log raw response
      console.log("=== Budget Check Raw Response ===");
      console.log(rawText);

      // Try parsing JSON
      let result;
      try {
        result = JSON.parse(rawText);
      } catch {
        result = { message: rawText };
      }

      // Log parsed response
      console.log("=== Budget Check Parsed Response ===");
      console.log(JSON.stringify(result, null, 2));

      //Alert.alert("Budget Check Result", JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("Budget Check Error:", err);
      Alert.alert("Budget Check Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // OCR API
  const handleUpload = async () => {
    if (!selectedFile) return Alert.alert("No file selected");

    try {
      setLoading(true);
      setUploadStatus("uploading");
      showProgress();
      logProgress('Uploading file...');

      const fileName = selectedFile.split("/").pop();
      const match = /\.(\w+)$/.exec(fileName);
      const type =
        fileType === "pdf"
          ? "application/pdf"
          : match
            ? `image/${match[1]}`
            : "image";

      // First, upload to expense storage
      console.log("Uploading expense document...");
      const uploadResult = await uploadExpenseDocument(selectedFile, fileName);

      if (uploadResult.success) {
        setSasUrl(uploadResult.sasUrl);
        setUploadStatus("success");
        console.log("Upload successful, URL:", uploadResult.sasUrl);
        logProgress('Upload successful');
      } else {
        setUploadStatus("failed");
        console.warn("Upload failed, continuing with OCR...");
        logProgress('Upload failed, continuing with OCR...');
      }

      // Ensure employee info for OCR grade
      let info = employeeInfo;
      if (!info) {
        const storedEmail = await AsyncStorage.getItem('user_email');
        if (storedEmail) {
          logProgress('Fetching employee info...');
          info = await fetchAndCacheEmployeeInfo(storedEmail);
        }
      }

      // Then proceed with OCR processing (with emp_grade)
      logProgress('Calling OCR (with grade)...');
      const formData = new FormData();
      formData.append("emp_grade", info?.Grade || "");
      formData.append("bill_file", {
        uri: selectedFile,
        name: fileName,
        type,
      });

      const response = await fetch(PROCESS_EXPENSE_API, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const json = await response.json();
      console.log("Process Expense (with grade) Response:", json);
      logProgress('OCR response received');

      // Check if the response has the expected structure
      if (
        !json.ExpenseData ||
        !Array.isArray(json.ExpenseData) ||
        json.ExpenseData.length === 0
      ) {
        Alert.alert("Error", "Invalid response format from OCR service");
        return;
      }

      const expense = json.ExpenseData[0] || {};
      const item = expense.ItemData || {};

      // Store OCR result for later use in submission
      setOcrExpense(expense);
      setOcrEnvelope(json);

      // Map the response data to form fields
      setCategory(expense.Category || "");
      setSubCategory(expense.SubCategory || "");
      setBillNumber(expense.BillNumber || "");
      setBillDate(expense.DocumentDate || "");
      setBillAmount(expense.InvoiceAmount?.toString() || "");
      setClaimAmount(item.ClaimAmount?.toString() || "");
      setHsnCode(item.HSNCode?.toString() || "998221");
      setNarration(expense.Narration || "");

      // Log the mapped values for debugging
      console.log("Mapped form values:", {
        category: expense.Category,
        subCategory: expense.SubCategory,
        billNumber: expense.BillNumber,
        billDate: expense.DocumentDate,
        billAmount: expense.InvoiceAmount,
        claimAmount: item.ClaimAmount,
        hsnCode: item.HSNCode,
        narration: expense.Narration,
      });

      Alert.alert("Success", "Expense details auto-filled from OCR!");
    } catch (e) {
      console.error("Process Expense Error:", e);
      setUploadStatus("failed");
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      hideProgress();
    }
  };

  // Using existing bot-style budget API (see bot_files/budget_api.py)

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

  const submitSingleExpense = async (status = "Pending") => {
    try {
      setLoading(true);
      showProgress();
      logProgress('Validating inputs');

      // Basic validations
      if (expenseType === "Bill-Based") {
        if (!selectedFile) {
          Alert.alert("Missing Bill", "Please upload a bill image or PDF.");
          setLoading(false);
          hideProgress();
          return;
        }
      } else {
        if (!claimAmount) {
          Alert.alert("Missing Amount", "Please enter the amount.");
          setLoading(false);
          hideProgress();
          return;
        }
      }

      // Ensure employee info is available
      logProgress('Fetching employee info');
      let info = employeeInfo;
      if (!info) {
        const storedEmail = await AsyncStorage.getItem('user_email');
        if (!storedEmail) {
          throw new Error('No user email found to fetch employee info');
        }
        info = await fetchAndCacheEmployeeInfo(storedEmail);
      }

      // For budget check call: prepare base64 file if bill-based
      logProgress('Preparing budget check payload');
      let budgetFileArray = undefined;
      if (expenseType === "Bill-Based" && selectedFile) {
        const base64Image = await getBase64FromUri(selectedFile);
        budgetFileArray = base64Image
          ? [{
            content: base64Image,
            filename: selectedFile.split("/").pop() || (fileType === "pdf" ? "bill.pdf" : "bill.jpg"),
          }]
          : [];
      }

      // For DB payload: DO NOT send base64. Ensure URL if bill-based.
      logProgress('Ensuring SAS URL for storage (if bill-based)');
      let finalFileArray = undefined;
      if (expenseType === "Bill-Based" && selectedFile) {
        let finalSasUrl = sasUrl;
        if (!finalSasUrl) {
          try {
            const fileName = selectedFile.split("/").pop();
            const uploadResult = await uploadExpenseDocument(selectedFile, fileName);
            if (uploadResult.success) {
              finalSasUrl = uploadResult.sasUrl;
              setSasUrl(finalSasUrl);
              logProgress('Upload URL obtained');
            }
          } catch (e) {
            console.warn('Upload failed, proceeding without URL');
            logProgress('Upload failed while getting URL');
          }
        }
        finalFileArray = finalSasUrl
          ? [{ url: finalSasUrl, filename: selectedFile.split("/").pop() || "bill" }]
          : [];
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const ts = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
      const generatedRef = `NB-${today.replace(/-/g, '')}-${ts}`;
      const reference = billNumber || generatedRef;
      let expenseItem;
      if (expenseType === "Bill-Based" && ocrExpense) {
        const oi = ocrExpense?.ItemData || {};
        expenseItem = {
          CompanyCode: ocrExpense?.CompanyCode || info?.CompanyCode || "1000",
          PostingDate: ocrExpense?.PostingDate || billDate || today,
          DocumentDate: ocrExpense?.DocumentDate || billDate || today,
          Currency: ocrExpense?.Currency || "INR",
          BillNumber: ocrExpense?.BillNumber || billNumber || "",
          EMSUniqueId: ocrExpense?.EMSUniqueId || `ems-${Date.now()}`,
          VendorCode: ocrExpense?.VendorCode || info?.VendorCode || "0000100401",
          BusinessPlace: ocrExpense?.BusinessPlace || info?.OfficeLocation || "MH01",
          SectionCode: ocrExpense?.SectionCode || info?.SectionCode || "1000",
          Narration: ocrExpense?.Narration || narration || "",
          InvoiceAmount: typeof ocrExpense?.InvoiceAmount === 'number' ? ocrExpense.InvoiceAmount : (parseFloat(billAmount) || 0),
          Category: ocrExpense?.Category || category || undefined,
          SubCategory: ocrExpense?.SubCategory || subCategory || undefined,
          SelfApprove: ocrExpense?.SelfApprove !== undefined ? ocrExpense.SelfApprove : true,
          ExpenseType: "Bill-Based",
          ConveyanceDetails: null,
          ItemData: {
            GLCode: oi?.GLCode || "40203061",
            TaxCode: oi?.TaxCode || "G0",
            FinancialYear: getCurrentFinancialYear() || "2025-2026",
            CostCenter: oi?.CostCenter || info?.CostCenter || "1000COIT02",
            ClaimAmount: typeof oi?.ClaimAmount === 'number' ? oi.ClaimAmount : (parseFloat(claimAmount) || 0),
            HSNCode: oi?.HSNCode ? (typeof oi.HSNCode === 'string' ? oi.HSNCode : String(oi.HSNCode)) : (hsnCode || '998221'),
            DocumentNo: oi?.DocumentNo || (billNumber || `${1900000000}`),
            WBS: oi?.WBS || "",
            FinancialYear: oi?.FinancialYear || info?.FinancialYear || "2025-2026",
          },
          File: finalFileArray,
        };
      } else {
        expenseItem = {
          CompanyCode: info?.CompanyCode || "1000",
          PostingDate: billDate || today,
          DocumentDate: billDate || today,
          Currency: "INR",
          BillNumber: expenseType === "Non-Bill-Based" ? reference : (billNumber || ""),
          EMSUniqueId: `ems-${Date.now()}`,
          VendorCode: info?.VendorCode || "0000100401",
          BusinessPlace: info?.OfficeLocation || "MH01",
          SectionCode: info?.SectionCode || "1000",
          Narration: narration || (expenseType === "Non-Bill-Based" ? `Non-bill expense on ${today}` : ""),
          InvoiceAmount: parseFloat(billAmount) || parseFloat(claimAmount) || 0,
          SelfApprove: false,
          ExpenseType: expenseType,
          // For non-bill-based, category is always "Local Conveyance" (hidden from UI but sent in payload)
          Category: expenseType === "Non-Bill-Based" ? (category || "Local Conveyance") : undefined,
          SubCategory: expenseType === "Non-Bill-Based" ? subCategory : undefined,
          ConveyanceDetails:
            expenseType === "Non-Bill-Based" && (distanceTravelled || origin || destination || purpose)
              ? {
                DistanceTravelledKm: parseFloat(distanceTravelled) || 0,
                Origin: origin || "",
                Destination: destination || "",
                Purpose: purpose || "",
              }
              : null,
          ItemData: {
            GLCode: "40203007",
            TaxCode: "G0",
            CostCenter: info?.CostCenter || "",
            ClaimAmount: parseFloat(claimAmount) || parseFloat(billAmount) || 0,
            HSNCode: hsnCode ? parseInt(hsnCode, 10) : 998221,
            FinancialYear: getCurrentFinancialYear() || "2025-2026",
            // DocumentNo: expenseType === "Non-Bill-Based" ? reference : `${1900000000}`,
            // WBS: "",
          },
          // File: finalFileArray,
        };
      }

      // 1) Call Budget Checking & Blocking with base64 file (if bill-based)
      const budgetPayload = {
        ExpenseData: {
          ...expenseItem,
          File: budgetFileArray,
        },
      };

      console.log("Calling Budget API:", JSON.stringify(budgetPayload, null, 2));
      logProgress('Calling Budget Checking & Blocking API');
      const budgetResp = await fetch(BUDGET_CHECK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgetPayload),
      });
      const budgetText = await budgetResp.text();
      let budgetJson = {};
      try { budgetJson = JSON.parse(budgetText); } catch { }
      if (!budgetResp.ok) {
        const errMsg = budgetJson?.ExpenseDatas?.ErrorMessage || budgetText || 'Budget validation failed';
        throw new Error(errMsg);
      }
      const expenseDatas = budgetJson?.ExpenseDatas || budgetJson?.ExpenseData || {};
      const errorMsgStr = (expenseDatas?.ErrorMessage || '').toString();
      console.log('🔎 Budget check response:', { status: budgetResp.status, body: budgetJson, errorMsgStr });
      const isParked = errorMsgStr.toLowerCase().includes('successfully parked');
      if (!isParked) {
        console.warn('🚧 Budget check did not return "successfully parked" — flow stops here. Master-expense POST will NOT be sent.');
        throw new Error(errorMsgStr || 'Budget validation failed');
      }
      console.log('✅ Budget check parked OK — proceeding to master-expense POST');
      logProgress('Budget parked successfully');
      // Apply returned identifiers to our expense item when available
      if (expenseDatas?.DocumentNo) {
        expenseItem.ItemData.DocumentNo = expenseDatas.DocumentNo;
      }
      // if (expenseDatas?.EMSUniqueId) {
      //   expenseItem.EMSUniqueId = expenseDatas.EMSUniqueId;
      // }

      // 2) DB payload (single-item), include employee info metadata; submit to master-expense
      const expensePayload = {
        ExpenseTitle: (ocrEnvelope?.ExpenseTitle) || "Single Expense",
        ExpenseId: (ocrEnvelope?.ExpenseId) || "",
        ApproverEmail: info?.ManagerEmail || (ocrEnvelope?.ApproverEmail || ""),
        SubmitterEmail: info?.SubmitterEmail || info?.PrimaryEmail || (ocrEnvelope?.SubmitterEmail || ""),
        ExpenseFromDate: (ocrEnvelope?.ExpenseFromDate) || expenseItem.DocumentDate,
        ExpenseToDate: (ocrEnvelope?.ExpenseToDate) || expenseItem.DocumentDate,
        ApprovalStatus: (ocrEnvelope?.ApprovalStatus) || status,
        SoftDelete: (ocrEnvelope?.SoftDelete) || "No",
        // Include employee data for auditing/BI
        FullName: info?.FullName,
        PrimaryEmail: info?.PrimaryEmail,
        UserPrincipalName: info?.UserPrincipalName,
        EmployeeId: info?.EmployeeId,
        CompanyName: info?.CompanyName,
        Department: info?.Department,
        JobTitle: info?.JobTitle,
        OfficeLocation: info?.OfficeLocation,
        City: info?.City,
        MobilePhone: info?.MobilePhone,
        Grade: info?.Grade,
        // Core expense array (no base64 content)
        ExpenseData: [expenseItem],
      };

      console.log("Submitting single expense to API:", JSON.stringify(expensePayload, null, 2));
      logProgress('Saving expense to database');
      const resp = await fetch(`${API_BASE_URL}/master-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expensePayload),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || 'Submission failed');
      }
      logProgress('Expense saved');

      Alert.alert("Success", status === 'Draft' ? "Saved as draft" : "Submitted successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);

      // Reset form after submission
      setExpenseType("Bill-Based");
      setCategory("");
      setSubCategory("");
      setBillNumber("");
      setBillDate("");
      setBillAmount("");
      setClaimAmount("");
      setHsnCode("");
      setNarration("");
      setSelectedImage(null);
      setSelectedFile(null);
      setFileType(null);
      setSasUrl(null);
      setUploadStatus(null);
      setPdfLoadError(false);
      setPdfBase64(null);
      setOcrExpense(null);
      setOcrEnvelope(null);
      setDistanceTravelled("");
      setOrigin("");
      setDestination("");
      setPurpose("");
      setShowConveyanceDetails(false);
    } catch (e) {
      console.error("Single expense submission error:", e);
      Alert.alert("Error", e.message || "Submission failed");
    } finally {
      setLoading(false);
      hideProgress();
    }
  };

  const handleDeleteImage = () => {
    setDeleteModalVisible(true);
  };

  const confirmDeleteImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setFileType(null);
    setDeleteModalVisible(false);
  };

  const handleAddMoreBills = () => {
    setShowMasterView(false);
    setCameFromMasterView(true); // Track that we came from master view
  };

  const handleBack = () => {
    if (showMasterView) {
      // If on master view, go back to home/main
      nav.goBack();
    } else {
      // If on add form and came from master view, go back to master view
      if (cameFromMasterView) {
        setShowMasterView(true);
        setCameFromMasterView(false);
      } else {
        // Otherwise, pop navigation
        nav.goBack();
      }
    }
  };

  const handleReset = () => {
    setExpenseType("Bill-Based");
    setCategory("");
    setSubCategory("");
    setBillNumber("");
    setBillDate("");
    setBillAmount("");
    setClaimAmount("");
    setHsnCode("");
    setNarration("");
    setSelectedImage(null);
    setSelectedFile(null);
    setFileType(null);
    setSasUrl(null);
    setUploadStatus(null);
    setPdfLoadError(false);
    setPdfBase64(null);
    setOcrExpense(null);
    setOcrEnvelope(null);

    // Reset conveyance fields
    setDistanceTravelled("");
    setOrigin("");
    setDestination("");
    setPurpose("");
    setShowConveyanceDetails(false);
  };

  // Show MasterExpense view if showMasterView is true
  // No master view branch; always show single-step form

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* <TopBar /> */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Back Button and Title Container */}
          <View style={styles.titleContainer}>
            {/* <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity> */}
            <Text style={styles.title}>Add Claim</Text>
            {/* Spacer to balance the layout when back button is present */}
            {/* {cameFromMasterView && <View style={styles.backButton} />} */}
          </View>

          {/* Expense Type Toggle */}
          <View style={styles.expenseTypeSection}>
            {/* <Text style={styles.sectionTitle}>Expense Type</Text> */}
            <View style={styles.expenseTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.expenseTypeButton,
                  expenseType === "Bill-Based" &&
                  styles.expenseTypeButtonActive,
                ]}
                onPress={() => {
                  setExpenseType("Bill-Based");
                  setSelectedImage(null);
                  setSelectedFile(null);
                  setFileType(null);
                  setShowConveyanceDetails(false);
                }}
              >
                <Ionicons
                  name="receipt-outline"
                  size={20}
                  color={expenseType === "Bill-Based" ? "#fff" : "#006DC7"}
                />
                <Text
                  style={[
                    styles.expenseTypeButtonText,
                    expenseType === "Bill-Based" &&
                    styles.expenseTypeButtonTextActive,
                  ]}
                >
                  Bill-Based
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.expenseTypeButton,
                  expenseType === "Non-Bill-Based" &&
                  styles.expenseTypeButtonActive,
                ]}
                onPress={() => {
                  setExpenseType("Non-Bill-Based");
                  setCategory("Local Conveyance"); // Set category for non-bill-based
                  setSelectedImage(null);
                  setSelectedFile(null);
                  setFileType(null);
                  setShowConveyanceDetails(false);
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={expenseType === "Non-Bill-Based" ? "#fff" : "#006DC7"}
                />
                <Text
                  style={[
                    styles.expenseTypeButtonText,
                    expenseType === "Non-Bill-Based" &&
                    styles.expenseTypeButtonTextActive,
                  ]}
                >
                  Non-Bill-Based
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Upload Section - Only show for Bill-Based */}
          {expenseType === "Bill-Based" && (
            <View
              style={[
                styles.scanCard,
                selectedFile && styles.scanCardWithImage,
              ]}
            >
              {selectedFile ? (
                <>
                  {fileType === "image" ? (
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: selectedFile }}
                        style={styles.imagePreview}
                      />
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDeleteImage}
                      >
                        <Ionicons name="trash-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.pdfContainer}>
                      {/* TODO: Implement PDF preview with WebView later */}
                      {/* 
                    {!pdfLoadError && pdfBase64 ? (
                      <WebView
                        source={{ 
                          uri: pdfBase64,
                        }}
                        style={styles.pdfPreview}
                        onError={(syntheticEvent) => {
                          const { nativeEvent } = syntheticEvent;
                          console.warn('WebView error: ', nativeEvent);
                          setPdfLoadError(true);
                        }}
                        onHttpError={(syntheticEvent) => {
                          const { nativeEvent } = syntheticEvent;
                          console.warn('WebView HTTP error: ', nativeEvent);
                          setPdfLoadError(true);
                        }}
                        startInLoadingState={true}
                        renderLoading={() => (
                          <View style={styles.pdfLoadingContainer}>
                            <ActivityIndicator size="large" color="#2e4d60" />
                            <Text style={styles.pdfLoadingText}>Loading PDF...</Text>
                          </View>
                        )}
                        onLoadEnd={() => {
                          console.log('PDF loaded successfully');
                          setPdfLoadError(false);
                        }}
                        onLoadStart={() => {
                          console.log('PDF loading started');
                        }}
                        // Enable file access for local files
                        originWhitelist={['*']}
                        allowsInlineMediaPlayback={true}
                        mediaPlaybackRequiresUserAction={false}
                        // For Android local file access
                        mixedContentMode="compatibility"
                        // For iOS local file access
                        allowsBackForwardNavigationGestures={false}
                      />
                    ) : (
                    */}
                      <View style={styles.pdfFallbackContainer}>
                        <MaterialCommunityIcons
                          name="file-pdf-box"
                          size={60}
                          color="#2e4d60"
                        />
                        <Text style={styles.pdfFileName}>
                          {selectedFile.split("/").pop()}
                        </Text>
                        <Text style={styles.pdfFileSize}>PDF Document</Text>
                        {/* TODO: Add retry functionality later */}
                        {/* 
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={async () => {
                            setPdfLoadError(false);
                            setPdfBase64(null);
                            const dataUri = await convertPdfToBase64(selectedFile);
                            if (dataUri) {
                              setPdfBase64(dataUri);
                            } else {
                              setPdfLoadError(true);
                            }
                          }}
                        >
                          <Ionicons name="refresh" size={16} color="#fff" />
                          <Text style={styles.retryButtonText}>Retry Preview</Text>
                        </TouchableOpacity>
                        */}
                      </View>
                      {/* 
                    )}
                    */}
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDeleteImage}
                      >
                        <Ionicons name="trash-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {loading ? (
                    <View style={styles.uploadStatusContainer}>
                      <ActivityIndicator
                        size="small"
                        color="#3D586E"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.uploadStatusText}>
                        {uploadStatus === "uploading"
                          ? "Uploading..."
                          : uploadStatus === "success"
                            ? "Processing OCR..."
                            : "Processing..."}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={handleUpload}
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.uploadButtonText}>
                        Upload & Extract
                      </Text>
                    </TouchableOpacity>
                  )}

                  {uploadStatus === "success" && (
                    <View style={styles.uploadStatusContainer}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#22C55E"
                      />
                      <Text style={styles.uploadStatusText}>
                        Upload successful
                      </Text>
                    </View>
                  )}

                  {uploadStatus === "failed" && (
                    <View style={styles.uploadStatusContainer}>
                      <Ionicons name="warning" size={16} color="#EF4444" />
                      <Text style={styles.uploadStatusText}>
                        Upload failed
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Ionicons
                    name="receipt-outline"
                    size={40}
                    color="#2e4d60"
                    style={styles.receiptIcon}
                  />
                  <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => setModalVisible(true)}
                  >
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={styles.scanButtonText}>Upload expenses</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Form fields - Category and Subcategory only for Non-Bill-Based */}
          {expenseType === "Non-Bill-Based" && (
            <View style={styles.row}>
              {/* Category field - Hidden from UI but still used in payload */}
              {/* <View
                style={[styles.column, Platform.OS === "ios" && { zIndex: 2 }]}
              >
                <Text style={styles.label}>Category</Text>
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={styles.pickerTouchable}
                    onPress={() => setShowCategoryPickerModal(true)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        !category && styles.pickerPlaceholder,
                      ]}
                    >
                      {category || "Select Category"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={category}
                      onValueChange={handleCategoryChange}
                      style={styles.picker}
                      mode="dropdown"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <Picker.Item
                          key={option.value}
                          label={option.label}
                          value={option.value}
                        />
                      ))}
                    </Picker>
                  </View>
                )}
              </View> */}

              <View
                style={[styles.column, Platform.OS === "ios" && { zIndex: 1 }]}
              >
                <Text style={styles.label}>Sub Category</Text>
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={styles.pickerTouchable}
                    onPress={() => setShowSubCategoryPickerModal(true)}
                    disabled={false}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        !subCategory && styles.pickerPlaceholder,
                      ]}
                    >
                      {subCategory || "Select Sub-Category"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={subCategory}
                      onValueChange={handleSubCategoryChange}
                      style={styles.picker}
                      enabled={true}
                      mode="dropdown"
                    >
                      {(
                        SUBCATEGORY_OPTIONS["Local Conveyance"] || [
                          { label: "Select Sub-Category", value: "" },
                        ]
                      ).map((option) => (
                        <Picker.Item
                          key={option.value}
                          label={option.label}
                          value={option.value}
                        />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Bill-Based Expense Fields */}
          {expenseType === "Bill-Based" ? (
            <>
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Bill Number</Text>
                  <TextInput
                    style={styles.input}
                    value={billNumber}
                    onChangeText={setBillNumber}
                    placeholder="Bill Number"
                    placeholderTextColor="#ccc"
                  />
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Bill Date</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={onDatePickerPress}
                  >
                    <Text
                      style={[
                        styles.datePickerText,
                        !billDate && styles.datePickerPlaceholder,
                      ]}
                    >
                      {billDate || "Select Date"}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Bill Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={billAmount}
                    onChangeText={setBillAmount}
                    placeholder="Amount"
                    keyboardType="numeric"
                    placeholderTextColor="#ccc"
                  />
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Claim Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={claimAmount}
                    onChangeText={setClaimAmount}
                    placeholder="Amount"
                    keyboardType="numeric"
                    placeholderTextColor="#ccc"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>HSN Code</Text>
                  <TextInput
                    style={styles.input}
                    value={hsnCode}
                    onChangeText={setHsnCode}
                    placeholder="HSN Code"
                    placeholderTextColor="#ccc"
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }}
                  />
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Narration</Text>
                  <TextInput
                    style={styles.input}
                    value={narration}
                    onChangeText={setNarration}
                    placeholder="Narration"
                    placeholderTextColor="#ccc"
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }}
                  />
                </View>
              </View>
            </>
          ) : (
            /* Non-Bill-Based Expense Fields */
            <>
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={claimAmount}
                    onChangeText={setClaimAmount}
                    placeholder="Enter amount"
                    keyboardType="numeric"
                    placeholderTextColor="#ccc"
                  />
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Bill Date</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={onDatePickerPress}
                  >
                    <Text
                      style={[
                        styles.datePickerText,
                        !billDate && styles.datePickerPlaceholder,
                      ]}
                    >
                      {billDate || "Select Date"}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.commentContainer}>
                <Text style={styles.label}>Comment</Text>
                <TextInput
                  style={styles.commentInput}
                  value={narration}
                  onChangeText={setNarration}
                  placeholder="Enter comments"
                  placeholderTextColor="#ccc"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                />
              </View>
            </>
          )}

          {/* Conveyance Details - Only show for Non-Bill-Based + Local Conveyance */}
          {expenseType === "Non-Bill-Based" &&
            category === "Local Conveyance" && (
              <View style={styles.conveyanceSection}>
                <Text style={styles.conveyanceTitle}>Conveyance Details</Text>

                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.label}>Distance Travelled (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={distanceTravelled}
                      onChangeText={setDistanceTravelled}
                      placeholder="Distance in km"
                      keyboardType="numeric"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.label}>Purpose</Text>
                    <TextInput
                      style={styles.input}
                      value={purpose}
                      onChangeText={setPurpose}
                      placeholder="Purpose of travel"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.label}>Origin</Text>
                    <TextInput
                      style={styles.input}
                      value={origin}
                      onChangeText={setOrigin}
                      placeholder="Starting location"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.label}>Destination</Text>
                    <TextInput
                      style={styles.input}
                      value={destination}
                      onChangeText={setDestination}
                      placeholder="End location"
                      placeholderTextColor="#ccc"
                    />
                  </View>
                </View>
              </View>
            )}

          {/* {policyFlags.length > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color="#B00020" />
              <View style={{ marginLeft: 8 }}>
                {policyFlags.map((flag, idx) => (
                  <Text key={idx} style={styles.warningText}>⚠️ {flag}</Text>
                ))}
              </View>
            </View>
          )} /}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => submitSingleExpense('Pending')}
            >
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal */}
      <Modal transparent visible={modalVisible} animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalView}>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickImage(false)}
            >
              <MaterialCommunityIcons
                name="image-outline"
                size={24}
                color="#333"
              />
              <Text style={styles.modalText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickImage(true)}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={24}
                color="#333"
              />
              <Text style={styles.modalText}>Take a Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={pickPDF}>
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={24}
                color="#333"
              />
              <Text style={styles.modalText}>Upload PDF</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal transparent visible={deleteModalVisible} animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDeleteModalVisible(false)}
        >
          <View style={styles.deleteModalView}>
            <Ionicons name="warning-outline" size={48} color="#f44336" />
            <Text style={styles.deleteModalTitle}>Delete Image</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to remove this image? This action cannot be
              undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={confirmDeleteImage}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Category Picker Modal (iOS) */}
      <Modal
        transparent
        visible={showCategoryPickerModal}
        animationType="slide"
      >
        <Pressable
          style={styles.pickerModalOverlay}
          onPress={() => setShowCategoryPickerModal(false)}
        >
          <View
            style={styles.pickerModalContainer}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity
                onPress={() => setShowCategoryPickerModal(false)}
              >
                <Text style={styles.pickerModalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Select Category</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.pickerModalContent}>
              <Picker
                selectedValue={category}
                onValueChange={(value) => handleCategoryChange(value)}
                style={styles.pickerModalPicker}
                itemStyle={styles.pickerItemStyle}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                    color="#333333"
                  />
                ))}
              </Picker>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* SubCategory Picker Modal (iOS) */}
      <Modal
        transparent
        visible={showSubCategoryPickerModal}
        animationType="slide"
      >
        <Pressable
          style={styles.pickerModalOverlay}
          onPress={() => setShowSubCategoryPickerModal(false)}
        >
          <View
            style={styles.pickerModalContainer}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity
                onPress={() => setShowSubCategoryPickerModal(false)}
              >
                <Text style={styles.pickerModalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Select Sub-Category</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.pickerModalContent}>
              <Picker
                selectedValue={subCategory}
                onValueChange={(value) => handleSubCategoryChange(value)}
                style={styles.pickerModalPicker}
                itemStyle={styles.pickerItemStyle}
                enabled={true}
              >
                {(
                  SUBCATEGORY_OPTIONS["Local Conveyance"] || [
                    { label: "Select Sub-Category", value: "" },
                  ]
                ).map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                    color="#333333"
                  />
                ))}
              </Picker>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Date Picker */}
      {Platform.OS === "android" && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
          textColor="#000000"
          accentColor="#007BFF"
          themeVariant="light"
        />
      )}

      {/* iOS Date Picker Modal */}
      {Platform.OS === "ios" && (
        <Modal transparent visible={showDatePicker} animationType="slide">
          <Pressable
            style={styles.pickerModalOverlay}
            onPress={() => setShowDatePicker(false)}
          >
            <View
              style={styles.datePickerModalContainer}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerModalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerModalTitle}>Select Date</Text>
                <TouchableOpacity onPress={confirmDateIOS}>
                  <Text style={styles.pickerModalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerContent}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setSelectedDate(date);
                  }}
                  maximumDate={new Date()}
                  style={styles.datePicker}
                  textColor="#000000"
                  accentColor="#007BFF"
                  themeVariant="light"
                />
              </View>
            </View>
          </Pressable>
        </Modal>
      )}

      {(loading || progressVisible) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color="#3D586E" />
            <Text style={styles.loadingText}>{progressVisible ? 'Working...' : 'Processing...'}</Text>
            {progressVisible && progressLogs.length > 0 && (
              <View style={{ marginTop: 12, maxWidth: '90%' }}>
                <Text style={{ color: '#333', fontSize: 12 }}>• {progressLogs[progressLogs.length - 1]}</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
  },
  backButton: {
    padding: 8,
    backgroundColor: "#f8f9fa",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: 20,
    paddingBottom: 100,
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    flex: 1,
  },

  // Expense Type Section Styles
  expenseTypeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 12,
  },
  expenseTypeToggle: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  expenseTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  expenseTypeButtonActive: {
    backgroundColor: "#006DC7",
  },
  expenseTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#006DC7",
    marginLeft: 6,
  },
  expenseTypeButtonTextActive: {
    color: "#fff",
  },

  scanCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    paddingBottom: 70,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#000",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
    position: "relative",
    minHeight: 220,
    overflow: "hidden",
  },
  scanCardWithImage: {
    padding: 0,
    paddingBottom: 0,
  },
  receiptIcon: {
    alignContent: "center",
    paddingTop: 50,
    // position: "absolute",
    // top: 0,
    // left: 0,
    // right: 0,
    // bottom: 0,
  },
  scanButton: {
    position: "absolute",
    bottom: -1,
    left: -1,
    right: -1,
    flexDirection: "row",
    backgroundColor: "#006DC7",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },

  uploadButton: {
    position: "absolute",
    bottom: -1,
    left: -1,
    right: -1,
    flexDirection: "row",
    backgroundColor: "#006DC7",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },

  imageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
    marginBottom: 0,
    width: "100%",
    paddingHorizontal: 0,
  },
  pdfContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
    marginBottom: 0,
    width: "100%",
    paddingHorizontal: 0,
  },
  pdfPreview: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  pdfLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
  },
  pdfLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#2e4d60",
    fontWeight: "500",
  },
  pdfFallbackContainer: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  pdfFileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2e4d60",
    marginTop: 12,
    textAlign: "center",
  },
  pdfFileSize: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#006DC7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 0,
    resizeMode: "cover",
  },
  deleteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#f44336",
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  label: {
    fontWeight: "600",
    color: "#333333",
    marginTop: 10,
    marginBottom: 6,
    minHeight: 40, // Fixed minimum height to align labels with different text lengths
    textAlignVertical: "top",
  },

  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DDE2E5",
    color: "#333",
  },

  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DDE2E5",
    // overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#333",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    ...(Platform.OS === "ios" ? { zIndex: 0 } : {}),
  },
  column: { flex: 1 },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },

  submitButton: {
    flex: 1,
    backgroundColor: "#007BFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  resetButton: {
    flex: 1,
    backgroundColor: "#f44336",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  resetText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFEAEA",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#B00020",
  },
  warningText: { fontSize: 14, color: "#B00020", marginBottom: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modalView: {
    backgroundColor: "#fff",
    margin: 30,
    padding: 20,
    borderRadius: 12,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  modalText: { fontSize: 16, color: "#333" },

  // Delete Modal Styles
  deleteModalView: {
    backgroundColor: "#fff",
    margin: 30,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: "#f44336",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  loaderCard: {
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#007BFF",
  },

  // Master View Styles
  masterViewContainer: {
    flex: 1,
  },
  masterViewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  masterViewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  addNewBillButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007BFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addNewBillText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },

  // Upload Status Styles
  uploadStatusContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#006DC7",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadStatusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  uploadStatusContainer: {
    position: "absolute",
    bottom: -25,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  uploadStatusText: {
    color: "#666",
    fontSize: 12,
    marginLeft: 4,
  },

  // Conveyance Toggle Section Styles
  conveyanceToggleSection: {
    marginTop: 20,
  },
  conveyanceToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE2E5",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  conveyanceToggleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginLeft: 8,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: "#006DC7",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },

  // Conveyance Section Styles
  conveyanceSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  conveyanceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 16,
    textAlign: "center",
  },

  // iOS Picker Touchable Styles
  pickerTouchable: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDE2E5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 50,
    marginBottom: 8,
  },
  pickerText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  pickerPlaceholder: {
    color: "#999",
  },

  // iOS Picker Modal Styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "50%",
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  pickerModalCancel: {
    fontSize: 16,
    color: "#007BFF",
    fontWeight: "500",
  },
  pickerModalDone: {
    fontSize: 16,
    color: "#007BFF",
    fontWeight: "600",
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  pickerModalContent: {
    backgroundColor: "#fff",
  },
  pickerModalPicker: {
    height: 200,
    width: "100%",
  },
  pickerItemStyle: {
    height: 200,
    fontSize: 16,
    color: "#333333",
  },

  // Comment Container Styles (Non-Bill-Based)
  commentContainer: {
    width: "100%",
  },
  commentInput: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DDE2E5",
    color: "#333",
    minHeight: 80,
  },

  // Date Picker Button Styles
  datePickerButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDE2E5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 50,
    marginBottom: 8,
  },
  datePickerText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  datePickerPlaceholder: {
    color: "#999",
  },

  // Date Picker Modal Styles
  datePickerModalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "40%",
  },
  datePickerContent: {
    backgroundColor: "#fff",
    paddingVertical: 10,
  },
  datePicker: {
    height: 200,
    width: "100%",
    backgroundColor: "#fff",
  },
});
