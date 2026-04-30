/**
 * Drop-in replacement for the Base44 SDK client.
 *
 * Provides the same interface used across all pages:
 *   base44.entities.<EntityName>.list(sort?, limit?)
 *   base44.entities.<EntityName>.filter(conditions, sort?, limit?)
 *   base44.entities.<EntityName>.create(data)
 *   base44.entities.<EntityName>.update(id, data)
 *   base44.entities.<EntityName>.delete(id)
 *   base44.auth.me()
 *   base44.auth.logout(redirectUrl?)
 *   base44.auth.redirectToLogin(returnUrl?)
 */

// Empty string = relative URLs (/api/auth/me) — correct for production Nginx setup.
// Set VITE_API_URL=http://localhost:3045 for local dev.
const API_BASE = import.meta.env.VITE_API_URL || '';

// ── Token helpers ─────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('gmt_token');
}

function setToken(token) {
  localStorage.setItem('gmt_token', token);
}

function clearToken() {
  localStorage.removeItem('gmt_token');
}

// ── HTTP helper ───────────────────────────────────────────────
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || err.message || 'API Error');
    error.status = res.status;
    error.data = err;
    throw error;
  }

  return res.json();
}

// ── Entity proxy ──────────────────────────────────────────────
const ENTITY_NAMES = [
  'Application', 'ApplicationBudget', 'ApplicationReview',
  'AuditLog', 'ComplianceFlag', 'Document', 'DocumentTemplate',
  'FundingRequest', 'FundingRequestLineItem', 'GeneratedDocument',
  'Grantee', 'GrantProgram', 'Message', 'Milestone', 'Nofo',
  'Notification', 'Organization', 'ProgressReport', 'ReportSchedule',
  'SavedReport', 'TemplateVersion', 'User', 'WorkflowRule',
];

function createEntityClient(entityName) {
  const base = `/api/entities/${entityName}`;

  return {
    /** list(sort?, limit?) */
    async list(sort, limit) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return api('GET', `${base}${qs ? '?' + qs : ''}`);
    },

    /** filter(conditions, sort?, limit?) */
    async filter(conditions, sort, limit) {
      return api('POST', `${base}/filter`, {
        filter: conditions,
        sort,
        limit,
      });
    },

    /** create(data) — returns the created record */
    async create(data) {
      return api('POST', base, data);
    },

    /** update(id, data) — returns the updated record */
    async update(id, data) {
      return api('PUT', `${base}/${id}`, data);
    },

    /** delete(id) */
    async delete(id) {
      return api('DELETE', `${base}/${id}`);
    },
  };
}

// Build entities map
const entities = {};
for (const name of ENTITY_NAMES) {
  entities[name] = createEntityClient(name);
}

// ── Auth proxy ────────────────────────────────────────────────
const auth = {
  /** Returns the current user object (like base44.auth.me()) */
  async me() {
    return api('GET', '/api/auth/me');
  },

  /** Login with email/password. Stores JWT and returns { user, token }. */
  async login(email, password) {
    const result = await api('POST', '/api/auth/login', { email, password });
    setToken(result.token);
    return result;
  },

  /** Register a new user. Stores JWT and returns { user, token }. */
  async register(email, password, full_name, role) {
    const result = await api('POST', '/api/auth/register', {
      email,
      password,
      full_name,
      role,
    });
    setToken(result.token);
    return result;
  },

  /** Logout — clear token and optionally redirect */
  logout(redirectUrl) {
    clearToken();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  /** Redirect to login page */
  redirectToLogin(returnUrl) {
    const params = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    window.location.href = `/login${params}`;
  },
};

// ── Exported client ───────────────────────────────────────────
export const base44 = { entities, auth };
