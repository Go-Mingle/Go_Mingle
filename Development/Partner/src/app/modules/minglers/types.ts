export interface MinglerBooking {
  [key: string]: unknown
  id: string
  bookingId: string
  restaurant: string
  date: string
  interestTableId: string
  interestTableTopic: string
  comboId: string
  comboName: string
  status: string
  bill: number
  loyaltyRedeemed: number
  /** True when this mingler is the Captain of the interest table. */
  isCaptain?: boolean
}

export interface MinglerIdentity {
  name: string
  birthdate?: string
  energyDrive?: 'Introvert' | 'Extrovert' | 'Ambivert'
  relationshipStatus?: string
  children?: string
  professionIndustry?: string
  profession?: string
  personalInterests?: string[]
  footballTeam?: string
  cricketTeam?: string
  pets?: string
  budget?: string
  enneagramType?: string
}

export interface MinglerEatingPreferences {
  culinaryRestrictions?: string[]
  allergies?: string[]
  favouriteCuisines?: string[]
  favouriteDishes?: string[]
  alcohol?: 'Yes' | 'No'
  favouriteDrinks?: string[]
  favouriteCocktail?: string
}

export interface MinglerReview {
  [key: string]: unknown
  id: string
  date: string
  restaurant: string
  rating: number
  text: string
  visible: boolean
  bookingId?: string
  photos?: string[]
}

export interface PaymentMethod {
  id: string
  network: string
  last4: string
  type: string
  expiry: string
  isDefault: boolean
}

export type MinglerStatus = 'active' | 'suspended' | 'pending'
