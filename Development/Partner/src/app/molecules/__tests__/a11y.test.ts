import { describe, it, expect, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { activateOnKey } from '../a11y'

function makeEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent
}

describe('activateOnKey', () => {
  it('activates and prevents default on Enter', () => {
    const activate = vi.fn()
    const e = makeEvent('Enter')
    activateOnKey(activate)(e)
    expect(activate).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('activates and prevents default on Space', () => {
    const activate = vi.fn()
    const e = makeEvent(' ')
    activateOnKey(activate)(e)
    expect(activate).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const activate = vi.fn()
    const e = makeEvent('Tab')
    activateOnKey(activate)(e)
    expect(activate).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
