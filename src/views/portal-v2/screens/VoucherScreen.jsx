import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Ticket, ShieldCheck, Zap, Timer } from 'lucide-react';
import { Button, BrandHeader } from '../../../portal';
import { usePortalChrome } from '../../portal/PortalChrome';
import { supabase } from '../../../lib/supabaseClient';
import { toCamel } from '../../../lib/fieldMaps';

/**
 * Voucher redemption screen — `#wifi-v2?voucher=1`.
 *
 * Flow:
 *   idle → submitting → ( success → auto-POST to MikroTik | not_found | inactive )
 *
 * Behaviour parity with member-login (LoginScreen + submitToMikroTik):
 * once the voucher is matched in Supabase we build the same hidden form
 * POST to MikroTik's `link-login-only` URL — username + password are
 * BOTH the full `WIFI-XXXXXX` code (matching the hotspot user that
 * `mtkCreateSession` provisioned). `dst` falls back to `link-orig` or
 * the captive portal's success page so iOS/Android finish the captive
 * detection loop the same way the member path does.
 *
 * `wifi_sessions.expires_at` is populated on first successful redemption
 * (when it's still NULL) so admin views can show a real expiry timestamp
 * — MikroTik's `limit-uptime` still drives the actual kick (handled by
 * `session-worker.js` on the bridge).
 */
const STATES = {
  IDLE:       'idle',
  SUBMITTING: 'submitting',
  SUCCESS:    'success',
  NOT_FOUND:  'not_found',
};

export function VoucherScreen({ t, libraryName, submitToMikroTik, onBack }) {
  const { lang, navigate } = usePortalChrome();

  const [code, setCode]         = useState('');
  const [state, setState]       = useState(STATES.IDLE);
  const [session, setSession]   = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 3) return;

    navigate(() => setState(STATES.SUBMITTING));
    setErrorMsg('');
    setSession(null);

    try {
      const username = `WIFI-${trimmed}`;
      const { data: rows, error } = await supabase
        .from('wifi_sessions')
        .select('*')
        .eq('username', username)
        .eq('is_voucher', true)
        .limit(1);

      if (error) throw error;

      const found = rows?.[0] ? toCamel(rows[0]) : null;

      if (!found) {
        navigate(() => {
          setState(STATES.NOT_FOUND);
          setErrorMsg(t('v2.voucher.errNotFound'));
          setShakeKey(k => k + 1);
        });
        return;
      }

      if (found.status !== 'active') {
        navigate(() => {
          setState(STATES.NOT_FOUND);
          setErrorMsg(
            found.status === 'expired'
              ? t('v2.voucher.errExpired')
              : t('v2.voucher.errInactive')
          );
          setShakeKey(k => k + 1);
        });
        return;
      }

      // Populate expires_at on first redemption so admin views can
      // surface a real countdown. MikroTik `limit-uptime` is still the
      // authoritative kick.
      if (!found.expiresAt && found.durationMinutes) {
        const expiresAt = new Date(Date.now() + found.durationMinutes * 60_000).toISOString();
        supabase
          .from('wifi_sessions')
          .update({ expires_at: expiresAt, started_at: new Date().toISOString() })
          .eq('id', found.id)
          .then(() => {});
      }

      navigate(() => {
        setSession(found);
        setState(STATES.SUCCESS);
      });

      // Same hidden-form POST pattern the member path uses — only the
      // credential pair differs (here both fields = full WIFI-XXXXXX).
      submitToMikroTik?.(found.username, found.password || found.username);
    } catch (err) {
      console.error('[VoucherScreen] redeem error:', err);
      navigate(() => {
        setState(STATES.NOT_FOUND);
        setErrorMsg(t('login.errorConnection'));
        setShakeKey(k => k + 1);
      });
    }
  }

  function handleReset() {
    navigate(() => {
      setCode('');
      setSession(null);
      setErrorMsg('');
      setState(STATES.IDLE);
    }, 'back');
  }

  return (
    <div className="max-w-md mx-auto px-5 sm:px-6 pt-20 pb-10 sm:pt-24">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 min-h-[44px] py-2 text-[var(--p-fg-muted)] hover:text-[var(--p-fg)] font-medium text-sm transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft size={14} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-180' : ''} aria-hidden="true" />
        {t('v2.voucher.backToMember')}
      </button>

      <header className="mb-10 sm:mb-12">
        <BrandHeader libraryName={libraryName} className="mb-6 sm:mb-8" />
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color-mix(in_oklab,var(--p-accent)_15%,transparent)] mb-4">
          <Ticket size={14} className="text-[var(--p-accent)]" strokeWidth={2.5} aria-hidden="true" />
          <span className="label-eyebrow text-[var(--p-accent)]">{t('v2.voucher.eyebrow')}</span>
        </div>
        <h1 className="display-tight text-[var(--p-fg)] text-5xl sm:text-6xl font-black mb-3 p-enter">
          {t('v2.voucher.titleA')}
          <span className="block text-[var(--p-accent)]">{t('v2.voucher.titleB')}</span>
        </h1>
        <p className="text-[var(--p-fg-soft)] text-base leading-relaxed max-w-xs">
          {t('v2.voucher.subhead')}
        </p>
      </header>

      <section
        className={state === STATES.NOT_FOUND && shakeKey ? 'p-shake' : 'p-enter'}
        key={shakeKey}
        aria-live="polite"
        aria-atomic="true"
      >
        {(state === STATES.IDLE || state === STATES.SUBMITTING) && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="voucher-code-v2" className="label-eyebrow text-[var(--p-fg-muted)] block mb-3">
                {t('v2.voucher.label')}
              </label>
              <input
                id="voucher-code-v2"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="XXXXXX"
                className="w-full px-3 sm:px-5 py-5 sm:py-6 text-center text-[2rem] sm:text-4xl font-black tracking-[0.25em] sm:tracking-[0.4em] bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)] rounded-2xl text-[var(--p-fg)] placeholder:text-[var(--p-fg-muted)] placeholder:opacity-40 placeholder:tracking-[0.2em] sm:placeholder:tracking-[0.3em] focus:outline-none focus:border-[var(--p-fg)] focus-visible:ring-2 focus-visible:ring-[var(--p-ring)] transition-colors duration-200 font-mono tabular-nums min-h-[72px]"
                maxLength={6}
                inputMode="text"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                autoFocus
                dir="ltr"
              />
              <p className="text-[var(--p-fg-muted)] text-xs mt-2 text-center font-medium">
                {t('v2.voucher.helper')}
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              full
              disabled={code.trim().length < 3}
              loading={state === STATES.SUBMITTING}
              iconEnd={<ArrowUpRight size={18} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-90' : ''} aria-hidden="true" />}
            >
              {t('v2.voucher.cta')}
            </Button>
          </form>
        )}

        {state === STATES.SUCCESS && session && (
          <div className="p-enter rounded-3xl border-2 border-[color-mix(in_oklab,var(--p-success,#16a34a)_40%,var(--p-border))] bg-[color-mix(in_oklab,var(--p-success,#16a34a)_8%,var(--p-bg-elevated))] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--p-success,#16a34a)] flex items-center justify-center shrink-0 text-white">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[var(--p-fg)] text-lg leading-tight">
                  {t('v2.voucher.accepted')}
                </p>
                <p className="text-[var(--p-fg-muted)] text-xs mt-1">
                  {t('v2.voucher.acceptedSub')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat icon={Timer} label={t('v2.voucher.duration')} value={session.durationMinutes ? `${session.durationMinutes}m` : '—'} />
              <Stat icon={Zap} label={t('v2.voucher.speed')} value={session.speedProfile?.replace('svs-', '') || '—'} />
              <Stat icon={ShieldCheck} label={t('v2.voucher.status')} value={t('v2.voucher.active')} />
            </div>
          </div>
        )}

        {state === STATES.NOT_FOUND && (
          <div className="p-enter rounded-2xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-danger-border,#fecaca)] p-5 sm:p-6" role="alert">
            <p className="font-bold text-[var(--p-fg)] text-lg mb-1">{t('v2.voucher.invalid')}</p>
            <p className="text-[var(--p-fg-muted)] text-sm mb-5" style={{ overflowWrap: 'anywhere' }}>{errorMsg}</p>
            <Button variant="ghost" size="md" onClick={handleReset} iconEnd={<ArrowUpRight size={14} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-90' : ''} aria-hidden="true" />}>
              {t('common.tryAgain')}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)]">
      <Icon size={16} strokeWidth={2.25} className="text-[var(--p-accent)]" aria-hidden="true" />
      <span className="label-eyebrow text-[var(--p-fg-muted)] truncate max-w-full px-1">{label}</span>
      <span className="text-[var(--p-fg)] font-bold text-sm tabular-nums">{value}</span>
    </div>
  );
}
