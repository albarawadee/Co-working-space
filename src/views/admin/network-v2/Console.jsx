import { useEffect, useMemo, useState } from 'react';
import { Skull } from 'lucide-react';
import { useStorage } from '../../../hooks/useStorage';
import { STORAGE_KEYS } from '../../../constants';
import { supabase } from '../../../lib/supabaseClient';
import { toCamel } from '../../../lib/fieldMaps';
import {
  useBridgeEvents, usePortalConfig, wrapT, ToastStack, useToastStack,
  ConnectionPulse, Button, Logo,
} from '../../../portal';
import '../../../portal/design.css';
import { usePortalChrome, PortalChromeProvider } from '../../portal/PortalChrome';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import { SectionCard }      from './sections/SectionCard';
import { LiveOpsSection }   from './sections/LiveOpsSection';
import { UsageSection }     from './sections/UsageSection';
import { CatalogSection }   from './sections/CatalogSection';
import { AccessSection }    from './sections/AccessSection';
import { RouterSection }    from './sections/RouterSection';
import { AuditSection }     from './sections/AuditSection';
import { EmployeesSection } from './sections/EmployeesSection';
import {
  mtkV2GetDevices, mtkV2KickAll, logWifiEvent,
} from '../../../lib/mikrotikApi';

/**
 * Admin Network Console v2 — Phase 5 redesign.
 *
 * Replaces the previous 9-tab strip with a single-page sectioned
 * dashboard. Sections collapse via <SectionCard> and share a single
 * Supabase + SSE subscription via this orchestrator.
 *
 * Layout (top-to-bottom):
 *   1. Live Ops    — KPIs + active devices/users tables (student names)
 *   2. Usage       — per-user bandwidth with date filter + CSV export
 *   3. Catalog     — Packages (tiers) + Profiles (full RouterOS opts)
 *   4. Access      — Free sites bundles + Blocked categories + Custom blocks
 *   5. Router      — Winbox-parity controls (cookies, restart, lifetime)
 *   6. Audit       — Event timeline
 *   7. Employees   — Staff codes
 *
 * sharedProps: { user, toast, config, setActiveView, uncollectedBalance, onStudentClick }
 */
export default function AdminNetworkV2Console(sharedProps) {
  return (
    <PortalChromeProvider>
      <ConsoleInner {...sharedProps} />
    </PortalChromeProvider>
  );
}

function ConsoleInner({ user, toast: appToast }) {
  const baseChrome = usePortalChrome();
  const t = wrapT(baseChrome.t, baseChrome.lang);

  const localToast = useToastStack();
  const { config } = usePortalConfig();

  const sse = useBridgeEvents({
    bridgeUrl: config?.bridgeUrlV2,
    secret:    config?.bridgeSecretV2,
    enabled:   !!config?.bridgeUrlV2,
  });

  // Shared Supabase-backed stores (every section reads from these so
  // there's exactly ONE subscription per table on this page).
  const [profiles,    , refreshProfiles]    = useStorage(STORAGE_KEYS.WIFI_PROFILES_V2, []);
  const [devicesDb]                          = useStorage(STORAGE_KEYS.WIFI_DEVICES, []);
  const [fullAccess,  , refreshFullAccess]  = useStorage(STORAGE_KEYS.WIFI_FULL_ACCESS, []);
  const [eventsDb,    , refreshEvents]      = useStorage(STORAGE_KEYS.WIFI_EVENTS, []);
  const [wifiSessions,, refreshWifiSessions]= useStorage(STORAGE_KEYS.WIFI_SESSIONS, []);
  const [tiers,       , refreshTiers]       = useStorage(STORAGE_KEYS.WIFI_SESSION_TIERS, []);
  const [usageLogs,   , refreshUsageLogs]   = useStorage(STORAGE_KEYS.WIFI_USAGE_LOGS, []);

  // Students — loaded once with a focused select, NOT via useStorage
  // (the table is large and we only need three columns for the
  // member_number → name lookup. Refreshes on Realtime + every 60s).
  const [students, setStudents] = useState([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from('students')
        .select('id, name, phone, member_number')
        .limit(20000);
      if (!mounted) return;
      setStudents((data || []).map(toCamel));
    }
    load();
    const id = setInterval(load, 60_000);
    // Realtime subscription: refresh whenever students table changes.
    const ch = supabase
      .channel('admin_network_v2_students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => load())
      .subscribe();
    return () => { mounted = false; clearInterval(id); supabase.removeChannel(ch); };
  }, []);

  // member_number → student map, used by every section for display names.
  const studentByCode = useMemo(() => {
    const m = new Map();
    (students || []).forEach(s => {
      const k = String(s.memberNumber || '').trim();
      if (k) m.set(k, s);
    });
    return m;
  }, [students]);

  const [liveDeviceCount, setLiveDeviceCount] = useState(0);
  const [liveUserCount, setLiveUserCount]     = useState(0);
  const [killing, setKilling]   = useState(false);

  // Live counter for the Kill Switch label + Live Ops KPIs.
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!config?.bridgeUrlV2) { if (mounted) { setLiveDeviceCount(0); setLiveUserCount(0); } return; }
      const r = await mtkV2GetDevices(config).catch(() => null);
      if (!mounted || !r?.ok) return;
      const devices = Array.isArray(r.devices) ? r.devices : [];
      setLiveDeviceCount(devices.length);
      setLiveUserCount(new Set(devices.map(d => d.username).filter(Boolean)).size);
    }
    load();
    const id = setInterval(load, 20_000);
    return () => { mounted = false; clearInterval(id); };
  }, [config?.bridgeUrlV2, sse?.lastEvent]);

  function pushToast(tone, message, opts = {}) {
    localToast.push({ tone, message, ...opts });
    if (tone === 'error' && appToast) appToast(message, 'error');
  }

  async function killSwitch() {
    if (liveDeviceCount === 0) {
      pushToast('info', 'لا توجد جلسات نشطة الآن');
      return;
    }
    if (!window.confirm(`⚠️ Kill Switch — قتل ${liveDeviceCount} جلسة نشطة على الراوتر؟`)) return;
    if (!window.confirm('متأكد؟ سيتم فصل كل المستخدمين فوراً.')) return;
    setKilling(true);
    const r = await mtkV2KickAll(config);
    setKilling(false);
    if (r?.ok) {
      pushToast('success', `تم فصل ${r.kicked}/${r.total} جلسة`);
      logWifiEvent('kill_switch', 'all', { total: r.total, kicked: r.kicked, source: 'console' }, user?.id, user?.name);
      setLiveDeviceCount(0);
      setLiveUserCount(0);
    } else {
      pushToast('error', r?.error || 'فشل تنفيذ Kill Switch');
    }
  }

  const pulseState = !config?.bridgeUrlV2 ? 'offline' : sse?.connected ? 'live' : 'connecting';
  const pulseLabel = pulseState === 'live'
    ? t('v2.common.live')
    : pulseState === 'connecting' ? t('v2.common.connecting') : t('v2.common.offline');

  // Bag of props every section receives. Sections destructure what they need.
  const sectionProps = {
    t,
    user,
    config,
    sse,
    toast: pushToast,
    students,
    studentByCode,
    profiles,
    devicesDb,
    fullAccess,
    eventsDb,
    wifiSessions,
    tiers,
    usageLogs,
    refreshProfiles,
    refreshFullAccess,
    refreshEvents,
    refreshWifiSessions,
    refreshTiers,
    refreshUsageLogs,
    liveDeviceCount,
    liveUserCount,
  };

  return (
    <div className="portal-v2 max-w-6xl mx-auto" dir={baseChrome.dir}>
      {/* Hero header — sticky pulse + Kill Switch */}
      <header className="p-4 sm:p-6 pb-3 sticky top-0 z-20 bg-[var(--p-bg,white)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--p-bg,white)]/85 border-b border-[var(--p-border)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Logo variant="lockup" size={32} className="text-[var(--p-fg)] mb-3" ariaLabel="Smart Vision Institute" />
            <p className="label-eyebrow text-[var(--p-accent)] mb-1">إدارة الشبكة</p>
            <h1 className="display-tight text-[var(--p-fg)] text-3xl sm:text-4xl font-black">
              {t('admin.netv2.title')}
            </h1>
            <p className="text-[var(--p-fg-soft)] text-sm mt-2 max-w-2xl">
              لوحة تحكم موحدة — جلسات نشطة، استهلاك، باقات، بروفايلات، صلاحيات الوصول، وأوامر الراوتر.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConnectionPulse state={pulseState} label={pulseLabel} />
            <Button
              variant="danger"
              size="md"
              loading={killing}
              iconStart={<Skull size={14} strokeWidth={2.5} />}
              onClick={killSwitch}
              disabled={!config?.bridgeUrlV2 || liveDeviceCount === 0}
            >
              Kill Switch{liveDeviceCount > 0 ? ` (${liveDeviceCount})` : ''}
            </Button>
          </div>
        </div>
      </header>

      {/* Stacked sections — collapsible, each in its own error boundary */}
      <div className="p-4 sm:p-6 pt-5 space-y-4">
        <SectionCard id="live"     title="نشاط مباشر"        subtitle="الأجهزة والمستخدمون الآن على الشبكة" defaultOpen>
          <TabErrorBoundary><LiveOpsSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>

        <SectionCard id="usage"    title="استهلاك الإنترنت"   subtitle="استهلاك التحميل والرفع لكل مستخدم" defaultOpen>
          <TabErrorBoundary><UsageSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>

        <SectionCard id="catalog"  title="الكتالوج"           subtitle="باقات الواي فاي + بروفايلات السرعة">
          <TabErrorBoundary><CatalogSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>

        <SectionCard id="access"   title="صلاحيات الوصول"     subtitle="مواقع مجانية، فئات محظورة، نطاقات مخصصة">
          <TabErrorBoundary><AccessSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>

        <SectionCard id="router"   title="إدارة الراوتر"      subtitle="أوامر MikroTik من داخل اللوحة">
          <TabErrorBoundary><RouterSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>

        <SectionCard id="audit"    title="سجل النشاط"         subtitle="آخر العمليات على الشبكة">
          <TabErrorBoundary><AuditSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>

        <SectionCard id="employees" title="أكواد الموظفين"     subtitle="أكواد الواي فاي للموظفين">
          <TabErrorBoundary><EmployeesSection {...sectionProps} /></TabErrorBoundary>
        </SectionCard>
      </div>

      <ToastStack {...localToast.bind} />
    </div>
  );
}
