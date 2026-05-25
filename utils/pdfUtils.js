import * as Print from 'expo-print';
import { formatDate, formatDateTime } from './dateUtils';

const formatLabel = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const isDateKey = (key) => {
  const k = key.toLowerCase();
  return k.includes('at') || k.includes('date') || k.includes('postingdate');
};

const renderDataRows = (data, excludeKeys = []) => {
  if (!data || typeof data !== 'object') return '';

  const lowerExcludeKeys = excludeKeys.map(k => k.toLowerCase());

  return Object.entries(data)
    .filter(([key, value]) => {
      const k = key.toLowerCase();
      if (lowerExcludeKeys.includes(k)) return false;
      if (k === 'file') return false;
      if (value === null || value === undefined || value === '') return false;
      return true;
    })
    .map(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        return renderDataRows(value, excludeKeys);
      }

      let displayValue = value;
      const label = formatLabel(key);
      const k = key.toLowerCase();

      if (isDateKey(key)) {
        displayValue = formatDate(value) || value;
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') return '';
        displayValue = value.join(', ');
      }

      // Determine if this should be a "Box" (more data or array or narrative)
      const isLong = typeof displayValue === 'string' && displayValue.length > 50;
      const isArray = Array.isArray(value);
      const isNarrative = k.includes('narration') || k.includes('purpose') || k.includes('comment');

      if (isLong || isArray || isNarrative) {
        return `
          <tr>
            <td colspan="2" style="border-bottom: none; padding-top: 15px; padding-bottom: 15px;">
              <span class="box-label">${label}</span>
              <div class="data-box">${displayValue}</div>
            </td>
          </tr>
        `;
      }

      return `
        <tr>
          <td class="label">${label}:</td>
          <td class="value">${displayValue}</td>
        </tr>
      `;
    })
    .join('');
};

export const generateApprovalTrailHTML = (expenseData, employeeData) => {
  const {
    ExpenseDatas,
    invoices,
    ApprovalHistory,
    ExpenseTitle,
    ExpenseId,
    id,
    SubmissionDate,
    InvoiceAmount,
    TotalAmount
  } = expenseData;

  const invoice = invoices?.[0] || {};
  const expData0 = expenseData?.ExpenseData?.[0] || {};
  const itemData = invoice.ItemData || expData0.ItemData || {};

  const excludeFromMain = ['ExpenseData', 'ExpenseDatas', 'invoices', 'ApprovalHistory', 'id', 'ExpenseId', 'ExpenseTitle', 'attachments', 'images', 'File', 'file', 'requesterName', 'overdue', 'submissionDate', 'billDate', 'amount', 'status'];
  const excludeFromInvoice = ['ItemData', 'Attachments', 'File', 'file'];

  const employeeName = employeeData?.FullName || employeeData?.SubmitterName || expenseData?.FullName || 'Unknown';
  const employeeEmail = employeeData?.PrimaryEmail || employeeData?.SubmitterEmail || expenseData?.PrimaryEmail || expenseData?.SubmitterEmail || 'unknown@example.com';
  const department = employeeData?.Department || expenseData?.Department || 'Marketing & Sales';
  const company = employeeData?.CompanyName || expenseData?.CompanyName || 'Tata Housing Development Company Limited';
  const costCenter = employeeData?.CostCenter || expData0.ItemData?.CostCenter || invoice.ItemData?.CostCenter || '1000COMS01';
  const costCenterDesc = employeeData?.CostCenterDescription || employeeData?.CostCenterDesc || employeeData?.CostCenterName || '';
  const companyCode = invoice.CompanyCode || expData0.CompanyCode || '1000';

  const history = ApprovalHistory || [];

  // ---- Values for the structured Expense Details block ----
  // Read from `invoices[0]` (frontend-mapped, used by manager flow) OR `ExpenseData[0]`
  // (raw API shape, used by self-approve flow). Both shapes are supported so the
  // same generator works for both flows.
  const employeeId = employeeData?.EmployeeId || employeeData?.EmpId || employeeData?.UserId || expenseData?.EmployeeId || '';
  const vendorCode = invoice.VendorCode || expData0.VendorCode || '';
  const vendorName = invoice.VendorName || expData0.VendorName || '';
  const expTitle   = ExpenseTitle || expenseData?.ExpenseTitle || '';
  const category   = expData0.Category || invoice.category || invoice.Category || '';
  const subCategory = expData0.SubCategory || invoice.subCategory || invoice.SubCategory || '';
  const expNature  = [category, subCategory].filter(Boolean).join(' / ') || expTitle;
  const glCode     = itemData.GLCode || '';
  const narration  = invoice.Narration || expData0.Narration || '';
  const wbs        = itemData.WBS || '';
  const billNumber = invoice.BillNumber || expData0.BillNumber || '';
  const rawBillDate = invoice.DocumentDate || expData0.DocumentDate || '';
  const billDate   = rawBillDate ? formatDate(rawBillDate) : '';
  const docNo      = itemData.DocumentNo || '';
  const fy         = itemData.FinancialYear || '';
  const invoiceAmt = invoice.InvoiceAmount ?? expData0.InvoiceAmount;
  const claimAmt   = itemData.ClaimAmount;

  const submittedAt = SubmissionDate || expenseData?.SubmissionDate || history[0]?.at || '';

  const isSelfApproved = invoice.SelfApprove === true || expData0.SelfApprove === true;
  const approvedEntry  = [...history].reverse().find(h => h && h.from !== h.to && h.to === 'Approved');
  const rejectedEntry  = [...history].reverse().find(h => h && h.from !== h.to && h.to === 'Rejected');

  let approverDisplay = '';
  let approvedAt = '';
  if (isSelfApproved) {
    approverDisplay = 'Self Approved';
    approvedAt = approvedEntry?.at || expenseData?.ApprovedAt || submittedAt;
  } else if (approvedEntry) {
    approverDisplay = approvedEntry.by || expenseData?.ApproverEmail || '';
    approvedAt = approvedEntry.at || expenseData?.ApprovedAt || '';
  } else if (rejectedEntry) {
    approverDisplay = `Rejected by ${rejectedEntry.by || expenseData?.ApproverEmail || ''}`;
    approvedAt = rejectedEntry.at || expenseData?.RejectionInfo?.RejectedAt || '';
  } else {
    approverDisplay = 'Pending';
  }

  const join = (sep, ...parts) => parts.filter(p => p !== null && p !== undefined && String(p).trim() !== '').join(sep);
  const dash = (val) => (val === null || val === undefined || String(val).trim() === '') ? '-' : val;
  const detailsRow = (label, value) => `
    <tr>
      <td class="label">${label}</td>
      <td class="value">${dash(value)}</td>
    </tr>`;
  const detailsSpacer = `<tr><td colspan="2" style="border-bottom:none;height:10px;"></td></tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Expense Approval Trail</title>
        <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #000; }
            h1 { text-align: center; font-size: 24px; margin-bottom: 40px; font-weight: bold; }
            h2 { color: #0056b3; font-size: 18px; border-bottom: 0px solid #ddd; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px;}

            .section { margin-bottom: 30px; }

            .details-table { width: 100%; border-collapse: collapse; border: none; }
            .details-table td { padding: 8px 0; vertical-align: top; border-bottom: 1px solid #f3f4f6; }
            .details-table .label { font-weight: bold; width: 180px; color: #4B5563; }
            .details-table .value { color: #111827; }

            .box-label { font-weight: bold; color: #4B5563; font-size: 14px; margin-bottom: 6px; display: block; }
            .data-box {
                background-color: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: 12px;
                color: #111827;
                font-size: 14px;
                line-height: 1.5;
            }

            table.timeline { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
            table.timeline th { background-color: #d1d5db; text-align: left; padding: 10px; border: 1px solid #ccc; }
            table.timeline td { padding: 10px; border: 1px solid #ccc; vertical-align: top; }

            .action-approved { background-color: #d1fae5; }
            .action-rejected { background-color: #fee2e2; }
        </style>
    </head>
    <body>
        <h1>Expense Approval Trail</h1>

        <div class="section">
            <h2>Expense Details</h2>
            <table class="details-table">
                ${detailsRow('Name', employeeName)}
                ${detailsRow('Employee Id & Name', join(' - ', employeeId, employeeName))}
                ${detailsRow('Vendor Id & Name', join(' - ', vendorCode, employeeName))}
                ${detailsRow('Company Code & Name', join(' - ', companyCode, company))}
                ${detailsSpacer}
                ${detailsRow('Exp - Nature', expNature)}
                ${detailsRow('GL Code', glCode)}
                ${detailsRow('CC / WBS', join(' / ', costCenter, wbs))}
                ${detailsRow('Invoice Amount', invoiceAmt !== undefined && invoiceAmt !== null && invoiceAmt !== '' ? `${invoiceAmt}` : '')}
                ${detailsRow('Claim Amount', claimAmt !== undefined && claimAmt !== null && claimAmt !== '' ? `${claimAmt}` : '')}
                ${detailsRow('Bill No.', billNumber)}
                ${detailsRow('Bill Date', billDate)}
                ${detailsRow('Parked Doc No. & Fiscal Year', join(' / ', docNo, fy))}
                ${detailsSpacer}
                ${detailsRow('Claim Submitted - Date & Time', submittedAt ? formatDateTime(submittedAt) : '')}
                ${detailsRow('Claim Approved -', approverDisplay)}
                ${detailsRow('Claim Approved - Date & Time', approvedAt ? formatDateTime(approvedAt) : '')}
            </table>
        </div>

        <div class="section">
            <h2>Employee Information</h2>
            <table class="details-table" style="width:100%">
               <tr>
                 <td class="label">Name:</td><td class="value">${employeeName}</td>
                 <td class="label">Department:</td><td class="value">${department}</td>
               </tr>
               <tr>
                 <td class="label">Email:</td><td class="value">${employeeEmail}</td>
                 <td class="label">Company Code:</td><td class="value">${companyCode}</td>
               </tr>
               <tr>
                 <td class="label">Company:</td><td class="value" colspan="3">${company}</td>
               </tr>
               <tr>
                 <td class="label">Cost Center:</td><td class="value" colspan="3">${costCenter}</td>
               </tr>
            </table>
        </div>

        <div class="section">
            <h2>Complete Approval Timeline</h2>
            <table class="timeline">
                <thead>
                    <tr>
                        <th style="width: 25%;">Date</th>
                        <th style="width: 25%;">Current Status</th>
                        <th style="width: 20%;">By</th>
                        <th style="width: 30%;">Comments</th>
                    </tr>
                </thead>
                <tbody>
                    ${history
                      .filter(item => item && item.from !== item.to)
                      .map(item => {
                        let rowClass = '';
                        let actionText = '';
                        let byText = item.by ? item.by.replace('@', '<br/>@') : '';
                        let commentsText = item.comments || '';

                        if (item.to === 'Approved') {
                            rowClass = 'action-approved';
                            actionText = 'Approved<br/>(Forwarding to Finance)';
                            if (isSelfApproved) {
                                byText = 'Self Approved';
                                commentsText = 'Self Approved, forwarded to Finance Department';
                            }
                        } else if (item.to === 'Rejected') {
                            rowClass = 'action-rejected';
                            actionText = 'Rejected';
                        } else if (item.from === 'Start') {
                             actionText = 'Pending';
                        } else {
                            actionText = item.to;
                        }

                        const dateStr = formatDateTime(item.at);

                        return `
                        <tr class="${rowClass}">
                            <td>${dateStr}</td>
                            <td>${actionText}</td>
                            <td>${byText}</td>
                            <td>${commentsText}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>
  `;

  return htmlContent;
};

export const generateApprovalTrailPDF = async (expenseData, employeeData) => {
  const htmlContent = generateApprovalTrailHTML(expenseData, employeeData);
  const { uri } = await Print.printToFileAsync({ html: htmlContent });
  return uri;
};
