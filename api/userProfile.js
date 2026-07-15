// Self-service profile API — talks to expenses-backend /users.
//   - fetchProfile(email)            → GET  /users/:email
//   - uploadAvatar(email, fileUri)   → POST /users/:email/avatar (multipart)
//   - updateIntegrationProvider(...) → PATCH /users/:email/profile
//
// BASE_URL mirrors AuthContext (the @env value, falling back to localhost).

import { BASE_URL } from '@env';
import { guessMimeFromUri } from '../config/expgenie';

const API_BASE = BASE_URL || 'http://localhost:5000';

function avatarMime(uri) {
  const mime = guessMimeFromUri(uri);
  // Avatars are images only; the picker may hand us octet-stream for some URIs.
  return mime === 'image/png' || mime === 'image/jpeg' ? mime : 'image/jpeg';
}

function fileNameFor(uri, mime) {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  return `avatar.${ext}`;
}

export async function fetchProfile(email) {
  if (!email) return { success: false, error: 'Missing email' };
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(email)}`);
    if (res.status === 404) return { success: false, notFound: true };
    if (!res.ok) throw new Error(`Profile lookup failed: ${res.status}`);
    const user = await res.json();
    return { success: true, user };
  } catch (error) {
    console.error('fetchProfile error:', error);
    return { success: false, error: error.message };
  }
}

export async function uploadAvatar(email, fileUri) {
  if (!email) return { success: false, error: 'Missing email' };
  if (!fileUri) return { success: false, error: 'No image selected' };
  try {
    const mime = avatarMime(fileUri);
    const form = new FormData();
    form.append('file', {
      uri: fileUri,
      name: fileNameFor(fileUri, mime),
      type: mime,
    });

    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(email)}/avatar`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed: ${res.status}`);
    return { success: true, user: data, avatarUrl: data.avatarUrl };
  } catch (error) {
    console.error('uploadAvatar error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateIntegrationProvider(email, provider) {
  if (!email) return { success: false, error: 'Missing email' };
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(email)}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integrationProvider: provider }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Update failed: ${res.status}`);
    return { success: true, user: data };
  } catch (error) {
    console.error('updateIntegrationProvider error:', error);
    return { success: false, error: error.message };
  }
}
