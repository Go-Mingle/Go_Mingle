import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { ImportContactsDialog } from '../components/ImportContactsDialog'
import { partnerProfileService } from '../services'

vi.mock('../services', () => ({ partnerProfileService: { createContact: vi.fn().mockResolvedValue({}) } }))

describe('ImportContactsDialog', () => {
  it('checks rows like the contact form and sends phones in E.164', async () => {
    renderWithProviders(<ImportContactsDialog open onClose={vi.fn()} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await userEvent.upload(input, new File(['Name,Title,Email,Phone\nBilal Ahmed,Head chef,bilal@r.pk,+92 300 1234567\n,Manager,,\nBilal Ahmed,Head chef,bilal@r.pk,+92 300 1234567'], 'c.csv', { type: 'text/csv' }))

    expect(await screen.findByText('Repeated in this file')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /import 1 row/i }))
    expect(await screen.findByTestId('import-done')).toBeInTheDocument()
    expect(partnerProfileService.createContact).toHaveBeenCalledWith({
      name: 'Bilal Ahmed',
      title: 'Head chef',
      email: 'bilal@r.pk',
      phone: '+923001234567',
    })
  })
})
