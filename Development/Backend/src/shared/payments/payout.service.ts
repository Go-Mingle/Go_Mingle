import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { payoutAccounts } from '../../db/schema'
import { RestaurantsService } from '../restaurants/restaurants.service'

export type PayoutAccount = typeof payoutAccounts.$inferSelect

export const BANKS = [
  'Meezan Bank', 'HBL', 'UBL', 'MCB Bank', 'Allied Bank', 'Bank Alfalah', 'Standard Chartered Pakistan',
  'Faysal Bank', 'Bank AL Habib', 'Askari Bank', 'JS Bank', 'Soneri Bank', 'BankIslami', 'Dubai Islamic Bank Pakistan',
]

export function normaliseIban(iban: unknown): string {
  return String(iban ?? '').replace(/\s+/g, '').toUpperCase()
}

export function isValidPkIban(iban: unknown): boolean {
  const v = normaliseIban(iban)
  if (!/^PK\d{2}[A-Z]{4}\d{16}$/.test(v)) return false
  // ISO 13616 mod-97 check.
  const moved = v.slice(4) + v.slice(0, 4)
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

export function maskIban(iban: unknown): string {
  const v = normaliseIban(iban)
  return v ? `${v.slice(0, 4)} •••• ${v.slice(-4)}` : ''
}

/** The payout account as the partner sees it: the number is always masked. */
export function publicPayoutAccount(account: PayoutAccount | null) {
  if (!account) return null
  return {
    accountTitle: account.accountTitle,
    bankName: account.bankName,
    ibanMasked: maskIban(account.iban),
    addedAt: account.addedAt,
    updatedAt: account.updatedAt ?? account.addedAt,
  }
}

export type SaveResult = { account: PayoutAccount; error?: undefined } | { error: string; field?: string; account?: undefined }

/** Restaurants' payout bank accounts. */
@Injectable()
export class PayoutService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
  ) {}

  async account(restaurantId: string): Promise<PayoutAccount | null> {
    const [row] = await this.db.select().from(payoutAccounts).where(eq(payoutAccounts.restaurantId, restaurantId))
    return row ?? null
  }

  /**
   * Validates and stores a restaurant's payout account. Shared by the Partner
   * Portal's Payout Account tab and the hosted setup page.
   * An IBAN sent back exactly as shown masked ("PK72 •••• 1234") keeps the
   * number on file, so editing only the title or bank does not need it retyped.
   */
  async save(restaurantId: string, input: Record<string, unknown>): Promise<SaveResult> {
    if (!(await this.restaurants.find(restaurantId))) return { error: 'Restaurant not found.' }
    const existing = await this.account(restaurantId)
    const accountTitle = String(input.accountTitle ?? '').trim()
    const bankName = String(input.bankName ?? '').trim()
    const saved = existing?.iban
    const iban = saved && String(input.iban ?? '').trim() === maskIban(saved) ? saved : normaliseIban(input.iban)
    if (!accountTitle) return { error: 'Enter the account title.', field: 'accountTitle' }
    if (accountTitle.length > 100) return { error: 'The account title can be at most 100 characters.', field: 'accountTitle' }
    if (!BANKS.includes(bankName)) return { error: 'Choose your bank.', field: 'bankName' }
    if (!isValidPkIban(iban)) return { error: 'Enter a valid Pakistani IBAN (24 characters, starting with PK).', field: 'iban' }

    const now = new Date().toISOString()
    const values = { restaurantId, accountTitle, bankName, iban, addedAt: existing?.addedAt ?? now, updatedAt: now }
    const [account] = await this.db
      .insert(payoutAccounts)
      .values(values)
      .onConflictDoUpdate({ target: payoutAccounts.restaurantId, set: { accountTitle, bankName, iban, updatedAt: now } })
      .returning()
    await this.restaurants.update(restaurantId, { payoutAccountId: `po_${iban.slice(-8)}` })
    return { account }
  }
}
