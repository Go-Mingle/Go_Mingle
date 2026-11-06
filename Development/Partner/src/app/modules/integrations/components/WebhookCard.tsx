import { Tooltip } from 'antd'
import { Info } from '@phosphor-icons/react'

interface WebhookCardProps {
  title: string
  sub?: string
  /** Actionable info shown in a tooltip beside the title. */
  titleInfo?: string
  /** Optional element pinned to the top-right of the card header (e.g. a toggle). */
  right?: React.ReactNode
  children?: React.ReactNode
}

/** Standard portal card used for every section on the Webhooks page. */
export function WebhookCard({ title, sub, titleInfo, right, children }: WebhookCardProps) {
  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-[var(--color-text)] font-[var(--font-display)] m-0">
              {title}
            </h2>
            {titleInfo && (
              <Tooltip title={titleInfo}>
                <Info size={15} className="text-[var(--color-text-subtle)] cursor-help shrink-0" />
              </Tooltip>
            )}
          </div>
          {sub && (
            <p className="text-[13px] text-[var(--color-text-muted)] mt-1 mb-0 leading-[1.5] max-w-[64ch]">
              {sub}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
