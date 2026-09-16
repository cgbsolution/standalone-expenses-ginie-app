// Single source of truth for all non-secret runtime URLs the client uses.
// Do not inline the chat host, upload host or OCR host anywhere else — import
// from here.
//
// Everything below is deployment-level configuration and comes from `.env`
// (react-native-dotenv). The fallbacks are the values this app shipped with, so
// an existing build keeps working without an .env change — but nothing here is
// tied to a particular customer.
//
// PER-TENANT values (categories, GL codes, SAP endpoint, company/vendor codes)
// are NOT configured here — they are fetched per tenant from the backend. See
// api/tenantMasterData.js.

import { BASE_URL, CHAT_URL, UPLOAD_URL, OCR_URL } from '@env';

const DEFAULT_HOST = 'https://147.93.103.97';

export const EXPGENIE_CONFIG = {
  CHAT_BASE_URL: CHAT_URL || `${DEFAULT_HOST}/chat`,
  UPLOAD_URL: UPLOAD_URL || `${DEFAULT_HOST}/api/upload-expense`,
  UPLOAD_MAX_BYTES: 20 * 1024 * 1024,
  UPLOAD_ALLOWED_MIME: ['application/pdf', 'image/jpeg', 'image/png'],
  API_BASE_URL: BASE_URL || 'http://localhost:3000',
  // Shared OCR / expense-engine service. Deployment-level, not per tenant.
  OCR_URL:
    OCR_URL ||
    'https://ocr-validations-hnh3e7g2bkhhf6hq.southeastasia-01.azurewebsites.net',
};

export function buildChatUrl(email, displayName) {
  const userid = encodeURIComponent(email || '');
  const username = encodeURIComponent(displayName || '');
  return `${EXPGENIE_CONFIG.CHAT_BASE_URL}?userid=${userid}&username=${username}`;
}

export function guessMimeFromUri(uri) {
  const lower = (uri || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
