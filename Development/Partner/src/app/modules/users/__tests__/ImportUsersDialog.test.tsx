import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ImportUsersDialog } from '../components/ImportUsersDialog'
import { partnerUsersService } from '../services'

vi.mock('../services', () => ({ partnerUsersService: { create: vi.fn() } }))
const create = vi.mocked(partnerUsersService.create)

const upload = async (text: string) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  await userEvent.upload(input, new File([text], 'team.csv', { type: 'text/csv' }))
}

describe('ImportUsersDialog', () => {
  beforeEach(() => create.mockReset().mockResolvedValue({} as never))

  it('needs a valid shared password, then creates each ready row', async () => {
    const onImported = vi.fn()
    renderWithProviders(<ImportUsersDialog open onClose={vi.fn()} onImported={onImported} />)
    await upload(
      'Full name,Email,Designation,Status\nAyesha,ayesha@r.pk,Floor manager,Suspended\nBilal,not-an-email,,\nSara,sara@r.pk,,maybe',
    )

    expect(await screen.findByText('Email looks wrong')).toBeInTheDocument()
    expect(screen.getByText('Status must be Active or Suspended')).toBeInTheDocument()
    const go = screen.getByRole('button', { name: /import 1 row/i })
    expect(go).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Temporary password'), 'short')
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Temporary password'))
    await userEvent.type(screen.getByLabelText('Temporary password'), 'Tonight#2026')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Tonight#2026')
    await userEvent.click(go)

    expect(await screen.findByTestId('import-done')).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      fullName: 'Ayesha',
      email: 'ayesha@r.pk',
      designation: 'Floor manager',
      status: 'SUSPENDED',
      password: 'Tonight#2026',
      confirmPassword: 'Tonight#2026',
    })
    expect(onImported).toHaveBeenCalledWith(1)
  })
})
