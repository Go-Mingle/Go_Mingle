import { useState } from 'react'
import { Alert, InputNumber, Skeleton } from 'antd'
import { ClockCountdown, Coins, Info } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { HttpError } from '../../../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { OverviewField } from '../../components/OverviewField'
import { SectionCard } from '../../restaurantDetail.utils'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { useNoShowPolicyQuery, useSaveNoShowPolicyMutation } from '../hooks/useNoShowPolicy'
import type { NoShowPolicy, NoShowPolicyField, SaveNoShowPolicyDto } from '../types'

const FIELD_GRID = 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0'
const LABEL = 'mb-1.5 block text-[13px] font-medium text-[var(--color-text)]'
const HELP = 'm-0 mt-1.5 text-[12px] text-[var(--color-text-muted)]'
const ERROR = 'm-0 mt-1.5 text-[12px] text-[var(--color-error)]'

type FieldErrors = Partial<Record<NoShowPolicyField, string>>

/** Messages a 422 attaches to individual fields. */
function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof HttpError) || error.status !== 422) return null
  const body = error.responseBody as { error?: { details?: { fields?: FieldErrors } } } | null
  return body?.error?.details?.fields ?? null
}

const formatPkr = (amount: number) => `PKR ${amount.toLocaleString('en-PK')}`

function SavedPolicy({ policy }: { policy: NoShowPolicy }) {
  const { t } = useTranslation('restaurants')
  return (
    <div className={FIELD_GRID}>
      <OverviewField
        IconComp={Coins}
        label={t('noShowPolicy.fields.penalty')}
        value={
          policy.penaltyPerSeatPkr > 0
            ? t('noShowPolicy.penaltyValue', { amount: formatPkr(policy.penaltyPerSeatPkr) })
            : t('noShowPolicy.noPenalty')
        }
      />
      <OverviewField
        IconComp={ClockCountdown}
        label={t('noShowPolicy.fields.window')}
        value={t('noShowPolicy.windowValue', { count: policy.cancellationWindowHours })}
      />
    </div>
  )
}

function PolicyForm({
  policy,
  saving,
  serverErrors,
  onSave,
  onCancel,
}: {
  policy: NoShowPolicy
  saving: boolean
  serverErrors: FieldErrors | null
  onSave: (body: SaveNoShowPolicyDto) => void
  onCancel: () => void
}) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [penalty, setPenalty] = useState<number | null>(policy.penaltyPerSeatPkr)
  const [hours, setHours] = useState<number | null>(policy.cancellationWindowHours)
  const [touched, setTouched] = useState(false)

  const errors: FieldErrors = {}
  if (penalty === null || penalty < 0) errors.penaltyPerSeatPkr = t('restaurants:noShowPolicy.errors.penalty')
  if (hours === null || hours < 0 || !Number.isInteger(hours)) {
    errors.cancellationWindowHours = t('restaurants:noShowPolicy.errors.window')
  }
  const shown: FieldErrors = touched ? { ...(serverErrors ?? {}), ...errors } : {}

  const submit = () => {
    setTouched(true)
    if (Object.keys(errors).length > 0 || penalty === null || hours === null) return
    onSave({ penaltyPerSeatPkr: penalty, cancellationWindowHours: hours })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="no-show-penalty" className={LABEL}>
            {t('restaurants:noShowPolicy.fields.penalty')}
          </label>
          <InputNumber
            id="no-show-penalty"
            value={penalty}
            onChange={setPenalty}
            min={0}
            max={policy.limits.penaltyMaxPkr}
            precision={0}
            prefix="PKR"
            className="!w-full"
            size="large"
            status={shown.penaltyPerSeatPkr ? 'error' : undefined}
          />
          {shown.penaltyPerSeatPkr ? (
            <p className={ERROR}>{shown.penaltyPerSeatPkr}</p>
          ) : (
            <p className={HELP}>{t('restaurants:noShowPolicy.penaltyHelp')}</p>
          )}
        </div>
        <div>
          <label htmlFor="no-show-window" className={LABEL}>
            {t('restaurants:noShowPolicy.fields.window')}
          </label>
          <InputNumber
            id="no-show-window"
            value={hours}
            onChange={setHours}
            min={0}
            max={policy.limits.windowMaxHours}
            precision={0}
            suffix={t('restaurants:noShowPolicy.hours')}
            className="!w-full"
            size="large"
            status={shown.cancellationWindowHours ? 'error' : undefined}
          />
          {shown.cancellationWindowHours ? (
            <p className={ERROR}>{shown.cancellationWindowHours}</p>
          ) : (
            <p className={HELP}>{t('restaurants:noShowPolicy.windowHelp')}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <AppButton variant="neutral" onClick={onCancel} disabled={saving}>
          {t('common:buttons.cancel')}
        </AppButton>
        <AppButton variant="primary" onClick={submit} disabled={saving}>
          {t('restaurants:noShowPolicy.save')}
        </AppButton>
      </div>
    </div>
  )
}

/**
 * No-Show Policy: what an empty seat costs a Mingler at this restaurant, and
 * until when a booking can be cancelled free of charge.
 */
export function NoShowPolicyTab({ feedback }: { feedback: ProfileFeedback }) {
  const { t } = useTranslation('restaurants')
  const query = useNoShowPolicyQuery()
  const save = useSaveNoShowPolicyMutation()
  const [editing, setEditing] = useState(false)

  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} />
  if (query.isError) {
    return <Alert type="error" showIcon message={getApiErrorMessage(query.error, t('noShowPolicy.loadFailed'))} />
  }

  const policy = query.data
  const onSave = (body: SaveNoShowPolicyDto) =>
    save.mutate(body, {
      onSuccess: () => {
        setEditing(false)
        feedback.showSuccess(t('noShowPolicy.saved'))
      },
      onError: (error) => {
        if (!serverFieldErrors(error)) feedback.showError(error)
      },
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] bg-[var(--color-accent-light)] p-4 text-[var(--color-accent-dark)]">
        <Info size={18} weight="fill" className="mt-px shrink-0" />
        <p className="m-0 text-[13px] leading-relaxed">{t('noShowPolicy.explainer')}</p>
      </div>
      <SectionCard
        title={t('noShowPolicy.title')}
        editAriaLabel={t('noShowPolicy.editAria')}
        onEdit={editing ? undefined : () => setEditing(true)}
      >
        {editing ? (
          <PolicyForm
            policy={policy}
            saving={save.isPending}
            serverErrors={serverFieldErrors(save.error)}
            onSave={onSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <SavedPolicy policy={policy} />
        )}
      </SectionCard>
    </div>
  )
}
