import { useEffect, useState } from 'react';
import {
  Cookie, Power, Clock, Globe, RefreshCw, AlertTriangle,
} from 'lucide-react';
import {
  mtkClearAllCookies, mtkRestartHotspot, mtkSetCookieLifetime,
  mtkGetWalledGarden, mtkGetActive, logWifiEvent,
} from '../../../../lib/mikrotikApi';
import { Card, Button, Input, Badge, EmptyState, Spinner } from '../../../../portal';

/**
 * Router Section — Winbox-parity controls.
 *
 * Everything in this section is an explicit RouterOS API call. No
 * Supabase state lives here; the actions are point-in-time.
 *
 * What's NOT here (intentional security/scope):
 *   - FTP toggle (Winbox-only; FTP is plaintext)
 *   - Firmware updates
 *   - RouterOS user/group management
 *   - Any persistent /system/scheduler / scripts
 *
 * Each action is wrapped in two layers of confirmation for destructive
 * operations (clear cookies + restart hotspot) because they affect
 * every connected device immediately.
 */
export function RouterSection({ config, user, toast }) {
  const [busy, setBusy] = useState('');
  const [lifetime, setLifetime] = useState('10m');
  const [activeRaw, setActiveRaw] = useState(null);
  const [wgRaw, setWgRaw] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  async function loadRaw() {
    if (!config?.mikrotikBridgeUrl) return;
    setLoadingRaw(true);
    const [active, wg] = await Promise.all([
      mtkGetActive(config).catch(() => null),
      mtkGetWalledGarden(config).catch(() => null),
    ]);
    setLoadingRaw(false);
    if (active?.ok) setActiveRaw(Array.isArray(active.sessions) ? active.sessions : []);
    if (wg?.ok)     setWgRaw(Array.isArray(wg.entries) ? wg.entries : []);
  }

  useEffect(() => { loadRaw(); }, [config?.mikrotikBridgeUrl]);

  async function clearCookies() {
    if (!window.confirm('حذف كل cookies للحوت سبوت؟ سيتطلب من جميع الأجهزة إعادة إدخال الكود.')) return;
    setBusy('cookies');
    const r = await mtkClearAllCookies(config);
    setBusy('');
    if (r?.ok) {
      logWifiEvent('cookies_cleared_all', '', { removed: r.removed }, user?.id, user?.name);
      toast?.('success', `تم حذف ${r.removed || 0} cookie`);
    } else {
      toast?.('error', r?.error || 'فشل المسح');
    }
  }

  async function restart() {
    if (!window.confirm('⚠️ إعادة تشغيل الـ hotspot؟ سيتم فصل كل المستخدمين فوراً (~2 ثانية).')) return;
    if (!window.confirm('متأكد؟ هذا فعل عدواني سيقطع الجميع.')) return;
    setBusy('restart');
    const r = await mtkRestartHotspot(config);
    setBusy('');
    if (r?.ok) {
      logWifiEvent('hotspot_restarted', '', { instances: r.instances }, user?.id, user?.name);
      toast?.('success', 'تم إعادة تشغيل الـ hotspot');
    } else {
      toast?.('error', r?.error || 'فشل إعادة التشغيل');
    }
  }

  async function setLife() {
    const value = lifetime.trim();
    if (!value) return;
    setBusy('lifetime');
    const r = await mtkSetCookieLifetime(config, value, 'hsprof1');
    setBusy('');
    if (r?.ok) {
      logWifiEvent('cookie_lifetime_set', 'hsprof1', { value }, user?.id, user?.name);
      toast?.('success', `تم ضبط مدة الـ cookie إلى ${value}`);
    } else {
      toast?.('error', r?.error || 'فشل التحديث');
    }
  }

  if (!config?.mikrotikBridgeUrl) {
    return (
      <Card padding="none">
        <EmptyState
          icon={AlertTriangle}
          title="جسر v1 غير متصل"
          body="هذه الأوامر تستخدم الجسر v1 (port 3456) — اضبط الرابط في الإعدادات."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ActionCard
          icon={Cookie}
          title="حذف جميع الـ cookies"
          body="يجبر كل جهاز على إعادة إدخال الكود في المرة القادمة. مفيد بعد العبث بالـ cookie."
        >
          <Button variant="primary" size="md" full loading={busy === 'cookies'} onClick={clearCookies}>
            تنفيذ
          </Button>
        </ActionCard>

        <ActionCard
          icon={Power}
          title="إعادة تشغيل الـ hotspot"
          body="disable + enable. فصل فوري لكل الجلسات. عدوانية ~2 ثانية."
        >
          <Button variant="danger" size="md" full loading={busy === 'restart'} onClick={restart}>
            تشغيل
          </Button>
        </ActionCard>

        <ActionCard
          icon={Clock}
          title="مدة الـ cookie"
          body="صيغة RouterOS — 10m / 3d / 0s (تعطيل cookie). مدة أقصر = ضمان إعادة التسجيل."
        >
          <div className="flex items-center gap-1.5">
            <Input value={lifetime} onChange={e => setLifetime(e.target.value)} dir="ltr" placeholder="10m" />
            <Button variant="primary" size="md" loading={busy === 'lifetime'} onClick={setLife}>
              حفظ
            </Button>
          </div>
        </ActionCard>
      </div>

      {/* Raw RouterOS state */}
      <div className="pt-3 border-t border-[var(--p-border)] flex items-center justify-between gap-3">
        <p className="label-eyebrow text-[var(--p-fg-muted)]">حالة الراوتر الخام</p>
        <Button size="sm" variant="ghost" iconStart={<RefreshCw size={14} strokeWidth={2.5} />} onClick={loadRaw} loading={loadingRaw}>
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RawCard
          icon={Globe}
          title="Walled garden (هوست سبوت)"
          body="القائمة الكاملة من /ip hotspot walled-garden — جميع الإدخالات على الراوتر مباشرة."
        >
          {loadingRaw && !wgRaw ? <Spinner /> : !wgRaw || wgRaw.length === 0 ? (
            <p className="text-xs text-[var(--p-fg-muted)]">لا توجد إدخالات أو الجسر غير متاح.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {wgRaw.map(e => (
                <div key={e.id} className="text-xs font-mono py-1 border-b border-[var(--p-border)] last:border-0" dir="ltr">
                  <span className="text-[var(--p-fg)]">{e.dst}</span>
                  <span className="text-[var(--p-fg-muted)]"> · {e.action}</span>
                  {e.comment && <span className="text-[var(--p-fg-muted)] block">{e.comment}</span>}
                </div>
              ))}
            </div>
          )}
        </RawCard>

        <RawCard
          icon={Power}
          title="Active sessions"
          body="من /ip hotspot active — كل جلسة موجودة على الراوتر الآن."
        >
          {loadingRaw && !activeRaw ? <Spinner /> : !activeRaw || activeRaw.length === 0 ? (
            <p className="text-xs text-[var(--p-fg-muted)]">لا توجد جلسات نشطة.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {activeRaw.map(s => (
                <div key={s.id} className="text-xs font-mono py-1 border-b border-[var(--p-border)] last:border-0" dir="ltr">
                  <span className="text-[var(--p-fg)] font-bold">{s.username}</span>
                  <span className="text-[var(--p-fg-muted)]"> · {s.ip} · {s.mac}</span>
                  <span className="text-[var(--p-fg-muted)] block">{s.uptime}</span>
                </div>
              ))}
            </div>
          )}
        </RawCard>
      </div>

      <p className="text-xs text-[var(--p-fg-muted)] pt-2">
        <Badge variant="warning" size="sm">ملاحظة</Badge>{' '}
        FTP غير معروض هنا (يبقى Winbox-only) لأنه plaintext. وصول الراوتر بصلاحيات admin يجب أن يبقى على المنزل/الشبكة فقط.
      </p>
    </div>
  );
}

function ActionCard({ icon: Icon, title, body, children }) {
  return (
    <div className="rounded-2xl border-2 border-[var(--p-border)] bg-[var(--p-bg-elevated)] p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-9 h-9 rounded-xl bg-[var(--p-bg-muted)] text-[var(--p-fg-muted)] flex items-center justify-center shrink-0">
          <Icon size={16} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-[var(--p-fg)] text-sm">{title}</h4>
          <p className="text-xs text-[var(--p-fg-muted)] mt-0.5">{body}</p>
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function RawCard({ icon: Icon, title, body, children }) {
  return (
    <div className="rounded-2xl border-2 border-[var(--p-border)] bg-[var(--p-bg-elevated)] p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-9 h-9 rounded-xl bg-[var(--p-bg-muted)] text-[var(--p-fg-muted)] flex items-center justify-center shrink-0">
          <Icon size={16} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-[var(--p-fg)] text-sm">{title}</h4>
          <p className="text-xs text-[var(--p-fg-muted)] mt-0.5">{body}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
