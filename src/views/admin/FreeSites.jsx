import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, Sparkles, Pencil, Save, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { toCamel, toSnake } from '../../lib/fieldMaps';
import { generateId } from '../../utils';
import {
  mtkGetWalledGarden, mtkAddWalledGarden, mtkRemoveWalledGarden, logWifiEvent,
} from '../../lib/mikrotikApi';
import {
  Card, Button, Input, Badge, EmptyState, Skeleton, ErrorState,
} from '../../portal';
import '../../portal/design.css';
import { PortalChromeProvider, usePortalChrome } from '../portal/PortalChrome';

/**
 * Admin "Free Sites" page (admin_free_sites).
 *
 * The "websites of unlimited WiFi" — bundles of domains that bypass the
 * captive portal entirely. A student/guest does NOT need a voucher or
 * an active session to reach them. Maps 1:1 to the MikroTik walled
 * garden, but presented as named CATEGORY bundles (WhatsApp, Telegram,
 * etc.) instead of a flat list — so admins can flip a whole service
 * on/off with one tap.
 *
 * Storage model:
 *   • Bundles live in Supabase `wifi_walled_garden` (id, name,
 *     domains[], comment).
 *   • Live router state comes from `/api/walled-garden`. Each row
 *     pushed from this page carries `comment = "svs-bundle:<bundle_id>"`
 *     so we can compute the enabled/disabled state by intersecting the
 *     bundle's `domains[]` with what's on the router AND can clean up
 *     accurately on disable.
 *
 * Pre-seeded bundles (from `20260518100000_wifi_network_tables.sql`):
 *   - wg-whatsapp  → WhatsApp
 *   - wg-telegram  → Telegram
 *   - wg-dns       → DNS resolvers
 *
 * Why this page is separate from the v2 network console's
 * "Walled Garden" tab: the tab is a raw row-by-row CRUD against
 * RouterOS for advanced cases. This page is the customer-facing-ish
 * "what services are free?" view — accessible by sidebar entry, with
 * category presets, ad-hoc bundles, and a built-in "infrastructure"
 * panel for the 4 mandatory pre-auth hosts (Smart Vision app, Supabase,
 * Google Fonts) so admins can see them but cannot accidentally remove
 * them. See WIFI-SYSTEM.md §3, §16.
 */

const BUNDLE_COMMENT_PREFIX = 'svs-bundle:';

// Hosts the router walled-garden MUST contain for captive portal + app
// to function. Shown read-only at the bottom of this page; see §3.
const INFRA_HOSTS = [
  { host: '10.5.50.240',                          why: 'Smart Vision app + bridge' },
  { host: 'vokdyuhmrnwyphgdlqri.supabase.co',     why: 'Captive portal Supabase lookup' },
  { host: 'fonts.googleapis.com',                 why: 'DM Sans CSS' },
  { host: 'fonts.gstatic.com',                    why: 'DM Sans font files' },
];

export default function AdminFreeSites(sharedProps) {
  return (
    <PortalChromeProvider>
      <Inner {...sharedProps} />
    </PortalChromeProvider>
  );
}

function Inner({ user, toast, config }) {
  const { dir } = usePortalChrome();

  const [bundles, setBundles]       = useState([]);
  const [routerEntries, setRouter]  = useState([]);
  const [loading, setLoading]       = useState(true);
  const [routerError, setRouterErr] = useState(null);
  const [busyId, setBusyId]         = useState('');
  const [editingId, setEditingId]   = useState('');
  const [draftName, setDraftName]   = useState('');
  const [draftDomains, setDraftDomains] = useState('');

  const [adhocDst, setAdhocDst]     = useState('');
  const [adhocBusy, setAdhocBusy]   = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setRouterErr(null);
    try {
      const [{ data: bundleRows }, routerResp] = await Promise.all([
        supabase.from('wifi_walled_garden').select('*').order('name'),
        mtkGetWalledGarden(config).catch(err => ({ ok: false, error: err?.message })),
      ]);
      setBundles((bundleRows || []).map(toCamel));
      if (routerResp?.ok) {
        setRouter(Array.isArray(routerResp.entries) ? routerResp.entries : []);
      } else {
        setRouter([]);
        setRouterErr(routerResp?.error || 'bridge_unreachable');
      }
    } catch (err) {
      console.error('[FreeSites] load failed:', err);
      toast?.('فشل التحميل', 'error');
    } finally {
      setLoading(false);
    }
  }, [config, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Compute enabled state per bundle: bundle is "enabled" if EVERY
  // domain it owns is currently in the router walled-garden under the
  // bundle's comment marker. Otherwise: partial or disabled.
  const bundleStatus = useMemo(() => {
    const m = new Map();
    for (const b of bundles) {
      const expected = new Set((b.domains || []).map(d => String(d).toLowerCase()));
      const seenComment = `${BUNDLE_COMMENT_PREFIX}${b.id}`;
      const present = new Set(
        routerEntries
          .filter(e => (e.comment || '').startsWith(seenComment))
          .map(e => String(e.dst || '').toLowerCase())
      );
      let state;
      if (expected.size === 0) state = 'empty';
      else if (present.size === 0) state = 'off';
      else if (Array.from(expected).every(d => present.has(d))) state = 'on';
      else state = 'partial';
      m.set(b.id, { state, present, expected });
    }
    return m;
  }, [bundles, routerEntries]);

  async function toggleBundle(bundle) {
    if (busyId) return;
    const status = bundleStatus.get(bundle.id);
    if (!status) return;
    setBusyId(bundle.id);

    try {
      if (status.state === 'on') {
        // Fully on — disable: remove every entry whose comment matches this bundle.
        const toRemove = routerEntries.filter(e =>
          (e.comment || '').startsWith(`${BUNDLE_COMMENT_PREFIX}${bundle.id}`)
        );
        let ok = 0;
        for (const e of toRemove) {
          const r = await mtkRemoveWalledGarden(config, e.id);
          if (r?.ok) ok++;
        }
        logWifiEvent('free_sites_bundle_off', bundle.name, { id: bundle.id, removed: ok }, user?.id, user?.name);
        toast?.(`تم إيقاف ${bundle.name}`, 'success');
      } else {
        // Off OR partial — push every missing domain.
        const present = status.present;
        const missing = (bundle.domains || []).filter(d => !present.has(String(d).toLowerCase()));
        let ok = 0;
        for (const dst of missing) {
          const r = await mtkAddWalledGarden(config, {
            dst:     dst,
            action:  'accept',
            comment: `${BUNDLE_COMMENT_PREFIX}${bundle.id} ${bundle.name}`,
          });
          if (r?.ok) ok++;
        }
        logWifiEvent('free_sites_bundle_on', bundle.name, { id: bundle.id, added: ok }, user?.id, user?.name);
        toast?.(`تم تفعيل ${bundle.name}`, 'success');
      }
      await loadAll();
    } catch (err) {
      console.error('[FreeSites] toggle failed:', err);
      toast?.('فشل تبديل الحزمة', 'error');
    } finally {
      setBusyId('');
    }
  }

  function parseDomains(str) {
    return String(str || '')
      .split(/[\s,،\n]+/)
      .map(d => d.trim())
      .filter(Boolean);
  }

  async function saveBundle(existing) {
    const name = draftName.trim();
    const domains = parseDomains(draftDomains);
    if (!name || domains.length === 0) {
      toast?.('اسم وموقع واحد على الأقل', 'error');
      return;
    }
    setBusyId(existing?.id || 'new');
    try {
      if (existing) {
        const { error } = await supabase.from('wifi_walled_garden')
          .update(toSnake({ name, domains }))
          .eq('id', existing.id);
        if (error) throw error;
        logWifiEvent('free_sites_bundle_edited', name, { id: existing.id }, user?.id, user?.name);
      } else {
        const id = generateId();
        const { error } = await supabase.from('wifi_walled_garden').insert(toSnake({
          id, name, domains, comment: `Created by ${user?.name || 'admin'}`,
        }));
        if (error) throw error;
        logWifiEvent('free_sites_bundle_created', name, { id }, user?.id, user?.name);
      }
      setEditingId('');
      setDraftName('');
      setDraftDomains('');
      await loadAll();
      toast?.('تم الحفظ', 'success');
    } catch (err) {
      console.error('[FreeSites] save failed:', err);
      toast?.('فشل الحفظ', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function deleteBundle(b) {
    if (!window.confirm(`حذف "${b.name}"؟ سيتم أيضاً إزالة جميع المواقع المرتبطة من الراوتر.`)) return;
    setBusyId(b.id);
    try {
      // Best-effort: remove router rows owned by this bundle first.
      const ownedRows = routerEntries.filter(e =>
        (e.comment || '').startsWith(`${BUNDLE_COMMENT_PREFIX}${b.id}`)
      );
      for (const r of ownedRows) {
        await mtkRemoveWalledGarden(config, r.id).catch(() => {});
      }
      const { error } = await supabase.from('wifi_walled_garden').delete().eq('id', b.id);
      if (error) throw error;
      logWifiEvent('free_sites_bundle_deleted', b.name, { id: b.id }, user?.id, user?.name);
      toast?.('تم الحذف', 'success');
      await loadAll();
    } catch (err) {
      console.error('[FreeSites] delete failed:', err);
      toast?.(err?.message || 'فشل الحذف', 'error');
    } finally {
      setBusyId('');
    }
  }

  function startEdit(b) {
    setEditingId(b?.id || 'new');
    setDraftName(b?.name || '');
    setDraftDomains((b?.domains || []).join('\n'));
  }

  async function addAdhoc() {
    const d = adhocDst.trim();
    if (!d) return;
    setAdhocBusy(true);
    try {
      const r = await mtkAddWalledGarden(config, { dst: d, action: 'accept', comment: `manual ${user?.name || ''}` });
      if (!r?.ok) throw new Error(r?.error || 'fail');
      logWifiEvent('free_sites_manual_added', d, {}, user?.id, user?.name);
      setAdhocDst('');
      await loadAll();
      toast?.('تمت الإضافة', 'success');
    } catch (err) {
      toast?.(err.message || 'فشلت الإضافة', 'error');
    } finally {
      setAdhocBusy(false);
    }
  }

  async function removeAdhoc(entry) {
    if (!window.confirm(`إزالة ${entry.dst}؟`)) return;
    try {
      await mtkRemoveWalledGarden(config, entry.id);
      logWifiEvent('free_sites_manual_removed', entry.dst, {}, user?.id, user?.name);
      await loadAll();
      toast?.('تمت الإزالة', 'success');
    } catch (err) {
      toast?.(err.message || 'فشل', 'error');
    }
  }

  // Non-bundle, non-infra rows = "manual" entries the admin added directly.
  const infraHosts = new Set(INFRA_HOSTS.map(i => i.host.toLowerCase()));
  const manualEntries = routerEntries.filter(e => {
    const c = (e.comment || '').toLowerCase();
    const dst = String(e.dst || '').toLowerCase();
    if (c.startsWith(BUNDLE_COMMENT_PREFIX)) return false;
    if (infraHosts.has(dst)) return false;
    return true;
  });

  return (
    <div className="portal-v2 p-4 sm:p-6 max-w-5xl mx-auto" dir={dir}>
      <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="label-eyebrow text-[var(--p-accent)] mb-1">إعداد الشبكة</p>
          <h1 className="display-tight text-[var(--p-fg)] text-3xl sm:text-4xl font-black">
            المواقع المجانية
          </h1>
          <p className="text-[var(--p-fg-muted)] text-sm mt-1 max-w-lg leading-relaxed">
            مواقع وخدمات يمكن للأعضاء والزوّار الوصول إليها بدون تسجيل دخول أو قسيمة. يتم مزامنتها مع الراوتر فور التبديل.
          </p>
        </div>
        <Button variant="secondary" iconStart={<RefreshCw size={14} strokeWidth={2.5} />} onClick={loadAll}>
          تحديث
        </Button>
      </header>

      {routerError && (
        <div className="mb-4">
          <ErrorState
            icon={Globe}
            title="الجسر غير متصل بالراوتر"
            body="لا يمكن قراءة الحالة الحالية للجدار. تحقق من تشغيل الجسر على Windows."
            code={routerError}
            onRetry={loadAll}
            retryLabel="إعادة المحاولة"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Card padding="md"><Skeleton.Block lines={3} /></Card>
          <Card padding="md"><Skeleton.Block lines={3} /></Card>
        </div>
      ) : (
        <>
          {/* Bundles */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="label-eyebrow text-[var(--p-fg-muted)]">حزم المواقع</h2>
              {editingId !== 'new' && (
                <Button size="sm" variant="primary" iconStart={<Plus size={14} strokeWidth={2.5} />} onClick={() => startEdit(null)}>
                  حزمة جديدة
                </Button>
              )}
            </div>

            {editingId === 'new' && (
              <BundleEditor
                draftName={draftName}
                draftDomains={draftDomains}
                setDraftName={setDraftName}
                setDraftDomains={setDraftDomains}
                onSave={() => saveBundle(null)}
                onCancel={() => { setEditingId(''); setDraftName(''); setDraftDomains(''); }}
                busy={busyId === 'new'}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {bundles.map(b => {
                const status = bundleStatus.get(b.id) || { state: 'off' };
                const isEditing = editingId === b.id;
                const isBusy    = busyId === b.id;
                if (isEditing) {
                  return (
                    <BundleEditor
                      key={b.id}
                      draftName={draftName}
                      draftDomains={draftDomains}
                      setDraftName={setDraftName}
                      setDraftDomains={setDraftDomains}
                      onSave={() => saveBundle(b)}
                      onCancel={() => { setEditingId(''); setDraftName(''); setDraftDomains(''); }}
                      busy={isBusy}
                    />
                  );
                }
                return (
                  <Card key={b.id} padding="md" tone={status.state === 'on' ? 'accent' : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[var(--p-fg)] text-base truncate">{b.name}</h3>
                          <BundleBadge state={status.state} />
                        </div>
                        <p className="text-xs text-[var(--p-fg-muted)] mt-1">
                          {(b.domains || []).length} موقع · {b.comment || ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBundle(b)}
                        disabled={isBusy || !!routerError}
                        aria-label={status.state === 'on' ? 'Disable' : 'Enable'}
                        className={`shrink-0 rounded-2xl p-2 transition-colors cursor-pointer ${
                          isBusy ? 'opacity-50 cursor-wait' : ''
                        } ${
                          status.state === 'on'
                            ? 'bg-[color-mix(in_oklab,var(--p-accent)_18%,transparent)] text-[var(--p-accent)] hover:bg-[color-mix(in_oklab,var(--p-accent)_28%,transparent)]'
                            : 'bg-[var(--p-bg-elevated)] text-[var(--p-fg-muted)] hover:text-[var(--p-fg)]'
                        }`}
                      >
                        {status.state === 'on' ? <ToggleRight size={28} strokeWidth={2.5} /> : <ToggleLeft size={28} strokeWidth={2.5} />}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(b.domains || []).slice(0, 8).map((d, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-1 rounded-lg bg-[var(--p-bg-elevated)] border border-[var(--p-border)] text-xs font-mono text-[var(--p-fg-muted)] truncate max-w-full"
                          dir="ltr"
                        >
                          {d}
                        </span>
                      ))}
                      {(b.domains || []).length > 8 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-[var(--p-bg-elevated)] text-xs text-[var(--p-fg-muted)]">
                          +{(b.domains || []).length - 8}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" variant="ghost" iconStart={<Pencil size={12} strokeWidth={2.5} />} onClick={() => startEdit(b)}>
                        تعديل
                      </Button>
                      <Button size="sm" variant="ghost" iconStart={<Trash2 size={12} strokeWidth={2.5} />} onClick={() => deleteBundle(b)}>
                        حذف
                      </Button>
                    </div>
                  </Card>
                );
              })}
              {bundles.length === 0 && editingId !== 'new' && (
                <div className="sm:col-span-2">
                  <Card padding="none">
                    <EmptyState
                      icon={Sparkles}
                      title="لا توجد حزم بعد"
                      body="أضف حزمة (مثل واتساب أو تيليجرام) لتفعيل الوصول المجاني لمجموعة مواقع دفعة واحدة."
                    />
                  </Card>
                </div>
              )}
            </div>
          </section>

          {/* Ad-hoc */}
          <section className="mb-8">
            <h2 className="label-eyebrow text-[var(--p-fg-muted)] mb-3">إضافة موقع مفرد</h2>
            <Card padding="md">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <Input
                  placeholder="example.com  أو  *.example.com"
                  value={adhocDst}
                  onChange={e => setAdhocDst(e.target.value)}
                />
                <Button
                  variant="primary"
                  iconStart={<Plus size={14} strokeWidth={2.5} />}
                  loading={adhocBusy}
                  disabled={!adhocDst.trim()}
                  onClick={addAdhoc}
                >
                  إضافة
                </Button>
              </div>

              {manualEntries.length > 0 && (
                <div className="mt-4 divide-y divide-[var(--p-border)]">
                  {manualEntries.map(e => (
                    <div key={e.id} className="flex items-center gap-3 py-2.5">
                      <Globe size={16} className="text-[var(--p-fg-muted)] shrink-0" strokeWidth={2.25} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-[var(--p-fg)] truncate" dir="ltr">{e.dst}</p>
                        {e.comment && <p className="text-xs text-[var(--p-fg-muted)] truncate" dir="ltr">{e.comment}</p>}
                      </div>
                      <Badge variant={e.action === 'accept' ? 'success' : 'danger'} size="sm">{e.action || 'accept'}</Badge>
                      <Button size="sm" variant="ghost" iconStart={<Trash2 size={12} strokeWidth={2.5} />} onClick={() => removeAdhoc(e)}>
                        إزالة
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          {/* Infrastructure (read-only) */}
          <section>
            <h2 className="label-eyebrow text-[var(--p-fg-muted)] mb-3">مواقع البنية التحتية</h2>
            <Card padding="md">
              <p className="text-xs text-[var(--p-fg-muted)] mb-3">
                هذه المواقع مطلوبة لعمل البوابة نفسها — لا يمكن حذفها من هنا. (راجع WIFI-SYSTEM.md §3).
              </p>
              <div className="divide-y divide-[var(--p-border)]">
                {INFRA_HOSTS.map(h => {
                  const onRouter = routerEntries.some(
                    e => String(e.dst || '').toLowerCase() === h.host.toLowerCase()
                  );
                  return (
                    <div key={h.host} className="flex items-center gap-3 py-2.5">
                      <Globe size={16} className="text-[var(--p-fg-muted)] shrink-0" strokeWidth={2.25} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-[var(--p-fg)] truncate" dir="ltr">{h.host}</p>
                        <p className="text-xs text-[var(--p-fg-muted)] truncate">{h.why}</p>
                      </div>
                      <Badge variant={onRouter ? 'success' : 'danger'} size="sm">
                        {onRouter ? 'موجود' : 'مفقود'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function BundleBadge({ state }) {
  if (state === 'on')      return <Badge variant="success" size="sm">مفعّلة</Badge>;
  if (state === 'partial') return <Badge variant="warning" size="sm">جزئيًا</Badge>;
  if (state === 'empty')   return <Badge variant="neutral" size="sm">فارغة</Badge>;
  return <Badge variant="neutral" size="sm">متوقّفة</Badge>;
}

function BundleEditor({ draftName, draftDomains, setDraftName, setDraftDomains, onSave, onCancel, busy }) {
  return (
    <Card padding="md">
      <div className="space-y-3">
        <Input
          label="اسم الحزمة"
          placeholder="مثلًا: واتساب"
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
        />
        <div>
          <label className="text-xs font-medium text-[var(--p-fg-muted)] block mb-2">
            المواقع (سطر أو فاصلة بين كل موقع)
          </label>
          <textarea
            value={draftDomains}
            onChange={e => setDraftDomains(e.target.value)}
            placeholder={`web.whatsapp.com\n*.whatsapp.net\n*.whatsapp.com`}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] text-[var(--p-fg)] font-mono text-sm focus:outline-none focus:border-[var(--p-fg)] focus-visible:ring-2 focus-visible:ring-[var(--p-ring)]"
            dir="ltr"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" iconStart={<Save size={14} strokeWidth={2.5} />} loading={busy} onClick={onSave}>
            حفظ
          </Button>
          <Button variant="ghost" iconStart={<X size={14} strokeWidth={2.5} />} onClick={onCancel}>
            إلغاء
          </Button>
        </div>
      </div>
    </Card>
  );
}
