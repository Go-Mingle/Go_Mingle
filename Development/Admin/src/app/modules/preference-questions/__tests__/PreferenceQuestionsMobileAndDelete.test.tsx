import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { PreferenceQuestionsPage } from '../PreferenceQuestionsPage'

function setMobile() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('PreferenceQuestionsPage — desktop delete flow', () => {
  it('opens the delete confirmation modal, then cancels it', async () => {
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = rows[0].querySelectorAll('td:last-child > div > div')
    const user = userEvent.setup()
    await user.click(actionDivs[1] as Element)

    await waitFor(() => expect(screen.getByText('Delete question?')).toBeInTheDocument())
    expect(screen.getAllByText(/How often do you eat out\?/).length).toBeGreaterThan(0)

    const dialog = screen.getByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // antd's CSSMotion "leave" transition never resolves under jsdom, so the
    // dialog is never actually unmounted here even though cancel fired correctly.
    await waitFor(() => expect(dialog.className).toMatch(/ant-zoom-leave/))
  })

  it('confirms delete and shows the deleted toast', async () => {
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('When do you usually dine?')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const targetRow = Array.from(rows).find((r) =>
      r.textContent?.includes('When do you usually dine?'),
    ) as Element
    const actionDivs = targetRow.querySelectorAll('td:last-child > div > div')
    const user = userEvent.setup()
    await user.click(actionDivs[1] as Element)

    await waitFor(() => expect(screen.getByText('Delete question?')).toBeInTheDocument())
    const delBtn = screen.getByRole('button', { name: 'Delete question' })
    await user.click(delBtn)

    expect(await screen.findByText(/has been deleted\./)).toBeInTheDocument()
  })
})

describe('PreferenceQuestionsPage — mobile card view', () => {
  it('renders the mobile card list', async () => {
    setMobile()
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    expect(document.querySelector('.preference-questions-card-list')).not.toBeNull()
    expect(screen.getByText('What are your favourite cuisines?')).toBeInTheDocument()
  })

  it('opens the edit modal from a mobile card Edit button', async () => {
    setMobile()
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    const editBtns = document.querySelectorAll('.preference-questions-card-list button')
    const editBtn = Array.from(editBtns).find((b) =>
      /edit/i.test((b.textContent ?? '').trim()),
    ) as HTMLElement
    fireEvent.click(editBtn)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
    )
  })

  it('opens the delete confirmation modal from a mobile card Delete button', async () => {
    setMobile()
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    const deleteBtns = document.querySelectorAll('.preference-questions-card-list button')
    const deleteBtn = Array.from(deleteBtns).find((b) =>
      /delete/i.test((b.textContent ?? '').trim()),
    ) as HTMLElement
    fireEvent.click(deleteBtn)

    await waitFor(() => expect(screen.getByText('Delete question?')).toBeInTheDocument())
  })
})
