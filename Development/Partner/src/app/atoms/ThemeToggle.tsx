import { Moon, Sun } from '@phosphor-icons/react'
import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '../../shared/theme/themeStore'

/** Light / dark switch for the top bar. Shows the theme it switches to. */
export function ThemeToggle() {
  const { t } = useTranslation()
  const mode = useThemeStore((s) => s.mode)
  const toggle = useThemeStore((s) => s.toggle)
  const label = mode === 'dark' ? t('topbar.switchToLight') : t('topbar.switchToDark')

  return (
    <Tooltip title={label}>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={mode === 'dark'}
        data-testid="theme-toggle"
        className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-neutral)] hover:text-[var(--color-text)] bg-transparent border-none cursor-pointer shrink-0 transition-colors"
      >
        {mode === 'dark' ? <Sun size={20} weight="bold" /> : <Moon size={20} weight="bold" />}
      </button>
    </Tooltip>
  )
}
