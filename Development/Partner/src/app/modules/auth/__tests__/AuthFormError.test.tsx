import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { AuthFormError } from '../components/AuthFormError'

describe('AuthFormError', () => {
  it('announces the message through an alert role', () => {
    renderWithProviders(<AuthFormError message="Attempt limit exceeded." />)

    // The alert role is the fix for MET-1242: without it the message rendered
    // but nothing observable changed, so a rate-limited "Send code" read as a
    // dead button to screen readers and accessibility checks alike.
    expect(screen.getByRole('alert')).toHaveTextContent('Attempt limit exceeded.')
  })

  it('renders nothing when there is no message', () => {
    renderWithProviders(<AuthFormError />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing for an empty message so callers can pass state straight through', () => {
    renderWithProviders(<AuthFormError message="" />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('centres the line for the OTP step', () => {
    renderWithProviders(<AuthFormError message="Enter the 6-digit code." centered />)

    expect(screen.getByRole('alert')).toHaveClass('justify-center')
  })

  it('leaves the line start-aligned by default', () => {
    renderWithProviders(<AuthFormError message="Enter a valid email address." />)

    expect(screen.getByRole('alert')).not.toHaveClass('justify-center')
  })
})
