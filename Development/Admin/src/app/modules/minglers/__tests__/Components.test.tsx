import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Storefront } from '@phosphor-icons/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MinglerStatusBadge } from '../components/MinglerStatusBadge'
import { BookingStatusBadge } from '../components/BookingStatusBadge'
import { ActionIcon } from '../components/MinglerActionIcon'
import { OverviewField } from '../components/OverviewField'
import { SuspendModal } from '../components/SuspendModal'
import { UnsuspendModal } from '../components/UnsuspendModal'

describe('MinglerStatusBadge', () => {
  it.each(['ACTIVE', 'SUSPENDED', 'PENDING', 'UNKNOWN'])('renders %s', (s) => {
    render(<MinglerStatusBadge status={s} />)
    expect(screen.getByText(new RegExp(s, 'i'))).toBeInTheDocument()
  })
})

describe('BookingStatusBadge', () => {
  it.each(['completed', 'cancelled', 'no-show', 'unknown'])('renders %s', (s) => {
    render(<BookingStatusBadge status={s} />)
  })
})

describe('ActionIcon (mingler)', () => {
  it('handles hover, leave, click', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <ActionIcon hoverBg="red" hoverColor="blue" onClick={onClick}>
        x
      </ActionIcon>,
    )
    const div = container.querySelector('div')!
    const user = userEvent.setup()
    await user.hover(div)
    await user.unhover(div)
    await user.click(div)
    expect(onClick).toHaveBeenCalled()
  })
})

describe('OverviewField (mingler)', () => {
  it('renders', () => {
    render(
      <OverviewField IconComp={Storefront} label="L">
        <span>V</span>
      </OverviewField>,
    )
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument()
  })
})

describe('SuspendModal', () => {
  it('disabled until reason >= 10 chars', () => {
    renderWithProviders(
      <SuspendModal
        open
        minglerName="X"
        suspendReason="short"
        onSuspendReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /suspend/i.test(b.textContent ?? ''))
    expect(confirm).toBeDisabled()
  })

  it('confirm when valid; cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <SuspendModal
        open
        minglerName="X"
        suspendReason="long enough reason here"
        onSuspendReasonChange={() => {}}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /suspend/i.test(b.textContent ?? ''))!
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('typing updates reason', async () => {
    const setReason = vi.fn()
    renderWithProviders(
      <SuspendModal
        open
        minglerName="X"
        suspendReason=""
        onSuspendReasonChange={setReason}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const textareas = document.querySelectorAll('textarea')
    await userEvent.setup().type(textareas[0] as HTMLTextAreaElement, 'a')
    expect(setReason).toHaveBeenCalled()
  })
})

describe('UnsuspendModal', () => {
  it('renders and triggers confirm/cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <UnsuspendModal open minglerName="X" onCancel={onCancel} onConfirm={onConfirm} />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    const buttons = screen.getAllByRole('button')
    const confirm = buttons[buttons.length - 1]
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })
})
