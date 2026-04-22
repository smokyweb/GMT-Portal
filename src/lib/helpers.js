import moment from 'moment';

export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date) {
  if (!date) return '—';
  return moment(date).format('MMMM DD, YYYY');
}

export function formatDateShort(date) {
  if (!date) return '—';
  return moment(date).format('MMM DD, YYYY');
}

export function isStateUser(role) {
  return role === 'admin' || role === 'reviewer';
}

export function isAdmin(role) {
  return role === 'admin';
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