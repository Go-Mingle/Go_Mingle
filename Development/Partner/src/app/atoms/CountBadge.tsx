import { clsx } from 'clsx'

/**
 * Where the badge sits, which is the only thing that varies between its uses.
 *
 * `overlay` pins it to the corner of an icon button (the bell); `inline` sits it in a
 * row of text (the panel header's chip).
 */
export type CountBadgePlacement = 'overlay' | 'inline'

interface CountBadgeProps {
  /** The true count. Capping for display is this component's job, not the caller's. */
  count: number
  /** Above this, the label reads `{cap}+`. */
  cap?: number
  placement?: CountBadgePlacement
  /** Announced to assistive tech; the digits alone say nothing useful. */
  label?: string
}

const PLACEMENT_CLASS: Record<CountBadgePlacement, string> = {
  overlay:
    'absolute top-1 right-1 h-4 w-4 text-[9px] flex items-center justify-center rounded-full',
  inline:
    'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] rounded-full',
}

/**
 * A numeric count badge.
 *
 * Extracted by J7 because the `> 99 ? '99+'` rule was written out three times — twice in
 * `NotificationPopover` and once, **uncapped**, in `SidebarNavGroup`, where a partner with
 * a hundred notifications would have burst the pill.
 *
 * Renders **nothing** at zero rather than a `0`. That is the actual requirement for the
 * bell (BR-06: "hidden entirely at zero", leaving a bell outline), and it means callers
 * can hand over a count unconditionally instead of guarding every use site.
 */
export function CountBadge({ count, cap = 99, placement = 'inline', label }: CountBadgeProps) {
  if (!Number.isFinite(count) || count <= 0) return null

  const display = count > cap ? `${String(cap)}+` : String(count)

  return (
    <span
      className={clsx(
        PLACEMENT_CLASS[placement],
        'bg-[var(--color-coral)] font-bold leading-none text-white',
      )}
      aria-label={label}
      // Without a label the digits are noise to a screen reader — the surrounding
      // control already carries the meaning.
      aria-hidden={label ? undefined : true}
    >
      {display}
    </span>
  )
}
