import { useTranslation } from 'react-i18next'
import { CardFooter } from './CardFooter'
import { NumberField } from './NumberField'
import {
  POINTS_NEEDED_MIN,
  POINTS_NEEDED_MAX,
  MAX_REDEMPTION_MIN,
  MAX_REDEMPTION_MAX,
} from '../constants'

interface RedeemRateCardProps {
  pointsNeededForPkr1Off: number
  onPointsNeededForPkr1OffChange: (v: number) => void
  maxRedemptionPercentOfBill: number
  onMaxRedemptionPercentOfBillChange: (v: number) => void
  isSaveDisabled: boolean
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
  saveLabel: string
}

export function RedeemRateCard({
  pointsNeededForPkr1Off,
  onPointsNeededForPkr1OffChange,
  maxRedemptionPercentOfBill,
  onMaxRedemptionPercentOfBillChange,
  isSaveDisabled,
  isSaving,
  onCancel,
  onSave,
  saveLabel,
}: RedeemRateCardProps) {
  const { t } = useTranslation('loyalty')
  return (
    <div className="bg-(--color-card) rounded-xl shadow-sm p-6">
      <div className="pb-4 mb-5 border-b border-(--color-divider)">
        <h2 className="text-[15px] font-semibold text-(--color-text) m-0">
          {t('redeemRate.title')}
        </h2>
      </div>

      <div className="loyalty-field-grid">
        <NumberField
          label={t('redeemRate.pointsPerPkr')}
          value={pointsNeededForPkr1Off}
          onChange={onPointsNeededForPkr1OffChange}
          suffix="pts"
          helper={t('redeemRate.pointsPerPkrHelper', { value: pointsNeededForPkr1Off || '—' })}
          min={POINTS_NEEDED_MIN}
          max={POINTS_NEEDED_MAX}
        />
        <NumberField
          label={t('redeemRate.maxRedeemPercent')}
          value={maxRedemptionPercentOfBill}
          onChange={onMaxRedemptionPercentOfBillChange}
          suffix="%"
          helper={t('redeemRate.maxRedeemPercentHelper')}
          min={MAX_REDEMPTION_MIN}
          max={MAX_REDEMPTION_MAX}
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
