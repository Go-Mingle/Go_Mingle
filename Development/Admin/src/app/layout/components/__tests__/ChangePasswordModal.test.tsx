import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { message } from 'antd'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ChangePasswordModal } from '../ChangePasswordModal'
import { authService } from '../../../modules/auth/services'
import { cognitoSignOut } from '../../../modules/auth/cognitoService'

vi.mock('../../../modules/auth/services', () => ({
  authService: { changePassword: vi.fn() },
}))

vi.mock('../../../modules/auth/cognitoService', () => ({
  cognitoSignOut: vi.fn().mockResolvedValue(undefined),
}))

const changePassword = authService.changePassword as unknown as ReturnType<typeof vi.fn>
const cognitoSignOutMock = cognitoSignOut as unknown as ReturnType<typeof vi.fn>

afterEach(() => {
  message.destroy()
  vi.clearAllMocks()
})

function setup(overrides: Partial<React.ComponentProps<typeof ChangePasswordModal>> = {}) {
  const props = { open: true, onClose: vi.fn(), ...overrides }
  renderWithProviders(<ChangePasswordModal {...props} />)
  return props
}

// The three Input.Password fields, in DOM order.
function fields() {
  const inputs = document.querySelectorAll('input[type="password"]')
  return {
    current: inputs[0] as HTMLInputElement,
    next: inputs[1] as HTMLInputElement,
    confirm: inputs[2] as HTMLInputElement,
  }
}

function submitBtn() {
  return screen.getByRole('button', { name: /update password/i })
}

describe('ChangePasswordModal', () => {
  beforeEach(() => changePassword.mockResolvedValue(undefined))

  it('keeps submit disabled until a strong, matching password is entered', () => {
    setup()
    const { current, next, confirm } = fields()
    expect(submitBtn()).toBeDisabled()

    fireEvent.change(current, { target: { value: 'OldPass1!' } })
    fireEvent.change(next, { target: { value: 'weak' } }) // strength < 3
    fireEvent.change(confirm, { target: { value: 'weak' } })
    expect(submitBtn()).toBeDisabled()

    fireEvent.change(next, { target: { value: 'StrongPass1' } }) // strength >= 3
    fireEvent.change(confirm, { target: { value: 'StrongPass1' } })
    expect(submitBtn()).toBeEnabled()
  })

  it('shows a mismatch message when confirmation differs', () => {
    setup()
    const { next, confirm } = fields()
    fireEvent.change(next, { target: { value: 'StrongPass1' } })
    fireEvent.change(confirm, { target: { value: 'Different1' } })
    expect(screen.getByText(/don't match/i)).toBeInTheDocument()
    expect(submitBtn()).toBeDisabled()
  })

  it('calls the API and closes on success', async () => {
    const { onClose } = setup()
    const { current, next, confirm } = fields()
    fireEvent.change(current, { target: { value: 'OldPass1!' } })
    fireEvent.change(next, { target: { value: 'StrongPass1' } })
    fireEvent.change(confirm, { target: { value: 'StrongPass1' } })
    fireEvent.click(submitBtn())

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass1!',
        newPassword: 'StrongPass1',
        confirmPassword: 'StrongPass1',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('signs the user out of Cognito on success when a session token exists', async () => {
    localStorage.setItem('auth-token', 'active-token')
    setup()
    const { current, next, confirm } = fields()
    fireEvent.change(current, { target: { value: 'OldPass1!' } })
    fireEvent.change(next, { target: { value: 'StrongPass1' } })
    fireEvent.change(confirm, { target: { value: 'StrongPass1' } })
    fireEvent.click(submitBtn())

    await waitFor(() => expect(cognitoSignOutMock).toHaveBeenCalledWith('active-token'))
  })

  it('surfaces the incorrect-current-password error', async () => {
    changePassword.mockRejectedValueOnce({ code: 'ERR_CURRENT_PASSWORD_INCORRECT' })
    setup()
    const { current, next, confirm } = fields()
    fireEvent.change(current, { target: { value: 'WrongPass1' } })
    fireEvent.change(next, { target: { value: 'StrongPass1' } })
    fireEvent.change(confirm, { target: { value: 'StrongPass1' } })
    fireEvent.click(submitBtn())

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument()
  })

  it('surfaces a generic API error message', async () => {
    changePassword.mockRejectedValueOnce({ message: 'Server exploded' })
    const { onClose } = setup()
    const { current, next, confirm } = fields()
    fireEvent.change(current, { target: { value: 'OldPass1!' } })
    fireEvent.change(next, { target: { value: 'StrongPass1' } })
    fireEvent.change(confirm, { target: { value: 'StrongPass1' } })
    fireEvent.click(submitBtn())

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
