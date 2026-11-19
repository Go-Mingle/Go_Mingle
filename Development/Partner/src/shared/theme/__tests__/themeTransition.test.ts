import { describe, it, expect, vi, afterEach } from 'vitest'
import { useThemeStore } from '../themeStore'
import { transitionTheme } from '../themeTransition'

const doc = document as unknown as { startViewTransition?: unknown }

describe('transitionTheme', () => {
  afterEach(() => {
    delete doc.startViewTransition
    document.documentElement.classList.remove('gm-theme-fade', 'gm-theme-vt')
    vi.useRealTimers()
  })

  it('fades colours when the browser has no view transitions', () => {
    vi.useFakeTimers()
    useThemeStore.getState().setMode('light')
    transitionTheme('dark')
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('gm-theme-fade')).toBe(true)
    vi.advanceTimersByTime(500)
    expect(document.documentElement.classList.contains('gm-theme-fade')).toBe(false)
  })

  it('uses a view transition when there is one', () => {
    useThemeStore.getState().setMode('dark')
    const start = vi.fn((update: () => void) => {
      update()
      return { ready: new Promise<void>(() => {}) }
    })
    doc.startViewTransition = start
    transitionTheme('light', { x: 10, y: 10 })
    expect(start).toHaveBeenCalledOnce()
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('does nothing when the theme is already the one asked for', () => {
    useThemeStore.getState().setMode('light')
    const start = vi.fn()
    doc.startViewTransition = start
    transitionTheme('light')
    expect(start).not.toHaveBeenCalled()
  })
})
