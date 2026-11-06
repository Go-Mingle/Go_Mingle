import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { server } from './mocks/server'
import './locales/i18n'

// The suite is interaction-heavy (antd + userEvent) and runs with limited
// concurrency, so async assertions after network/FileReader flows can exceed
// Testing Library's 1000ms default under CPU contention, causing flaky
// findBy*/waitFor timeouts in CI. Raise the default so these stay reliable.
configure({ asyncUtilTimeout: 5000 })

// jsdom in this project's vitest setup does not expose a working localStorage,
// so httpClient.getAuthToken() crashes during request tests. Provide a minimal
// in-memory Storage implementation and reset it between tests.
const createStorageMock = (): Storage => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

vi.stubGlobal('localStorage', localStorageMock)
vi.stubGlobal('sessionStorage', sessionStorageMock)

beforeEach(() => {
  // Re-establish the storage stubs before every test. Some tests call
  // vi.unstubAllGlobals() in their own afterEach, which strips these
  // module-level stubs; without re-stubbing, httpClient.getAuthToken() would
  // then throw for any request-driven test that follows.
  vi.stubGlobal('localStorage', localStorageMock)
  vi.stubGlobal('sessionStorage', sessionStorageMock)
  localStorageMock.clear()
  sessionStorageMock.clear()
})

// Polyfill matchMedia for antd. Default to desktop (≥768px) so antd Grid.useBreakpoint
// returns md/lg/xl/xxl as true. Tests that want mobile can override window.matchMedia.
const DEFAULT_TEST_WIDTH = 1280
function matchesDefault(query: string): boolean {
  // Parse simple "(min-width: Npx)" or "(max-width: Npx)" expressions.
  const minMatch = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (minMatch) return DEFAULT_TEST_WIDTH >= Number(minMatch[1])
  const maxMatch = /\(max-width:\s*(\d+)px\)/.exec(query)
  if (maxMatch) return DEFAULT_TEST_WIDTH <= Number(maxMatch[1])
  return false
}
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: matchesDefault(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Polyfill ResizeObserver for antd/recharts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock

// Polyfill scrollTo
window.HTMLElement.prototype.scrollIntoView = vi.fn()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
