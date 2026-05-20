import { useMemo } from 'react';

/**
 * Shared date-range filter — used by LiveOps + Usage sections.
 *
 * Period radio: all | today | week | month | custom.
 *   - today  → [start of today, now]
 *   - week   → [start of today - 6 days, now]
 *   - month  → [start of current month, now]
 *   - all    → no filter (returns rows unchanged)
 *   - custom → [from 00:00, to 23:59]
 *
 * Mirrors the pattern in `admin/AdminCharges.jsx:28-36` and
 * `admin/StaffRevenue.jsx`.
 *
 * Props:
 *   period     'all' | 'today' | 'week' | 'month' | 'custom'
 *   from / to  'YYYY-MM-DD' (only used when period='custom')
 *   onChange({period, from, to})
 *
 * Helpers exported for filtering arrays:
 *   computeRange({period,from,to}) → { start: Date|null, end: Date|null }
 *   inRange(dateLike, {start,end})  → boolean
 */

export function computeRange({ period, from, to }) {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay   = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (period === 'today') return { start: startOfDay(now), end: now };
  if (period === 'week') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { start, end: now };
  }
  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (period === 'custom') {
    const s = from ? startOfDay(new Date(from)) : null;
    const e = to   ? endOfDay(new Date(to))     : null;
    return { start: s, end: e };
  }
  return { start: null, end: null }; // 'all'
}

export function inRange(dateLike, range) {
  if (!range) return true;
  const { start, end } = range;
  if (!start && !end) return true;
  const t = (dateLike instanceof Date) ? dateLike.getTime() : new Date(dateLike).getTime();
  if (Number.isNaN(t)) return false;
  if (start && t < start.getTime()) return false;
  if (end   && t > end.getTime())   return false;
  return true;
}

const OPTIONS = [
  { key: 'all',    label: 'الكل' },
  { key: 'today',  label: 'اليوم' },
  { key: 'week',   label: 'هذا الأسبوع' },
  { key: 'month',  label: 'هذا الشهر' },
  { key: 'custom', label: 'مخصص' },
];

export function DateRangeFilter({ period = 'all', from = '', to = '', onChange }) {
  const range = useMemo(() => computeRange({ period, from, to }), [period, from, to]);

  function setPeriod(p) {
    onChange({ period: p, from, to });
  }
  function setFrom(v) { onChange({ period, from: v, to }); }
  function setTo(v)   { onChange({ period, from, to: v }); }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setPeriod(opt.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
              period === opt.key
                ? 'bg-[var(--p-fg)] text-[var(--p-bg)]'
                : 'bg-[var(--p-bg-muted)] text-[var(--p-fg-muted)] hover:bg-[var(--p-bg-elevated)] hover:text-[var(--p-fg)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] text-[var(--p-fg)] text-sm focus:outline-none focus:border-[var(--p-fg)]"
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] text-[var(--p-fg)] text-sm focus:outline-none focus:border-[var(--p-fg)]"
          />
        </div>
      )}
      {range.start && range.end && period !== 'all' && (
        <p className="text-xs text-[var(--p-fg-muted)] tabular-nums" dir="ltr">
          {range.start.toLocaleDateString('ar-EG')} → {range.end.toLocaleDateString('ar-EG')}
        </p>
      )}
    </div>
  );
}
