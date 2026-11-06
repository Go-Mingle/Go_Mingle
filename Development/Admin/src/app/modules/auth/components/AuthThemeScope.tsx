import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { goMingleAuthTheme } from '../../../../styles/brandTheme'

/**
 * Applies the GoMingle brand palette (logo navy + coral) to the landing
 * screens: antd primary actions via a nested theme, Tailwind accent utilities
 * via the `.gm-auth` token re-map in index.css.
 */
export function AuthThemeScope({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={goMingleAuthTheme}>
      <div className="gm-auth" data-testid="gm-auth-scope">
        {children}
      </div>
    </ConfigProvider>
  )
}
