import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ImportDialog } from '../ImportDialog'

type Col = 'name' | 'email'

function setup(importRow = vi.fn().mockResolvedValue(undefined)) {
  const onImported = vi.fn()
  renderWithProviders(
    <ImportDialog<Col>
      open
      onClose={vi.fn()}
      onImported={onImported}
      title="Import people"
      intro="Pick a file"
      templateFileName="t.csv"
      columns={[
        { key: 'name', label: 'Name', headers: ['name'], required: true, example: 'A' },
        { key: 'email', label: 'Email', headers: ['email'], required: true, example: 'a@b.pk' },
      ]}
      validate={(r, seen) => {
        if (!r.name) return 'Name is missing'
        if (seen.has(r.email)) return 'Repeated'
        seen.add(r.email)
        return null
      }}
      importRow={importRow}
      errorMessage={(e) => (e as Error).message}
    />,
  )
  return { onImported, importRow }
}

const upload = async (text: string, name = 'people.csv') => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  await userEvent.upload(input, new File([text], name, { type: 'text/csv' }))
}

describe('ImportDialog', () => {
  it('previews rows, skips problems and imports the rest', async () => {
    const failing = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Already registered'))
    const { onImported } = setup(failing)
    await upload('Name,Email\nAli,a@b.pk\n,x@b.pk\nSara,s@b.pk\nSara,s@b.pk')

    expect(await screen.findByTestId('import-preview')).toBeInTheDocument()
    expect(screen.getByText('Name is missing')).toBeInTheDocument()
    expect(screen.getByText('Repeated')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /import 2 rows/i }))
    expect(await screen.findByTestId('import-done')).toBeInTheDocument()
    expect(failing).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Imported 1\. Failed 1\. Skipped 2\./)).toBeInTheDocument()
    expect(screen.getByText(/Row 4: Already registered/)).toBeInTheDocument()
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(1))
  })

  it('names missing required columns', async () => {
    setup()
    await upload('Name\nAli')
    expect(await screen.findByText(/has no Email column/)).toBeInTheDocument()
  })

  it('refuses other file types', async () => {
    setup()
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await userEvent.upload(input, new File(['x'], 'people.txt', { type: 'text/plain' }), {
      applyAccept: false,
    })
    expect(await screen.findByText(/Choose an \.xlsx or \.csv file/)).toBeInTheDocument()
  })
})
