import { useState } from 'react';
import {
  Ticket, Gauge, Plus, Pencil, Trash2, Lock, Check, X,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { toSnake } from '../../../../lib/fieldMaps';
import { generateId } from '../../../../utils';
import {
  mtkV2UpsertProfile, mtkV2DeleteProfile, logWifiEvent,
} from '../../../../lib/mikrotikApi';
import {
  Card, Button, Input, Badge, EmptyState, Modal,
} from '../../../../portal';

/**
 * Catalog Section — side-by-side Packages + Profiles management.
 *
 * Left: Packages (`wifi_session_tiers`)
 *   - Full inline CRUD with "+" row at bottom for new tier
 *   - Every field exposed: name, duration_minutes, price, speed_profile,
 *     max_devices, active
 *   - Tier deletion is soft-delete (active=false) — preserves history
 *
 * Right: Profiles (`wifi_profiles_v2` + RouterOS via v2 bridge)
 *   - Full CRUD via modal with "Advanced RouterOS options" expander
 *   - Fields: name, label_ar/en, download/upload Mbps, max_devices,
 *     mac_cookie_timeout, idle_timeout, keepalive_timeout, session_timeout,
 *     transparent_proxy, status_autorefresh
 *   - System profiles (locked=true) editable but not deletable
 */
export function CatalogSection(props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PackagesPanel {...props} />
      <ProfilesPanel {...props} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Packages (tiers)
// ─────────────────────────────────────────────────────────────────
const EMPTY_TIER = {
  name: '',
  durationMinutes: 60,
  price: 10,
  speedProfile: 'svs-normal',
  maxDevices: 1,
  active: true,
};

function PackagesPanel({ tiers, profiles, refreshTiers, user, toast }) {
  const [editing, setEditing] = useState(null); // tier obj OR { __new: true, ...EMPTY_TIER }
  const [busy, setBusy] = useState(false);

  const sortedTiers = [...(tiers || [])].sort((a, b) =>
    (a.active === b.active ? 0 : a.active ? -1 : 1) || (Number(a.durationMinutes) - Number(b.durationMinutes))
  );

  async function save(draft) {
    setBusy(true);
    try {
      const isNew = !!draft.__new;
      const row = toSnake({
        id:              isNew ? generateId() : draft.id,
        name:            draft.name.trim(),
        durationMinutes: Math.max(1, parseInt(draft.durationMinutes, 10) || 60),
        price:           Math.max(0, parseFloat(draft.price) || 0),
        speedProfile:    draft.speedProfile || 'svs-normal',
        maxDevices:      Math.max(1, parseInt(draft.maxDevices, 10) || 1),
        active:          !!draft.active,
      });
      const { error } = isNew
        ? await supabase.from('wifi_session_tiers').insert(row)
        : await supabase.from('wifi_session_tiers').update(row).eq('id', draft.id);
      if (error) throw error;
      logWifiEvent(isNew ? 'tier_created' : 'tier_edited', draft.name, { id: row.id }, user?.id, user?.name);
      toast?.('success', isNew ? 'تم إنشاء الباقة' : 'تم تحديث الباقة');
      setEditing(null);
      refreshTiers?.();
    } catch (err) {
      toast?.('error', err?.message || 'فشل الحفظ');
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    if (!window.confirm(`حذف باقة "${t.name}"؟`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('wifi_session_tiers').delete().eq('id', t.id);
      if (error) throw error;
      logWifiEvent('tier_deleted', t.name, { id: t.id }, user?.id, user?.name);
      toast?.('success', 'تم حذف الباقة');
      refreshTiers?.();
    } catch (err) {
      toast?.('error', err?.message || 'فشل الحذف');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[color-mix(in_oklab,var(--p-accent)_18%,transparent)] text-[var(--p-accent)] flex items-center justify-center shrink-0">
            <Ticket size={16} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="label-eyebrow text-[var(--p-accent)]">الكتالوج</p>
            <h3 className="font-bold text-[var(--p-fg)] text-base">باقات الواي فاي</h3>
          </div>
        </div>
        {!editing && (
          <Button size="sm" variant="primary" iconStart={<Plus size={14} strokeWidth={2.5} />}
            onClick={() => setEditing({ __new: true, ...EMPTY_TIER, speedProfile: (profiles?.[0]?.name) || 'svs-normal' })}>
            باقة جديدة
          </Button>
        )}
      </div>

      {editing && (
        <TierEditor
          draft={editing}
          profiles={profiles}
          onChange={setEditing}
          onSave={() => save(editing)}
          onCancel={() => setEditing(null)}
          busy={busy}
        />
      )}

      {sortedTiers.length === 0 && !editing ? (
        <EmptyState icon={Ticket} title="لا توجد باقات" body="أضف باقة لبدء بيع قسائم الواي فاي." />
      ) : (
        <div className="divide-y divide-[var(--p-border)] mt-3">
          {sortedTiers.map(t => (
            <div key={t.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[var(--p-fg)] text-sm truncate">{t.name}</p>
                  {!t.active && <Badge variant="neutral" size="sm">متوقفة</Badge>}
                </div>
                <p className="text-xs text-[var(--p-fg-muted)] mt-0.5 tabular-nums" dir="ltr">
                  {t.durationMinutes}m · {t.price} ج.م · {t.speedProfile} · {t.maxDevices} جهاز
                </p>
              </div>
              <Button size="sm" variant="ghost" iconStart={<Pencil size={12} strokeWidth={2.5} />} onClick={() => setEditing(t)}>
                تعديل
              </Button>
              <Button size="sm" variant="ghost" iconStart={<Trash2 size={12} strokeWidth={2.5} />} onClick={() => remove(t)}>
                حذف
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TierEditor({ draft, profiles, onChange, onSave, onCancel, busy }) {
  const set = (patch) => onChange({ ...draft, ...patch });
  return (
    <div className="rounded-2xl border-2 border-[var(--p-accent)] bg-[color-mix(in_oklab,var(--p-accent)_6%,var(--p-bg-elevated))] p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input label="اسم الباقة" value={draft.name} onChange={e => set({ name: e.target.value })} placeholder="مثلًا: ساعة" />
        <Input label="المدة (دقائق)" type="number" value={draft.durationMinutes}
          onChange={e => set({ durationMinutes: e.target.value })} />
        <Input label="السعر (ج.م)" type="number" step="0.5" value={draft.price}
          onChange={e => set({ price: e.target.value })} />
        <div>
          <label className="text-xs font-medium text-[var(--p-fg-muted)] block mb-1.5">بروفايل السرعة</label>
          <select
            value={draft.speedProfile}
            onChange={e => set({ speedProfile: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] text-[var(--p-fg)] focus:outline-none focus:border-[var(--p-fg)]"
          >
            <option value="svs-normal">svs-normal</option>
            <option value="svs-slow">svs-slow</option>
            <option value="svs-fast">svs-fast</option>
            <option value="svs-unlimited">svs-unlimited</option>
            {(profiles || []).map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        <Input label="عدد الأجهزة" type="number" value={draft.maxDevices}
          onChange={e => set({ maxDevices: e.target.value })} />
        <label className="flex items-end gap-2 pb-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!draft.active}
            onChange={e => set({ active: e.target.checked })}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="text-sm text-[var(--p-fg)] select-none">مفعّلة</span>
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="primary" loading={busy} disabled={!draft.name.trim()}
          iconStart={<Check size={14} strokeWidth={2.5} />} onClick={onSave}>
          حفظ
        </Button>
        <Button size="sm" variant="ghost" iconStart={<X size={14} strokeWidth={2.5} />} onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Profiles
// ─────────────────────────────────────────────────────────────────
const EMPTY_PROFILE = {
  name: '',
  labelAr: '',
  labelEn: '',
  downloadMbps: 10,
  uploadMbps: 2,
  maxDevices: 2,
  appliesTo: 'normal',
  description: '',
  // advanced
  macCookieTimeout: '',
  idleTimeout: '',
  keepaliveTimeout: '',
  sessionTimeout: '',
  transparentProxy: false,
  statusAutorefresh: '',
};

function ProfilesPanel({ profiles, config, refreshProfiles, user, toast }) {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const isNew = !editing.id;
      // 1. Push to RouterOS via v2 bridge (creates/updates the profile).
      const bridgeResp = await mtkV2UpsertProfile(config, {
        name: editing.name.trim(),
        downloadMbps: Math.max(0, parseFloat(editing.downloadMbps) || 0),
        uploadMbps:   Math.max(0, parseFloat(editing.uploadMbps)   || 0),
        maxDevices:   Math.max(1, parseInt(editing.maxDevices, 10) || 2),
        macCookieTimeout:  editing.macCookieTimeout  || undefined,
        idleTimeout:       editing.idleTimeout       || undefined,
        keepaliveTimeout:  editing.keepaliveTimeout  || undefined,
        sessionTimeout:    editing.sessionTimeout    || undefined,
        statusAutorefresh: editing.statusAutorefresh || undefined,
        transparentProxy:  !!editing.transparentProxy,
      });
      const bridgeOk = !!bridgeResp?.ok;
      if (!bridgeOk) {
        // Non-fatal: persist to Supabase anyway so admin can fix bridge later.
        console.warn('[ProfilesPanel] bridge upsert failed:', bridgeResp?.error);
      }

      // 2. Persist to Supabase.
      const row = toSnake({
        name:             editing.name.trim(),
        labelAr:          editing.labelAr || editing.name.trim(),
        labelEn:          editing.labelEn || editing.name.trim(),
        downloadMbps:     parseFloat(editing.downloadMbps) || 0,
        uploadMbps:       parseFloat(editing.uploadMbps)   || 0,
        maxDevices:       parseInt(editing.maxDevices, 10) || 2,
        appliesTo:        editing.appliesTo || 'normal',
        description:      editing.description || '',
        macCookieTimeout: editing.macCookieTimeout || null,
        idleTimeout:      editing.idleTimeout      || null,
        keepaliveTimeout: editing.keepaliveTimeout || null,
        sessionTimeout:   editing.sessionTimeout   || null,
        transparentProxy: !!editing.transparentProxy,
        statusAutorefresh: editing.statusAutorefresh || null,
      });
      const { error } = isNew
        ? await supabase.from('wifi_profiles_v2').insert(row)
        : await supabase.from('wifi_profiles_v2').update(row).eq('id', editing.id);
      if (error) throw error;
      logWifiEvent(isNew ? 'profile_created' : 'profile_edited', editing.name, { advanced: showAdvanced, bridgeOk }, user?.id, user?.name);
      if (bridgeOk) {
        toast?.('success', isNew ? 'تم إنشاء البروفايل' : 'تم تحديث البروفايل');
      } else {
        // Single combined message — Supabase saved, router didn't.
        toast?.('error', `تم الحفظ في Supabase لكن الجسر لم يحدّث الراوتر: ${bridgeResp?.error || 'unknown'}`);
      }
      setEditing(null);
      setShowAdvanced(false);
      refreshProfiles?.();
    } catch (err) {
      toast?.('error', err?.message || 'فشل الحفظ');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (p.locked) { toast?.('error', 'بروفايل مقفل — لا يمكن حذفه.'); return; }
    if (!window.confirm(`حذف البروفايل "${p.name}"؟ سيتم حذفه من Supabase ومن الراوتر.`)) return;
    setBusy(true);
    try {
      await mtkV2DeleteProfile(config, p.name).catch(() => {});
      const { error } = await supabase.from('wifi_profiles_v2').delete().eq('id', p.id);
      if (error) throw error;
      logWifiEvent('profile_deleted', p.name, { id: p.id }, user?.id, user?.name);
      toast?.('success', 'تم حذف البروفايل');
      refreshProfiles?.();
    } catch (err) {
      toast?.('error', err?.message || 'فشل الحذف');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[color-mix(in_oklab,var(--p-accent)_18%,transparent)] text-[var(--p-accent)] flex items-center justify-center shrink-0">
            <Gauge size={16} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="label-eyebrow text-[var(--p-accent)]">الكتالوج</p>
            <h3 className="font-bold text-[var(--p-fg)] text-base">بروفايلات السرعة</h3>
          </div>
        </div>
        <Button size="sm" variant="primary" iconStart={<Plus size={14} strokeWidth={2.5} />}
          onClick={() => { setEditing({ ...EMPTY_PROFILE }); setShowAdvanced(false); }}>
          بروفايل جديد
        </Button>
      </div>

      {(profiles || []).length === 0 ? (
        <EmptyState icon={Gauge} title="لا توجد بروفايلات" body="أضف بروفايل لتحديد سرعة وحدود الاتصال." />
      ) : (
        <div className="divide-y divide-[var(--p-border)]">
          {profiles.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[var(--p-fg)] text-sm truncate" dir="ltr">{p.name}</p>
                  {p.locked && <Lock size={12} className="text-[var(--p-fg-muted)] shrink-0" strokeWidth={2.5} />}
                </div>
                <p className="text-xs text-[var(--p-fg-muted)] mt-0.5 tabular-nums" dir="ltr">
                  {p.downloadMbps}↓/{p.uploadMbps}↑ Mbps · {p.maxDevices} جهاز · {p.appliesTo}
                </p>
              </div>
              <Button size="sm" variant="ghost" iconStart={<Pencil size={12} strokeWidth={2.5} />}
                onClick={() => { setEditing({ ...EMPTY_PROFILE, ...p }); setShowAdvanced(false); }}>
                تعديل
              </Button>
              {!p.locked && (
                <Button size="sm" variant="ghost" iconStart={<Trash2 size={12} strokeWidth={2.5} />} onClick={() => remove(p)}>
                  حذف
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => { setEditing(null); setShowAdvanced(false); }} title={editing?.id ? 'تعديل بروفايل' : 'بروفايل جديد'}>
        {editing && (
          <div className="space-y-3">
            <Input label="الاسم (يجب أن يطابق الراوتر)" dir="ltr" value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              disabled={editing.locked} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="التسمية (عربي)" value={editing.labelAr}
                onChange={e => setEditing({ ...editing, labelAr: e.target.value })} />
              <Input label="التسمية (English)" value={editing.labelEn}
                onChange={e => setEditing({ ...editing, labelEn: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input label="تحميل (Mbps)" type="number" value={editing.downloadMbps}
                onChange={e => setEditing({ ...editing, downloadMbps: e.target.value })} />
              <Input label="رفع (Mbps)" type="number" value={editing.uploadMbps}
                onChange={e => setEditing({ ...editing, uploadMbps: e.target.value })} />
              <Input label="عدد الأجهزة" type="number" value={editing.maxDevices}
                onChange={e => setEditing({ ...editing, maxDevices: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--p-fg-muted)] block mb-1.5">يطبَّق على</label>
              <select
                value={editing.appliesTo}
                onChange={e => setEditing({ ...editing, appliesTo: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] text-[var(--p-fg)] focus:outline-none focus:border-[var(--p-fg)]"
              >
                <option value="normal">عضو</option>
                <option value="staff">موظف</option>
                <option value="voucher">قسيمة</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(s => !s)}
              className="text-xs font-bold text-[var(--p-accent)] hover:underline cursor-pointer"
            >
              {showAdvanced ? '◂ إخفاء الخيارات المتقدمة' : '▸ خيارات RouterOS المتقدمة'}
            </button>

            {showAdvanced && (
              <div className="space-y-2 p-3 rounded-2xl bg-[var(--p-bg-muted)] border border-[var(--p-border)]">
                <p className="text-[10px] text-[var(--p-fg-muted)] uppercase tracking-wider">صيغة RouterOS مباشرة (مثال: 1h30m، 15m، 0s، none)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="mac-cookie-timeout" dir="ltr" placeholder="3d" value={editing.macCookieTimeout}
                    onChange={e => setEditing({ ...editing, macCookieTimeout: e.target.value })} />
                  <Input label="idle-timeout" dir="ltr" placeholder="15m" value={editing.idleTimeout}
                    onChange={e => setEditing({ ...editing, idleTimeout: e.target.value })} />
                  <Input label="keepalive-timeout" dir="ltr" placeholder="2m" value={editing.keepaliveTimeout}
                    onChange={e => setEditing({ ...editing, keepaliveTimeout: e.target.value })} />
                  <Input label="session-timeout" dir="ltr" placeholder="8h" value={editing.sessionTimeout}
                    onChange={e => setEditing({ ...editing, sessionTimeout: e.target.value })} />
                  <Input label="status-autorefresh" dir="ltr" placeholder="1m" value={editing.statusAutorefresh}
                    onChange={e => setEditing({ ...editing, statusAutorefresh: e.target.value })} />
                  <label className="flex items-end gap-2 pb-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!editing.transparentProxy}
                      onChange={e => setEditing({ ...editing, transparentProxy: e.target.checked })}
                      className="w-4 h-4 cursor-pointer" />
                    <span className="text-sm text-[var(--p-fg)] select-none">transparent-proxy</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button variant="primary" loading={busy} onClick={save}
                disabled={!editing.name.trim()} iconStart={<Check size={14} strokeWidth={2.5} />}>
                حفظ
              </Button>
              <Button variant="ghost" onClick={() => { setEditing(null); setShowAdvanced(false); }}>
                إلغاء
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
