import { useEffect, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { CommandPalette } from './CommandPalette'
import { isApple } from './commandModel'

/**
 * The top-bar search button. Ctrl+K (⌘K on a Mac) opens the palette from
 * anywhere, including while typing in a field; pressing it again closes it.
 */
export function CommandPaletteTrigger() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apple] = useState(isApple)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const shortcut = apple ? '⌘K' : 'Ctrl K'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('command.open', { shortcut })}
        aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
        aria-haspopup="dialog"
        data-testid="command-trigger"
        className="group flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-input-border-hover)] hover:text-[var(--color-text)] max-md:w-9 max-md:justify-center max-md:border-transparent max-md:bg-transparent max-md:px-0 md:w-56 lg:w-64"
      >
        <MagnifyingGlass size={18} weight="bold" aria-hidden className="shrink-0" />
        <span className="hidden flex-1 text-left md:inline">{t('command.trigger')}</span>
        <kbd className="gm-kbd max-md:hidden md:inline-flex">{shortcut}</kbd>
      </button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  )
}
