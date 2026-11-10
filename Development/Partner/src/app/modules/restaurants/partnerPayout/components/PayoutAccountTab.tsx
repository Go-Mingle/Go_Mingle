import { useState } from 'react'
import { Alert, Skeleton } from 'antd'
import { Bank, CalendarBlank, Hash, IdentificationCard, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { HttpError } from '../../../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { OverviewField } from '../../components/OverviewField'
import { SectionCard } from '../../restaurantDetail.utils'
import { displayProfileDate } from '../../partnerProfile/format'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { usePayoutAccountQuery, useSavePayoutAccountMutation } from '../hooks/usePayoutAccount'
import type { PayoutAccount, PayoutAccountField, SavePayoutAccountDto } from '../types'
import { PayoutAccountForm } from './PayoutAccountForm'

const FIELD_GRID = 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0'

/** The field a 422 points at, so its message shows under that input. */
function fieldError(error: unknown): { field: PayoutAccountField; message: string } | null {
  if (!(error instanceof HttpError) || error.status !== 422) return null
  const body = error.responseBody as { error?: { message?: string; details?: { field?: string } } } | null
  const field = body?.error?.details?.field
  if (field !== 'accountTitle' && field !== 'bankName' && field !== 'iban') return null
  return { field, message: body?.error?.message ?? '' }
}

function SavedAccount({ account }: { account: PayoutAccount }) {
  const { t } = useTranslation('restaurants')
  return (
    <div className={FIELD_GRID}>
      <OverviewField IconComp={IdentificationCard} label={t('payoutAccount.fields.accountTitle')} value={account.accountTitle} />
      <OverviewField IconComp={Bank} label={t('payoutAccount.fields.bankName')} value={account.bankName} />
      <OverviewField
        IconComp={Hash}
        label={t('payoutAccount.fields.iban')}
        value={<span className="tabular-nums tracking-wide">{account.ibanMasked}</span>}
      />
      <OverviewField
        IconComp={CalendarBlank}
        label={t('payoutAccount.fields.updatedAt')}
        value={displayProfileDate(account.updatedAt)}
      />
    </div>
  )
}

/**
 * Payout Account — the bank account GoMingle pays the restaurant's share into
 * once Safepay escrow is released. Shown, added and edited here in the portal.
 */
export function PayoutAccountTab({ feedback }: { feedback: ProfileFeedback }) {
  const { t } = useTranslation('restaurants')
  const query = usePayoutAccountQuery()
  const save = useSavePayoutAccountMutation()
  const [editing, setEditing] = useState(false)

  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} />
  if (query.isError) {
    return <Alert type="error" showIcon message={getApiErrorMessage(query.error, t('payoutAccount.loadFailed'))} />
  }

  const { account, banks } = query.data
  const showForm = !account || editing
  const serverError = fieldError(save.error)

  const onSave = (body: SavePayoutAccountDto) =>
    save.mutate(body, {
      onSuccess: () => {
        setEditing(false)
        feedback.showSuccess(t('payoutAccount.saved'))
      },
      onError: (error) => {
        if (!fieldError(error)) feedback.showError(error)
      },
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] bg-[var(--color-accent-light)] p-4 text-[var(--color-accent-dark)]">
        <ShieldCheck size={18} weight="fill" className="mt-px shrink-0" />
        <p className="m-0 text-[13px] leading-relaxed">{t('payoutAccount.explainer')}</p>
      </div>
      <SectionCard
        title={t('payoutAccount.title')}
        editAriaLabel={t('payoutAccount.editAria')}
        onEdit={account && !editing ? () => setEditing(true) : undefined}
      >
        {showForm ? (
          <PayoutAccountForm
            account={account}
            banks={banks}
            saving={save.isPending}
            serverError={serverError}
            onSave={onSave}
            onCancel={account ? () => setEditing(false) : undefined}
          />
        ) : (
          <SavedAccount account={account} />
        )}
      </SectionCard>
    </div>
  )
}
