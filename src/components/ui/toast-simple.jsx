/**
 * Simple in-app toast — replaces browser alert().
 * Usage:
 *   import { toast } from '@/components/ui/toast-simple';
 *   toast('Message here');
 *   toast('Error!', 'error');
 *   toast('Saved!', 'success');
 */
import { createRoot } from 'react-dom/client';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const COLORS = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const ICON_COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

function ToastItem({ message, type = 'info', onClose }) {
  const Icon = ICONS[type] || Info;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full ${COLORS[type]} animate-in slide-in-from-right-5 duration-200`}>
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${ICON_COLORS[type]}`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Container singleton
let container = null;
let root = null;
let toasts = [];
let idCounter = 0;

function render() {
  if (!root) return;
  root.render(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem message={t.message} type={t.type} onClose={() => remove(t.id)} />
        </div>
      ))}
    </div>
  );
}

function remove(id) {
  toasts = toasts.filter(t => t.id !== id);
  render();
}

export function toast(message, type = 'info', durationMs = 4000) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  const id = ++idCounter;
  toasts = [...toasts, { id, message, type }];
  render();
  if (durationMs > 0) setTimeout(() => remove(id), durationMs);
}
