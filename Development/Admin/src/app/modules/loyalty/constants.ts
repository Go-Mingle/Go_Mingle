export const LOYALTY_ENDPOINTS = {
  current: '/api/v1/loyalty-configuration',
  earnRate: '/api/v1/loyalty-configuration/earn-rate',
  redeemRate: '/api/v1/loyalty-configuration/redeem-rate',
} as const

// Earn field ranges (spec §4.5)
export const PKR_SPENT_MIN = 1
export const PKR_SPENT_MAX = 1000
export const BONUS_MIN = 1
export const BONUS_MAX = 10000
export const INVITE_MIN = 1
export const INVITE_MAX = 10000
export const REVIEW_MIN = 1
export const REVIEW_MAX = 10000
export const CROWN_MIN = 1
export const CROWN_MAX = 10000
export const SHARE_MIN = 1
export const SHARE_MAX = 10000

// Redeem field ranges (spec §4.6)
export const POINTS_NEEDED_MIN = 1
export const POINTS_NEEDED_MAX = 10000
export const MAX_REDEMPTION_MIN = 1
export const MAX_REDEMPTION_MAX = 100
