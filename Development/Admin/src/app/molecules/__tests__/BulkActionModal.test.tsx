import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook, act } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { BulkActionModal } from '../BulkActionModal'
import { BulkActionBar } from '../BulkActionBar'
import { useRowSelection } from '../../hooks/useRowSelection'

const items = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, name: `Restaurant ${i}` }))

describe('BulkActionModal', () => {
  it('names the count, previews five rows and waits for a long enough reason', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <BulkActionModal
        open
        title="Suspend 7 restaurants?"
        description="They disappear from the app."
        confirmLabel="Suspend 7"
        items={items}
        danger
        reason={{ label: 'Reason', min: 10 }}
        task={vi.fn()}
        onClose={vi.fn()}
        onFinished={vi.fn()}
      />,
    )
    expect(screen.getByText('Suspend 7 restaurants?')).toBeInTheDocument()
    expect(screen.getByText('Restaurant 4')).toBeInTheDocument()
    expect(screen.queryByText('Restaurant 5')).not.toBeInTheDocument()
    expect(screen.getByText('and 2 more')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Suspend 7' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox'), 'Too short')
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox'), ' still')
    expect(confirm).toBeEnabled()
  })

  it('runs each item, then lists the ones that failed with the reason', async () => {
    const user = userEvent.setup()
    const onFinished = vi.fn()
    const task = vi.fn(async (item: { id: string }) => {
      if (item.id === 'r2') throw new Error('Has upcoming bookings.')
    })
    renderWithProviders(
      <BulkActionModal
        open
        title="Reactivate?"
        description="Back on the app."
        confirmLabel="Reactivate 7"
        items={items}
        task={task}
        onClose={vi.fn()}
        onFinished={onFinished}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Reactivate 7' }))
    expect(await screen.findByTestId('bulk-result')).toBeInTheDocument()
    expect(task).toHaveBeenCalledTimes(7)
    expect(screen.getByText('6 updated.')).toBeInTheDocument()
    expect(screen.getByText('1 could not be changed:')).toBeInTheDocument()
    expect(screen.getByText('Restaurant 2')).toBeInTheDocument()
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(expect.not.arrayContaining(['r2'])))
    expect(onFinished.mock.calls[0][0]).toHaveLength(6)
  })
})

describe('BulkActionBar', () => {
  it('is hidden with nothing selected', () => {
    renderWithProviders(<BulkActionBar count={0} actions={[]} onClear={vi.fn()} />)
    expect(screen.queryByTestId('bulk-bar')).not.toBeInTheDocument()
  })
  it('shows the count and clears', async () => {
    const onClear = vi.fn()
    renderWithProviders(
      <BulkActionBar
        count={3}
        actions={[{ key: 'x', label: 'Do it', onClick: vi.fn() }]}
        onClear={onClear}
      />,
    )
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('useRowSelection', () => {
  const rows = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ]
  it('starts empty again when the list query changes', () => {
    const { result, rerender } = renderHook(({ scope }) => useRowSelection(rows, scope), {
      initialProps: { scope: { page: 1 } },
    })
    act(() => result.current.rowSelection.onChange?.(['a'], [rows[0]], { type: 'single' }))
    expect(result.current.selected.map((r) => r.id)).toEqual(['a'])
    rerender({ scope: { page: 2 } })
    expect(result.current.selected).toEqual([])
  })
  it('drops rows a bulk action changed', () => {
    const { result } = renderHook(() => useRowSelection(rows, null))
    act(() => result.current.rowSelection.onChange?.(['a', 'b'], rows, { type: 'all' }))
    act(() => result.current.remove(['a']))
    expect(result.current.selected.map((r) => r.id)).toEqual(['b'])
  })
})
