import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  withRefreshLock,
  broadcastSessionLost,
  onRemoteSessionLost,
  __resetCrossTabSession,
} from '../crossTabSession'

/**
 * jsdom implements neither Web Locks nor BroadcastChannel, so the unstubbed
 * state *is* the unsupported-browser path — both branches get exercised for
 * free rather than needing a second environment.
 */

interface FakeChannel {
  name: string
  posted: unknown[]
  listeners: Set<(event: MessageEvent<unknown>) => void>
  postMessage: (data: unknown) => void
  addEventListener: (type: string, fn: (event: MessageEvent<unknown>) => void) => void
  removeEventListener: (type: string, fn: (event: MessageEvent<unknown>) => void) => void
  close: () => void
}

const channels: FakeChannel[] = []

/**
 * Restored by hand rather than with `vi.unstubAllGlobals()`, which would also
 * drop the `localStorage` stub `setupTests.ts` installs at module load.
 */
const realNavigator = globalThis.navigator

/** A same-origin BroadcastChannel stand-in: every instance sees every post. */
function installChannel(): void {
  class Fake implements FakeChannel {
    name: string
    posted: unknown[] = []
    listeners = new Set<(event: MessageEvent<unknown>) => void>()

    constructor(name: string) {
      this.name = name
      channels.push(this)
    }
    postMessage(data: unknown) {
      this.posted.push(data)
      // Real channels never deliver to the poster; only to the other instances.
      channels
        .filter((other) => other !== this && other.name === this.name)
        .forEach((other) => {
          other.listeners.forEach((fn) => fn({ data } as MessageEvent<unknown>))
        })
    }
    addEventListener(_type: string, fn: (event: MessageEvent<unknown>) => void) {
      this.listeners.add(fn)
    }
    removeEventListener(_type: string, fn: (event: MessageEvent<unknown>) => void) {
      this.listeners.delete(fn)
    }
    close() {
      this.listeners.clear()
    }
  }
  vi.stubGlobal('BroadcastChannel', Fake)
}

afterEach(() => {
  __resetCrossTabSession()
  channels.length = 0
  vi.stubGlobal('navigator', realNavigator)
  // jsdom has no BroadcastChannel, so "restored" means absent again.
  vi.stubGlobal('BroadcastChannel', undefined)
})

describe('withRefreshLock', () => {
  it('runs the work under the browser lock when Web Locks exists', async () => {
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn())
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })

    await expect(withRefreshLock(async () => 'renewed')).resolves.toBe('renewed')
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0]).toBe('gomingle-partner-refresh')
  })

  /** Older browsers and jsdom: degrade to the per-tab behaviour, never crash. */
  it('runs the work directly when Web Locks is absent', async () => {
    const work = vi.fn(async () => 'renewed')
    await expect(withRefreshLock(work)).resolves.toBe('renewed')
    expect(work).toHaveBeenCalledOnce()
  })

  it('propagates a rejection from the work', async () => {
    await expect(withRefreshLock(() => Promise.reject(new Error('nope')))).rejects.toThrow('nope')
  })

  /** The whole point: the second caller waits rather than running concurrently. */
  it('serialises callers through the lock', async () => {
    let held = false
    let overlapped = false
    const request = async (_name: string, fn: () => Promise<unknown>) => {
      while (held) await Promise.resolve()
      held = true
      try {
        return await fn()
      } finally {
        held = false
      }
    }
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })

    const body = async () => {
      if (held && overlapped) overlapped = true
      await Promise.resolve()
      return 'ok'
    }
    await Promise.all([withRefreshLock(body), withRefreshLock(body)])
    expect(overlapped).toBe(false)
  })
})

describe('broadcastSessionLost', () => {
  it('posts the reason to the other tabs', () => {
    installChannel()
    const received: string[] = []
    onRemoteSessionLost((reason) => received.push(reason))

    // A second instance stands in for the other tab.
    const other = new (globalThis.BroadcastChannel as unknown as new (n: string) => FakeChannel)(
      'gomingle-partner-session',
    )
    other.postMessage({ type: 'session-lost', reason: 'ACCOUNT_SUSPENDED' })

    expect(received).toEqual(['ACCOUNT_SUSPENDED'])
  })

  /** BR-11 — the channel carries a reason and never a credential. */
  it('sends no token, only a reason', () => {
    installChannel()
    broadcastSessionLost('REFRESH_FAILED')

    const posted = channels[0].posted
    expect(posted).toEqual([{ type: 'session-lost', reason: 'REFRESH_FAILED' }])
    expect(JSON.stringify(posted)).not.toContain('eyJ')
    expect(JSON.stringify(posted)).not.toMatch(/token/i)
  })

  it('is a no-op without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    expect(() => broadcastSessionLost('TOKEN_INVALID')).not.toThrow()
  })

  it('survives a channel that refuses to construct', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked by privacy mode')
        }
      },
    )
    expect(() => broadcastSessionLost('TOKEN_INVALID')).not.toThrow()
    expect(onRemoteSessionLost(vi.fn())).toBeTypeOf('function')
  })

  it('reuses one channel across calls', () => {
    installChannel()
    broadcastSessionLost('TOKEN_INVALID')
    broadcastSessionLost('REFRESH_FAILED')
    expect(channels).toHaveLength(1)
  })
})

describe('onRemoteSessionLost', () => {
  function postFromOtherTab(data: unknown): void {
    const other = new (globalThis.BroadcastChannel as unknown as new (n: string) => FakeChannel)(
      'gomingle-partner-session',
    )
    other.postMessage(data)
  }

  it('stops listening once unsubscribed', () => {
    installChannel()
    const listener = vi.fn()
    const unsubscribe = onRemoteSessionLost(listener)
    unsubscribe()

    postFromOtherTab({ type: 'session-lost', reason: 'TOKEN_INVALID' })
    expect(listener).not.toHaveBeenCalled()
  })

  it.each([
    ['a foreign message type', { type: 'something-else', reason: 'TOKEN_INVALID' }],
    ['a bare string', 'session-lost'],
    ['null', null],
  ])('ignores %s', (_label, data) => {
    installChannel()
    const listener = vi.fn()
    onRemoteSessionLost(listener)

    postFromOtherTab(data)
    expect(listener).not.toHaveBeenCalled()
  })

  it('returns a usable unsubscribe without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const unsubscribe = onRemoteSessionLost(vi.fn())
    expect(() => unsubscribe()).not.toThrow()
  })
})
