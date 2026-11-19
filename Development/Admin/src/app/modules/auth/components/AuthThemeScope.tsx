import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { goMingleAuthTheme } from '../../../../styles/brandTheme'
import { ThemeSwitch } from '../../../atoms/ThemeSwitch'

/**
 * Wraps the landing screens (sign in, sign up, password reset). They follow the
 * app's light or dark theme, and carry the same switch as the top bar so people
 * can pick before they sign in (GM-335).
 */
export function AuthThemeScope({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={goMingleAuthTheme}>
      <div className="gm-auth relative" data-testid="gm-auth-scope">
        <div className="absolute top-5 right-5 z-10">
          <ThemeSwitch />
        </div>
        {children}
      </div>
    </ConfigProvider>
  )
}
