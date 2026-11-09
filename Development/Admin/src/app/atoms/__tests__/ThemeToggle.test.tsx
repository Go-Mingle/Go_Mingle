import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { useThemeStore } from '../../../shared/theme/themeStore'
import { ThemeToggle } from '../ThemeToggle'

beforeEach(() => {
  window.localStorage.clear()
  useThemeStore.setState({ mode: 'light', explicit: false })
})

describe('ThemeToggle', () => {
  it('switches between light and dark mode', async () => {
    renderWithProviders(<ThemeToggle />)
    const button = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(button)
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    const back = screen.getByRole('button', { name: /switch to light mode/i })
    expect(back).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(back)
    expect(useThemeStore.getState().mode).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
