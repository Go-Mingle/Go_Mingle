import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { MenuPdfCard } from '../components/MenuPdfCard'
import type { useMenuPdfSection } from '../hooks/useMenuPdfSection'

type Pdf = ReturnType<typeof useMenuPdfSection>

const MENU_URL = 'https://cdn.example/restaurant-multimedia/menu/signature-menu.pdf'

/** A plain stand-in, so each state can be rendered directly. */
function controller(overrides: Partial<Pdf> = {}): Pdf {
  return {
    menuUrl: null,
    name: null,
    isPending: false,
    isError: false,
    error: null,
    editable: true,
    pickFile: vi.fn().mockReturnValue(false),
    uploading: false,
    progress: 0,
    uploadError: null,
    dismissUploadError: vi.fn(),
    confirmingDelete: false,
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    downloadPdf: vi.fn(),
    deleting: false,
    ...overrides,
  } as Pdf
}

function renderCard(overrides: Partial<Pdf> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<MenuPdfCard c={c} />) }
}

const uploaded = (extra: Partial<Pdf> = {}) => ({
  menuUrl: MENU_URL,
  name: 'signature-menu.pdf',
  ...extra,
})

describe('MenuPdfCard — states', () => {
  it('spins while loading', () => {
    const { container } = renderCard({ isPending: true })
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message on failure', () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Menu unavailable.' } }
    renderCard({ isError: true, error })

    expect(screen.getByText('Menu unavailable.')).toBeInTheDocument()
  })

  it('offers an upload when nothing is there (AC-01.1)', () => {
    const { container } = renderCard()

    expect(screen.getByText(/no menu pdf uploaded yet/i)).toBeInTheDocument()
    expect(screen.getByText('Upload PDF')).toBeInTheDocument()
    // Full-width dashed drop box (Upload.Dragger), matching the design.
    expect(container.querySelector('.ant-upload-drag')).toBeInTheDocument()
  })

  /**
   * The picked file goes straight to the controller — no preview modal (AC-01.2).
   * `pickFile` returns false so AntD does not start an upload of its own; the real
   * one is the presigned PUT the controller triggers.
   */
  it('hands a picked file to the controller and stops AntD uploading it', async () => {
    const { c, container } = renderCard()
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('the picker did not render a file input')

    const file = new File(['x'], 'menu.pdf', { type: 'application/pdf' })
    await userEvent.setup().upload(input, file)

    expect(c.pickFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'menu.pdf' }))
  })

  it('accepts only PDFs at the picker', () => {
    const { container } = renderCard()
    expect(container.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      '.pdf,application/pdf',
    )
  })

  /** Progress replaces the row: there is no preview modal to host it (AC-01.2). */
  it('shows progress while the bytes are moving', () => {
    renderCard({ uploading: true, progress: 42 })

    expect(screen.getByText(/uploading your menu/i)).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })
})

/**
 * MET-1258. An over-limit PDF is refused client-side, so the page's toast was
 * the only report and it had already faded — the section itself said nothing.
 */
describe('MenuPdfCard — a refused upload', () => {
  const TOO_LARGE = 'This file is larger than the 10 MB limit.'

  it('says why, in the section, as an alert', () => {
    renderCard({ uploadError: TOO_LARGE })

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_LARGE)
  })

  it('says nothing when there is nothing to report', () => {
    renderCard()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /** The upload control stays available: the recovery is to pick a smaller file. */
  it('keeps the picker alongside the reason', () => {
    renderCard({ uploadError: TOO_LARGE })
    expect(screen.getByText('Upload PDF')).toBeInTheDocument()
  })

  it('reports against the uploaded row as well as the empty state', () => {
    renderCard(uploaded({ uploadError: TOO_LARGE }))

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_LARGE)
    expect(screen.getByText('signature-menu.pdf')).toBeInTheDocument()
  })

  it('can be dismissed', async () => {
    const { c } = renderCard({ uploadError: TOO_LARGE })
    await userEvent.setup().click(screen.getByRole('button', { name: /close/i }))

    expect(c.dismissUploadError).toHaveBeenCalled()
  })
})

describe('MenuPdfCard — the uploaded row', () => {
  it('shows the server’s name', () => {
    renderCard(uploaded())
    expect(screen.getByText('signature-menu.pdf')).toBeInTheDocument()
  })

  it('falls back to a label when the name is missing but the file is not', () => {
    renderCard({ menuUrl: MENU_URL, name: null })
    expect(screen.getByText('Menu.pdf')).toBeInTheDocument()
  })

  /**
   * `menuUrl` is a public CloudFront URL (CR-39), which is exactly why this is no
   * longer an `<a download>`: the attribute is silently ignored cross-origin, so
   * the anchor navigated the current tab into the PDF viewer instead of saving it.
   */
  it('downloads through the controller rather than an anchor', async () => {
    const { c } = renderCard(uploaded())

    expect(screen.queryByRole('link', { name: /download pdf/i })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /download pdf/i }))

    expect(c.downloadPdf).toHaveBeenCalled()
  })

  it('opens the public URL in a new tab to preview', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    renderCard(uploaded())

    await userEvent.setup().click(screen.getByRole('button', { name: /view pdf/i }))

    expect(open).toHaveBeenCalledWith(MENU_URL, '_blank', 'noopener')
    vi.unstubAllGlobals()
  })

  it('asks to remove the PDF', async () => {
    const { c } = renderCard(uploaded())
    await userEvent.setup().click(screen.getByRole('button', { name: /remove pdf/i }))

    expect(c.requestDelete).toHaveBeenCalled()
  })

  it('confirms before removing, warning it cannot be undone', () => {
    renderCard(uploaded({ confirmingDelete: true }))

    expect(screen.getByText('Remove menu PDF')).toBeInTheDocument()
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument()
  })
})

/** PENDING offers no control that would only 409 — absent, not disabled (BR-10). */
describe('MenuPdfCard — read-only', () => {
  it('withholds the upload control on the empty state', () => {
    renderCard({ editable: false })

    expect(screen.getByText(/no menu pdf uploaded yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Upload PDF')).not.toBeInTheDocument()
  })

  it('withholds the remove button but keeps preview and download', () => {
    renderCard(uploaded({ editable: false }))

    expect(screen.queryByRole('button', { name: /remove pdf/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view pdf/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument()
  })

  it('still names the uploaded file', () => {
    renderCard(uploaded({ editable: false }))
    expect(screen.getByText('signature-menu.pdf')).toBeInTheDocument()
  })
})
