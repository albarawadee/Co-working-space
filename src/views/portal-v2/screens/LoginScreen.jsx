import { ArrowUpRight, ShieldCheck, Zap, UsersRound, Ticket } from 'lucide-react';
import { Button, Input, BrandHeader } from '../../../portal';
import { usePortalChrome } from '../../portal/PortalChrome';

export function LoginScreen({ t, libraryName, query, setQuery, onSubmit, onVoucher }) {
  const { lang } = usePortalChrome();

  function handleSubmit(e) {
    e?.preventDefault();
    onSubmit?.(query);
  }

  return (
    <div className="max-w-md mx-auto px-5 sm:px-6 pt-20 pb-10 sm:pt-24">
      {/* Brand */}
      <header className="mb-10 sm:mb-12">
        <BrandHeader libraryName={libraryName} className="mb-8 sm:mb-10" />
        <p className="label-eyebrow text-[var(--p-accent)] mb-3">{t('brand.tagline')}</p>
        <h1 className="display-tight text-[var(--p-fg)] text-5xl sm:text-6xl font-black mb-3 p-enter">
          {t('v2.login.titleA')}
          <span className="block text-[var(--p-accent)]">{t('v2.login.titleB')}</span>
        </h1>
        <p className="text-[var(--p-fg-soft)] text-base leading-relaxed max-w-xs">
          {t('v2.login.subhead')}
        </p>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 p-enter" noValidate>
        <Input
          label={t('login.label')}
          placeholder={t('login.placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          numeric
          size="lg"
          autoFocus
          enterKeyHint="go"
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          disabled={!query.trim()}
          iconEnd={<ArrowUpRight size={18} strokeWidth={2.5} className={lang === 'ar' ? 'rotate-90' : ''} aria-hidden="true" />}
        >
          {t('login.cta')}
        </Button>
      </form>

      {/* Voucher CTA — second-citizen, doesn't compete with member login */}
      {onVoucher && (
        <button
          type="button"
          onClick={onVoucher}
          className="mt-4 w-full p-enter inline-flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--p-border)] bg-[var(--p-bg-elevated)] hover:border-[var(--p-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-ring)] transition-colors cursor-pointer px-4 py-3.5 text-start"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[color-mix(in_oklab,var(--p-accent)_18%,transparent)] text-[var(--p-accent)] flex items-center justify-center shrink-0">
              <Ticket size={16} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--p-fg)] text-sm truncate">{t('v2.voucher.ctaTitle')}</span>
              <span className="block text-xs text-[var(--p-fg-muted)] truncate">{t('v2.voucher.ctaSub')}</span>
            </span>
          </span>
          <ArrowUpRight
            size={16}
            strokeWidth={2.5}
            className={`text-[var(--p-fg-muted)] shrink-0 ${lang === 'ar' ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      {/* Trust strip */}
      <div className="grid grid-cols-3 gap-2 mt-8 p-enter">
        <Trust icon={Zap}        label={t('v2.login.tipFast')} />
        <Trust icon={ShieldCheck} label={t('v2.login.tipSecure')} />
        <Trust icon={UsersRound}  label={t('v2.login.tipFair')} />
      </div>
    </div>
  );
}

function Trust({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-[var(--p-bg-elevated)] border-2 border-[var(--p-border)]">
      <Icon size={16} strokeWidth={2.25} className="text-[var(--p-accent)]" aria-hidden="true" />
      <span className="label-eyebrow text-[var(--p-fg-muted)]">{label}</span>
    </div>
  );
}
