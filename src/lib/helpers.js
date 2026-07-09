import moment from 'moment';

export function formatCurrency(amount) {
  const num = Number(amount);
  if (amount == null || isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

// Safe numeric coercion - always returns a number, never NaN or concatenated string
export function toNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function formatDate(date) {
  if (!date) return '-';
  // Fast path: if it's YYYY-MM-DD or starts with it, parse directly
  const str = String(date);
  if (str.length >= 10) {
    const d = new Date(str.substring(0, 10) + 'T12:00:00Z');
    if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }
  return moment.utc(date).format('MMMM DD, YYYY');
}

export function formatDateShort(date) {
  if (!date) return '-';
  // Fast path: strip time component directly from string to avoid timezone issues
  const str = String(date);
  if (str.length >= 10) {
    const d = new Date(str.substring(0, 10) + 'T12:00:00Z');
    if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }
  return moment.utc(date).format('MMM DD, YYYY');
}

export function isStateUser(role) {
  return role === 'admin' || role === 'reviewer' || role === 'federal_admin' || role === 'federal_officer';
}

export function isAdmin(role) {
  return role === 'admin' || role === 'federal_admin';
}

export function isSubrecipient(role) {
  return role === 'user';
}

export const STATUS_CONFIG = {
  Draft: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
  Submitted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  PendingReview: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  UnderReview: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  RevisionRequested: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-600' },
  Approved: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  Denied: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  Published: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  Closed: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
  Archived: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
  Pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  Overdue: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  AdditionalInfoRequested: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-600' },
};

export const SEVERITY_CONFIG = {
  Low: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  Medium: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  High: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  Critical: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-600' },
};

export async function logAudit(base44, user, action, entityType, entityId, description) {
  await base44.entities.AuditLog.create({
    user_email: user?.email || 'system',
    user_name: user?.full_name || 'System',
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
  });
}

export async function createNotification(base44, userEmail, title, message, type, entityType, entityId, link) {
  await base44.entities.Notification.create({
    user_email: userEmail,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
    is_read: false,
    link,
  });
}