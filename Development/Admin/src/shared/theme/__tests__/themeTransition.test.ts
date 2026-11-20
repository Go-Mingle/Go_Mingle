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

  it('uses a view transition whose circle starts at the switch, and cleans up after', async () => {
    useThemeStore.getState().setMode('dark')
    let finish = () => {}
    const finished = new Promise<void>((r) => (finish = r))
    const root = document.documentElement
    const start = vi.fn((update: () => void) => {
      // The circle's position is set before the snapshot is taken, so the
      // reveal is in place from the first frame (no flash of the new theme).
      expect(root.classList.contains('gm-theme-vt')).toBe(true)
      expect(root.style.getPropertyValue('--gm-vt-x')).toBe('10px')
      expect(root.style.getPropertyValue('--gm-vt-y')).toBe('20px')
      expect(parseFloat(root.style.getPropertyValue('--gm-vt-r'))).toBeGreaterThan(0)
      update()
      return { ready: Promise.resolve(), finished }
    })
    doc.startViewTransition = start
    transitionTheme('light', { x: 10, y: 20 })
    expect(start).toHaveBeenCalledOnce()
    expect(useThemeStore.getState().mode).toBe('light')
    finish()
    await finished
    await Promise.resolve()
    expect(root.classList.contains('gm-theme-vt')).toBe(false)
    expect(root.style.getPropertyValue('--gm-vt-x')).toBe('')
  })

  it('does nothing when the theme is already the one asked for', () => {
    useThemeStore.getState().setMode('light')
    const start = vi.fn()
    doc.startViewTransition = start
    transitionTheme('light')
    expect(start).not.toHaveBeenCalled()
  })
})
