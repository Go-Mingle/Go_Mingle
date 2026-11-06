import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { WebhookCard } from '../WebhookCard'

describe('WebhookCard', () => {
  it('renders the title heading', () => {
    renderWithProviders(<WebhookCard title="Delivery status" />)
    expect(screen.getByRole('heading', { name: 'Delivery status' })).toBeInTheDocument()
  })

  it('omits the sub, tooltip, right slot and children when not provided', () => {
    const { container } = renderWithProviders(<WebhookCard title="Bare card" />)
    expect(screen.getByRole('heading', { name: 'Bare card' })).toBeInTheDocument()
    // No info icon, no paragraph sub-text.
    expect(container.querySelector('p')).toBeNull()
    // Only the header row exists (no extra right/children wrappers with mt-4/shrink-0 content).
    expect(container.querySelector('.mt-4')).toBeNull()
  })

  it('renders the sub text when provided', () => {
    renderWithProviders(<WebhookCard title="With sub" sub="Some helpful description." />)
    expect(screen.getByText('Some helpful description.')).toBeInTheDocument()
  })

  it('shows the info tooltip on hover when titleInfo is provided', async () => {
    renderWithProviders(<WebhookCard title="With info" titleInfo="Extra actionable detail" />)
    const icon = document.querySelector('svg')
    expect(icon).not.toBeNull()
    await userEvent.hover(icon as Element)
    expect(await screen.findByText('Extra actionable detail')).toBeInTheDocument()
  })

  it('renders the right slot content', () => {
    renderWithProviders(
      <WebhookCard title="With right" right={<button type="button">Toggle</button>} />,
    )
    expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument()
  })

  it('renders children content', () => {
    renderWithProviders(
      <WebhookCard title="With children">
        <p>Body content</p>
      </WebhookCard>,
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('renders all optional slots together', () => {
    const { container } = renderWithProviders(
      <WebhookCard
        title="Everything"
        sub="A subtitle"
        titleInfo="tip"
        right={<span>right-slot</span>}
      >
        <div>child-slot</div>
      </WebhookCard>,
    )
    const heading = screen.getByRole('heading', { name: 'Everything' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText('A subtitle')).toBeInTheDocument()
    expect(screen.getByText('right-slot')).toBeInTheDocument()
    expect(screen.getByText('child-slot')).toBeInTheDocument()
    // Info icon is present alongside the title.
    expect((heading.parentElement as HTMLElement).querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.mt-4')).not.toBeNull()
  })
})
