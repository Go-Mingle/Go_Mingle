import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantDocumentsTab } from '../RestaurantDocumentsTab'
import { RestaurantScheduleTab } from '../RestaurantScheduleTab'
import type { MediaFile } from '../restaurantDetail.types'
import type { RestaurantTablesResponse } from '../restaurantApi.types'

const RESTAURANT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const TABLES_URL = `/api/v1/restaurants/${RESTAURANT_ID}/tables`

describe('RestaurantDocumentsTab', () => {
  afterEach(() => {
    // NOTE: do not call vi.unstubAllGlobals() here — it would remove the
    // module-level localStorage/sessionStorage stubs from setupTests, causing
    // httpClient.getAuthToken() to throw in every later request-driven test
    // (e.g. the RestaurantScheduleTab tables queries below).
    vi.restoreAllMocks()
  })

  it('renders the empty state when there are no documents', () => {
    renderWithProviders(<RestaurantDocumentsTab documents={[]} />)
    expect(screen.getByText('No documents uploaded.')).toBeInTheDocument()
  })

  it('renders a grid of documents with captions and file names', () => {
    const documents: MediaFile[] = [
      {
        id: 'doc-1',
        filename: 'trade-licence.pdf',
        ext: 'pdf',
        fileType: 'pdf',
        caption: 'Trade Licence',
        size: '1MB',
        url: 'https://files.test/trade-licence.pdf',
      },
      {
        id: 'doc-2',
        filename: 'menu.docx',
        ext: 'docx',
        fileType: 'docx',
        size: '2MB',
        url: 'https://files.test/menu.docx',
      },
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)

    expect(screen.getByText('Trade Licence')).toBeInTheDocument()
    // no caption falls back to filename
    expect(screen.getByText('menu.docx')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(2)
  })

  it.each([
    ['xls', 'xls-file.xls'],
    ['xlsx', 'xlsx-file.xlsx'],
    ['csv', 'csv-file.csv'],
    ['jpg', 'photo.jpg'],
    ['jpeg', 'photo.jpeg'],
    ['png', 'photo.png'],
    ['webp', 'photo.webp'],
    ['txt', 'notes.txt'],
  ])('renders correct icon branch for fileType "%s"', (fileType, filename) => {
    const documents: MediaFile[] = [
      {
        id: `doc-${fileType}`,
        filename,
        ext: fileType,
        fileType,
        size: '1MB',
        url: 'https://files.test/file',
      },
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    expect(screen.getByText(filename)).toBeInTheDocument()
  })

  it('derives file type from ext when fileType is missing', () => {
    const documents: MediaFile[] = [
      {
        id: 'doc-ext',
        filename: 'contract.pdf',
        ext: 'pdf',
        size: '1MB',
        url: 'https://files.test/contract.pdf',
      } as MediaFile,
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    expect(screen.getByText('contract.pdf')).toBeInTheDocument()
  })

  it('derives file type from the filename extension when fileType and ext are both missing', () => {
    const documents: MediaFile[] = [
      {
        id: 'doc-noext',
        filename: 'report.xlsx',
        size: '1MB',
        url: 'https://files.test/report.xlsx',
      } as MediaFile,
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    expect(screen.getByText('report.xlsx')).toBeInTheDocument()
  })

  it('falls back to an empty type string when no extension can be derived at all', () => {
    const documents: MediaFile[] = [
      {
        id: 'doc-none',
        filename: 'noextension',
        size: '1MB',
        url: 'https://files.test/noextension',
      } as MediaFile,
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    expect(screen.getByText('noextension')).toBeInTheDocument()
  })

  it('downloads the file via fetch+blob when the download button is clicked', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    server.use(
      http.get('https://files.test/trade-licence.pdf', () => {
        // Return an ArrayBuffer body (not a Blob) so the Response is constructed
        // without calling Blob.stream(), which jsdom's Blob does not implement
        // in CI's undici build. response.blob() still resolves in downloadFileFromUrl.
        return new HttpResponse(new TextEncoder().encode('data').buffer, {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        })
      }),
    )
    const documents: MediaFile[] = [
      {
        id: 'doc-1',
        filename: 'trade-licence.pdf',
        ext: 'pdf',
        fileType: 'pdf',
        size: '1MB',
        url: 'https://files.test/trade-licence.pdf',
      },
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
  })

  it('falls back to opening a new tab when the download request fails', async () => {
    const openSpy = vi.fn()
    Object.defineProperty(window, 'open', { writable: true, value: openSpy })
    server.use(http.get('https://files.test/missing.pdf', () => HttpResponse.error()))
    const documents: MediaFile[] = [
      {
        id: 'doc-1',
        filename: 'trade-licence.pdf',
        ext: 'pdf',
        fileType: 'pdf',
        size: '1MB',
        url: 'https://files.test/missing.pdf',
      },
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://files.test/missing.pdf',
        '_blank',
        'noopener,noreferrer',
      ),
    )
  })

  it('falls back to opening a new tab when the file has no url', async () => {
    const openSpy = vi.fn()
    Object.defineProperty(window, 'open', { writable: true, value: openSpy })
    server.use(http.get('*', () => HttpResponse.error()))
    const documents: MediaFile[] = [
      {
        id: 'doc-1',
        filename: 'trade-licence.pdf',
        ext: 'pdf',
        fileType: 'pdf',
        size: '1MB',
        url: undefined,
      } as unknown as MediaFile,
    ]
    renderWithProviders(<RestaurantDocumentsTab documents={documents} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('#', '_blank', 'noopener,noreferrer'))
  })
})

describe('RestaurantScheduleTab', () => {
  function renderSchedule() {
    return renderWithProviders(
      <RestaurantScheduleTab restaurant={{ id: RESTAURANT_ID } as Record<string, unknown>} />,
    )
  }

  it('shows the loading state before the tables response resolves', () => {
    server.use(
      http.get(TABLES_URL, () =>
        HttpResponse.json({
          success: true,
          data: { items: [] } satisfies RestaurantTablesResponse,
        }),
      ),
    )
    renderSchedule()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an error message when the tables request fails', async () => {
    server.use(
      http.get(TABLES_URL, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
          { status: 404 },
        ),
      ),
    )
    renderSchedule()
    await waitFor(() =>
      expect(screen.getByText('Unable to load table timings.')).toBeInTheDocument(),
    )
  })

  it('shows the empty state when there are no tables', async () => {
    server.use(
      http.get(TABLES_URL, () =>
        HttpResponse.json({
          success: true,
          data: { items: [] } satisfies RestaurantTablesResponse,
        }),
      ),
    )
    renderSchedule()
    expect(await screen.findByText('No tables have been set up yet.')).toBeInTheDocument()
  })

  it('does not render the schedule tab when restaurant id is undefined', () => {
    renderWithProviders(<RestaurantScheduleTab restaurant={{} as Record<string, unknown>} />)
    expect(screen.getByText('No tables have been set up yet.')).toBeInTheDocument()
  })

  it('renders table names, open days with time ranges, and closed days', async () => {
    server.use(
      http.get(TABLES_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'table-1',
                name: 'Rooftop Table',
                availability: [
                  { dayOfWeek: 1, start: '09:00', end: '12:00' },
                  { dayOfWeek: 1, start: '14:00', end: '18:00' },
                  { dayOfWeek: 3, start: '10:00', end: '20:00' },
                ],
              },
              {
                id: 'table-2',
                name: 'Garden Table',
                availability: [],
              },
            ],
          } satisfies RestaurantTablesResponse,
        }),
      ),
    )
    renderSchedule()

    expect(await screen.findByText('Rooftop Table')).toBeInTheDocument()
    expect(screen.getByText('Garden Table')).toBeInTheDocument()

    // Two time ranges rendered for Monday
    expect(screen.getByText('09:00 – 12:00')).toBeInTheDocument()
    expect(screen.getByText('14:00 – 18:00')).toBeInTheDocument()
    // Single range for Wednesday
    expect(screen.getByText('10:00 – 20:00')).toBeInTheDocument()

    // Closed labels appear for days without availability (Garden Table: all 7 days closed)
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0)

    // All day abbreviations rendered per table
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('groups multiple availability windows under the same day correctly', async () => {
    server.use(
      http.get(TABLES_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'table-1',
                name: 'Sunday Brunch Table',
                availability: [{ dayOfWeek: 0, start: '08:00', end: '11:00' }],
              },
            ],
          } satisfies RestaurantTablesResponse,
        }),
      ),
    )
    renderSchedule()
    expect(await screen.findByText('Sunday Brunch Table')).toBeInTheDocument()
    expect(screen.getByText('08:00 – 11:00')).toBeInTheDocument()
  })
})
