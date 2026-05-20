import { useMemo, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { exportCSV } from '../../../../utils';
import { Card, Button, EmptyState, Badge } from '../../../../portal';
import { DateRangeFilter, computeRange, inRange } from '../components/DateRangeFilter';

function fmtBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = b / 1024;
  for (const u of units) {
    if (v < 1024) return `${v.toFixed(v >= 100 ? 0 : 1)} ${u}`;
    v /= 1024;
  }
  return `${v.toFixed(1)} PB`;
}

const SORTS = [
  { key: 'total', label: 'الإجمالي' },
  { key: 'down',  label: 'التحميل' },
  { key: 'up',    label: 'الرفع' },
  { key: 'days',  label: 'الأيام' },
];

/**
 * Usage Section — per-user bandwidth ledger.
 *
 * Reads `wifi_usage_logs` (one row per username/day) via shared store,
 * filters by date range, groups by username, joins to studentByCode
 * for display name. CSV export reflects the filtered+sorted view.
 *
 * Data is written by `mikrotik-bridge-v2/watchers/usage-aggregator.js`
 * (5-min flush). First production reader of this table.
 */
export function UsageSection({ usageLogs, studentByCode, toast }) {
  const [filter, setFilter] = useState({ period: 'month', from: '', to: '' });
  const [sortKey, setSortKey] = useState('total');

  const range = useMemo(() => computeRange(filter), [filter]);

  // Aggregate per-username across the filtered rows.
  const rows = useMemo(() => {
    const filtered = (usageLogs || []).filter(r => inRange(r.date, range));
    const m = new Map();
    for (const r of filtered) {
      const u = String(r.username || '').trim();
      if (!u) continue;
      if (!m.has(u)) m.set(u, { username: u, bytesIn: 0, bytesOut: 0, days: new Set(), sessions: 0 });
      const e = m.get(u);
      e.bytesIn  += Number(r.bytesIn  || 0);
      e.bytesOut += Number(r.bytesOut || 0);
      e.sessions += Number(r.sessionsCount || 0);
      if (r.date) e.days.add(r.date);
    }
    const list = Array.from(m.values()).map(e => ({
      ...e,
      total: e.bytesIn + e.bytesOut,
      days:  e.days.size,
    }));
    const cmp = {
      total: (a, b) => b.total - a.total,
      down:  (a, b) => b.bytesIn - a.bytesIn,
      up:    (a, b) => b.bytesOut - a.bytesOut,
      days:  (a, b) => b.days - a.days,
    }[sortKey] || ((a, b) => b.total - a.total);
    return list.sort(cmp);
  }, [usageLogs, range, sortKey]);

  const totals = useMemo(() => {
    let bytesIn = 0; let bytesOut = 0;
    for (const r of rows) { bytesIn += r.bytesIn; bytesOut += r.bytesOut; }
    return { bytesIn, bytesOut, users: rows.length };
  }, [rows]);

  function nameFor(username) {
    const s = studentByCode?.get(String(username || '').trim());
    return s?.name || '';
  }

  function handleExport() {
    if (rows.length === 0) { toast?.('info', 'لا توجد بيانات للتصدير'); return; }
    const data = [
      ['الاسم', 'الكود', 'التحميل (بايت)', 'الرفع (بايت)', 'الإجمالي (بايت)', 'الأيام'],
      ...rows.map(r => [
        nameFor(r.username) || (r.username.startsWith('WIFI-') ? 'قسيمة' : ''),
        r.username,
        r.bytesIn,
        r.bytesOut,
        r.total,
        r.days,
      ]),
    ];
    const label = filter.period === 'all' ? 'all' :
                  filter.period === 'custom' ? `${filter.from || 'start'}_${filter.to || 'now'}` :
                  filter.period;
    exportCSV(`wifi-usage-${label}.csv`, data);
  }

  return (
    <div className="space-y-4">
      <DateRangeFilter
        period={filter.period}
        from={filter.from}
        to={filter.to}
        onChange={setFilter}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Mini label="مستخدمون" value={totals.users} />
        <Mini label="إجمالي التحميل" value={fmtBytes(totals.bytesIn)} />
        <Mini label="إجمالي الرفع" value={fmtBytes(totals.bytesOut)} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSortKey(s.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                sortKey === s.key
                  ? 'bg-[var(--p-accent)] text-white'
                  : 'bg-[var(--p-bg-muted)] text-[var(--p-fg-muted)] hover:bg-[var(--p-bg-elevated)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" iconStart={<Download size={14} strokeWidth={2.5} />} onClick={handleExport}>
          تصدير CSV
        </Button>
      </div>

      <Card padding="none">
        {rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="لا توجد بيانات استهلاك"
            body="ينقل الجسر v2 إحصائيات الاستهلاك إلى Supabase كل 5 دقائق. بعد فترة من الاستخدام ستظهر هنا الأرقام."
          />
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {rows.map(r => (
              <div key={r.username} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--p-fg)] text-sm truncate">
                    {nameFor(r.username) || (r.username.startsWith('WIFI-') ? 'قسيمة' : `#${r.username}`)}
                  </p>
                  <p className="text-xs text-[var(--p-fg-muted)] truncate tabular-nums" dir="ltr">
                    #{r.username}
                  </p>
                </div>
                <Badge variant="neutral" size="sm">{r.days} يوم</Badge>
                <div className="hidden sm:flex flex-col items-end shrink-0 tabular-nums" dir="ltr">
                  <span className="text-xs text-[var(--p-fg-muted)]">{fmtBytes(r.bytesIn)} ↓</span>
                  <span className="text-xs text-[var(--p-fg-muted)]">{fmtBytes(r.bytesOut)} ↑</span>
                </div>
                <div className="text-end shrink-0 min-w-[80px]">
                  <p className="font-bold text-[var(--p-fg)] text-sm tabular-nums" dir="ltr">{fmtBytes(r.total)}</p>
                  <p className="text-[10px] text-[var(--p-fg-muted)] uppercase tracking-wider">الإجمالي</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-2xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] p-3">
      <p className="label-eyebrow text-[var(--p-fg-muted)]">{label}</p>
      <p className="font-black text-[var(--p-fg)] text-lg tabular-nums mt-1" dir="ltr">{value}</p>
    </div>
  );
}
