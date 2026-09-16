// Per-tenant master data — everything that must NOT be hardcoded in the app.
//
//   getTenantCategories(slug)  → GET /categories?slug=      (tenant's own list)
//   getCategoryGlCode(...)     → GL account for a category  (from the same list)
//   getTenantSapConfig(slug)   → GET /integrations/:slug     (SAP on/off + URL)
//   getEmployeeDefaults(email) → GET /auth/me                (company/vendor/…)
//
// Why this exists: the app used to hardcode one customer's SAP master data —
// CompanyCode "1000", VendorCode "0000100401", CostCenter "1000COIT02",
// GLCode "40203061", SectionCode "1000", BusinessPlace "MH01" — plus a fixed
// three-item category list. Every tenant's expenses were stamped with those
// values regardless of who they belonged to. All of it now resolves per tenant,
// and falls back to empty rather than to another company's codes.

import { BASE_URL } from '@env';

const API_BASE = BASE_URL || 'http://localhost:5000';

// Master data changes rarely; cache per key for the app session.
const cache = new Map();
const inflight = new Map();

async function cached(key, loader) {
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const value = await loader();
      cache.set(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Drop cached master data (e.g. after an admin edits categories). */
export function clearTenantMasterData(slug) {
  if (!slug) { cache.clear(); return; }
  for (const k of [...cache.keys()]) {
    if (k.endsWith(`:${slug}`)) cache.delete(k);
  }
}

/**
 * The tenant's expense categories, as configured in the dashboard.
 * Returns [] when the tenant has none — callers should then let the user type
 * a category rather than showing another tenant's list.
 */
export async function getTenantCategories(slug) {
  if (!slug) return [];
  return cached(`categories:${slug}`, async () => {
    try {
      const res = await fetch(`${API_BASE}/categories?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) return [];
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) ? rows.filter((c) => c?.enabled !== false) : [];
    } catch (e) {
      console.warn('getTenantCategories failed:', e?.message);
      return [];
    }
  });
}

/** Dropdown options built from the tenant's own categories. */
export function categoryOptions(categories) {
  return [
    { label: 'Select Category', value: '' },
    ...(categories || []).map((c) => ({ label: c.name, value: c.name })),
  ];
}

/**
 * Sub-category options for a parent category.
 *
 * Tenant categories are a flat list, and the sub-category convention in the
 * data is "<Parent>-<Child>" (e.g. "Local Conveyance-Two Wheeler"). So the
 * children are derived from the tenant's own categories rather than a fixed
 * map. A tenant that defines no children simply gets the placeholder, and
 * sub-category stays optional.
 */
export function subCategoryOptions(categories, parentName) {
  const placeholder = [{ label: 'Select Sub-Category', value: '' }];
  const parent = String(parentName || '').trim().toLowerCase();
  if (!parent) return placeholder;
  const children = (categories || []).filter((c) =>
    String(c.name || '').trim().toLowerCase().startsWith(`${parent}-`)
  );
  return [...placeholder, ...children.map((c) => ({ label: c.name, value: c.name }))];
}

/**
 * Category to use for a conveyance / non-bill claim when the UI doesn't ask.
 * Prefers a conveyance-looking category from the tenant's own list, else the
 * first one. Returns '' when the tenant has configured none — the caller should
 * then surface that instead of inventing a category name.
 */
export function defaultConveyanceCategory(categories) {
  const list = (categories || []).filter((c) => !String(c.name || '').includes('-'));
  const conveyance = list.find((c) => /conveyance|travel|transport/i.test(c.name || ''));
  return (conveyance || list[0])?.name || '';
}

/** GL account configured for a category name; '' when not mapped. */
export function getCategoryGlCode(categories, name) {
  if (!name) return '';
  const key = String(name).trim().toLowerCase();
  const hit = (categories || []).find(
    (c) => String(c.name || '').trim().toLowerCase() === key
  );
  return hit?.glAccount || '';
}

/** Does this category still require a bill? Defaults to true (safer). */
export function categoryRequiresBill(categories, name) {
  if (!name) return true;
  const key = String(name).trim().toLowerCase();
  const hit = (categories || []).find(
    (c) => String(c.name || '').trim().toLowerCase() === key
  );
  return hit ? hit.requiresBill !== false : true;
}

/**
 * The tenant's SAP integration: whether it's on, and the endpoint to use.
 * `enabled: false` means this tenant has no SAP at all — callers must skip any
 * SAP call rather than falling back to some other tenant's host.
 */
export async function getTenantSapConfig(slug) {
  if (!slug) return { enabled: false, baseUrl: '' };
  return cached(`sap:${slug}`, async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/${encodeURIComponent(slug)}`);
      if (!res.ok) return { enabled: false, baseUrl: '' };
      const data = await res.json().catch(() => null);
      return {
        enabled: !!data?.sap?.enabled,
        baseUrl: data?.sap?.baseUrl || '',
        companyCode: data?.sap?.companyCode || '',
        glAccount: data?.sap?.glAccount || '',
        costCenter: data?.sap?.costCenter || '',
        taxCode: data?.sap?.taxCode || '',
      };
    } catch (e) {
      console.warn('getTenantSapConfig failed:', e?.message);
      return { enabled: false, baseUrl: '' };
    }
  });
}

/**
 * SAP posting fields for this employee, from their own employees row.
 * Every field falls back to '' — never to another company's code.
 */
export async function getEmployeeDefaults(email) {
  if (!email) return {};
  return cached(`employee:${email.toLowerCase()}`, async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me?email=${encodeURIComponent(email)}`);
      if (!res.ok) return {};
      const data = await res.json().catch(() => null);
      const u = data?.user || {};
      return {
        CompanyCode: u.companyCode || '',
        VendorCode: u.vendorCode || '',
        CostCenter: u.costCenter || '',
        SectionCode: u.sectionCode || '',
        EmployeeId: u.employeeId || '',
        Grade: u.grade || '',
        Tenant: u.tenantSlug || u.tenant || '',
      };
    } catch (e) {
      console.warn('getEmployeeDefaults failed:', e?.message);
      return {};
    }
  });
}

/**
 * Resolve the SAP posting fields for one expense line, in priority order:
 *   OCR//engine value → employee record → tenant SAP config → ''
 * Never substitutes a hardcoded customer-specific code.
 */
export function resolveSapFields({ fromOcr = {}, employee = {}, sap = {}, categories, category }) {
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };
  return {
    CompanyCode: pick(fromOcr.CompanyCode, employee.CompanyCode, sap.companyCode),
    VendorCode: pick(fromOcr.VendorCode, employee.VendorCode),
    SectionCode: pick(fromOcr.SectionCode, employee.SectionCode),
    CostCenter: pick(fromOcr.CostCenter, employee.CostCenter, sap.costCenter),
    GLCode: pick(fromOcr.GLCode, getCategoryGlCode(categories, category), sap.glAccount),
    TaxCode: pick(fromOcr.TaxCode, sap.taxCode),
  };
}
