import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { DocumentsTab } from '../components/DocumentsTab'
import type { useDocumentsTab } from '../hooks/useDocumentsTab'
import type { DocumentItem } from '../types'

type Documents = ReturnType<typeof useDocumentsTab>

const DOCUMENTS: DocumentItem[] = [
  {
    mediaId: 'doc-1',
    name: 'Trade Licence 2026.pdf',
    type: 'PDF',
    size: 1258291,
    uploadedAt: '2026-05-01T09:12:00Z',
  },
  // Predates J6B, so neither size nor date was recorded.
  { mediaId: 'doc-2', name: 'Floor plan.png', type: 'PNG', size: null, uploadedAt: null },
]

/** A plain stand-in, so each state can be rendered directly. */
function controller(overrides: Partial<Documents> = {}): Documents {
  return {
    documents: DOCUMENTS,
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    sortBy: 'name',
    sortOrder: 'asc',
    applySort: vi.fn(),
    search: '',
    applySearch: vi.fn(),
    editable: true,
    pendingFile: null,
    stageFile: vi.fn(() => false),
    cancelUpload: vi.fn(),
    submitUpload: vi.fn(),
    uploading: false,
    progress: 0,
    download: vi.fn(),
    downloading: false,
    deleteTarget: null,
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    deleting: false,
    ...overrides,
  } as Documents
}

function renderTab(overrides: Partial<Documents> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<DocumentsTab c={c} />) }
}

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement

describe('DocumentsTab — states', () => {
  it('spins while loading', () => {
    const { container } = renderTab({ isPending: true })
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message on failure', () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Documents unavailable.' } }
    renderTab({ isError: true, error })
    expect(screen.getByText('Documents unavailable.')).toBeInTheDocument()
  })

  it('shows the empty-state copy with no documents', () => {
    renderTab({ documents: [] })
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument()
  })
})

describe('DocumentsTab — the row', () => {
  it('renders name, type and size', () => {
    renderTab()
    const row = rowFor('Trade Licence 2026.pdf')

    expect(within(row).getByText('PDF')).toBeInTheDocument()
    expect(within(row).getByText('1.2 MB')).toBeInTheDocument()
  })

  /**
   * The upload date is deliberately absent: J6B BR-04 leaves showing it to the
   * client, and the design's table is Document / Type / Size only.
   */
  it('shows no upload date column', () => {
    renderTab()

    expect(screen.queryByRole('columnheader', { name: /uploaded/i })).not.toBeInTheDocument()
    // 09:12 UTC would have rendered as 13:12 in Asia/Karachi.
    expect(screen.queryByText('01-05-2026 13:12')).not.toBeInTheDocument()
  })

  /** Icon by extension, so the list can be scanned by file kind at a glance. */
  it('gives each file kind its own icon', () => {
    const kinds = ['PDF', 'DOCX', 'PNG', 'ZIP']
    renderTab({
      documents: kinds.map((type, i) => ({
        mediaId: `k-${i}`,
        name: `file-${type}`,
        type,
        size: 1024,
        uploadedAt: null,
      })),
    })

    // The leading svg in each row is the type icon; ZIP falls through to generic.
    const icons = kinds.map((type) => rowFor(`file-${type}`).querySelector('svg')?.innerHTML)
    expect(new Set(icons).size).toBe(kinds.length)
  })

  /** Media predating J6B carries no size — a dash, never a fabricated value. */
  it('renders a dash for a missing size', () => {
    renderTab()
    const row = rowFor('Floor plan.png')
    expect(within(row).getAllByText('—')).toHaveLength(1)
  })
})

describe('DocumentsTab — sorting', () => {
  /**
   * By accessible name, never by `querySelector('svg')` — MET-1257 was filed as
   * "no column offers a sort control" while all three sorted correctly, because
   * the control was an unnamed button around a bare <svg>. A test that only
   * asserts an svg exists would have passed throughout that bug.
   */
  const sortControl = (label: string) => screen.getByRole('button', { name: `Sort by ${label}` })

  it.each(['Document', 'Type', 'Size'])('offers a named sort control on %s', (label) => {
    renderTab()
    expect(sortControl(label)).toBeInTheDocument()
  })

  it.each(['Document', 'Type', 'Size'])('asks the caller to sort by %s', async (label) => {
    const { c } = renderTab()
    await userEvent.setup().click(sortControl(label))

    const field = label === 'Document' ? 'name' : label.toLowerCase()
    expect(c.applySort).toHaveBeenCalledWith(field)
  })

  const th = (label: string) => sortControl(label).closest('th') as HTMLElement

  it.each(['Document', 'Type', 'Size'])('marks the %s header as sortable', (label) => {
    renderTab()
    expect(th(label)).toHaveClass('ant-table-column-has-sorters')
  })

  it('announces the active column and direction through aria-sort', () => {
    renderTab({ sortBy: 'size', sortOrder: 'desc' })

    expect(th('Size')).toHaveAttribute('aria-sort', 'descending')
    expect(th('Document')).toHaveAttribute('aria-sort', 'none')
  })

  it('flips aria-sort with the order', () => {
    renderTab({ sortBy: 'name', sortOrder: 'asc' })
    expect(th('Document')).toHaveAttribute('aria-sort', 'ascending')
  })

  const sortArrow = (label: string) =>
    sortControl(label).querySelector('.ant-table-column-sorter svg')

  it('marks the active column with an accent sort arrow', () => {
    renderTab({ sortBy: 'size', sortOrder: 'desc' })
    expect(sortArrow('Size')?.getAttribute('class')).toContain('text-[var(--color-accent)]')
  })

  it('leaves inactive columns with a neutral sort arrow', () => {
    renderTab({ sortBy: 'name', sortOrder: 'asc' })
    expect(sortArrow('Type')?.getAttribute('class')).toContain('text-[var(--color-text-subtle)]')
  })

  /**
   * Search now lives on the Name column only — the design's Type filter-funnel
   * and Size search need server params the API lacks, so they are not built.
   */
  it('offers search only on the name column', () => {
    renderTab()
    // Name is searchable; Type and Size deliberately are not.
    expect(screen.getByRole('img', { name: 'Search Document' })).toBeInTheDocument()
    expect(th('Type').querySelector('.ant-table-filter-trigger')).toBeNull()
    expect(th('Size').querySelector('.ant-table-filter-trigger')).toBeNull()
  })

  const openSearch = async () => {
    fireEvent.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    return screen.findByPlaceholderText(/search documents by name/i)
  }

  it('drives the controller search from the name-column dropdown', async () => {
    const { c } = renderTab()
    const input = await openSearch()
    await userEvent.setup().type(input, 'licence{Enter}')
    expect(c.applySearch).toHaveBeenCalledWith('licence')
  })

  /** Enter is the shortcut; the button is the discoverable path. */
  it('searches from the dropdown button too', async () => {
    const { c } = renderTab()
    const input = await openSearch()
    const user = userEvent.setup()
    await user.type(input, 'plan')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(c.applySearch).toHaveBeenCalledWith('plan')
  })

  it('clears the term through Reset', async () => {
    const { c } = renderTab({ search: 'licence' })
    await openSearch()
    await userEvent.setup().click(screen.getByRole('button', { name: /^reset$/i }))

    expect(c.applySearch).toHaveBeenCalledWith('')
  })
})

describe('DocumentsTab — actions', () => {
  it('downloads the row it was clicked on', async () => {
    const { c } = renderTab()
    const row = rowFor('Trade Licence 2026.pdf')
    await userEvent.setup().click(within(row).getByRole('button', { name: /download/i }))

    expect(c.download).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'doc-1' }))
  })

  it('requests confirmation rather than deleting outright', async () => {
    const { c } = renderTab()
    const row = rowFor('Trade Licence 2026.pdf')
    await userEvent.setup().click(within(row).getByRole('button', { name: /delete/i }))

    expect(c.requestDelete).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'doc-1' }))
    expect(c.confirmDelete).not.toHaveBeenCalled()
  })

  /** Scoped to the modal — the name is also in the table row behind it. */
  it('names the document in the confirmation', () => {
    renderTab({ deleteTarget: DOCUMENTS[0] })
    const modal = document.querySelector('.ant-modal') as HTMLElement

    expect(within(modal).getByText(/Trade Licence 2026\.pdf/)).toBeInTheDocument()
    expect(within(modal).getByText(/can't be undone/i)).toBeInTheDocument()
  })

  it('stages a picked file rather than uploading it', () => {
    const { c } = renderTab()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] },
    })
    expect(c.stageFile).toHaveBeenCalled()
  })

  /** PENDING offers no control that would only 409 (BR-13). */
  it('offers no upload or delete while read-only', () => {
    renderTab({ editable: false })
    expect(screen.queryByRole('button', { name: /upload document/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    // Download stays available — reading is not a write.
    expect(screen.getAllByRole('button', { name: /download/i }).length).toBeGreaterThan(0)
  })

  it('offers the file picker while editable', () => {
    renderTab()
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument()
  })
})

describe('DocumentsTab — the preview modal', () => {
  const staged = new File(['x'], 'licence.pdf', { type: 'application/pdf' })

  it('opens with the staged file and no preview image', () => {
    renderTab({ pendingFile: staged })
    expect(screen.getByText('licence.pdf')).toBeInTheDocument()
    expect(screen.getByText(/no preview available/i)).toBeInTheDocument()
  })

  it('submits through the controller', async () => {
    const { c } = renderTab({ pendingFile: staged })
    await userEvent.setup().click(screen.getByRole('button', { name: /^submit$/i }))
    expect(c.submitUpload).toHaveBeenCalled()
  })

  it('cancels without submitting', async () => {
    const { c } = renderTab({ pendingFile: staged })
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(c.cancelUpload).toHaveBeenCalled()
    expect(c.submitUpload).not.toHaveBeenCalled()
  })

  /**
   * MET-1148 made a commit-time rejection common, and it arrives *after* the
   * progress bar has completed and vanished. Without something in the modal, the
   * partner sees an upload that appeared to finish and a dialog that did
   * nothing — so the reason is anchored where the progress bar was.
   */
  it('shows the failure inline, not only as a toast', () => {
    renderTab({
      pendingFile: staged,
      uploadError: 'Only PDF, DOCX, JPG or PNG documents are allowed.',
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only PDF, DOCX, JPG or PNG documents are allowed.',
    )
  })

  /** Retrying is a whole new upload, so the button says so rather than "Submit". */
  it('relabels Submit once an attempt has failed', () => {
    renderTab({ pendingFile: staged, uploadError: 'Something went wrong.' })

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument()
  })

  it('shows no alert before anything has failed', () => {
    renderTab({ pendingFile: staged })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /** The bar and the reason are mutually exclusive: one replaces the other. */
  it('hides the previous reason while a retry is uploading', () => {
    renderTab({ pendingFile: staged, uploading: true, progress: 40, uploadError: 'Stale reason.' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /** Dismissing mid-upload would leave the request with nowhere to report. */
  it('locks both buttons while uploading', () => {
    renderTab({ pendingFile: staged, uploading: true, progress: 40 })
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('shows progress while uploading', () => {
    renderTab({ pendingFile: staged, uploading: true, progress: 40 })
    expect(document.querySelector('.ant-progress')).toBeInTheDocument()
  })
})
