import { Switch } from 'antd'
import { useTranslation } from 'react-i18next'

interface WebhookStatusHeaderProps {
  enabled: boolean
  /** Whether the toggle may be turned on (endpoint + token saved). */
  canEnable: boolean
  /** Fires the requested next state — the page confirms before persisting. */
  onToggleRequest: (next: boolean) => void
}

export function WebhookStatusHeader({
  enabled,
  canEnable,
  onToggleRequest,
}: WebhookStatusHeaderProps) {
  const { t } = useTranslation('integrations')
  // Can't switch ON until configured; can always switch OFF.
  const toggleDisabled = !enabled && !canEnable

  return (
    <div className="mb-6">
      {/* Title + status toggle share one row on both breakpoints. */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="m-0 leading-tight font-bold text-[var(--color-text)] font-[var(--font-display)] text-[20px] md:text-[26px]">
          {t('title')}
        </h1>
        <div className="inline-flex items-center gap-2.5 h-10 px-3.5 rounded-[12px] bg-[var(--color-card)] shrink-0 border-[1.5px] border-solid border-[var(--color-border-strong)]">
          <Switch
            checked={enabled}
            disabled={toggleDisabled}
            onChange={(next) => onToggleRequest(next)}
          />
          <span
            className={`text-[13px] font-medium whitespace-nowrap ${
              enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {enabled ? t('status.active') : t('status.inactive')}
          </span>
        </div>
      </div>

      {toggleDisabled && (
        <p className="text-[11.5px] text-[var(--color-text-subtle)] mt-2 mb-0">
          {t('toggle.lockedHint')}
        </p>
      )}
    </div>
  )
}
