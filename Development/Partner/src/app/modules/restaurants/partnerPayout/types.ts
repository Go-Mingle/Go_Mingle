/** The restaurant's payout bank account. The IBAN only ever arrives masked. */
export interface PayoutAccount {
  accountTitle: string
  bankName: string
  /** e.g. "PK72 •••• 1234" */
  ibanMasked: string
  addedAt: string
  updatedAt: string
}

export interface PayoutAccountResponse {
  account: PayoutAccount | null
  /** Banks GoMingle can pay out to. */
  banks: string[]
}

export interface SavePayoutAccountDto {
  accountTitle: string
  bankName: string
  /** A full IBAN, or the masked value unchanged to keep the number on file. */
  iban: string
}

export type PayoutAccountField = keyof SavePayoutAccountDto
