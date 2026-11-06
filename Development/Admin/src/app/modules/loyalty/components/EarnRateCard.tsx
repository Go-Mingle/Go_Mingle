import { useTranslation } from 'react-i18next'
import { CardFooter } from './CardFooter'
import { NumberField } from './NumberField'
import {
  PKR_SPENT_MIN,
  PKR_SPENT_MAX,
  BONUS_MIN,
  BONUS_MAX,
  INVITE_MIN,
  INVITE_MAX,
  REVIEW_MIN,
  REVIEW_MAX,
  CROWN_MIN,
  CROWN_MAX,
  SHARE_MIN,
  SHARE_MAX,
} from '../constants'

interface EarnRateCardProps {
  pkrSpentToEarn1Point: number
  onPkrSpentToEarn1PointChange: (v: number) => void
  bonusPointsAt10thBooking: number
  onBonusPointsAt10thBookingChange: (v: number) => void
  pointsPerAcceptedInvite: number
  onPointsPerAcceptedInviteChange: (v: number) => void
  pointsPerReviewWithPhoto: number
  onPointsPerReviewWithPhotoChange: (v: number) => void
  pointsPerCrownProminglerRole: number
  onPointsPerCrownProminglerRoleChange: (v: number) => void
  pointsPerInterestTableShare: number
  onPointsPerInterestTableShareChange: (v: number) => void
  isSaveDisabled: boolean
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
  saveLabel: string
}

export function EarnRateCard({
  pkrSpentToEarn1Point,
  onPkrSpentToEarn1PointChange,
  bonusPointsAt10thBooking,
  onBonusPointsAt10thBookingChange,
  pointsPerAcceptedInvite,
  onPointsPerAcceptedInviteChange,
  pointsPerReviewWithPhoto,
  onPointsPerReviewWithPhotoChange,
  pointsPerCrownProminglerRole,
  onPointsPerCrownProminglerRoleChange,
  pointsPerInterestTableShare,
  onPointsPerInterestTableShareChange,
  isSaveDisabled,
  isSaving,
  onCancel,
  onSave,
  saveLabel,
}: EarnRateCardProps) {
  const { t } = useTranslation('loyalty')
  return (
    <div className="bg-(--color-card) rounded-xl shadow-sm p-6">
      <div className="pb-4 mb-5 border-b border-(--color-divider)">
        <h2 className="text-[15px] font-semibold text-(--color-text) m-0">{t('earnRate.title')}</h2>
      </div>

      <div className="loyalty-field-grid">
        <NumberField
          label={t('earnRate.pkrPerPoint')}
          value={pkrSpentToEarn1Point}
          onChange={onPkrSpentToEarn1PointChange}
          suffix="PKR"
          helper={t('earnRate.pkrPerPointHelper', { value: pkrSpentToEarn1Point || '—' })}
          min={PKR_SPENT_MIN}
          max={PKR_SPENT_MAX}
        />
        <NumberField
          label={t('earnRate.per10Bookings')}
          value={bonusPointsAt10thBooking}
          onChange={onBonusPointsAt10thBookingChange}
          suffix="pts"
          helper={t('earnRate.per10BookingsHelper')}
          min={BONUS_MIN}
          max={BONUS_MAX}
        />
        <NumberField
          label={t('earnRate.perInvite')}
          value={pointsPerAcceptedInvite}
          onChange={onPointsPerAcceptedInviteChange}
          suffix="pts"
          helper={t('earnRate.perInviteHelper')}
          min={INVITE_MIN}
          max={INVITE_MAX}
        />
        <NumberField
          label={t('earnRate.perReviewWithPhoto')}
          value={pointsPerReviewWithPhoto}
          onChange={onPointsPerReviewWithPhotoChange}
          suffix="pts"
          helper={t('earnRate.perReviewWithPhotoHelper')}
          min={REVIEW_MIN}
          max={REVIEW_MAX}
        />
        <NumberField
          label={t('earnRate.perCaptain')}
          value={pointsPerCrownProminglerRole}
          onChange={onPointsPerCrownProminglerRoleChange}
          suffix="pts"
          helper={t('earnRate.perCaptainHelper')}
          min={CROWN_MIN}
          max={CROWN_MAX}
        />
        <NumberField
          label={t('earnRate.perShare')}
          value={pointsPerInterestTableShare}
          onChange={onPointsPerInterestTableShareChange}
          suffix="pts"
          helper={t('earnRate.perShareHelper')}
          min={SHARE_MIN}
          max={SHARE_MAX}
        />
      </div>

      <CardFooter
        onCancel={onCancel}
        onSave={onSave}
        saveLabel={saveLabel}
        disabled={isSaveDisabled}
        loading={isSaving}
      />
    </div>
  )
}
