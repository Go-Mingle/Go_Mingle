import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Storefront } from '@phosphor-icons/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { TabEmptyState } from '../TabEmptyState'

describe('TabEmptyState', () => {
  it('renders the icon and title, omitting description and action by default', () => {
    const { container } = renderWithProviders(
      <TabEmptyState IconComp={Storefront} title="No items yet" />,
    )

    const heading = screen.getByRole('heading', { name: 'No items yet' })
    expect(heading).toBeInTheDocument()

    // Phosphor icon renders an svg inside the tinted circle.
    expect(container.querySelector('svg')).toBeInTheDocument()

    // No description paragraph and no action wrapper when both are omitted.
    expect(container.querySelector('p')).not.toBeInTheDocument()
    expect(container.querySelector('.mt-5')).not.toBeInTheDocument()
  })

  it('renders the description paragraph when a description is provided', () => {
    renderWithProviders(
      <TabEmptyState
        IconComp={Storefront}
        title="No items yet"
        description="Add your first item to get started."
      />,
    )

    expect(screen.getByText('Add your first item to get started.')).toBeInTheDocument()
  })

  it('renders the action node when an action is provided', () => {
    const { container } = renderWithProviders(
      <TabEmptyState
        IconComp={Storefront}
        title="No items yet"
        action={<button type="button">Add item</button>}
      />,
    )

    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
    // Action is wrapped in the spacing container.
    expect(container.querySelector('.mt-5')).toBeInTheDocument()
  })

  it('uses the roomy vertical padding by default (non-compact)', () => {
    const { container } = renderWithProviders(
      <TabEmptyState IconComp={Storefront} title="No items yet" />,
    )

    const root = container.firstElementChild
    expect(root).toHaveClass('py-16')
    expect(root).not.toHaveClass('py-8')
  })

  it('uses the tighter vertical padding when compact', () => {
    const { container } = renderWithProviders(
      <TabEmptyState IconComp={Storefront} title="No items yet" compact />,
    )

    const root = container.firstElementChild
    expect(root).toHaveClass('py-8')
    expect(root).not.toHaveClass('py-16')
  })

  it('renders description and action together', () => {
    renderWithProviders(
      <TabEmptyState
        IconComp={Storefront}
        title="Nothing here"
        description="A friendly prompt."
        action={<button type="button">Upload</button>}
        compact
      />,
    )

    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
    expect(screen.getByText('A friendly prompt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })
})
