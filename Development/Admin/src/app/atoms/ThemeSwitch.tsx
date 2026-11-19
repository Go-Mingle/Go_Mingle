import { Moon, Sun } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useThemeStore, type ThemeMode } from '../../shared/theme/themeStore'
import { originOf, transitionTheme } from '../../shared/theme/themeTransition'

/**
 * Sun / moon pill for the landing screens (GM-335). Both choices are visible, so
 * people see they can pick a theme before signing in; the current one is filled.
 */
export function ThemeSwitch() {
  const { t } = useTranslation()
  const mode = useThemeStore((s) => s.mode)
  const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { value: 'light', label: t('topbar.themeLight'), Icon: Sun },
    { value: 'dark', label: t('topbar.themeDark'), Icon: Moon },
  ]

  return (
    <div
      role="group"
      aria-label={t('topbar.theme')}
      data-testid="theme-switch"
      className="inline-flex gap-1 p-1 rounded-full bg-(--color-card) border border-(--color-border) shadow-(--shadow-sm)"
    >
      {options.map(({ value, label, Icon }) => {
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={(e) => transitionTheme(value, originOf(e))}
            className={`w-11 h-9 flex items-center justify-center rounded-full border-none cursor-pointer transition-colors duration-200 ${
              active
                ? 'bg-(--color-accent) text-(--color-on-accent)'
                : 'bg-transparent text-(--color-text-muted) hover:text-(--color-text)'
            }`}
          >
            <Icon size={18} weight={active ? 'fill' : 'bold'} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
