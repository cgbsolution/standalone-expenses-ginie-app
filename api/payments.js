// Payment status API — talks to expenses-backend.
//
//   getTenantPaymentSettings(slug) → GET /tenant-config/:slug + /integrations/:slug
//   markExpensePaid({...})         → POST /master-expense/:id/payment
//
// Background: tenants wired to SAP get payment status from the SAP posting.
// Tenants without SAP have no payment record at all, so a super-admin can turn
// on `manualPaymentEnabled` for them and the finance approver ticks payment off
// by hand after final approval. The server re-checks both the tenant flag and
// the caller's authority on every mark-paid call — the UI gating here is only
// to avoid showing an action that would be refused.
//
// BASE_URL mirrors AuthContext (the @env value, falling back to localhost).

import { BASE_URL } from '@env';

const API_BASE = BASE_URL || 'http://localhost:5000';

// Tenant settings change rarely; cache per slug so every expense card doesn't
// re-fetch them. Cleared on app restart, which is frequent enough for a
// super-admin toggle to land.
const settingsCache = new Map();
const settingsInflight = new Map();

const EMPTY_SETTINGS = {
  manualPaymentEnabled: false,
  noPolicyMode: false,
  sapConnected: false,
};

/**
 * Resolve what this tenant does about payment.
 * Never throws — on any failure it resolves to EMPTY_SETTINGS, which hides the
 * manual action rather than showing one the server would reject.
 */
export async function getTenantPaymentSettings(slug) {
  if (!slug) return EMPTY_SETTINGS;
  if (settingsCache.has(slug)) return settingsCache.get(slug);
  if (settingsInflight.has(slug)) return settingsInflight.get(slug);

  const promise = (async () => {
    try {
      const [cfgRes, intRes] = await Promise.all([
        fetch(`${API_BASE}/tenant-config/${encodeURIComponent(slug)}`),
        fetch(`${API_BASE}/integrations/${encodeURIComponent(slug)}`),
      ]);
      const cfg = cfgRes.ok ? await cfgRes.json().catch(() => null) : null;
      const int = intRes.ok ? await intRes.json().catch(() => null) : null;

      const resolved = {
        manualPaymentEnabled: !!cfg?.config?.manualPaymentEnabled,
        noPolicyMode: !!cfg?.config?.noPolicyMode,
        sapConnected: !!int?.sap?.enabled,
      };
      settingsCache.set(slug, resolved);
      return resolved;
    } catch (error) {
      console.warn('getTenantPaymentSettings failed:', error?.message);
      return EMPTY_SETTINGS;
    } finally {
      settingsInflight.delete(slug);
    }
  })();

  settingsInflight.set(slug, promise);
  return promise;
}

/** Drop the cache so a super-admin toggle is picked up without an app restart. */
export function clearTenantPaymentSettings(slug) {
  if (slug) settingsCache.delete(slug);
  else settingsCache.clear();
}

const slugCache = new Map();

/**
 * Tenant slug for the signed-in user.
 *
 * The email/password login already returns it, but Microsoft-OAuth profiles are
 * built from Graph and carry no tenant — so fall back to /auth/me, which reads
 * the employees row. Returns '' when it can't be resolved, which safely
 * degrades to "no manual payment action".
 */
export async function getTenantSlug(user) {
  const direct = user?.tenantSlug || user?.tenant;
  if (direct) return direct;

  const email = user?.mail || user?.email || user?.userPrincipalName || '';
  if (!email) return '';
  if (slugCache.has(email)) return slugCache.get(email);

  try {
    const res = await fetch(`${API_BASE}/auth/me?email=${encodeURIComponent(email)}`);
    if (!res.ok) return '';
    const data = await res.json().catch(() => null);
    const slug = data?.user?.tenantSlug || data?.user?.tenant || '';
    if (slug) slugCache.set(email, slug);
    return slug;
  } catch (error) {
    console.warn('getTenantSlug failed:', error?.message);
    return '';
  }
}

/** True when this expense already has a recorded payment. */
export function isPaid(expense) {
  return (expense?.PaymentStatus || 'Unpaid') === 'Paid';
}

/**
 * Can this user record payment on this expense?
 * Mirrors `canMarkPaid` in expenses-backend/routes/masterExpense.js — the
 * server is the real gate, this only decides whether to render the action.
 */
export function canRecordPayment(user, expense) {
  const email = (user?.mail || user?.email || user?.userPrincipalName || '').toLowerCase();
  if (!email) return false;
  if (!/^approv/i.test(expense?.ApprovalStatus || '')) return false;
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin') return true;
  return email === (expense?.ApproverEmail || '').toLowerCase();
}

/**
 * POST /master-expense/:id/payment
 * `paid: false` reverses a payment recorded in error.
 */
export async function markExpensePaid({
  id,
  updatedBy,
  paid = true,
  reference = '',
  note = '',
}) {
  if (!id) return { success: false, error: 'Missing expense id' };
  if (!updatedBy) return { success: false, error: 'Missing user email' };
  try {
    const res = await fetch(
      `${API_BASE}/master-expense/${encodeURIComponent(id)}/payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UpdatedBy: updatedBy,
          Paid: paid,
          PaymentReference: reference || undefined,
          PaymentNote: note || undefined,
        }),
      }
    );
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* empty body */ }
    if (!res.ok) {
      // The server explains *why* (not approved yet / not enabled for this
      // tenant / not your expense) — surface that rather than a bare status.
      throw new Error(data?.error || text || `Payment update failed (${res.status})`);
    }
    return { success: true, expense: data };
  } catch (error) {
    console.error('markExpensePaid error:', error);
    return { success: false, error: error.message };
  }
}

/** Short label for an expense's payment state, given the tenant's wiring. */
export function paymentLabel(expense, settings) {
  if (isPaid(expense)) {
    const ref = expense?.PaymentInfo?.Reference;
    return { text: ref ? `Paid · ${ref}` : 'Paid', tone: 'paid' };
  }
  if (settings?.sapConnected) return { text: 'Handled by SAP', tone: 'muted' };
  if (/^approv/i.test(expense?.ApprovalStatus || '')) {
    return { text: 'Awaiting payout', tone: 'pending' };
  }
  return { text: '—', tone: 'muted' };
}
