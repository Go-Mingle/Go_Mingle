import { describe, it, expect } from 'vitest'
import { isDeliverableWebhookHost } from '../endpointUrl'

/** MET-1282 / TC-PARTNER-WEBHOOK-009 — https alone never made a host reachable. */
describe('isDeliverableWebhookHost', () => {
  it.each([
    'api.yourdomain.com',
    'hooks.aurelia-pos.co.uk',
    'x.test',
    '203.0.113.10',
    '[2001:db8::1]',
  ])('accepts %s', (host) => {
    expect(isDeliverableWebhookHost(host)).toBe(true)
  })

  it.each([
    'no-tld',
    'localhost',
    'example.',
    '.com',
    'example..com',
    'example.c',
    'exa mple.com',
    '999.999.999.999',
    '',
  ])('rejects %s', (host) => {
    expect(isDeliverableWebhookHost(host)).toBe(false)
  })

  it('rejects a host longer than 253 characters', () => {
    expect(isDeliverableWebhookHost(`${'a'.repeat(250)}.com`)).toBe(false)
  })

  it('agrees with what URL reports for the reported endpoint', () => {
    expect(isDeliverableWebhookHost(new URL('https://no-tld').hostname)).toBe(false)
    expect(isDeliverableWebhookHost(new URL('https://api.yourdomain.com/hooks').hostname)).toBe(true)
  })
})
