import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePageVisible } from '../usePageVisible'

/**
 * jsdom exposes `document.hidden` as a getter with no setter, so it is stubbed rather
 * than assigned — then the event the browser would fire is dispatched by hand.
 */
function setHidden(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden)
}

function fireVisibilityChange() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePageVisible', () => {
  it('starts visible on a foreground tab', () => {
    setHidden(false)
    const { result } = renderHook(() => usePageVisible())

    expect(result.current).toBe(true)
  })

  /** The tab may already be hidden by the time the hook mounts. */
  it('starts hidden on a background tab', () => {
    setHidden(true)
    const { result } = renderHook(() => usePageVisible())

    expect(result.current).toBe(false)
  })

  it('goes false when the tab is hidden', () => {
    setHidden(false)
    const { result } = renderHook(() => usePageVisible())

    setHidden(true)
    fireVisibilityChange()

    expect(result.current).toBe(false)
  })

  it('goes true again when the tab comes back', () => {
    setHidden(true)
    const { result } = renderHook(() => usePageVisible())

    setHidden(false)
    fireVisibilityChange()

    expect(result.current).toBe(true)
  })

  it('survives repeated toggles', () => {
    setHidden(false)
    const { result } = renderHook(() => usePageVisible())

    for (const hidden of [true, false, true, false]) {
      setHidden(hidden)
      fireVisibilityChange()
      expect(result.current).toBe(!hidden)
    }
  })

  /** A listener left behind would keep setting state on an unmounted component. */
  it('removes its listener on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    setHidden(false)

    renderHook(() => usePageVisible()).unmount()

    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  /**
   * Degrades to "poll normally" rather than silently never polling — the failure mode of
   * defaulting to hidden would be an inbox that never updates.
   */
  it('reports visible when the platform has no Page Visibility support', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(undefined as unknown as boolean)
    const { result } = renderHook(() => usePageVisible())

    expect(result.current).toBe(true)
  })
})
