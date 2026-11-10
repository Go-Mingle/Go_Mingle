import { EyeSlash } from '@phosphor-icons/react'

interface Props {
  label: string
  note?: string
}

/**
 * Clear, high-contrast banner shown on a card that's hidden from diners.
 * Communicates the hidden state with an icon + copy (not just dimming), so
 * it's obvious the item exists but isn't visible on the Mingler app.
 */
export function HiddenNotice({ label, note }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-[8px] px-3 py-2 mb-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
      <EyeSlash size={15} weight="bold" className="shrink-0 mt-px text-[var(--color-warning)]" />
      <div>
        <div className="text-[12px] font-semibold text-[var(--color-warning)]">{label}</div>
        {note ? (
          <div className="text-[11px] leading-snug text-[var(--color-warning)]">{note}</div>
        ) : null}
      </div>
    </div>
  )
}
