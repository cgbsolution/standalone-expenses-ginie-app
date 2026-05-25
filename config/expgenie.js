// Single source of truth for all non-secret runtime URLs the client uses.
// Do not inline the chat host or upload host anywhere else — import from here.

import { BASE_URL } from '@env';

export const EXPGENIE_CONFIG = {
  CHAT_BASE_URL: 'https://147.93.103.97/chat',
  UPLOAD_URL: 'https://147.93.103.97/api/upload-expense',
  UPLOAD_MAX_BYTES: 20 * 1024 * 1024,
  UPLOAD_ALLOWED_MIME: ['application/pdf', 'image/jpeg', 'image/png'],
  API_BASE_URL: BASE_URL || 'http://localhost:3000',
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
