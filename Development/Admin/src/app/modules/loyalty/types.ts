export interface LoyaltyActor {
  id: string
  name: string
}

export interface LoyaltyConfigurationData {
  pkrSpentToEarn1Point: number
  bonusPointsAt10thBooking: number
  pointsPerAcceptedInvite: number
  pointsPerReviewWithPhoto: number
  pointsNeededForPkr1Off: number
  maxRedemptionPercentOfBill: number
  pointsPerCrownProminglerRole: number
  pointsPerInterestTableShare: number
  earnUpdatedAt: string | null
  earnUpdatedBy: LoyaltyActor | null
  redeemUpdatedAt: string | null
  redeemUpdatedBy: LoyaltyActor | null
}

export interface UpdateEarnRatePayload {
  pkrSpentToEarn1Point: number
  bonusPointsAt10thBooking: number
  pointsPerAcceptedInvite: number
  pointsPerReviewWithPhoto: number
  pointsPerCrownProminglerRole: number
  pointsPerInterestTableShare: number
}

export interface UpdateRedeemRatePayload {
  pointsNeededForPkr1Off: number
  maxRedemptionPercentOfBill: number
}
