import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { AppDetailApproveModal } from '../components/AppDetailApproveModal'
import { AppDetailDeclineModal } from '../components/AppDetailDeclineModal'

describe('AppDetailApproveModal', () => {
  const opts = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ]
  it('disabled until category selected', () => {
    renderWithProviders(
      <AppDetailApproveModal
        open
        applicationName="TestRest"
        selectedCategory={null}
        categoryOptions={opts}
        onCategoryChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /approve application/i.test(b.textContent ?? ''))
    expect(confirm).toBeDisabled()
  })

  it('enables and confirms when category selected; hover/leave', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <AppDetailApproveModal
        open
        applicationName="TestRest"
        selectedCategory="a"
        categoryOptions={opts}
        onCategoryChange={() => {}}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /approve application/i.test(b.textContent ?? ''))!
    const user = userEvent.setup()
    await user.hover(confirm)
    await user.unhover(confirm)
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCategoryChange when a category is selected', async () => {
    const onCategoryChange = vi.fn()
    renderWithProviders(
      <AppDetailApproveModal
        open
        applicationName="TestRest"
        selectedCategory={null}
        categoryOptions={opts}
        onCategoryChange={onCategoryChange}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('B'))
    expect(onCategoryChange).toHaveBeenCalledWith('b')
  })

  it('triggers cancel', async () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <AppDetailApproveModal
        open
        applicationName="TestRest"
        selectedCategory={null}
        categoryOptions={opts}
        onCategoryChange={() => {}}
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows the no-categories guard and keeps confirm disabled', () => {
    renderWithProviders(
      <AppDetailApproveModal
        open
        applicationName="TestRest"
        selectedCategory={null}
        categoryOptions={[]}
        onCategoryChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText(/no active categories exist/i)).toBeInTheDocument()
    const confirm = screen
      .getAllByRole('button')
      .find((b) => /approve application/i.test(b.textContent ?? ''))
    expect(confirm).toBeDisabled()
  })

  it('disables confirm while a mutation is loading', () => {
    renderWithProviders(
      <AppDetailApproveModal
        open
        applicationName="TestRest"
        selectedCategory="a"
        categoryOptions={opts}
        loading
        onCategoryChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const confirm = screen
      .getAllByRole('button')
      .find((b) => /approve application/i.test(b.textContent ?? ''))
    expect(confirm).toBeDisabled()
  })
})

describe('AppDetailDeclineModal', () => {
  it('disabled until reason >= 10 chars and shows error', async () => {
    const setReason = vi.fn()
    renderWithProviders(
      <AppDetailDeclineModal
        open
        applicationName="TestRest"
        declineReason="short"
        onReasonChange={setReason}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const submit = buttons.find((b) => /decline application/i.test(b.textContent ?? ''))
    expect(submit).toBeDisabled()
    const user = userEvent.setup()
    const textarea = screen.getByPlaceholderText(/explain why/i)
    await user.type(textarea, 'a')
    expect(setReason).toHaveBeenCalled()
  })

  it('enables when valid and triggers confirm + hover', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <AppDetailDeclineModal
        open
        applicationName="TestRest"
        declineReason="long enough reason here"
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const submit = buttons.find((b) => /decline application/i.test(b.textContent ?? ''))!
    const user = userEvent.setup()
    await user.hover(submit)
    await user.unhover(submit)
    await user.click(submit)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('renders empty reason fallback', () => {
    renderWithProviders(
      <AppDetailDeclineModal
        open
        applicationName="TestRest"
        declineReason=""
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
  })

  it('triggers cancel', async () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <AppDetailDeclineModal
        open
        applicationName="TestRest"
        declineReason=""
        onReasonChange={() => {}}
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
