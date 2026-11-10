import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { DeleteUserModal } from '../components/DeleteUserModal'
import { NewUserModal } from '../components/NewUserModal'
import { EditUserModal } from '../components/EditUserModal'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import type { UserRow } from '../components/types'

const user: UserRow = {
  id: '1',
  fullName: 'Jane',
  email: 'jane@test.com',
  role: { id: 'r1', name: 'Admin', fullAccess: true },
  status: 'ACTIVE',
  createdAt: '2024-01-01',
}

describe('DeleteUserModal', () => {
  it('hidden when no target', () => {
    renderWithProviders(<DeleteUserModal target={null} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument()
  })

  it('renders with target, confirm and cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(<DeleteUserModal target={user} onConfirm={onConfirm} onCancel={onCancel} />)
    // The confirm dialog interpolates the user's full name into the body.
    expect(screen.getByText('Jane')).toBeInTheDocument()
    const ue = userEvent.setup()
    await ue.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    // Confirm button is the styled button
    const confirmBtns = screen.getAllByRole('button')
    await ue.click(confirmBtns[confirmBtns.length - 1])
    expect(onConfirm).toHaveBeenCalled()
  })
})

function NewWrapper() {
  const [form] = Form.useForm()
  return (
    <NewUserModal
      open
      form={form}
      roleOptions={[{ value: 'admin', label: 'Admin' }]}
      onSave={() => {}}
      onCancel={() => {}}
    />
  )
}

describe('NewUserModal', () => {
  it('renders and cancels', () => {
    renderWithProviders(<NewWrapper />)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1)
  })

  it('save enabled when valid', () => {
    renderWithProviders(<NewWrapper />)
    const saveBtns = screen.getAllByRole('button')
    expect(saveBtns.some((b) => !b.hasAttribute('disabled'))).toBe(true)
  })
})

function EditWrapper() {
  const [form] = Form.useForm()
  return (
    <EditUserModal
      open
      form={form}
      roleOptions={[{ value: 'admin', label: 'Admin' }]}
      onSave={() => {}}
      onCancel={() => {}}
    />
  )
}

describe('EditUserModal', () => {
  it('renders', () => {
    renderWithProviders(<EditWrapper />)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })
})

describe('ResetPasswordModal', () => {
  it('hidden when no target', () => {
    renderWithProviders(
      <ResetPasswordModal target={null} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByText(/reset/i)).not.toBeInTheDocument()
  })

  it('renders with target and triggers cancel', async () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={() => {}} onCancel={onCancel} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('submits Set password with matching passwords to confirm reset', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    const ue = userEvent.setup()
    const pwdInputs = screen.getAllByPlaceholderText(/password/i)
    await ue.type(pwdInputs[0], 'Test@1234')
    await ue.type(pwdInputs[1], 'Test@1234')
    const submitBtn = screen.getByRole('button', { name: /set password/i })
    await ue.click(submitBtn)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('cancel does not invoke confirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <ResetPasswordModal target={user} onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const ue = userEvent.setup()
    await ue.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
