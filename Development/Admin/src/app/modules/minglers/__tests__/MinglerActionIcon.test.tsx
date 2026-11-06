import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ActionIcon } from '../components/MinglerActionIcon'

describe('ActionIcon', () => {
  it('calls onClick and toggles hover styles when enabled', () => {
    const onClick = vi.fn()
    renderWithProviders(
      <ActionIcon hoverBg="#fff" hoverColor="#000" onClick={onClick}>
        <span>icon</span>
      </ActionIcon>,
    )
    const icon = screen.getByText('icon').parentElement as HTMLElement

    fireEvent.mouseEnter(icon)
    expect(icon.style.background).toBe('rgb(255, 255, 255)')
    fireEvent.mouseLeave(icon)
    expect(icon.style.background).toBe('transparent')

    fireEvent.click(icon)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ignores onClick and hover styling when disabled', () => {
    const onClick = vi.fn()
    renderWithProviders(
      <ActionIcon hoverBg="#fff" hoverColor="#000" onClick={onClick} disabled>
        <span>icon</span>
      </ActionIcon>,
    )
    const icon = screen.getByText('icon').parentElement as HTMLElement

    fireEvent.mouseEnter(icon)
    expect(icon.style.background).not.toBe('rgb(255, 255, 255)')
    fireEvent.mouseLeave(icon)

    fireEvent.click(icon)
    expect(onClick).not.toHaveBeenCalled()
  })
})
