import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { CopyButton } from '../CopyButton'

describe('CopyButton', () => {
  const writeText = vi.fn(() => Promise.resolve())

  beforeEach(() => {
    vi.useFakeTimers()
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders icon-only button without a label span and falls back to the default className', () => {
    renderWithProviders(<CopyButton value="secret" />)
    const btn = screen.getByRole('button')
    expect(btn.querySelector('span')).toBeNull()
    expect(btn.className).toContain('inline-flex')
    // ariaLabel falls back to label, both undefined
    expect(btn.getAttribute('aria-label')).toBeNull()
  })

  it('renders a label and uses the explicit ariaLabel and className', () => {
    renderWithProviders(
      <CopyButton value="secret" label="Copy key" ariaLabel="Copy the key" className="custom" />,
    )
    const btn = screen.getByRole('button', { name: 'Copy the key' })
    expect(btn.className).toBe('custom')
    expect(screen.getByText('Copy key')).toBeTruthy()
  })

  it('falls back to label for aria-label when ariaLabel is omitted', () => {
    renderWithProviders(<CopyButton value="secret" label="Copy key" />)
    expect(screen.getByRole('button', { name: 'Copy key' })).toBeTruthy()
  })

  it('copies the value, shows the copied confirmation, then resets after the timeout', () => {
    renderWithProviders(<CopyButton value="secret" label="Copy" copiedLabel="Copied!" />)
    const btn = screen.getByRole('button')

    fireEvent.click(btn)

    expect(writeText).toHaveBeenCalledWith('secret')
    expect(screen.getByText('Copied!')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1400)
    })

    expect(screen.getByText('Copy')).toBeTruthy()
    expect(screen.queryByText('Copied!')).toBeNull()
  })

  it('falls back to label as the copied text when copiedLabel is omitted', () => {
    renderWithProviders(<CopyButton value="secret" label="Copy" />)
    fireEvent.click(screen.getByRole('button'))
    // still shows the same label text, now with the Check icon
    expect(screen.getAllByText('Copy').length).toBeGreaterThan(0)
  })

  it('does not throw when the clipboard API is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    renderWithProviders(<CopyButton value="secret" label="Copy" />)
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
  })
})
