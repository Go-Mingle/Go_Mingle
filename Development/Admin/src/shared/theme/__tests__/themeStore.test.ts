import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  initTheme,
  readStoredTheme,
  systemTheme,
  useThemeStore,
} from '../themeStore'

type Listener = (event: MediaQueryListEvent) => void

function mockMatchMedia(dark: boolean) {
  const listeners: Listener[] = []
  const query = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  )
  return { emit: (matches: boolean) => listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent)) }
}

beforeEach(() => {
  window.localStorage.clear()
  useThemeStore.setState({ mode: 'light', explicit: false })
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme store', () => {
  it('reads only a valid stored choice', () => {
    expect(readStoredTheme()).toBeNull()
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    expect(readStoredTheme()).toBeNull()
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('returns null when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('blocked')
    })
    expect(readStoredTheme()).toBeNull()
  })

  it('follows the operating system preference', () => {
    mockMatchMedia(true)
    expect(systemTheme()).toBe('dark')
    mockMatchMedia(false)
    expect(systemTheme()).toBe('light')
  })

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemTheme()).toBe('light')
  })

  it('puts the theme on <html>', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('toggling switches the theme, remembers it and applies it', () => {
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(useThemeStore.getState().explicit).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('keeps working when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('blocked')
    })
    useThemeStore.getState().setMode('dark')
    expect(useThemeStore.getState().mode).toBe('dark')
  })

  it('follows OS changes until the user picks a theme', () => {
    const os = mockMatchMedia(false)
    initTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
    os.emit(true)
    expect(useThemeStore.getState().mode).toBe('dark')

    useThemeStore.getState().setMode('light')
    os.emit(true)
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('initialises without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    initTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
