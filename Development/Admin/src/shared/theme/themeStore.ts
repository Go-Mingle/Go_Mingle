import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'

/** localStorage key for the theme the user picked. Absent = follow the OS. */
export const THEME_STORAGE_KEY = 'gomingle.theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

/** The theme the user picked earlier, or null when they never picked one. */
export function readStoredTheme(): ThemeMode | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(value) ? value : null
  } catch {
    return null
  }
}

function storeTheme(mode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Storage blocked (private window): the choice lasts for this visit only.
  }
}

/** The operating system's light/dark preference. */
export function systemTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Puts the theme on <html>: `data-theme` drives the CSS colour tokens
 * (styles/index.css) and `color-scheme` makes native controls and scrollbars
 * follow along.
 */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
}

interface ThemeState {
  mode: ThemeMode
  /** True once the user has picked a theme; until then the OS setting rules. */
  explicit: boolean
  setMode: (mode: ThemeMode) => void
  toggle: () => void
  /** The OS setting changed: follow it unless the user picked a theme. */
  syncWithSystem: (mode: ThemeMode) => void
}

const stored = typeof window === 'undefined' ? null : readStoredTheme()

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: stored ?? systemTheme(),
  explicit: stored !== null,
  setMode: (mode) => {
    storeTheme(mode)
    applyTheme(mode)
    set({ mode, explicit: true })
  },
  toggle: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
  syncWithSystem: (mode) => {
    if (get().explicit) return
    applyTheme(mode)
    set({ mode })
  },
}))

/**
 * Applies the starting theme before the first paint and keeps following the
 * OS setting until the user picks one. Call once, before rendering.
 */
export function initTheme() {
  applyTheme(useThemeStore.getState().mode)
  if (typeof window.matchMedia !== 'function') return
  const query = window.matchMedia(DARK_QUERY)
  const onChange = (event: MediaQueryListEvent) =>
    useThemeStore.getState().syncWithSystem(event.matches ? 'dark' : 'light')
  query.addEventListener?.('change', onChange)
}
