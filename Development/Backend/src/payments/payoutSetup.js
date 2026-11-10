import express from 'express'
import { db, save } from '../db/store.js'
import { config } from '../config.js'
import { partnerTenant, snapshot } from '../integration.js'
import { isValidPkIban, maskIban, normaliseIban } from './escrow.js'

/**
 * Payout account setup — the page the Partner Portal's "Add payout account"
 * step opens. The restaurant enters the bank account GoMingle releases escrow
 * into; GoMingle then pays out from its Safepay merchant balance.
 */

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const trusted = (o) => Boolean(o) && (LOCAL.test(o) || config.corsOrigins.includes(o))
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export const BANKS = [
  'Meezan Bank', 'HBL', 'UBL', 'MCB Bank', 'Allied Bank', 'Bank Alfalah', 'Standard Chartered Pakistan',
  'Faysal Bank', 'Bank AL Habib', 'Askari Bank', 'JS Bank', 'Soneri Bank', 'BankIslami', 'Dubai Islamic Bank Pakistan',
]

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · GoMingle payouts</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f5f8;color:#1c1730;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
.card{background:#fff;border:1px solid #e2dfe9;border-radius:14px;max-width:460px;width:100%;padding:28px}
h1{font-size:20px;margin:0 0 8px}p{color:#5d5872;line-height:1.55;margin:0 0 18px}
label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}input,select{width:100%;box-sizing:border-box;border:1px solid #d9d5e3;border-radius:9px;padding:10px 12px;font-size:15px;margin:0 0 14px;font-family:inherit}
input:focus,select:focus{outline:2px solid #ff5a44;border-color:transparent}
button{background:#ff5a44;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:600;font-size:15px;cursor:pointer;width:100%}
.tag{display:inline-block;font-size:12px;font-weight:600;color:#1c7a45;background:#e3f4ea;border-radius:99px;padding:2px 10px;margin-bottom:14px}
.err{background:#fbe6e3;color:#a3271f;border-radius:9px;padding:10px 12px;font-size:14px;margin:0 0 14px}
.flow{font-size:13px;color:#5d5872;background:#f6f5f8;border-radius:9px;padding:10px 12px;margin:0 0 18px;line-height:1.6}</style></head>
<body><div class="card"><span class="tag">Safepay ${esc(process.env.SAFEPAY_ENV === 'production' ? 'live' : 'sandbox')}</span>${body}</div></body></html>`
}

function form(rec, query, error) {
  const a = rec.payoutAccount ?? {}
  const back = trusted(query.return) ? `?return=${encodeURIComponent(query.return)}` : ''
  return page(
    'Payout account',
    `<h1>Payout account</h1>
<p>Bank account for <b>${esc(rec.profile?.name || 'your restaurant')}</b>.</p>
<div class="flow">Mingler pays → Safepay holds the card payment → captured into <b>GoMingle escrow</b> at the 24-hour confirmation → released to this account after the event, minus the GoMingle fee.</div>
${error ? `<div class="err">${esc(error)}</div>` : ''}
<form method="post" action="${esc(back)}">
<label for="t">Account title</label><input id="t" name="accountTitle" required maxlength="100" value="${esc(query.accountTitle ?? a.accountTitle ?? '')}">
<label for="b">Bank</label><select id="b" name="bankName" required>${BANKS.map((b) => `<option${(query.bankName ?? a.bankName) === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>
<label for="i">IBAN</label><input id="i" name="iban" required placeholder="PK36 SCBL 0000 0011 2345 6702" value="${esc(query.iban ?? (a.iban ? maskIban(a.iban) : ''))}">
<button type="submit">Save payout account</button></form>`,
  )
}

/** The payout account as the partner sees it: the number is always masked. */
export function publicPayoutAccount(account) {
  if (!account) return null
  return {
    accountTitle: account.accountTitle,
    bankName: account.bankName,
    ibanMasked: maskIban(account.iban),
    addedAt: account.addedAt,
    updatedAt: account.updatedAt ?? account.addedAt,
  }
}

/**
 * Validates and stores a restaurant's payout account. Shared by the Partner
 * Portal's Payout Account tab and the hosted setup page.
 * An IBAN sent back exactly as shown masked ("PK72 •••• 1234") keeps the
 * number on file, so editing only the title or bank does not need it retyped.
 */
export async function savePayoutAccount(restaurantId, input) {
  const rec = db.restaurants[restaurantId]
  if (!rec) return { error: 'Restaurant not found.' }
  const accountTitle = String(input.accountTitle ?? '').trim()
  const bankName = String(input.bankName ?? '').trim()
  const saved = rec.payoutAccount?.iban
  const iban = saved && String(input.iban ?? '').trim() === maskIban(saved) ? saved : normaliseIban(input.iban)
  if (!accountTitle) return { error: 'Enter the account title.', field: 'accountTitle' }
  if (accountTitle.length > 100) return { error: 'The account title can be at most 100 characters.', field: 'accountTitle' }
  if (!BANKS.includes(bankName)) return { error: 'Choose your bank.', field: 'bankName' }
  if (!isValidPkIban(iban)) {
    return { error: 'Enter a valid Pakistani IBAN (24 characters, starting with PK).', field: 'iban' }
  }
  const now = new Date().toISOString()
  rec.payoutAccount = { accountTitle, bankName, iban, addedAt: rec.payoutAccount?.addedAt ?? now, updatedAt: now }
  const ns = await partnerTenant(restaurantId)
  ns.profile.mockProfile.payoutAccountId = `po_${iban.slice(-8)}`
  snapshot(restaurantId, ns)
  save()
  return { account: rec.payoutAccount }
}

export function payoutRoutes() {
  const r = express.Router()
  r.get('/payouts/setup/:id', (req, res) => {
    const rec = db.restaurants[req.params.id]
    if (!rec) return res.status(404).send(page('Not found', '<h1>Restaurant not found</h1>'))
    res.send(form(rec, req.query))
  })
  r.post('/payouts/setup/:id', express.urlencoded({ extended: false }), async (req, res, next) => {
    try {
      const id = req.params.id
      const rec = db.restaurants[id]
      if (!rec) return res.status(404).send(page('Not found', '<h1>Restaurant not found</h1>'))
      const raw = Buffer.isBuffer(req.body) ? new URLSearchParams(req.body.toString('utf8')) : new URLSearchParams(req.body)
      const input = Object.fromEntries(raw)
      const result = await savePayoutAccount(id, input)
      if (result.error) return res.status(422).send(form(rec, { ...req.query, ...input }, result.error))
      const iban = result.account.iban
      if (trusted(req.query.return)) return res.redirect(303, `${req.query.return}/overview?payments=return`)
      res.send(page('Saved', `<h1>Payout account saved</h1><p>Payouts will go to <b>${esc(rec.payoutAccount.bankName)} ${esc(maskIban(iban))}</b>. You can close this tab.</p>`))
    } catch (err) {
      next(err)
    }
  })
  return r
}
