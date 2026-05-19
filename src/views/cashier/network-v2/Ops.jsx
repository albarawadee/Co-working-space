import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, WifiOff, User, Ticket, Copy, Check, Printer } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { toCamel, toSnake } from '../../../lib/fieldMaps';
import { generateId } from '../../../utils';
import {
  mtkV2GetDevicesByUser, mtkV2KickSession, mtkV2KickByIdV2,
  mtkCreateSession, logWifiEvent,
} from '../../../lib/mikrotikApi';
import {
  Card, Button, Input, Badge, DeviceTile, Spinner, EmptyState, ConnectionPulse,
  ToastStack, useToastStack, Logo,
  usePortalConfig, useBridgeEvents, wrapT,
} from '../../../portal';
import '../../../portal/design.css';
import { PortalChromeProvider, usePortalChrome } from '../../portal/PortalChrome';

const VOUCHER_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeVoucherCode() {
  let out = 'WIFI-';
  for (let i = 0; i < 6; i++) out += VOUCHER_ALPHA[Math.floor(Math.random() * VOUCHER_ALPHA.length)];
  return out;
}

/**
 * Cashier ops console — focused single-page screen.
 *
 *   1. Search active student by member_number / phone / name.
 *   2. Card: student name + member number + current speed profile.
 *   3. Devices list (per-MAC kick).
 *   4. "Disconnect" (kicks all) + "Refresh" (kicks all; next student-sync
 *      tick re-creates the user — same UX as v1 cashier InternetGate's
 *      refresh button, but via the v2 bridge instead of gateway_config).
 *
 * Compared to v1 cashier/InternetGate: the gateway_config indirection is
 * gone. Same router, same MikroTik bridge as admin uses.
 */
export default function CashierNetworkV2Ops(sharedProps) {
  return (
    <PortalChromeProvider>
      <Inner {...sharedProps} />
    </PortalChromeProvider>
  );
}

function Inner({ user, toast: appToast }) {
  const baseChrome = usePortalChrome();
  const t = wrapT(baseChrome.t, baseChrome.lang);
  const { config } = usePortalConfig();
  const localToast = useToastStack();

  const sse = useBridgeEvents({
    bridgeUrl: config?.bridgeUrlV2,
    secret:    config?.bridgeSecretV2,
    enabled:   !!config?.bridgeUrlV2,
  });

  const [query, setQuery]       = useState('');
  const [searching, setSearching] = useState(false);
  const [student, setStudent]   = useState(null);
  const [devices, setDevices]   = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [tiers, setTiers]       = useState([]);

  const memberNumber = String(student?.memberNumber || '').trim();

  // Load active WiFi packages for sale
  useEffect(() => {
    supabase
      .from('wifi_session_tiers')
      .select('*')
      .eq('active', true)
      .order('price', { ascending: true })
      .then(({ data }) => {
        if (Array.isArray(data)) setTiers(data.map(toCamel));
      });
  }, []);

  function pushToast(tone, message) {
    localToast.push({ tone, message });
    if (tone === 'error' && appToast) appToast(message, 'error');
  }

  async function searchStudent(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setStudent(null);
    setDevices([]);
    try {
      const { data } = await supabase
        .from('students')
        .select('id, name, phone, member_number, wallet_balance')
        .or(`member_number.ilike.${q},phone.ilike.${q},name.ilike.%${q}%`)
        .limit(1);
      const found = data?.[0] ? toCamel(data[0]) : null;
      if (!found) {
        pushToast('warning', t('cashier.netv2.notFound'));
      }
      setStudent(found);
    } catch (err) {
      pushToast('error', err.message);
    } finally {
      setSearching(false);
    }
  }

  const refreshDevices = useCallback(async () => {
    if (!memberNumber || !config?.bridgeUrlV2) return;
    setDevicesLoading(true);
    const r = await mtkV2GetDevicesByUser(config, memberNumber);
    setDevicesLoading(false);
    if (r?.ok) setDevices(Array.isArray(r.devices) ? r.devices : []);
  }, [config, memberNumber]);

  useEffect(() => {
    if (memberNumber) refreshDevices();
  }, [memberNumber, refreshDevices]);

  // SSE refresh
  const lastEvent = sse?.lastEvent;
  useEffect(() => {
    if (!lastEvent || !memberNumber) return;
    if (lastEvent.data?.username === memberNumber) refreshDevices();
  }, [lastEvent, memberNumber, refreshDevices]);

  async function disconnectAll() {
    if (!memberNumber) return;
    setBusy(true);
    const r = await mtkV2KickSession(config, memberNumber);
    setBusy(false);
    if (r?.ok) {
      pushToast('success', t('cashier.netv2.kickedAll', { count: r.kicked ?? 0 }));
      logWifiEvent('cashier_user_disconnected', memberNumber, { kicked: r.kicked }, user?.id, user?.name);
      setDevices([]);
    } else {
      pushToast('error', r?.error || t('cashier.netv2.kickFailed'));
    }
  }

  async function refreshSession() {
    if (!memberNumber) return;
    // Same as disconnect — the next student-sync tick (every 30s) will
    // recreate the hotspot user. Cashier rarely needs to wait; if they
    // do, v1 bridge's /api/enable can be re-fired by checking the
    // student out and back in. For now, keep it simple.
    await disconnectAll();
  }

  async function kickOne(d) {
    setBusy(true);
    const r = await mtkV2KickByIdV2(config, d.id);
    setBusy(false);
    if (r?.ok) {
      pushToast('success', t('cashier.netv2.deviceKicked'));
      logWifiEvent('cashier_device_kicked', memberNumber, { mac: d.mac, sessionId: d.id }, user?.id, user?.name);
      setDevices(prev => prev.filter(x => x.id !== d.id));
    } else {
      pushToast('error', r?.error || t('cashier.netv2.kickFailed'));
    }
  }

  const pulseState = useMemo(() => {
    if (!config?.bridgeUrlV2) return 'offline';
    if (!sse?.connected) return 'connecting';
    return 'live';
  }, [config?.bridgeUrlV2, sse?.connected]);

  return (
    <div className="portal-v2 p-4 sm:p-6 max-w-2xl mx-auto" dir={baseChrome.dir}>
      {/* Header */}
      <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Logo variant="lockup" size={28} className="text-[var(--p-fg)] mb-3" ariaLabel="Smart Vision Institute" />
          <p className="label-eyebrow text-[var(--p-accent)] mb-1">{t('cashier.netv2.eyebrow')}</p>
          <h1 className="display-tight text-[var(--p-fg)] text-3xl sm:text-4xl font-black">
            {t('cashier.netv2.title')}
          </h1>
        </div>
        <ConnectionPulse state={pulseState} label={t(pulseState === 'live' ? 'v2.common.live' : pulseState === 'connecting' ? 'v2.common.connecting' : 'v2.common.offline')} />
      </header>

      {/* Search */}
      <form onSubmit={searchStudent} className="mb-6">
        <Input
          label={t('cashier.netv2.searchLabel')}
          placeholder={t('cashier.netv2.searchPh')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          iconStart={<Search size={16} strokeWidth={2.25} />}
        />
        <div className="mt-3">
          <Button type="submit" variant="primary" full loading={searching}>
            {t('cashier.netv2.searchCta')}
          </Button>
        </div>
      </form>

      {/* Selected student */}
      {student && (
        <Card padding="md" className="mb-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-[var(--p-bg-muted)] flex items-center justify-center text-[var(--p-fg-soft)] shrink-0">
              <User size={20} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--p-fg)] text-base truncate">{student.name}</p>
              <p className="text-xs text-[var(--p-fg-muted)] truncate tabular-nums" dir="ltr">
                #{student.memberNumber || '—'} {student.phone ? `· ${student.phone}` : ''}
              </p>
            </div>
            <Badge variant="neutral" size="sm">{t('cashier.netv2.devicesCount', { n: devices.length })}</Badge>
          </div>

          {/* Devices */}
          {devicesLoading ? (
            <div className="mt-4 flex justify-center"><Spinner size="md" /></div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-[var(--p-fg-muted)] text-center py-6">
              {config?.bridgeUrlV2 ? t('cashier.netv2.noDevices') : t('admin.netv2.devices.bridgeOffline')}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {devices.map(d => (
                <DeviceTile
                  key={d.id || d.mac}
                  mac={d.mac}
                  label={d.hostname || student.name}
                  userAgent={d.userAgent}
                  ip={d.ip}
                  since={d.uptime}
                  onKick={() => kickOne(d)}
                  kickLabel={t('cashier.netv2.kick')}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Button variant="secondary" iconStart={<RefreshCw size={14} strokeWidth={2.5} />} onClick={refreshSession} disabled={busy || !memberNumber}>
              {t('cashier.netv2.refreshSession')}
            </Button>
            <Button variant="danger" iconStart={<WifiOff size={14} strokeWidth={2.5} />} onClick={disconnectAll} disabled={busy || !memberNumber}>
              {t('cashier.netv2.disconnect')}
            </Button>
          </div>
        </Card>
      )}

      {!student && !searching && (
        <Card padding="none" className="mb-4">
          <EmptyState
            icon={Search}
            title={t('cashier.netv2.hintTitle')}
            body={t('cashier.netv2.hintBody')}
          />
        </Card>
      )}

      {/* Voucher sale — always visible, optionally linked to a selected member */}
      <SellVoucherCard
        t={t}
        tiers={tiers}
        student={student}
        user={user}
        config={config}
        pushToast={pushToast}
      />

      <ToastStack {...localToast.bind} />
    </div>
  );
}

/**
 * Sell a WiFi voucher to the customer in front of the cashier.
 *
 * Atomic flow on click:
 *   1. mtkCreateSession  → creates the MikroTik hotspot user with
 *                          `limit-uptime=<duration>m`, password = code.
 *   2. wifi_sessions     → row keyed by username; payment_method,
 *                          price, sold_by_*, optional student_id/name,
 *                          expires_at left NULL (populated on first
 *                          captive-portal redemption).
 *   3. invoices          → cashier-side revenue record so the voucher
 *                          shows up in DailyRevenue/Shifts/Reports.
 *
 * On bridge failure: aborts before writing to Supabase so we don't end
 * up with a Supabase row pointing at a hotspot user that doesn't exist.
 * The session-worker on the bridge auto-kicks the voucher at expiry.
 */
function SellVoucherCard({ t, tiers, student, user, config, pushToast }) {
  const [tierId, setTierId]         = useState('');
  const [paymentMethod, setPm]      = useState('cash');
  const [busy, setBusy]             = useState(false);
  const [lastSale, setLastSale]     = useState(null);
  const [copied, setCopied]         = useState(false);

  const tier = useMemo(() => tiers.find(x => x.id === tierId) || tiers[0] || null, [tiers, tierId]);

  async function getActiveShiftId() {
    if (!user?.id) return null;
    try {
      const { data } = await supabase
        .from('shifts')
        .select('id')
        .eq('cashier_id', user.id)
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1);
      return data?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  async function sell() {
    if (busy) return;
    if (!tier) { pushToast('error', t('cashier.netv2.sell.pickTier')); return; }
    setBusy(true);
    setLastSale(null);

    const code = makeVoucherCode();
    const limitUptime = tier.durationMinutes ? `${tier.durationMinutes}m` : '60m';

    // 1. MikroTik hotspot user — must succeed before we record the sale.
    const r = await mtkCreateSession(config, {
      username:    code,
      password:    code,
      profile:     tier.speedProfile || 'svs-normal',
      limitUptime,
      comment:     `Sold by ${user?.name || ''}${student ? ' to ' + student.name : ''}`,
    });
    if (!r?.ok) {
      setBusy(false);
      pushToast('error', r?.error || t('cashier.netv2.sell.failed'));
      return;
    }

    const shiftId = await getActiveShiftId();
    const now = new Date().toISOString();
    const invoiceId = generateId();
    const sessionRowId = generateId();

    const writes = [];

    // 2. wifi_sessions row
    writes.push(
      supabase.from('wifi_sessions').insert(toSnake({
        id:              sessionRowId,
        username:        code,
        password:        code,
        tierId:          tier.id,
        tierName:        tier.name,
        studentId:       student?.id || null,
        studentName:     student?.name || null,
        durationMinutes: tier.durationMinutes,
        price:           tier.price,
        speedProfile:    tier.speedProfile || 'svs-normal',
        paymentMethod,
        invoiceId,
        status:          'active',
        isVoucher:       true,
        soldBy:          user?.id || null,
        soldByName:      user?.name || null,
        shiftId,
        createdAt:       now,
      }))
    );

    // 3. invoice — counts as real revenue, lives next to checkout invoices
    writes.push(
      supabase.from('invoices').insert(toSnake({
        id:            invoiceId,
        sessionId:     null,
        studentId:     student?.id || null,
        studentName:   student?.name || `WiFi voucher (${code})`,
        minutes:       0,
        amount:        tier.price,
        kitchenTotal:  0,
        total:         tier.price,
        paymentMethod,
        billingType:   'wifi_voucher',
        shiftId,
        cashierId:     user?.id || null,
        inCustody:     false,
        createdAt:     now,
      }))
    );

    try {
      const results = await Promise.all(writes);
      const insertErr = results.find(rr => rr?.error)?.error;
      if (insertErr) throw insertErr;
    } catch (err) {
      setBusy(false);
      pushToast('error', err?.message || t('cashier.netv2.sell.failed'));
      return;
    }

    logWifiEvent(
      'voucher_sold',
      code,
      { tier: tier.name, price: tier.price, paymentMethod, studentId: student?.id || null },
      user?.id,
      user?.name,
    );

    setBusy(false);
    setCopied(false);
    setLastSale({ code, tier, student });
    pushToast('success', t('cashier.netv2.sell.created', { code }));
  }

  function handleCopy() {
    if (!lastSale?.code) return;
    navigator.clipboard.writeText(lastSale.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    if (!lastSale) return;
    const w = window.open('', '_blank', 'width=380,height=560');
    if (!w) return;
    const codeRaw = lastSale.code.replace('WIFI-', '');
    w.document.write(`
      <html><head><title>${lastSale.code}</title>
      <style>
        body { font-family: -apple-system,Segoe UI,Roboto,sans-serif; padding:24px; }
        .card { border:2px solid #111; border-radius:14px; padding:20px; text-align:center; }
        .eyebrow { font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:#666; font-weight:700; }
        .code { font-family: ui-monospace,Menlo,Consolas,monospace; font-size:32px; font-weight:900; letter-spacing:.25em; margin:14px 0; }
        .meta { font-size:13px; color:#444; }
      </style></head><body>
      <div class="card">
        <div class="eyebrow">Smart Vision · WiFi</div>
        <div class="code">${codeRaw}</div>
        <div class="meta">${lastSale.tier.name} · ${lastSale.tier.durationMinutes}m</div>
        ${lastSale.student ? `<div class="meta" style="margin-top:8px">${lastSale.student.name}</div>` : ''}
      </div>
      <script>setTimeout(()=>window.print(),100);</script>
      </body></html>
    `);
    w.document.close();
  }

  if (tiers.length === 0) {
    return (
      <Card padding="md">
        <p className="label-eyebrow text-[var(--p-accent)] mb-1">{t('cashier.netv2.sell.eyebrow')}</p>
        <h2 className="font-bold text-[var(--p-fg)] text-lg mb-2">{t('cashier.netv2.sell.title')}</h2>
        <p className="text-sm text-[var(--p-fg-muted)]">{t('cashier.netv2.sell.noTiers')}</p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-[color-mix(in_oklab,var(--p-accent)_18%,transparent)] text-[var(--p-accent)] flex items-center justify-center shrink-0">
          <Ticket size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-eyebrow text-[var(--p-accent)]">{t('cashier.netv2.sell.eyebrow')}</p>
          <h2 className="font-bold text-[var(--p-fg)] text-lg leading-tight">{t('cashier.netv2.sell.title')}</h2>
          {student && (
            <p className="text-xs text-[var(--p-fg-muted)] mt-1 truncate">
              {t('cashier.netv2.sell.codeFor', { name: student.name })}
            </p>
          )}
        </div>
      </div>

      {!lastSale ? (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--p-fg-muted)] block mb-2">
                {t('cashier.netv2.sell.tier')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tiers.map(tt => (
                  <button
                    key={tt.id}
                    type="button"
                    onClick={() => setTierId(tt.id)}
                    className={`text-start rounded-2xl border-2 px-4 py-3 transition-colors cursor-pointer ${
                      tier?.id === tt.id
                        ? 'border-[var(--p-fg)] bg-[var(--p-bg-elevated)]'
                        : 'border-[var(--p-border)] hover:border-[var(--p-fg-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-sm text-[var(--p-fg)] truncate">{tt.name}</span>
                      <span className="text-sm tabular-nums font-bold text-[var(--p-fg)]" dir="ltr">{tt.price}</span>
                    </div>
                    <p className="text-xs text-[var(--p-fg-muted)] mt-1 tabular-nums" dir="ltr">
                      {tt.durationMinutes}m · {(tt.speedProfile || '').replace('svs-', '')}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--p-fg-muted)] block mb-2">
                {t('cashier.netv2.sell.payment')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'cash',     label: t('cashier.netv2.sell.payCash') },
                  { value: 'transfer', label: t('cashier.netv2.sell.payTransfer') },
                  { value: 'instapay', label: t('cashier.netv2.sell.payInstapay') },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPm(opt.value)}
                    className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                      paymentMethod === opt.value
                        ? 'border-[var(--p-fg)] bg-[var(--p-bg-elevated)] text-[var(--p-fg)]'
                        : 'border-[var(--p-border)] text-[var(--p-fg-muted)] hover:border-[var(--p-fg-muted)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              full
              loading={busy}
              disabled={!tier}
              onClick={sell}
              iconStart={<Ticket size={16} strokeWidth={2.5} />}
            >
              {busy ? t('cashier.netv2.sell.selling') : t('cashier.netv2.sell.sell')}
            </Button>
          </div>
        </>
      ) : (
        <div className="p-enter rounded-2xl border-2 border-[color-mix(in_oklab,var(--p-success,#16a34a)_40%,var(--p-border))] bg-[color-mix(in_oklab,var(--p-success,#16a34a)_8%,var(--p-bg-elevated))] p-5">
          <p className="label-eyebrow text-[var(--p-fg-muted)] mb-1">{t('v2.voucher.eyebrow')}</p>
          <p className="font-mono font-black text-[var(--p-fg)] text-3xl tracking-[0.18em] mt-1" dir="ltr">{lastSale.code}</p>
          <p className="text-sm text-[var(--p-fg-muted)] mt-2">
            {t('cashier.netv2.sell.validFor', { minutes: lastSale.tier.durationMinutes })}
            {lastSale.student ? ` · ${lastSale.student.name}` : ''}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Button variant="secondary" iconStart={copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2.5} />} onClick={handleCopy}>
              {copied ? t('cashier.netv2.sell.copied') : t('cashier.netv2.sell.copyCode')}
            </Button>
            <Button variant="secondary" iconStart={<Printer size={14} strokeWidth={2.5} />} onClick={handlePrint}>
              {t('admin.netv2.vouchers.print')}
            </Button>
            <Button variant="primary" onClick={() => setLastSale(null)}>
              {t('cashier.netv2.sell.sellAnother')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
