import { http, HttpResponse } from 'msw'
import { PAYOUT_ACCOUNT_ENDPOINT } from '../../app/modules/restaurants/partnerPayout/constants'
import { isValidPkIban, normaliseIban } from '../../app/modules/restaurants/partnerPayout/iban'
import type {
  PayoutAccount,
  SavePayoutAccountDto,
} from '../../app/modules/restaurants/partnerPayout/types'

/** Mock of the restaurant's payout bank account (tests and mock-only demos). */

export const MOCK_PAYOUT_BANKS = ['Meezan Bank', 'HBL', 'UBL', 'MCB Bank', 'Bank Alfalah']

const mask = (iban: string) => `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`

let stored: (PayoutAccount & { iban: string }) | null = null

export function resetMockPayoutAccount() {
  stored = null
}

export function setMockPayoutAccount(account: { accountTitle: string; bankName: string; iban: string }) {
  const iban = normaliseIban(account.iban)
  stored = {
    ...account,
    iban,
    ibanMasked: mask(iban),
    addedAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  }
}

const view = (): PayoutAccount | null =>
  stored && {
    accountTitle: stored.accountTitle,
    bankName: stored.bankName,
    ibanMasked: stored.ibanMasked,
    addedAt: stored.addedAt,
    updatedAt: stored.updatedAt,
  }

const invalid = (field: keyof SavePayoutAccountDto, message: string) =>
  HttpResponse.json(
    { success: false, error: { code: 'ERR_VALIDATION', message, details: { field } } },
    { status: 422 },
  )

export const partnerPayoutAccountHandlers = [
  http.get(PAYOUT_ACCOUNT_ENDPOINT, () =>
    HttpResponse.json({ success: true, data: { account: view(), banks: MOCK_PAYOUT_BANKS } }),
  ),
  http.put(PAYOUT_ACCOUNT_ENDPOINT, async ({ request }) => {
    const body = (await request.json()) as SavePayoutAccountDto
    const iban = stored && body.iban.trim() === stored.ibanMasked ? stored.iban : normaliseIban(body.iban)
    if (!body.accountTitle?.trim()) return invalid('accountTitle', 'Enter the account title.')
    if (!MOCK_PAYOUT_BANKS.includes(body.bankName)) return invalid('bankName', 'Choose your bank.')
    if (!isValidPkIban(iban)) {
      return invalid('iban', 'Enter a valid Pakistani IBAN (24 characters, starting with PK).')
    }
    const now = new Date().toISOString()
    stored = {
      accountTitle: body.accountTitle.trim(),
      bankName: body.bankName,
      iban,
      ibanMasked: mask(iban),
      addedAt: stored?.addedAt ?? now,
      updatedAt: now,
    }
    return HttpResponse.json({ success: true, data: { account: view(), banks: MOCK_PAYOUT_BANKS } })
  }),
]
