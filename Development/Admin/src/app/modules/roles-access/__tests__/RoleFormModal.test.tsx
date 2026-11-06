import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { Form } from 'antd'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RoleFormModal } from '../RoleFormModal'
import type { Role } from '../types'

function Wrapper({
  editing = null,
  fullAccess = false,
  setFullAccess = () => {},
  onFinish = () => {},
  onCancel = () => {},
  initial,
}: {
  editing?: Role | null
  fullAccess?: boolean
  setFullAccess?: (v: boolean) => void
  onFinish?: (v: Role) => void
  onCancel?: () => void
  initial?: Record<string, unknown>
}) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (initial) form.setFieldsValue(initial)
  }, [form, initial])
  return (
    <RoleFormModal
      open
      editing={editing}
      fullAccess={fullAccess}
      setFullAccess={setFullAccess}
      form={form}
      onFinish={onFinish}
      onCancel={onCancel}
    />
  )
}

describe('RoleFormModal', () => {
  it('renders new role variant', () => {
    renderWithProviders(<Wrapper />)
    expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
  })

  it('renders edit variant with disabled save when empty', () => {
    renderWithProviders(
      <Wrapper
        editing={{ id: '1', name: '', fullAccess: false, permissions: [], usersAssigned: 0 }}
      />,
    )
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    expect(saveBtn).toBeDisabled()
  })

  it('triggers cancel', async () => {
    const onCancel = vi.fn()
    renderWithProviders(<Wrapper onCancel={onCancel} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('toggles full access checkbox', async () => {
    const setFullAccess = vi.fn()
    renderWithProviders(<Wrapper setFullAccess={setFullAccess} />)
    const cbs = screen.getAllByRole('checkbox')
    await userEvent.setup().click(cbs[0])
    expect(setFullAccess).toHaveBeenCalledWith(true)
  })

  it('toggles a module by clicking row', async () => {
    renderWithProviders(<Wrapper initial={{ name: 'X', permissions: [] }} />)
    const user = userEvent.setup()
    // Labels come from the permission-keys API (mocked), so wait for them.
    const card = (await screen.findByText('Approvals Queue')).closest('div')!
    const checkbox = card.querySelector('input[type="checkbox"]')!
    expect(checkbox).not.toBeChecked()
    await user.click(card)
    expect(checkbox).toBeChecked()
  })

  it('save enabled when valid; clicking submits', async () => {
    const onFinish = vi.fn()
    renderWithProviders(
      <Wrapper
        onFinish={onFinish}
        initial={{ name: 'Admin', permissions: ['MANAGE_MINGLERS', 'RESTAURANT_APPROVALS'] }}
      />,
    )
    const saveBtn = screen.getByRole('button', { name: /create role/i })
    const user = userEvent.setup()
    await user.hover(saveBtn)
    await user.unhover(saveBtn)
    await user.click(saveBtn)
    expect(onFinish).toHaveBeenCalled()
  })

  it('save with fullAccess enabled', async () => {
    const onFinish = vi.fn()
    renderWithProviders(
      <Wrapper fullAccess onFinish={onFinish} initial={{ name: 'Admin', permissions: [] }} />,
    )
    const saveBtn = screen.getByRole('button', { name: /create role/i })
    await userEvent.setup().click(saveBtn)
    expect(onFinish).toHaveBeenCalled()
  })

  it('fullAccess ticks every module but keeps the checkboxes editable', async () => {
    const setFullAccess = vi.fn()
    renderWithProviders(
      <Wrapper fullAccess setFullAccess={setFullAccess} initial={{ name: 'X', permissions: [] }} />,
    )
    const card = (await screen.findByText('Manage Minglers')).closest('div')!
    const checkbox = card.querySelector('input[type="checkbox"]')!
    // Full access populates every module as selected — but enabled, not disabled.
    // The tick is driven by an effect + Form.useWatch, so it lands a render after
    // the cards mount; await it rather than asserting synchronously.
    await waitFor(() => expect(checkbox).toBeChecked())
    expect(checkbox).not.toBeDisabled()
    // Unticking one module clears full access and unchecks that module.
    await userEvent.setup().click(card)
    expect(setFullAccess).toHaveBeenCalledWith(false)
    expect(checkbox).not.toBeChecked()
  })

  it('toggle module via inner checkbox (stopPropagation)', async () => {
    renderWithProviders(<Wrapper initial={{ name: 'X', permissions: [] }} />)
    // Wait for the permission catalogue so module checkboxes are rendered.
    await screen.findByText('Manage Minglers')
    const cbs = screen.getAllByRole('checkbox')
    // First checkbox is fullAccess; subsequent ones are permissions.
    await userEvent.setup().click(cbs[1])
    expect(cbs[1]).toBeChecked()
  })

  it('removes an already-selected module', async () => {
    renderWithProviders(<Wrapper initial={{ name: 'X', permissions: ['MANAGE_MINGLERS'] }} />)
    const card = (await screen.findByText('Manage Minglers')).closest('div')!
    const checkbox = card.querySelector('input[type="checkbox"]')!
    expect(checkbox).toBeChecked()
    await userEvent.setup().click(card)
    expect(checkbox).not.toBeChecked()
  })

  it('shows an error state when the permission catalogue fails to load', async () => {
    server.use(
      http.get('/api/v1/roles/permission-keys', () => HttpResponse.json({}, { status: 500 })),
    )
    renderWithProviders(<Wrapper initial={{ name: 'X', permissions: [] }} />)
    expect(await screen.findByText(/failed to load data/i)).toBeInTheDocument()
  })
})
