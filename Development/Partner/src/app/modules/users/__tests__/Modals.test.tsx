import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { DeleteUserModal } from '../components/DeleteUserModal'
import { NewUserModal } from '../components/NewUserModal'
import { EditUserModal } from '../components/EditUserModal'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import type { UserRow } from '../types'

const user: UserRow = {
  id: 'pu-2',
  name: 'Yasmeen Iqbal',
  designation: 'General Manager',
  status: 'active',
  lastActive: '2026-05-04',
  initials: 'YI',
  isPrimary: false,
  canSuspend: true,
  canDelete: true,
}

describe('DeleteUserModal', () => {
  it('hidden when no target', () => {
    renderWithProviders(<DeleteUserModal target={null} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText(/delete user\?/i)).not.toBeInTheDocument()
  })

  it('names the user being removed', () => {
    renderWithProviders(<DeleteUserModal target={user} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Yasmeen Iqbal')).toBeInTheDocument()
  })

  /**
   * The Figma copy said "This action cannot be undone", which is wrong — the
   * delete is soft and the record is retained (BR-10). Asserted so the softened
   * wording cannot silently regress.
   */
  it('does not claim the action is irreversible', () => {
    renderWithProviders(<DeleteUserModal target={user} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
    expect(screen.getByText(/lose access to the portal/i)).toBeInTheDocument()
  })

  it('confirms and cancels', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(<DeleteUserModal target={user} onConfirm={onConfirm} onCancel={onCancel} />)
    const ue = userEvent.setup()

    await ue.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalled()

    await ue.click(screen.getByRole('button', { name: /delete user/i }))
    expect(onConfirm).toHaveBeenCalled()
  })
})

function NewWrapper({
  isValid = false,
  onSave = () => {},
}: {
  isValid?: boolean
  onSave?: () => void
}) {
  const [form] = Form.useForm()
  return <NewUserModal open form={form} isValid={isValid} onSave={onSave} onCancel={() => {}} />
}

describe('NewUserModal', () => {
  it('collects name, email, designation, status and both passwords', () => {
    renderWithProviders(<NewWrapper />)
    expect(screen.getByText('Full name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Designation')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByText('Confirm password')).toBeInTheDocument()
  })

  it('offers no Role field — partner users have no roles (BR-01)', () => {
    renderWithProviders(<NewWrapper />)
    expect(screen.queryByText(/^role$/i)).not.toBeInTheDocument()
  })

  it('disables Send invite until the form is valid', () => {
    renderWithProviders(<NewWrapper />)
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled()
  })

  it('enables Send invite once valid', async () => {
    const onSave = vi.fn()
    renderWithProviders(<NewWrapper isValid onSave={onSave} />)
    const button = screen.getByRole('button', { name: /send invite/i })
    expect(button).not.toBeDisabled()
    await userEvent.setup().click(button)
    expect(onSave).toHaveBeenCalled()
  })

  it('disables the button while the create is in flight, so a double click cannot create two users', () => {
    renderWithProviders(<NewUserModalSaving />)
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled()
  })
})

function NewUserModalSaving() {
  const [form] = Form.useForm()
  return <NewUserModal open form={form} isValid isSaving onSave={() => {}} onCancel={() => {}} />
}

function EditWrapper(props: Partial<React.ComponentProps<typeof EditUserModal>> = {}) {
  const [form] = Form.useForm()
  return <EditUserModal open form={form} isValid onSave={() => {}} onCancel={() => {}} {...props} />
}

describe('EditUserModal', () => {
  it('offers no Role field — the Figma control is a design error (AC-03.3)', () => {
    renderWithProviders(<EditWrapper />)
    expect(screen.queryByText(/^role$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/select role/i)).not.toBeInTheDocument()
  })

  it('shows the email read-only with the immutability hint', () => {
    renderWithProviders(<EditWrapper email="yasmeen@aurelia.pk" />)
    expect(screen.getByText(/email cannot be changed/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('yasmeen@aurelia.pk')).toBeDisabled()
  })

  it('renders an empty email field when the grid did not supply one', () => {
    renderWithProviders(<EditWrapper />)
    expect(screen.getByText(/email cannot be changed/i)).toBeInTheDocument()
  })

  it('keeps Status editable for an ordinary user', () => {
    renderWithProviders(<EditWrapper />)
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('locks only Status for the primary user, leaving the name editable (BR-03)', () => {
    renderWithProviders(<EditWrapper statusDisabled />)
    // AntD portals the Modal to document.body, so query the document.
    const inputs = Array.from(document.querySelectorAll('.ant-modal input'))
    // The name input stays enabled — renaming the primary is allowed.
    expect(inputs.some((input) => !input.hasAttribute('disabled'))).toBe(true)
    expect(document.querySelector('.ant-select-disabled')).toBeInTheDocument()
  })

  it('saves changes', async () => {
    const onSave = vi.fn()
    renderWithProviders(<EditWrapper onSave={onSave} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /save changes/i }))
    expect(onSave).toHaveBeenCalled()
  })
})

describe('ResetPasswordModal', () => {
  it('hidden when no target', () => {
    renderWithProviders(
      <ResetPasswordModal target={null} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByText(/set new password/i)).not.toBeInTheDocument()
  })

  it('names the user whose password is being set', () => {
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('Yasmeen Iqbal')).toBeInTheDocument()
  })

  /** The values are the whole point — the old modal discarded them. */
  it('hands the entered password to the caller', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    const ue = userEvent.setup()
    const inputs = screen.getAllByPlaceholderText(/password/i)
    await ue.type(inputs[0], 'Aurelia2026!')
    await ue.type(inputs[1], 'Aurelia2026!')
    await ue.click(screen.getByRole('button', { name: /set password/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      newPassword: 'Aurelia2026!',
      confirmPassword: 'Aurelia2026!',
    })
  })

  it('blocks a password that misses the policy (BR-08)', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    const ue = userEvent.setup()
    const inputs = screen.getAllByPlaceholderText(/password/i)
    // Scores 3 of 4 on the strength meter yet is under the length minimum.
    await ue.type(inputs[0], 'Ab1!')
    await ue.type(inputs[1], 'Ab1!')
    await ue.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('blocks a mismatched confirmation', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    const ue = userEvent.setup()
    const inputs = screen.getAllByPlaceholderText(/password/i)
    await ue.type(inputs[0], 'Aurelia2026!')
    await ue.type(inputs[1], 'Different2026!')
    await ue.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancel does not invoke confirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={onConfirm} onCancel={onCancel} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
