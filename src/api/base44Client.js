import {createGanReturnsClient} from './ganReturns';
import {createGanWorkflowClient} from './ganWorkflow';
import {createGanPackageClient} from './ganPackages';
import {createGanSettingsClient} from './ganSettings';
import {createGanBatchClient} from './ganBatches';
import {createAwardDetailsClient} from './awardDetails';
import {createEhpClient} from './ehp';
import {createNofoFormsClient} from './nofoForms';
import { createAccountAccessClient } from './accountAccess';
import { createUploadClient } from './uploads';
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

// Empty string = relative URLs (/api/auth/me) - correct for production Nginx setup.
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
  'AppSettings', 'AuditLog', 'BudgetAmendment', 'ComplianceFlag', 'ReviewComment',
  'Credit', 'CreditApplication', 'Document', 'DocumentTemplate',
  'FundingRequest', 'FundingRequestLineItem', 'GeneratedDocument',
  'Grantee', 'GrantProgram', 'Message', 'Milestone', 'Nofo',
  'Notification', 'Organization', 'ProgressReport', 'ReportSchedule',
  'SavedReport', 'Task', 'TemplateVersion', 'User', 'WorkflowRule',
];

function createEntityClient(entityName) {
  const base = `/api/entities/${entityName}`;

  return {
    /** list(sort?, limit?) */
    async list(sort, limit, options) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      Object.entries(options || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)); });
      const qs = params.toString();
      return api('GET', `${base}${qs ? '?' + qs : ''}`).catch(e => { console.warn('[GMT] list', entityName, e.message); return []; });
    },

    /** filter(conditions, sort?, limit?) */
    async filter(conditions, sort, limit) {
      return api('POST', `${base}/filter`, {
        filter: conditions,
        sort,
        limit,
      }).catch(e => { console.warn('[GMT] filter', entityName, e.message); return []; });
    },

    /** create(data) - returns the created record */
    async create(data, options) {
      const query = new URLSearchParams(options || {}).toString();
      return api('POST', base + (query ? '?' + query : ''), data);
    },

    /** update(id, data) - returns the updated record */
    async update(id, data, options) {
      const query = new URLSearchParams(options || {}).toString();
      return api('PUT', base + '/' + id + (query ? '?' + query : ''), data);
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
// Cache the current user so repeated me() calls within one session don't
// cause flicker - the first real request populates the cache.
let _cachedUser = null;
function invalidateUserCache() { _cachedUser = null; }

const auth = {
  /** Returns the current user object (like base44.auth.me()). Cached per session. */
  async me() {
    if (_cachedUser) return _cachedUser;
    _cachedUser = await api('GET', '/api/auth/me');
    return _cachedUser;
  },

  /** Login with email/password. Stores JWT and returns { user, token }. */
  async login(email, password) {
    const result = await api('POST', '/api/auth/login', { email, password });
    setToken(result.token);
    // Pre-populate the user cache so subsequent me() calls return instantly
    if (result.user) _cachedUser = result.user;
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

  async updateMe(input) {
    const result=await api('PUT','/api/auth/me',input);_cachedUser=result;return result;
  },

  /** Logout - clear token, clear user cache, optionally redirect */
  logout(redirectUrl) {
    clearToken();
    invalidateUserCache();
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

// -- Integrations stub ------------------------------------------------
// Base44 pages call base44.integrations.Core.SendEmail() etc.
// We stub these so they don't throw -- email/integrations are not active.
const integrations = {
  Core: {
    SendEmail: async (opts) => { console.log('[GMT] Email stub (not sent):', opts); return {}; },
    ...createUploadClient(API_BASE,getToken),
    GeneratePDF: async (opts) => { console.log('[GMT] PDF stub:', opts); return {}; },
  },
};
export const base44 = { ganReturns:createGanReturnsClient(API_BASE,getToken), ganWorkflow:createGanWorkflowClient(api,API_BASE,getToken), entities, auth, integrations, accounts:createAccountAccessClient(api), forms:createNofoFormsClient(api), ehp:createEhpClient(api), awards:createAwardDetailsClient(api), gan:createGanBatchClient(api,API_BASE,getToken), ganSettings:createGanSettingsClient(api), ganPackages:createGanPackageClient(api,API_BASE,getToken) };
