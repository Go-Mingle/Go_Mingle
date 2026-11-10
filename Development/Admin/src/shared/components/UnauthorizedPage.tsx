import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldWarning } from '@phosphor-icons/react'
import { useAppSelector } from '../store/hooks'
import { getRoleFromUser } from '../services/permissions'
import { firstAccessiblePath } from '../../app/layout/navAccess'

/**
 * In-place "not authorized" screen rendered by PermissionGuard (and the landing
 * redirect) when the current user lacks access to a module. The app shell
 * (sidebar/topbar) stays mounted so the user can navigate elsewhere.
 */
export function UnauthorizedPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const permissionsUnavailable = useAppSelector((s) => s.auth.permissionsUnavailable)
  const target = firstAccessiblePath(getRoleFromUser(user))

  // A-02 (pentest) — when GET /auth/me fails the user arrives here with no
  // permissions, which is indistinguishable from a genuine denial. Say plainly
  // that the lookup failed, so an operator does not chase a permissions problem
  // that does not exist. The AuthGuard poll clears the flag once the API recovers.
  if (permissionsUnavailable) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Result
          status="warning"
          title={t('unauthorized.permissionsUnavailableTitle')}
          subTitle={t('unauthorized.permissionsUnavailableSubtitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('unauthorized.retry')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Result
        icon={
          <ShieldWarning
            size={64}
            weight="duotone"
            color="var(--color-accent)"
            className="place-self-center"
          />
        }
        title={t('unauthorized.title')}
        subTitle={t('unauthorized.subtitle')}
        extra={
          target ? (
            <Button type="primary" onClick={() => navigate(target, { replace: true })}>
              {t('unauthorized.goToAllowed')}
            </Button>
          ) : null
        }
      />
    </div>
  )
}
