import { useState } from 'react'
import { Input } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ImportDialog } from '../../../molecules/ImportDialog'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { meetsPasswordPolicy } from '../../../../shared/utils/passwordStrength'
import { EMAIL_RE } from '../../../../shared/utils/spreadsheet'
import { DESIGNATION_MAX_LENGTH, FULL_NAME_MAX_LENGTH, PARTNER_USERS_QUERY_KEY } from '../constants'
import { partnerUsersService } from '../services'

type Col = 'name' | 'email' | 'designation' | 'status'

const STATUS: Record<string, 'ACTIVE' | 'SUSPENDED'> = { '': 'ACTIVE', active: 'ACTIVE', suspended: 'SUSPENDED' }

interface Props {
  open: boolean
  onClose: () => void
  onImported: (count: number) => void
}

/**
 * Adds many team members from a spreadsheet. Each row goes through the same
 * create endpoint as "New user"; everyone imported gets the temporary password
 * set here, which the welcome email tells them to ask the owner for.
 */
export function ImportUsersDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation(['users', 'common'])
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const policyOk = meetsPasswordPolicy(password)
  const matches = password === confirm
  const p = (k: string) => t(`common:import.problems.${k}`)

  return (
    <ImportDialog<Col>
      open={open}
      onClose={() => {
        setPassword('')
        setConfirm('')
        onClose()
      }}
      onImported={(n) => {
        void qc.invalidateQueries({ queryKey: PARTNER_USERS_QUERY_KEY })
        onImported(n)
      }}
      title={t('users:import.title')}
      intro={t('users:import.intro')}
      templateFileName="gomingle-team-users.csv"
      columns={[
        { key: 'name', label: t('users:import.columns.name'), headers: ['name', 'full name', 'fullName'], required: true, example: 'Ayesha Siddiqui' },
        { key: 'email', label: t('users:import.columns.email'), headers: ['email', 'email address', 'work email'], required: true, example: 'ayesha@restaurant.pk' },
        { key: 'designation', label: t('users:import.columns.designation'), headers: ['designation', 'title', 'job title', 'role'], example: 'Floor manager' },
        { key: 'status', label: t('users:import.columns.status'), headers: ['status'], example: 'Active' },
      ]}
      validate={(r, seen) => {
        if (!r.name) return p('nameRequired')
        if (r.name.length > FULL_NAME_MAX_LENGTH) return p('nameTooLong')
        if (!r.email) return p('emailRequired')
        if (!EMAIL_RE.test(r.email)) return p('emailInvalid')
        if (r.designation.length > DESIGNATION_MAX_LENGTH) return p('designationTooLong')
        if (!(r.status.toLowerCase() in STATUS)) return p('statusInvalid')
        const key = r.email.toLowerCase()
        if (seen.has(key)) return p('duplicate')
        seen.add(key)
        return null
      }}
      importRow={async (r) => {
        await partnerUsersService.create({
          fullName: r.name,
          email: r.email,
          designation: r.designation || undefined,
          status: STATUS[r.status.toLowerCase()],
          password,
          confirmPassword: confirm,
        })
      }}
      errorMessage={(e) => getApiErrorMessage(e, t('common:import.errors.unreadable'))}
      extraReady={policyOk && matches}
      extra={
        <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--color-border)] p-4">
          <span className="text-[14px] font-semibold">{t('users:import.passwordTitle')}</span>
          <span className="text-[13px] text-[var(--color-text-muted)]">{t('users:import.passwordHint')}</span>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input.Password
              aria-label={t('users:import.password')}
              placeholder={t('users:import.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              status={password && !policyOk ? 'error' : undefined}
            />
            <Input.Password
              aria-label={t('users:import.confirm')}
              placeholder={t('users:import.confirm')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              status={confirm && !matches ? 'error' : undefined}
            />
          </div>
          {password && !policyOk && <span className="text-[12px] text-[var(--color-error)]">{t('users:validation.passwordPolicy')}</span>}
          {confirm && policyOk && !matches && <span className="text-[12px] text-[var(--color-error)]">{t('users:validation.passwordsDoNotMatch')}</span>}
        </div>
      }
    />
  )
}
