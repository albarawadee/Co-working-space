import { useState } from 'react';
import { Ticket, Check, Copy, ArrowLeft, ArrowUpRight, Wifi, Store } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { toCamel } from '../../lib/fieldMaps';
import { PortalShell, usePortalChrome } from './PortalChrome';

const STATE = { IDLE: 'idle', LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' };

/**
 * v1 captive-portal voucher redemption.
 *
 * On success we now do the SAME hidden-form POST to MikroTik's
 * `link-login-only` URL that the member path does — so the user is
 * logged into WiFi automatically instead of being asked to copy-paste
 * the username/password. The copy-buttons remain for users that hit
 * this page outside the captive context (e.g. typed the URL directly).
 *
 * `wifi_sessions.expires_at` is populated on first redemption so admin
 * views can show a real countdown — the MikroTik `limit-uptime` is
 * still the authoritative kick (session-worker on the bridge).
 */

function submitToMikroTikForm(username, password) {
  const urlParams = new URLSearchParams(window.location.search);
  const linkLoginOnly = urlParams.get('link-login-only');
  const linkOrig      = urlParams.get('link-orig') || '';
  if (!linkLoginOnly || !username) return false;
  const f = document.createElement('form');
  f.method = 'post';
  f.action = linkLoginOnly;
  const add = (n, v) => {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = n;
    i.value = v;
    f.appendChild(i);
  };
  add('username', username);
  add('password', password || username);
  add('dst', linkOrig || 'http://10.5.50.240:5173/');
  add('popup', 'true');
  document.body.appendChild(f);
  f.submit();
  return true;
}

export function PortalVoucher({ onBack }) {
  const { t, lang, navigate } = usePortalChrome();
  const [code, setCode] = useState('');
  const [state, setState] = useState(STATE.IDLE);
  const [session, setSession] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [copied, setCopied] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setState(STATE.LOADING);
    setErrorMsg('');
    setSession(null);

    try {
      const username = `WIFI-${trimmed}`;
      const { data: rows } = await supabase
        .from('wifi_sessions')
        .select('*')
        .eq('username', username)
        .eq('status', 'active')
        .eq('is_voucher', true)
        .limit(1);

      const found = rows?.[0] ? toCamel(rows[0]) : null;
      if (!found) {
        navigate(() => {
          setState(STATE.ERROR);
          setErrorMsg(t('vc.invalidBody'));
          setShakeKey(k => k + 1);
        });
        return;
      }

      // Populate expires_at on first redemption so admin views can
      // surface a real countdown. MikroTik `limit-uptime` is still the
      // authoritative kick (session-worker on the bridge).
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
        setState(STATE.SUCCESS);
      });

      // Auto-submit to MikroTik when we're inside the captive flow.
      const submitted = submitToMikroTikForm(found.username, found.password || found.username);
      if (submitted) setSubmittingForm(true);
    } catch (err) {
      console.error('[PortalVoucher] lookup error:', err);
      navigate(() => {
        setState(STATE.ERROR);
        setErrorMsg(t('login.errorConnection'));
        setShakeKey(k => k + 1);
      });
    }
  }

  function handleCopy(text, field) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  }

  function handleReset() {
    navigate(() => {
      setCode('');
      setState(STATE.IDLE);
      setSession(null);
      setErrorMsg('');
    }, 'back');
  }

  return (
    <PortalShell>
      <div className="max-w-md mx-auto px-5 sm:px-6 pt-20 pb-10 sm:pt-24">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[44px] py-2 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-amber-100 focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded-lg font-medium text-sm transition-colors mb-6 sm:mb-8 cursor-pointer"
        >
          <ArrowLeft size={14} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-180' : ''} aria-hidden="true" />
          {t('common.back')}
        </button>

        <header className="mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 mb-4">
            <Ticket size={14} className="text-amber-700 dark:text-amber-300" strokeWidth={2.5} aria-hidden="true" />
            <span className="label-eyebrow text-amber-700 dark:text-amber-300">{t('vc.eyebrow')}</span>
          </div>
          <h1 className="display-tight text-stone-900 dark:text-amber-50 text-5xl sm:text-6xl font-black mb-3">
            {t('vc.title')}
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-base leading-relaxed max-w-sm">
            {t('vc.subtitle')}
          </p>
        </header>

        <section
          className={`${state === STATE.ERROR && shakeKey ? 'v2-shake' : ''}`}
          key={shakeKey}
          aria-live="polite"
          aria-atomic="true"
        >
          {(state === STATE.IDLE || state === STATE.LOADING) && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="voucher-code" className="label-eyebrow text-stone-500 dark:text-stone-400 block mb-3">
                  {t('vc.label')}
                </label>
                <input
                  id="voucher-code"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="XXXXXX"
                  className="w-full px-3 sm:px-5 py-5 sm:py-6 text-center text-[2rem] sm:text-4xl font-black tracking-[0.25em] sm:tracking-[0.4em] bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-800 rounded-2xl text-stone-900 dark:text-amber-50 placeholder:text-stone-300 dark:placeholder:text-stone-700 placeholder:tracking-[0.2em] sm:placeholder:tracking-[0.3em] focus:outline-none focus:border-stone-900 dark:focus:border-amber-100 focus-visible:ring-2 focus-visible:ring-amber-400/40 transition-colors duration-200 font-mono tabular-nums min-h-[72px]"
                  maxLength={6}
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="go"
                  aria-describedby="voucher-helper"
                  autoFocus
                  dir="ltr"
                />
                <p id="voucher-helper" className="text-stone-400 dark:text-stone-600 text-xs mt-2 text-center font-medium">{t('vc.helper')}</p>
              </div>

              <button
                type="submit"
                disabled={code.trim().length < 3 || state === STATE.LOADING}
                aria-busy={state === STATE.LOADING}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-5 rounded-2xl bg-stone-900 dark:bg-amber-100 text-amber-50 dark:text-stone-900 font-semibold text-base hover:bg-stone-800 dark:hover:bg-amber-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:focus-visible:ring-offset-stone-950 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[56px]"
              >
                {state === STATE.LOADING ? (
                  <>
                    <span className="w-5 h-5 border-2 border-amber-50/30 dark:border-stone-900/30 border-t-amber-50 dark:border-t-stone-900 rounded-full animate-spin" aria-hidden="true" />
                    <span>{t('common.checking')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('vc.cta')}</span>
                    <ArrowUpRight size={18} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-90' : ''} aria-hidden="true" />
                  </>
                )}
              </button>

              {/* No voucher helper */}
              <div className="mt-2 rounded-2xl bg-white dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                  <Store size={16} className="text-amber-700 dark:text-amber-300" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 dark:text-amber-50 text-sm break-words">{t('vc.noVoucherTitle')}</p>
                  <p className="text-stone-600 dark:text-stone-400 text-xs mt-0.5 leading-relaxed">
                    {t('vc.noVoucherBody')}
                  </p>
                </div>
              </div>
            </form>
          )}

          {state === STATE.SUCCESS && session && (
            <div className="v2-enter">
              <div className="rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-5 sm:p-6 mb-4">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                    {submittingForm ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" className="v2-draw" style={{ strokeDasharray: 100 }} />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-stone-900 dark:text-amber-50 text-lg leading-tight break-words">
                      {submittingForm ? t('vc.accepted') : t('vc.accepted')}
                    </p>
                    <p className="text-stone-600 dark:text-stone-400 text-xs mt-0.5">
                      {submittingForm ? t('common.checking') : t('vc.acceptedSub')}
                    </p>
                  </div>
                </div>

                {!submittingForm && (
                  <>
                    <div className="flex items-center gap-2 pb-4 mb-4 border-b border-emerald-200 dark:border-emerald-800">
                      <Wifi size={14} className="text-emerald-700 dark:text-emerald-400" strokeWidth={2.5} aria-hidden="true" />
                      <span className="label-eyebrow text-emerald-700 dark:text-emerald-400">{t('vc.creds')}</span>
                    </div>

                    <div className="space-y-3">
                      <CredRow label={t('common.username')} value={session.username} copied={copied === 'user'} onCopy={() => handleCopy(session.username, 'user')} t={t} />
                      {session.password && (
                        <>
                          <div className="h-px bg-emerald-200 dark:bg-emerald-800" />
                          <CredRow label={t('common.password')} value={session.password} copied={copied === 'pass'} onCopy={() => handleCopy(session.password, 'pass')} t={t} />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onBack}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-5 rounded-2xl bg-stone-900 dark:bg-amber-100 text-amber-50 dark:text-stone-900 font-semibold text-base hover:bg-stone-800 dark:hover:bg-amber-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:focus-visible:ring-offset-stone-950 transition-all duration-200 cursor-pointer min-h-[56px]"
              >
                {t('common.backToSignIn')}
                <ArrowUpRight size={18} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-90' : ''} aria-hidden="true" />
              </button>
            </div>
          )}

          {state === STATE.ERROR && (
            <div className="v2-enter rounded-2xl bg-white dark:bg-stone-900 border-2 border-red-200 dark:border-red-900 p-5 sm:p-6" role="alert">
              <p className="font-bold text-stone-900 dark:text-amber-50 text-lg mb-1 break-words">{t('vc.invalid')}</p>
              <p className="text-stone-600 dark:text-stone-400 text-sm mb-5 break-words" style={{ overflowWrap: 'anywhere' }}>{errorMsg}</p>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 min-h-[44px] py-2 text-stone-900 dark:text-amber-100 font-semibold text-sm hover:gap-2.5 focus-visible:ring-2 focus-visible:ring-amber-400/50 rounded-lg transition-all cursor-pointer"
              >
                {t('common.tryAgain')} <ArrowUpRight size={14} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-90' : ''} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

function CredRow({ label, value, copied, onCopy, t }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-stone-600 dark:text-stone-400 text-sm font-medium shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-stone-900 dark:text-amber-50 font-mono text-sm font-semibold truncate select-all"
          dir="ltr"
          style={{ userSelect: 'all', WebkitUserSelect: 'all' }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="w-11 h-11 rounded-lg bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 focus-visible:ring-2 focus-visible:ring-emerald-400/50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          aria-label={t('common.copy', { label })}
          aria-live="polite"
        >
          {copied ? <Check size={14} className="text-emerald-700 dark:text-emerald-400" strokeWidth={2.5} aria-hidden="true" /> : <Copy size={14} className="text-stone-600 dark:text-stone-400" strokeWidth={2.5} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
