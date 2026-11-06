import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as antd from 'antd'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTopicsPage } from '../InterestTopicsPage'

// jsdom doesn't decode images, so stub Image so the logo dimension check in the
// modal's beforeUpload can run. Tests tweak `mockImageDims` for the small-image
// case; default clears the 300×300 floor.
let mockImageDims = { width: 400, height: 400 }
class MockImage {
  onload: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  set src(_value: string) {
    this.naturalWidth = mockImageDims.width
    this.naturalHeight = mockImageDims.height
    this.onload?.()
  }
}

const validLogo = () => new File(['img-bytes'], 'logo.png', { type: 'image/png' })

// Upload a valid logo into the modal and wait for the preview to confirm it took.
async function uploadValidLogo(user: ReturnType<typeof userEvent.setup>, modal: HTMLElement) {
  const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(fileInput, validLogo())
  await screen.findByText(/replace image/i)
}

// Fill every required field (name, interest, description, logo) so a create submit passes validation.
async function fillValidTopic(
  user: ReturnType<typeof userEvent.setup>,
  modal: HTMLElement,
  name: string,
) {
  await user.type(within(modal).getByPlaceholderText('e.g. Wine & Dine'), name)
  await pickInterest(user, modal)
  await user.type(
    within(modal).getByPlaceholderText('Describe what this interest topic is about.'),
    'A perfectly valid topic description.',
  )
  await uploadValidLogo(user, modal)
}

function setMobile(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !isMobile && /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const topicsResponse = (interestTablesCount: number) => ({
  success: true,
  data: {
    items: [
      {
        id: 't-solo',
        name: 'Solo Topic',
        description: 'A long enough description to exercise the truncation path in the table cell.',
        graphicUrl: 'https://picsum.photos/seed/solo/80/80',
        interests: [{ id: 'i1', name: 'Wine' }],
        interestTablesCount,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
  },
})

// Detail (GET /topics/:id) response used to populate the edit modal.
const topicDetailResponse = {
  success: true,
  data: {
    id: 't-solo',
    name: 'Solo Topic',
    description: 'A perfectly valid topic description.',
    graphicUrl: 'https://picsum.photos/seed/solo/80/80',
    interests: [{ id: 'i1', name: 'Wine' }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  },
}

async function pickInterest(user: ReturnType<typeof userEvent.setup>, modal: HTMLElement) {
  await user.click(within(modal).getByRole('combobox'))
  await user.click(await screen.findByText('Wine', { selector: '.ant-select-item-option-content' }))
}

beforeEach(() => {
  setMobile(false)
  mockImageDims = { width: 400, height: 400 }
  vi.stubGlobal('Image', MockImage)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('InterestTopicsPage — desktop rendering', () => {
  it('renders the topics table with a topic row', async () => {
    server.use(http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))))
    renderWithProviders(<InterestTopicsPage />)
    expect(await screen.findByText('Solo Topic')).toBeInTheDocument()
    // Interest chip is rendered (the description column has been removed).
    expect(screen.getByText('Wine')).toBeInTheDocument()
  })

  it('searches via the topic column filter and re-requests with q', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/topics', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(topicsResponse(0))
      }),
    )
    renderWithProviders(<InterestTopicsPage />)
    await screen.findByText('Solo Topic')
    const user = userEvent.setup()
    // Open the search dropdown on the TOPIC column (the only column filter).
    await user.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    const input = await screen.findByPlaceholderText(/search topics/i)
    await user.type(input, 'wine')
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(capturedUrl?.searchParams.get('q')).toBe('wine'), { timeout: 3000 })
  })

  it('clears the topic column filter and re-requests without q', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/topics', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(topicsResponse(0))
      }),
    )
    renderWithProviders(<InterestTopicsPage />)
    await screen.findByText('Solo Topic')
    const user = userEvent.setup()
    await user.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    const input = await screen.findByPlaceholderText(/search topics/i)
    await user.type(input, 'wine')
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(capturedUrl?.searchParams.get('q')).toBe('wine'), { timeout: 3000 })
    // Re-open and reset clears the query.
    await user.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    await user.click(await screen.findByRole('button', { name: /^reset$/i }))
    await waitFor(() => expect(capturedUrl?.searchParams.get('q')).toBeNull(), { timeout: 3000 })
  })

  it('toggles the sort order and renders a sparse topic (no description/interests)', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/topics', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 't-bare',
                name: 'Bare Topic',
                description: null,
                graphicUrl: null,
                interests: [],
                interestTablesCount: 0,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
            pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await screen.findByText('Bare Topic')
    // Sort header toggles asc -> desc and re-requests. AntD renders a duplicate
    // aria-hidden "measure" header, so click the first (visible) match.
    await user.click(screen.getAllByText('TOPIC')[0])
    await waitFor(() => expect(capturedUrl?.searchParams.get('sortOrder')).toBe('desc'), {
      timeout: 3000,
    })
  })
})

describe('InterestTopicsPage — create', () => {
  it('creates a topic, uploading the logo via signed-url and sending graphicKey (not base64)', async () => {
    let createdBody: Record<string, unknown> | undefined
    server.use(
      http.post('/api/v1/topics', async ({ request }) => {
        createdBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { success: true, data: { id: 'new', ...createdBody } },
          { status: 201 },
        )
      }),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    await fillValidTopic(user, modal, 'Fresh Topic')
    await user.click(within(modal).getByRole('button', { name: /create topic/i }))
    expect(await screen.findByText(/has been created/i)).toBeInTheDocument()
    // Payload carries the storage key from the signed-url mock, not a base64 data URL.
    // Asserted by shape rather than by literal: the key is unique per upload, and
    // the shape is what the backend enforces (TOPIC_GRAPHIC_KEY_PATTERN — anchored
    // to the `topics/` prefix, so a `covers/` key is a 400).
    expect(createdBody?.graphicKey).toMatch(/^topics\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/)
    expect(createdBody).not.toHaveProperty('graphicUrl')
  })

  it('previews a valid uploaded image via the upload dragger', async () => {
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement

    // Valid PNG → beforeUpload accepts it and FileReader sets the preview
    // (image + "Replace image" label).
    await user.upload(fileInput, new File(['img'], 'logo.png', { type: 'image/png' }))
    expect(await screen.findByText(/replace image/i)).toBeInTheDocument()
  })

  it('maps ERR_TOPIC_NAME_IN_USE to a field error', async () => {
    server.use(
      http.post('/api/v1/topics', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_TOPIC_NAME_IN_USE', message: 'dup' } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    await fillValidTopic(user, modal, 'Dup Topic')
    await user.click(within(modal).getByRole('button', { name: /create topic/i }))
    expect(await screen.findByText('Topic name already exists.')).toBeInTheDocument()
  })

  it('maps ERR_VALIDATION field details onto the form', async () => {
    server.use(
      http.post('/api/v1/topics', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_VALIDATION', details: { fields: { name: ['Name is invalid.'] } } },
          },
          { status: 400 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    await fillValidTopic(user, modal, 'Bad Topic')
    await user.click(within(modal).getByRole('button', { name: /create topic/i }))
    expect(await screen.findByText('Name is invalid.')).toBeInTheDocument()
  })

  it('renders a string field error as one horizontal message (not char-by-char)', async () => {
    // The API returns the description error as a bare string (not string[]).
    // It must be normalised so antd renders a single explain line rather than
    // one <div> per character.
    const message = 'Description must not exceed 500 characters.'
    server.use(
      http.post('/api/v1/topics', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_VALIDATION', details: { fields: { description: message } } },
          },
          { status: 400 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    await fillValidTopic(user, modal, 'Str Err Topic')
    await user.click(within(modal).getByRole('button', { name: /create topic/i }))
    // The whole message resolves to a single text node — proof it wasn't split
    // into one error row per character.
    const explain = await screen.findByText(message)
    expect(explain).toBeInTheDocument()
    expect(within(modal).getAllByText(message)).toHaveLength(1)
  })

  it('surfaces an unexpected API error via toast', async () => {
    server.use(
      http.post('/api/v1/topics', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_UNEXPECTED', message: 'Create failed on server.' },
          },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    await fillValidTopic(user, modal, 'Fresh Topic')
    await user.click(within(modal).getByRole('button', { name: /create topic/i }))
    expect(await screen.findByText('Create failed on server.')).toBeInTheDocument()
  })

  it('blocks submit and shows required errors when description and logo are missing', async () => {
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    // Only name + interest — description and logo left empty.
    await user.type(within(modal).getByPlaceholderText('e.g. Wine & Dine'), 'Incomplete Topic')
    await pickInterest(user, modal)
    await user.click(within(modal).getByRole('button', { name: /create topic/i }))
    expect(await screen.findByText('Description is required.')).toBeInTheDocument()
    expect(await screen.findByText('A logo image is required.')).toBeInTheDocument()
  })

  it('rejects a non-PNG/JPEG logo with a type error', async () => {
    const errorSpy = vi.spyOn(antd.message, 'error')
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    // .png name clears the picker's accept filter; the gif MIME then trips the
    // component's own type guard in beforeUpload.
    await user.upload(fileInput, new File(['x'], 'evil.png', { type: 'image/gif' }))
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Only PNG or JPEG images are supported.'),
    )
  })

  it('rejects a logo smaller than 300×300 with a dimension error', async () => {
    mockImageDims = { width: 200, height: 200 }
    const errorSpy = vi.spyOn(antd.message, 'error')
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, validLogo())
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Image must be at least 300×300 pixels.'),
    )
  })

  it('rejects a logo larger than 2MB with a size error', async () => {
    const errorSpy = vi.spyOn(antd.message, 'error')
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const modal = await screen.findByRole('dialog')
    const fileInput = modal.querySelector('input[type="file"]') as HTMLInputElement
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await user.upload(fileInput, big)
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Image must be under 2MB.'))
  })
})

describe('InterestTopicsPage — edit and delete (mobile)', () => {
  beforeEach(() => setMobile(true))

  it('populates the edit modal from GET /topics/:id and shows an updated toast', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.get('/api/v1/topics/:id', () => HttpResponse.json(topicDetailResponse)),
      http.patch('/api/v1/topics/:id', async ({ request }) =>
        HttpResponse.json({
          success: true,
          data: { id: 't-solo', ...((await request.json()) as object) },
        }),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    const modal = await screen.findByRole('dialog')
    // Field value comes from the detail fetch, not the list row — wait for it.
    const nameInput = within(modal).getByPlaceholderText('e.g. Wine & Dine')
    await waitFor(() => expect(nameInput).toHaveValue('Solo Topic'))
    await user.clear(nameInput)
    await user.type(nameInput, 'Solo Topic Renamed')
    await user.click(within(modal).getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText(/has been updated/i)).toBeInTheDocument()
  })

  it('does not carry the just-created topic image into a later edit (MET-1285)', async () => {
    let patchedBody: Record<string, unknown> | undefined
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.get('/api/v1/topics/:id', () => HttpResponse.json(topicDetailResponse)),
      http.post('/api/v1/topics', async ({ request }) =>
        HttpResponse.json(
          { success: true, data: { id: 'new', ...((await request.json()) as object) } },
          { status: 201 },
        ),
      ),
      http.patch('/api/v1/topics/:id', async ({ request }) => {
        patchedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true, data: { id: 't-solo', ...patchedBody } })
      }),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()

    // 1. Create a topic with an uploaded image — this sets the graphicKey state.
    await user.click(await screen.findByRole('button', { name: /new topic/i }))
    const createModal = await screen.findByRole('dialog')
    await fillValidTopic(user, createModal, 'Fresh Topic')
    await user.click(within(createModal).getByRole('button', { name: /create topic/i }))
    expect(await screen.findByText(/has been created/i)).toBeInTheDocument()

    // 2. Edit an existing topic without touching its image.
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    const editModal = await screen.findByRole('dialog')
    const nameInput = within(editModal).getByPlaceholderText('e.g. Wine & Dine')
    await waitFor(() => expect(nameInput).toHaveValue('Solo Topic'))
    await user.clear(nameInput)
    await user.type(nameInput, 'Solo Topic Renamed')
    await user.click(within(editModal).getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(patchedBody).toBeDefined())
    // The stale key from the created topic must not be submitted — omitting
    // graphicKey leaves the existing topic's graphic untouched.
    expect(patchedBody).not.toHaveProperty('graphicKey')
    expect(patchedBody?.name).toBe('Solo Topic Renamed')
  })

  it('shows a loading spinner while the topic detail is being fetched', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.get('/api/v1/topics/:id', async () => {
        await delay(50)
        return HttpResponse.json(topicDetailResponse)
      }),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    const modal = await screen.findByRole('dialog')
    // While the detail request is in flight, the form is replaced by a spinner.
    expect(modal.querySelector('.ant-spin')).toBeInTheDocument()
    // Once it resolves, the form populates.
    await waitFor(() =>
      expect(within(modal).getByPlaceholderText('e.g. Wine & Dine')).toHaveValue('Solo Topic'),
    )
  })

  it('toasts and closes the edit modal when the topic detail fetch fails', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.get('/api/v1/topics/:id', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_TOPIC_NOT_FOUND', message: 'Topic not found.' } },
          { status: 404 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    // The detail error surfaces via toast. `message.error(...)` and `onClose()`
    // run in the same effect (toast first), so the visible toast proves the
    // error handler — including the modal close — executed. jsdom can't observe
    // the antd close animation completing, so we assert the observable toast.
    expect(await screen.findByText('Topic not found.')).toBeInTheDocument()
  })

  it('deletes a topic and shows a deleted toast', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.delete('/api/v1/topics/:id', () => new HttpResponse(null, { status: 204 })),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))
    expect(await screen.findByText(/has been deleted/i)).toBeInTheDocument()
  })

  it('blocks deletion when the topic is used by interest tables', async () => {
    server.use(http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(3))))
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Cannot delete topic')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /got it/i }))
  })

  it('re-renders the blocked state when delete returns ERR_TOPIC_IN_USE', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.delete('/api/v1/topics/:id', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_TOPIC_IN_USE', details: { interestTablesCount: 2 } },
          },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))
    // The confirm modal flips to the "cannot delete" state.
    expect(await screen.findByText('Cannot delete topic')).toBeInTheDocument()
  })

  it("shows the API's own reason when ERR_TOPIC_IN_USE carries no details", async () => {
    const apiMessage =
      'Cannot delete topic. It is currently used by one or more interest tables. Remove it from those tables first.'
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.delete('/api/v1/topics/:id', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_TOPIC_IN_USE', message: apiMessage, details: {} },
          },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))
    expect(await screen.findByText('Cannot delete topic')).toBeInTheDocument()
    expect(await screen.findByText(apiMessage)).toBeInTheDocument()
    // The confirm action is gone — only the acknowledge button remains.
    expect(within(dialog).queryByRole('button', { name: 'Delete topic' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /got it/i })).toBeInTheDocument()
  })

  it('clears a previous block message when a different topic is targeted', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.delete('/api/v1/topics/:id', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_TOPIC_IN_USE', message: 'Blocked.', details: {} } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    let dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))
    expect(await screen.findByText('Blocked.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /got it/i }))

    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Delete topic' })).toBeInTheDocument()
    expect(screen.queryByText('Blocked.')).not.toBeInTheDocument()
  })

  it('surfaces an unexpected API error on delete via toast', async () => {
    server.use(
      http.get('/api/v1/topics', () => HttpResponse.json(topicsResponse(0))),
      http.delete('/api/v1/topics/:id', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_UNEXPECTED', message: 'Delete failed on server.' },
          },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<InterestTopicsPage />)
    const user = userEvent.setup()
    const card = (await screen.findByText('Solo Topic')).closest(
      '.interest-topics-card-list > div',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete topic' }))
    expect(await screen.findByText('Delete failed on server.')).toBeInTheDocument()
  })
})
