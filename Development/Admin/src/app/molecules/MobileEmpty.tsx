import { Tray } from '@phosphor-icons/react'

/**
 * What a phone shows in place of a card list with nothing in it: the desktop
 * table has its own empty row, and without this the phone showed only a pager.
 */
export function MobileEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      role="status"
      data-testid="mobile-empty"
      className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-5 py-10 text-center"
    >
      <Tray size={28} className="text-[var(--color-text-subtle)]" aria-hidden />
      <p className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{title}</p>
      {hint && <p className="m-0 text-[13px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}
