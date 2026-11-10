import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { config } from '../../config'
import { RestaurantsService, type Restaurant } from '../restaurants/restaurants.service'
import { BANKS, maskIban, PayoutService, type PayoutAccount } from './payout.service'

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const trusted = (o: unknown): o is string => typeof o === 'string' && Boolean(o) && (LOCAL.test(o) || config.corsOrigins.includes(o))
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function page(title: string, body: string) {
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
<body><div class="card"><span class="tag">Safepay ${esc(config.safepay.environment === 'production' ? 'live' : 'sandbox')}</span>${body}</div></body></html>`
}

function form(r: Restaurant, a: PayoutAccount | null, query: Record<string, unknown>, error?: string) {
  const back = trusted(query.return) ? `?return=${encodeURIComponent(query.return)}` : ''
  return page(
    'Payout account',
    `<h1>Payout account</h1>
<p>Bank account for <b>${esc(r.name || 'your restaurant')}</b>.</p>
<div class="flow">Mingler pays → Safepay holds the card payment → captured into <b>GoMingle escrow</b> at the 24-hour confirmation → released to this account after the event, minus the GoMingle fee.</div>
${error ? `<div class="err">${esc(error)}</div>` : ''}
<form method="post" action="${esc(back)}">
<label for="t">Account title</label><input id="t" name="accountTitle" required maxlength="100" value="${esc(query.accountTitle ?? a?.accountTitle ?? '')}">
<label for="b">Bank</label><select id="b" name="bankName" required>${BANKS.map((b) => `<option${(query.bankName ?? a?.bankName) === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>
<label for="i">IBAN</label><input id="i" name="iban" required placeholder="PK36 SCBL 0000 0011 2345 6702" value="${esc(query.iban ?? (a?.iban ? maskIban(a.iban) : ''))}">
<button type="submit">Save payout account</button></form>`,
  )
}

/**
 * Payout account setup: the page the Partner Portal's "Add payout account"
 * step opens. The restaurant enters the bank account GoMingle releases escrow
 * into; GoMingle then pays out from its Safepay merchant balance.
 */
@Controller('payouts/setup')
export class PayoutSetupController {
  constructor(
    private readonly restaurants: RestaurantsService,
    private readonly payouts: PayoutService,
  ) {}

  @Get(':id')
  async show(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const r = await this.restaurants.find(id)
    if (!r) return res.status(404).send(page('Not found', '<h1>Restaurant not found</h1>'))
    return res.send(form(r, await this.payouts.account(id), req.query))
  }

  @Post(':id')
  async save(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const r = await this.restaurants.find(id)
    if (!r) return res.status(404).send(page('Not found', '<h1>Restaurant not found</h1>'))
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
    const input = Object.fromEntries(new URLSearchParams(raw))
    const result = await this.payouts.save(id, input)
    if (result.error !== undefined) {
      return res.status(422).send(form(r, await this.payouts.account(id), { ...req.query, ...input }, result.error))
    }
    if (trusted(req.query.return)) return res.redirect(303, `${req.query.return}/overview?payments=return`)
    return res.send(
      page('Saved', `<h1>Payout account saved</h1><p>Payouts will go to <b>${esc(result.account.bankName)} ${esc(maskIban(result.account.iban))}</b>. You can close this tab.</p>`),
    )
  }
}
