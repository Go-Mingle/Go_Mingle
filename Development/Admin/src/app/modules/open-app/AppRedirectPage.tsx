import { Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { GoMingleLogo } from '../../atoms/GoMingleLogo'
import { useAppRedirect } from './hooks/useAppRedirect'

/**
 * Public, unauthenticated landing page for shared links (Share Table, Refer a
 * Friend). It opens the GoMingle app when installed and otherwise forwards to
 * the App Store, Play Store, or the marketing site — see {@link useAppRedirect}.
 *
 * Rendered only for the moment the hand-off takes, so it stays a single
 * centered status card with no navigation of its own.
 */
export function AppRedirectPage() {
  const { t } = useTranslation('open-app')
  useAppRedirect()

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-page)] px-6 py-10">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-8 py-12 text-center"
      >
        <GoMingleLogo height={40} />
        <Spin size="large" />
        <h1 className="m-0 font-[var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
          {t('title')}
        </h1>
        <p className="m-0 font-[var(--font-ui)] text-sm leading-relaxed text-[var(--color-text-muted)]">
          {t('subtitle')}
        </p>
      </div>
    </main>
  )
}
