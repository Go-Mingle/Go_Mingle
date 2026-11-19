import { AuthThemeScope } from './components/AuthThemeScope'
import { BrandPanel } from './components/BrandPanel'
import { LoginForm } from './components/LoginForm'

export function LoginPage() {
  return (
    <AuthThemeScope>
      {/* One full-screen stage: guests gather around the table, then the form (GM-336). */}
      <main className="gm-stage">
        <BrandPanel />
        <LoginForm />
      </main>
    </AuthThemeScope>
  )
}
