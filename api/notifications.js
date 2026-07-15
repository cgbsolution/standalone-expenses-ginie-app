// In-app notifications API — talks to expenses-backend /notifications.
//   fetchNotifications(email)       → GET  /notifications?email=
//   fetchUnreadCount(email)         → GET  /notifications/unread-count?email=
//   markNotificationRead(id)        → PUT  /notifications/:id/read
//   markAllNotificationsRead(email) → PUT  /notifications/read-all
//
// BASE_URL mirrors AuthContext (the @env value, falling back to localhost).

import { BASE_URL } from '@env';

const API_BASE = BASE_URL || 'http://localhost:5000';

export async function fetchNotifications(email, { status } = {}) {
  if (!email) return { success: false, error: 'Missing email', items: [] };
  try {
    const params = new URLSearchParams({ email });
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/notifications?${params.toString()}`);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const items = await res.json();
    return { success: true, items: Array.isArray(items) ? items : [] };
  } catch (error) {
    console.error('fetchNotifications error:', error);
    return { success: false, error: error.message, items: [] };
  }
}

export async function fetchUnreadCount(email) {
  if (!email) return { success: false, count: 0 };
  try {
    const res = await fetch(
      `${API_BASE}/notifications/unread-count?email=${encodeURIComponent(email)}`
    );
    if (!res.ok) throw new Error(`Count failed: ${res.status}`);
    const data = await res.json();
    return { success: true, count: Number(data?.count) || 0 };
  } catch (error) {
    console.error('fetchUnreadCount error:', error);
    return { success: false, count: 0, error: error.message };
  }
}

export async function markNotificationRead(id) {
  if (!id) return { success: false, error: 'Missing id' };
  try {
    const res = await fetch(
      `${API_BASE}/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PUT' }
    );
    if (!res.ok) throw new Error(`Mark read failed: ${res.status}`);
    return { success: true };
  } catch (error) {
    console.error('markNotificationRead error:', error);
    return { success: false, error: error.message };
  }
}

export async function markAllNotificationsRead(email) {
  if (!email) return { success: false, error: 'Missing email' };
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`Mark all read failed: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    return { success: true, updated: Number(data?.updated) || 0 };
  } catch (error) {
    console.error('markAllNotificationsRead error:', error);
    return { success: false, error: error.message };
  }
}
