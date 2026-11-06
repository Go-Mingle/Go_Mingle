import { AuthThemeScope } from './components/AuthThemeScope'
import { BrandPanel } from './components/BrandPanel'
import { LoginForm } from './components/LoginForm'

export function LoginPage() {
  return (
    <AuthThemeScope>
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* Brand panel — only shown at ≥ 1024px */}
        <div className="hidden lg:block">
          <BrandPanel />
        </div>

        {/* Form panel — always visible, full width on small screens */}
        <LoginForm />
      </div>
    </AuthThemeScope>
  )
}
