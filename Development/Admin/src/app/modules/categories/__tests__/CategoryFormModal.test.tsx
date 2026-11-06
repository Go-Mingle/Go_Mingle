import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { CategoryFormModal } from '../CategoryFormModal'
import type { Category, CategoryFormValues } from '../types'

function Wrapper({
  editing = null,
  onClose = () => {},
  onFinish = () => {},
}: {
  editing?: Category | null
  onClose?: () => void
  onFinish?: (v: CategoryFormValues) => void
}) {
  const [form] = Form.useForm()
  return (
    <CategoryFormModal open editing={editing} form={form} onClose={onClose} onFinish={onFinish} />
  )
}

describe('CategoryFormModal', () => {
  it('renders create variant', () => {
    renderWithProviders(<Wrapper />)
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('renders edit variant', () => {
    renderWithProviders(
      <Wrapper
        editing={{
          id: '1',
          name: 'X',
          commissionRate: 5,
          interestTablesPerMonth: 10,
          restaurantsCount: 0,
          createdAt: '',
        }}
      />,
    )
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('triggers onClose via cancel', async () => {
    const onClose = vi.fn()
    renderWithProviders(<Wrapper onClose={onClose} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('submits form when fields valid', async () => {
    const onFinish = vi.fn()
    renderWithProviders(<Wrapper onFinish={onFinish} />)
    const user = userEvent.setup()
    const inputs = document.querySelectorAll('.ant-modal input')
    // Fill all required fields: name, commissionRate
    await user.type(inputs[0] as HTMLInputElement, 'Premium')
    await user.type(inputs[1] as HTMLInputElement, '5')
    await user.click(screen.getByRole('button', { name: /create/i }))
    expect(onFinish).toHaveBeenCalledWith({ name: 'Premium', commissionRate: 5 })
  })
})
