import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Smartphone, Users, ArrowDown, ArrowUp, RefreshCw, WifiOff, Ban,
} from 'lucide-react';
import {
  mtkV2GetDevices, mtkV2KickByIdV2, mtkV2KickSession, mtkV2BanMac,
  logWifiEvent,
} from '../../../../lib/mikrotikApi';
import { Button, Badge, Card, EmptyState, Spinner } from '../../../../portal';

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

/**
 * Live Ops section — the heart of the redesigned console.
 *
 * Two stacked tables:
 *   1. Active devices  — one row per MAC, shows student.name + member# + bytes
 *   2. Active users    — one row per unique username (member_number)
 *
 * Joins MikroTik live data to Supabase `students` via `studentByCode`
 * (built by the parent Console).
 *
 * KPI strip mirrors what the OverviewTab used to render but now reads
 * the same SSE-refreshed device list as the tables (single source of
 * truth for the section).
 */
export function LiveOpsSection({
  t, user, config, sse, studentByCode, toast,
}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId]   = useState('');

  const load = useCallback(async () => {
    if (!config?.bridgeUrlV2) { setDevices([]); return; }
    setLoading(true);
    const r = await mtkV2GetDevices(config).catch(() => null);
    setLoading(false);
    setDevices(r?.ok && Array.isArray(r.devices) ? r.devices : []);
  }, [config]);

  // Initial load + 10s poll + SSE bump on every event.
  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const lastEvent = sse?.lastEvent;
  useEffect(() => { if (lastEvent) load(); }, [lastEvent, load]);

  // KPI aggregates from the same device list shown below.
  const kpis = useMemo(() => {
    const list = devices || [];
    let bytesIn = 0;
    let bytesOut = 0;
    const usernames = new Set();
    for (const d of list) {
      bytesIn  += Number(d.bytesIn  || 0);
      bytesOut += Number(d.bytesOut || 0);
      if (d.username) usernames.add(d.username);
    }
    return { devicesCount: list.length, usersCount: usernames.size, bytesIn, bytesOut };
  }, [devices]);

  // User rollup (one row per username with totals).
  const userRows = useMemo(() => {
    const m = new Map();
    for (const d of devices || []) {
      const u = d.username || '—';
      if (!m.has(u)) m.set(u, { username: u, deviceCount: 0, bytesIn: 0, bytesOut: 0 });
      const r = m.get(u);
      r.deviceCount += 1;
      r.bytesIn  += Number(d.bytesIn  || 0);
      r.bytesOut += Number(d.bytesOut || 0);
    }
    return Array.from(m.values()).sort((a, b) => (b.bytesIn + b.bytesOut) - (a.bytesIn + a.bytesOut));
  }, [devices]);

  function nameFor(username) {
    const s = studentByCode?.get(String(username || '').trim());
    return s?.name || '';
  }

  async function kickDevice(d) {
    setBusyId(d.id);
    const r = await mtkV2KickByIdV2(config, d.id);
    setBusyId('');
    if (r?.ok) {
      toast?.('success', 'تم فصل الجهاز');
      logWifiEvent('device_kicked', d.username || '', { mac: d.mac, sessionId: d.id }, user?.id, user?.name);
      setDevices(prev => prev.filter(x => x.id !== d.id));
    } else {
      toast?.('error', r?.error || 'فشل الفصل');
    }
  }

  async function banDevice(d) {
    if (!d.mac) return;
    if (!window.confirm(`حظر MAC ${d.mac}؟ سيتم فصله ومنعه من الاتصال مرة أخرى.`)) return;
    setBusyId(d.id);
    const r = await mtkV2BanMac(config, d.mac);
    setBusyId('');
    if (r?.ok) {
      toast?.('success', `تم حظر ${d.mac}`);
      logWifiEvent('device_banned', d.username || '', { mac: d.mac, kicked: r.kicked }, user?.id, user?.name);
      setDevices(prev => prev.filter(x => x.mac !== d.mac));
    } else {
      toast?.('error', r?.error || 'فشل الحظر');
    }
  }

  async function kickUser(u) {
    setBusyId(u.username);
    const r = await mtkV2KickSession(config, u.username);
    setBusyId('');
    if (r?.ok) {
      toast?.('success', `تم فصل ${u.deviceCount} جلسة لـ ${u.username}`);
      logWifiEvent('user_kicked', u.username, { kicked: r.kicked }, user?.id, user?.name);
      setDevices(prev => prev.filter(x => x.username !== u.username));
    } else {
      toast?.('error', r?.error || 'فشل الفصل');
    }
  }

  if (!config?.bridgeUrlV2) {
    return (
      <Card padding="none">
        <EmptyState
          icon={WifiOff}
          title="جسر v2 غير متصل"
          body="اضبط رابط الجسر v2 ومفتاحه في الإعدادات حتى يبدأ النشاط المباشر بالظهور."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi icon={Smartphone} label="الأجهزة" value={kpis.devicesCount} />
        <Kpi icon={Users} label="المستخدمون" value={kpis.usersCount} />
        <Kpi icon={ArrowDown} label="التحميل" value={fmtBytes(kpis.bytesIn)} />
        <Kpi icon={ArrowUp} label="الرفع" value={fmtBytes(kpis.bytesOut)} />
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" iconStart={<RefreshCw size={14} strokeWidth={2.5} />} onClick={load}>
          تحديث
        </Button>
      </div>

      {/* Active devices */}
      <div>
        <p className="label-eyebrow text-[var(--p-fg-muted)] mb-2">الأجهزة المتصلة الآن</p>
        <Card padding="none">
          {loading && devices.length === 0 ? (
            <div className="p-6 flex justify-center"><Spinner /></div>
          ) : devices.length === 0 ? (
            <EmptyState icon={Smartphone} title="لا توجد أجهزة الآن" body="ستظهر هنا الأجهزة المتصلة بالـ WiFi مباشرة." />
          ) : (
            <div className="divide-y divide-[var(--p-border)]">
              {devices.map(d => (
                <div key={d.id || d.mac} className="flex items-center gap-3 p-3 sm:p-4">
                  <span className="w-9 h-9 rounded-xl bg-[var(--p-bg-muted)] flex items-center justify-center text-[var(--p-fg-soft)] shrink-0">
                    <Smartphone size={16} strokeWidth={2.25} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--p-fg)] text-sm truncate">
                      {nameFor(d.username) || (d.username ? `#${d.username}` : '—')}
                    </p>
                    <p className="text-xs text-[var(--p-fg-muted)] truncate tabular-nums" dir="ltr">
                      {d.mac || '?'} · {d.ip || '?'} · {d.uptime || '0s'}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end shrink-0 tabular-nums" dir="ltr">
                    <span className="text-xs text-[var(--p-fg-muted)]">{fmtBytes(d.bytesIn)} ↓</span>
                    <span className="text-xs text-[var(--p-fg-muted)]">{fmtBytes(d.bytesOut)} ↑</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" iconStart={<WifiOff size={12} strokeWidth={2.5} />}
                      onClick={() => kickDevice(d)} disabled={busyId === d.id}>
                      فصل
                    </Button>
                    <Button size="sm" variant="ghost" iconStart={<Ban size={12} strokeWidth={2.5} />}
                      onClick={() => banDevice(d)} disabled={busyId === d.id}>
                      حظر
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Active users */}
      <div>
        <p className="label-eyebrow text-[var(--p-fg-muted)] mb-2">المستخدمون المتصلون الآن</p>
        <Card padding="none">
          {userRows.length === 0 ? (
            <EmptyState icon={Users} title="لا يوجد مستخدمون نشطون" body="عند اتصال أي طالب أو ضيف بالشبكة سيظهر هنا." />
          ) : (
            <div className="divide-y divide-[var(--p-border)]">
              {userRows.map(u => (
                <div key={u.username} className="flex items-center gap-3 p-3 sm:p-4">
                  <span className="w-9 h-9 rounded-xl bg-[var(--p-bg-muted)] flex items-center justify-center text-[var(--p-fg-soft)] shrink-0">
                    <Users size={16} strokeWidth={2.25} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--p-fg)] text-sm truncate">
                      {nameFor(u.username) || (u.username.startsWith('WIFI-') ? 'قسيمة' : `#${u.username}`)}
                    </p>
                    <p className="text-xs text-[var(--p-fg-muted)] truncate tabular-nums" dir="ltr">
                      #{u.username}
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm">{u.deviceCount} جهاز</Badge>
                  <div className="hidden sm:flex flex-col items-end shrink-0 tabular-nums" dir="ltr">
                    <span className="text-xs text-[var(--p-fg-muted)]">{fmtBytes(u.bytesIn)} ↓</span>
                    <span className="text-xs text-[var(--p-fg-muted)]">{fmtBytes(u.bytesOut)} ↑</span>
                  </div>
                  <Button size="sm" variant="ghost" iconStart={<WifiOff size={12} strokeWidth={2.5} />}
                    onClick={() => kickUser(u)} disabled={busyId === u.username}>
                    فصل الكل
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border-2 border-[var(--p-border)] bg-[var(--p-bg-elevated)] p-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-[var(--p-bg-muted)] flex items-center justify-center text-[var(--p-fg-soft)] shrink-0">
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="label-eyebrow text-[var(--p-fg-muted)] truncate">{label}</p>
        <p className="font-black text-[var(--p-fg)] text-lg tabular-nums truncate" dir="ltr">{value}</p>
      </div>
    </div>
  );
}
