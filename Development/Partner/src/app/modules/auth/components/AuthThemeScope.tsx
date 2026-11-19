import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { goMingleAuthTheme } from '../../../../styles/brandTheme'
import { ThemeToggle } from '../../../atoms/ThemeToggle'

/**
 * Wraps the landing screens (sign in, sign up, password reset). They follow the
 * app's light or dark theme, and carry the same switch as the top bar so people
 * can pick before they sign in (GM-335).
 */
export function AuthThemeScope({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={goMingleAuthTheme}>
      <div className="gm-auth relative" data-testid="gm-auth-scope">
        <div className="absolute top-4 right-4 z-10 rounded-full bg-(--color-card) shadow-(--shadow-sm)">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </ConfigProvider>
  )
}
