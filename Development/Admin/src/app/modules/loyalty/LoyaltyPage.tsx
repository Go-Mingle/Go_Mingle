import { useState, useMemo } from 'react'
import { Alert, Grid, Spin, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { EarnRateCard } from './components/EarnRateCard'
import { RedeemRateCard } from './components/RedeemRateCard'
import { useLoyaltyConfigurationQuery } from './hooks/useLoyaltyConfigurationQuery'
import { useSaveEarnRateMutation } from './hooks/useSaveEarnRateMutation'
import { useSaveRedeemRateMutation } from './hooks/useSaveRedeemRateMutation'
import type { UpdateEarnRatePayload, UpdateRedeemRatePayload } from './types'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
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
  POINTS_NEEDED_MIN,
  POINTS_NEEDED_MAX,
  MAX_REDEMPTION_MIN,
  MAX_REDEMPTION_MAX,
} from './constants'

export function LoyaltyPage() {
  const { t } = useTranslation('loyalty')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const { data, isPending, isError } = useLoyaltyConfigurationQuery()
  const earnMutation = useSaveEarnRateMutation()
  const redeemMutation = useSaveRedeemRateMutation()

  // null = no unsaved edits; display falls back to latest server data via earnDisplay.
  const [earnDraft, setEarnDraft] = useState<UpdateEarnRatePayload | null>(null)
  const [redeemDraft, setRedeemDraft] = useState<UpdateRedeemRatePayload | null>(null)

  // Derived display values: user edits take priority; when null, show server data.
  // This avoids setState-in-effect for the initial population pattern.
  const earnDisplay = useMemo<UpdateEarnRatePayload | null>(() => {
    if (!data) return null
    return (
      earnDraft ?? {
        pkrSpentToEarn1Point: data.pkrSpentToEarn1Point,
        bonusPointsAt10thBooking: data.bonusPointsAt10thBooking,
        pointsPerAcceptedInvite: data.pointsPerAcceptedInvite,
        pointsPerReviewWithPhoto: data.pointsPerReviewWithPhoto,
        pointsPerCrownProminglerRole: data.pointsPerCrownProminglerRole,
        pointsPerInterestTableShare: data.pointsPerInterestTableShare,
      }
    )
  }, [data, earnDraft])

  const redeemDisplay = useMemo<UpdateRedeemRatePayload | null>(() => {
    if (!data) return null
    return (
      redeemDraft ?? {
        pointsNeededForPkr1Off: data.pointsNeededForPkr1Off,
        maxRedemptionPercentOfBill: data.maxRedemptionPercentOfBill,
      }
    )
  }, [data, redeemDraft])

  const isEarnDirty =
    earnDraft != null &&
    data != null &&
    (earnDraft.pkrSpentToEarn1Point !== data.pkrSpentToEarn1Point ||
      earnDraft.bonusPointsAt10thBooking !== data.bonusPointsAt10thBooking ||
      earnDraft.pointsPerAcceptedInvite !== data.pointsPerAcceptedInvite ||
      earnDraft.pointsPerReviewWithPhoto !== data.pointsPerReviewWithPhoto ||
      earnDraft.pointsPerCrownProminglerRole !== data.pointsPerCrownProminglerRole ||
      earnDraft.pointsPerInterestTableShare !== data.pointsPerInterestTableShare)

  const isEarnValid =
    earnDraft != null &&
    earnDraft.pkrSpentToEarn1Point >= PKR_SPENT_MIN &&
    earnDraft.pkrSpentToEarn1Point <= PKR_SPENT_MAX &&
    earnDraft.bonusPointsAt10thBooking >= BONUS_MIN &&
    earnDraft.bonusPointsAt10thBooking <= BONUS_MAX &&
    earnDraft.pointsPerAcceptedInvite >= INVITE_MIN &&
    earnDraft.pointsPerAcceptedInvite <= INVITE_MAX &&
    earnDraft.pointsPerReviewWithPhoto >= REVIEW_MIN &&
    earnDraft.pointsPerReviewWithPhoto <= REVIEW_MAX &&
    earnDraft.pointsPerCrownProminglerRole >= CROWN_MIN &&
    earnDraft.pointsPerCrownProminglerRole <= CROWN_MAX &&
    earnDraft.pointsPerInterestTableShare >= SHARE_MIN &&
    earnDraft.pointsPerInterestTableShare <= SHARE_MAX

  const isRedeemDirty =
    redeemDraft != null &&
    data != null &&
    (redeemDraft.pointsNeededForPkr1Off !== data.pointsNeededForPkr1Off ||
      redeemDraft.maxRedemptionPercentOfBill !== data.maxRedemptionPercentOfBill)

  const isRedeemValid =
    redeemDraft != null &&
    redeemDraft.pointsNeededForPkr1Off >= POINTS_NEEDED_MIN &&
    redeemDraft.pointsNeededForPkr1Off <= POINTS_NEEDED_MAX &&
    redeemDraft.maxRedemptionPercentOfBill >= MAX_REDEMPTION_MIN &&
    redeemDraft.maxRedemptionPercentOfBill <= MAX_REDEMPTION_MAX

  const handleSaveEarn = async () => {
    if (!earnDraft) return
    try {
      await earnMutation.mutateAsync(earnDraft)
      setEarnDraft(null)
      void message.success(t('messages.earnSaved'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('common:errors.genericError')))
    }
  }

  const handleSaveRedeem = async () => {
    if (!redeemDraft) return
    try {
      await redeemMutation.mutateAsync(redeemDraft)
      setRedeemDraft(null)
      void message.success(t('messages.redeemSaved'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('common:errors.genericError')))
    }
  }

  const handleCancelEarn = () => {
    setEarnDraft(null)
  }

  const handleCancelRedeem = () => {
    setRedeemDraft(null)
  }

  const handleEarnFieldChange = (field: keyof UpdateEarnRatePayload) => (v: number) => {
    setEarnDraft((prev) => {
      const base =
        prev ??
        (data
          ? {
              pkrSpentToEarn1Point: data.pkrSpentToEarn1Point,
              bonusPointsAt10thBooking: data.bonusPointsAt10thBooking,
              pointsPerAcceptedInvite: data.pointsPerAcceptedInvite,
              pointsPerReviewWithPhoto: data.pointsPerReviewWithPhoto,
              pointsPerCrownProminglerRole: data.pointsPerCrownProminglerRole,
              pointsPerInterestTableShare: data.pointsPerInterestTableShare,
            }
          : null)
      return base ? ({ ...base, [field]: v } as UpdateEarnRatePayload) : null
    })
  }

  const handleRedeemFieldChange = (field: keyof UpdateRedeemRatePayload) => (v: number) => {
    setRedeemDraft((prev) => {
      const base =
        prev ??
        (data
          ? {
              pointsNeededForPkr1Off: data.pointsNeededForPkr1Off,
              maxRedemptionPercentOfBill: data.maxRedemptionPercentOfBill,
            }
          : null)
      return base ? ({ ...base, [field]: v } as UpdateRedeemRatePayload) : null
    })
  }

  if (isPending) {
    return (
      <div className="flex justify-center p-8">
        <Spin />
      </div>
    )
  }

  if (isError) {
    return <Alert type="error" message={t('loadError')} className="m-4" />
  }

  if (!earnDisplay || !redeemDisplay) {
    return (
      <div className="flex justify-center p-8">
        <Spin />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h1
          className={`${isMobile ? 'text-xl' : 'text-[26px]'} font-bold text-(--color-text) m-0 leading-tight`}
        >
          {t('title')}
        </h1>
      </div>

      <div className="loyalty-cards">
        <EarnRateCard
          pkrSpentToEarn1Point={earnDisplay.pkrSpentToEarn1Point}
          onPkrSpentToEarn1PointChange={handleEarnFieldChange('pkrSpentToEarn1Point')}
          bonusPointsAt10thBooking={earnDisplay.bonusPointsAt10thBooking}
          onBonusPointsAt10thBookingChange={handleEarnFieldChange('bonusPointsAt10thBooking')}
          pointsPerAcceptedInvite={earnDisplay.pointsPerAcceptedInvite}
          onPointsPerAcceptedInviteChange={handleEarnFieldChange('pointsPerAcceptedInvite')}
          pointsPerReviewWithPhoto={earnDisplay.pointsPerReviewWithPhoto}
          onPointsPerReviewWithPhotoChange={handleEarnFieldChange('pointsPerReviewWithPhoto')}
          pointsPerCrownProminglerRole={earnDisplay.pointsPerCrownProminglerRole}
          onPointsPerCrownProminglerRoleChange={handleEarnFieldChange(
            'pointsPerCrownProminglerRole',
          )}
          pointsPerInterestTableShare={earnDisplay.pointsPerInterestTableShare}
          onPointsPerInterestTableShareChange={handleEarnFieldChange('pointsPerInterestTableShare')}
          isSaveDisabled={!isEarnDirty || !isEarnValid}
          isSaving={earnMutation.isPending}
          onCancel={handleCancelEarn}
          onSave={handleSaveEarn}
          saveLabel={t('earnRate.save')}
        />
        <RedeemRateCard
          pointsNeededForPkr1Off={redeemDisplay.pointsNeededForPkr1Off}
          onPointsNeededForPkr1OffChange={handleRedeemFieldChange('pointsNeededForPkr1Off')}
          maxRedemptionPercentOfBill={redeemDisplay.maxRedemptionPercentOfBill}
          onMaxRedemptionPercentOfBillChange={handleRedeemFieldChange('maxRedemptionPercentOfBill')}
          isSaveDisabled={!isRedeemDirty || !isRedeemValid}
          isSaving={redeemMutation.isPending}
          onCancel={handleCancelRedeem}
          onSave={handleSaveRedeem}
          saveLabel={t('redeemRate.save')}
        />
      </div>
    </div>
  )
}
