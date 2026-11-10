import { useState } from 'react'
import { Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { readAndClearSessionNotice } from '../../../../shared/api/sessionManager'
import type { SessionEndReason } from '../../../../shared/api/sessionManager'

const NOTICE_I18N_KEY: Record<SessionEndReason, string> = {
  SUSPENDED: 'session.suspended',
  EXPIRED: 'session.expired',
  INVALID: 'session.invalid',
}

/**
 * FE1 AC-04.4 — the reason a session ended must reach the user. Termination
 * hard-redirects to /login, which destroys any toast mid-flight, so the reason
 * is carried across in sessionStorage and rendered here instead.
 *
 * Read once during the initial render and consumed, so a later reload of the
 * login screen shows nothing.
 */
export function SessionNotice() {
  const { t } = useTranslation('common')
  const [reason] = useState<SessionEndReason | null>(() => readAndClearSessionNotice())

  if (!reason) return null

  return (
    <Alert
      className="mb-4"
      type={reason === 'SUSPENDED' ? 'error' : 'warning'}
      showIcon
      // `title` rather than the deprecated `message` prop (AntD 6).
      title={t(NOTICE_I18N_KEY[reason])}
    />
  )
}
