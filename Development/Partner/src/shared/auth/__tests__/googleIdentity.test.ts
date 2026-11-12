import { describe, it, expect, afterEach, vi } from 'vitest'

type W = { google?: unknown }

afterEach(() => {
  delete (window as W).google
  document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((s) => s.remove())
  vi.resetModules()
})

describe('loadGoogleIdentity', () => {
  it('returns the API straight away when Google is already loaded', async () => {
    const api = { initialize: vi.fn(), renderButton: vi.fn(), disableAutoSelect: vi.fn() }
    ;(window as W).google = { accounts: { id: api } }
    const { loadGoogleIdentity } = await import('../googleIdentity')
    await expect(loadGoogleIdentity()).resolves.toBe(api)
    expect(document.head.querySelector('script[src*="accounts.google.com"]')).toBeNull()
  })

  it("adds Google's script once and resolves when it loads", async () => {
    const { loadGoogleIdentity } = await import('../googleIdentity')
    const first = loadGoogleIdentity()
    const second = loadGoogleIdentity()
    const scripts = document.head.querySelectorAll(
      'script[src="https://accounts.google.com/gsi/client"]',
    )
    expect(scripts).toHaveLength(1)
    const api = { initialize: vi.fn(), renderButton: vi.fn(), disableAutoSelect: vi.fn() }
    ;(window as W).google = { accounts: { id: api } }
    scripts[0].dispatchEvent(new Event('load'))
    await expect(first).resolves.toBe(api)
    await expect(second).resolves.toBe(api)
  })

  it('rejects when the script loads without the API, and when it fails, then retries', async () => {
    const { loadGoogleIdentity } = await import('../googleIdentity')
    const empty = loadGoogleIdentity()
    document.head
      .querySelector('script[src*="accounts.google.com"]')!
      .dispatchEvent(new Event('load'))
    await expect(empty).rejects.toThrow('did not load')

    vi.resetModules()
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((s) => s.remove())
    const mod = await import('../googleIdentity')
    const failed = mod.loadGoogleIdentity()
    document.head
      .querySelector('script[src*="accounts.google.com"]')!
      .dispatchEvent(new Event('error'))
    await expect(failed).rejects.toThrow('did not load')
    mod.loadGoogleIdentity().catch(() => undefined)
    expect(document.head.querySelectorAll('script[src*="accounts.google.com"]')).toHaveLength(2)
  })
})
