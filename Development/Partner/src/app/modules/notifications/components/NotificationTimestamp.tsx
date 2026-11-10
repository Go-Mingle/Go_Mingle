import { useTranslation } from 'react-i18next'
import { relativeTime } from '../format'

/**
 * A notification's age, per the BR-11 ladder.
 *
 * One component for both surfaces so they cannot drift: the prototype had a hand-rolled
 * `Xm ago` in the dropdown and an absolute `D MMM YYYY, h:mm A` on the full screen, which
 * meant the same notification read differently depending on where you looked at it.
 *
 * The ladder itself lives in `format.ts` and returns a key rather than a string — module
 * format files in this repo do not call `t()` — so this is the piece that translates it.
 */
export function NotificationTimestamp({
  createdAt,
  className,
}: {
  createdAt: string
  className?: string
}) {
  const { t } = useTranslation('notifications')
  const parts = relativeTime(createdAt)

  const text =
    parts.kind === 'absolute'
      ? parts.absolute
      : parts.kind === 'key'
        ? t(`relative.${parts.key}`)
        : t(`relative.${parts.key}`, { count: parts.count })

  return (
    <span className={className} title={text}>
      {text}
    </span>
  )
}
