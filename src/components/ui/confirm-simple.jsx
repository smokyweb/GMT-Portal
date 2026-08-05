/**
 * Inline confirmation helper — replaces await confirmAction().
 * Shows a small confirm bar above the triggering element.
 *
 * Usage (imperative via promise):
 *   import { confirmAction } from '@/components/ui/confirm-simple';
 *   const ok = await confirmAction('Delete this item?');
 *   if (ok) { ... }
 */
import { createRoot } from 'react-dom/client';

export function confirmAction(message) {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center';
    document.body.appendChild(container);

    const root = createRoot(container);
    const cleanup = (result) => {
      root.unmount();
      document.body.removeChild(container);
      resolve(result);
    };

    root.render(
      <div className="bg-white rounded-xl shadow-xl border p-6 max-w-sm w-full mx-4 space-y-4">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => cleanup(false)}
            className="px-4 py-2 text-sm rounded-lg border border-input bg-background hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            onClick={() => cleanup(true)}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium"
          >
            OK
          </button>
        </div>
      </div>
    );
  });
}
