import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Collapsible section wrapper used by every Phase 5 console section.
 *
 * Open/closed state persists per-section in localStorage under
 * `netv2-section-<id>` so admins keep their preferred layout across
 * page reloads. `defaultOpen` only applies when no preference is set.
 */
export function SectionCard({ id, title, subtitle, defaultOpen = false, children }) {
  const key = `netv2-section-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch (_) {}
    return defaultOpen;
  });

  useEffect(() => {
    try { localStorage.setItem(key, open ? '1' : '0'); } catch (_) {}
  }, [key, open]);

  return (
    <section className="rounded-3xl border-2 border-[var(--p-border)] bg-[var(--p-bg-elevated)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={`section-body-${id}`}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 hover:bg-[var(--p-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-ring)] transition-colors cursor-pointer text-start"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-black text-[var(--p-fg)] text-lg sm:text-xl tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[var(--p-fg-muted)] mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <span
          aria-hidden="true"
          className="w-9 h-9 shrink-0 rounded-full bg-[var(--p-bg-muted)] flex items-center justify-center text-[var(--p-fg-muted)]"
        >
          {open ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
        </span>
      </button>

      {open && (
        <div id={`section-body-${id}`} className="p-4 sm:p-5 pt-0">
          <div className="border-t border-[var(--p-border)] pt-4 sm:pt-5">
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
