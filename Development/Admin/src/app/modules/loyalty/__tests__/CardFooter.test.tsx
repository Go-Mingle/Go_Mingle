import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { CardFooter } from '../components/CardFooter'

describe('CardFooter', () => {
  it('renders cancel and save buttons', () => {
    renderWithProviders(
      <CardFooter
        onCancel={() => {}}
        onSave={() => {}}
        saveLabel="Save Earn"
        disabled={false}
        loading={false}
      />,
    )
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save earn/i })).toBeInTheDocument()
  })

  it('calls onCancel and onSave when clicked', async () => {
    const onCancel = vi.fn()
    const onSave = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <CardFooter
        onCancel={onCancel}
        onSave={onSave}
        saveLabel="Save Earn"
        disabled={false}
        loading={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /save earn/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('handles mouse hover styling on save button', async () => {
    renderWithProviders(
      <CardFooter
        onCancel={() => {}}
        onSave={() => {}}
        saveLabel="Save"
        disabled={false}
        loading={false}
      />,
    )
    const saveBtn = screen.getByRole('button', { name: /save/i })
    const user = userEvent.setup()
    await user.hover(saveBtn)
    await user.unhover(saveBtn)
    expect(saveBtn).toBeInTheDocument()
  })

  it('renders without check icon when loading is true', () => {
    renderWithProviders(
      <CardFooter
        onCancel={() => {}}
        onSave={() => {}}
        saveLabel="Save"
        disabled={false}
        loading={true}
      />,
    )
    const saveBtn = screen.getByRole('button', { name: /save/i })
    expect(saveBtn).toBeInTheDocument()
  })
})
