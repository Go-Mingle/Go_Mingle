import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { SessionNotice } from '../components/SessionNotice'
import { SESSION_NOTICE_KEY } from '../../../../shared/api/sessionManager'

beforeEach(() => {
  sessionStorage.clear()
})

describe('SessionNotice', () => {
  it('renders nothing when the session ended normally', () => {
    const { container } = renderWithProviders(<SessionNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the suspension message verbatim (AC-04.2)', () => {
    sessionStorage.setItem(SESSION_NOTICE_KEY, 'SUSPENDED')
    renderWithProviders(<SessionNotice />)

    expect(
      screen.getByText('Your account has been suspended. Please contact support.'),
    ).toBeInTheDocument()
    expect(document.querySelector('.ant-alert-error')).not.toBeNull()
  })

  it('shows a warning for an expired session', () => {
    sessionStorage.setItem(SESSION_NOTICE_KEY, 'EXPIRED')
    renderWithProviders(<SessionNotice />)

    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument()
    expect(document.querySelector('.ant-alert-warning')).not.toBeNull()
  })

  it('shows a warning for an invalid token', () => {
    sessionStorage.setItem(SESSION_NOTICE_KEY, 'INVALID')
    renderWithProviders(<SessionNotice />)

    expect(
      screen.getByText('Your session is no longer valid. Please sign in again.'),
    ).toBeInTheDocument()
  })

  it('consumes the notice so a reload of the login screen shows nothing', () => {
    sessionStorage.setItem(SESSION_NOTICE_KEY, 'SUSPENDED')
    const first = renderWithProviders(<SessionNotice />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    first.unmount()

    const { container } = renderWithProviders(<SessionNotice />)
    expect(container).toBeEmptyDOMElement()
    expect(sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull()
  })
})
