import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  markComboInUse,
  mockMenuOption,
  mockMenuOptionCount,
  mockMenuPdfState,
  MOCK_MENU_PDF_MAX_BYTES,
  receiveMockMenuPdf,
  releaseCombo,
  resetMockMenu,
  setMockMenuPdf,
} from '../../../../../mocks/data/partnerMenu'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_MENU_ENDPOINTS } from '../constants'
import { partnerMenuService } from '../services'
import type { ComboDraft } from '../types'

const draft: ComboDraft = {
  name: 'Weekend Brunch',
  pricePkr: 0,
  courses: [{ course: 'Starters', choose: 1, options: ['Soup', 'Salad'] }],
}

const caught = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => error) as Promise<HttpError>

beforeEach(() => {
  resetMockProfile()
  resetMockMenu()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  server.resetHandlers()
})

describe('getMenuPdf', () => {
  /** Both fields null *is* the empty state, not an error (AC-01.1). */
  it('returns nulls when nothing is uploaded', async () => {
    await expect(partnerMenuService.getMenuPdf()).resolves.toEqual({ menuUrl: null, name: null })
  })

  it('returns the public URL and name once uploaded', async () => {
    setMockMenuPdf('signature-menu.pdf')

    const pdf = await partnerMenuService.getMenuPdf()
    expect(pdf.name).toBe('signature-menu.pdf')
    expect(pdf.menuUrl).toContain('signature-menu.pdf')
  })

  it('surfaces a failed read', async () => {
    server.use(
      http.get(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    expect(await caught(partnerMenuService.getMenuPdf())).toBeInstanceOf(HttpError)
  })
})

describe('menuPdfUploadTarget', () => {
  it('mints a target carrying the authoritative size limit', async () => {
    const target = await partnerMenuService.menuPdfUploadTarget('menu.pdf')

    expect(target.uploadUrl).toBeTruthy()
    expect(target.uploadRef).toBeTruthy()
    expect(target.maxBytes).toBe(MOCK_MENU_PDF_MAX_BYTES)
  })

  /**
   * The fixture-contract check for MET-1147 on J6D's target — outside the
   * ticket's scope but fixed with it, because leaving it would have shipped
   * three upload-target endpoints disagreeing about the same field.
   *
   * Pinned here only, for the same reason as J6B's: the bucket segment is
   * whatever `S3_BUCKET_RESTAURANT_MULTIMEDIA` holds, so no production code may
   * assert on it.
   */
  it('bucket-qualifies the menu key (MET-1147)', async () => {
    const target = await partnerMenuService.menuPdfUploadTarget('My Menu (Final).pdf')

    expect(target.key).toBe(`restaurant-multimedia/restaurants/rest-1/menu/${target.uploadRef}.pdf`)
  })

  /** The client never chooses the type — PDF is the only thing this endpoint takes. */
  it('always declares application/pdf', async () => {
    let body: unknown
    server.use(
      http.post(`*${PARTNER_MENU_ENDPOINTS.menuPdfUploadUrl}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { uploadUrl: 'u', uploadRef: 'r', maxBytes: 1 },
        })
      }),
    )

    await partnerMenuService.menuPdfUploadTarget('menu.pdf')
    expect(body).toEqual({ name: 'menu.pdf', contentType: 'application/pdf' })
  })

  it('refuses a non-PDF at step 1, before any bytes move', async () => {
    server.use(
      http.post(`*${PARTNER_MENU_ENDPOINTS.menuPdfUploadUrl}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_VALIDATION', message: 'Only a PDF menu is allowed.' },
          },
          { status: 422 },
        ),
      ),
    )

    const error = await caught(partnerMenuService.menuPdfUploadTarget('notes.docx'))
    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
  })
})

describe('commitMenuPdf', () => {
  async function stage(size: number): Promise<string> {
    const target = await partnerMenuService.menuPdfUploadTarget('My Menu (Final).pdf')
    receiveMockMenuPdf(target.uploadRef, size)
    return target.uploadRef
  }

  /**
   * The backend derives the name from the object key, so it comes back
   * slugified. The client shows this verbatim, and asserting it here is what
   * stops a future change from quietly showing the picked filename instead.
   */
  it('returns the slugified name, not what the partner picked', async () => {
    const pdf = await partnerMenuService.commitMenuPdf(await stage(1024))
    expect(pdf.name).toBe('my-menu-final.pdf')
  })

  it('sends the uploadRef and nothing else', async () => {
    let body: unknown
    server.use(
      http.put(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { menuUrl: 'u', name: 'n' } })
      }),
    )

    await partnerMenuService.commitMenuPdf('ref-1')
    // Notably no `name` — the server derives it, and an unknown field is a 422.
    // J6B's three commits are asserted the same way.
    expect(body).toEqual({ uploadRef: 'ref-1' })
  })

  it('replaces an existing PDF rather than adding a second', async () => {
    setMockMenuPdf('old.pdf')
    await partnerMenuService.commitMenuPdf(await stage(1024))

    expect(mockMenuPdfState().name).toBe('my-menu-final.pdf')
  })

  /**
   * A presigned PUT cannot bind Content-Length, so the server re-inspects the
   * stored object. The client's pre-check is a courtesy, never the enforcement.
   */
  it('413s when the stored object exceeds the limit', async () => {
    const error = await caught(
      partnerMenuService.commitMenuPdf(await stage(MOCK_MENU_PDF_MAX_BYTES + 1)),
    )
    expect(error.status).toBe(413)
    expect(error.code).toBe('ERR_MEDIA_TOO_LARGE')
  })

  it('422s for a reference whose bytes never landed', async () => {
    const target = await partnerMenuService.menuPdfUploadTarget('menu.pdf')
    const error = await caught(partnerMenuService.commitMenuPdf(target.uploadRef))

    expect(error.status).toBe(422)
  })
})

describe('deleteMenuPdf', () => {
  it('clears the reference so the empty state returns', async () => {
    setMockMenuPdf()

    await expect(partnerMenuService.deleteMenuPdf()).resolves.toEqual({ menuUrl: null })
    expect(mockMenuPdfState().menuUrl).toBeNull()
  })

  it('404s when there was nothing to remove', async () => {
    const error = await caught(partnerMenuService.deleteMenuPdf())

    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })
})

describe('listMenuOptions', () => {
  it('returns the combos with their courses', async () => {
    const { items } = await partnerMenuService.listMenuOptions()

    expect(items.length).toBeGreaterThan(0)
    expect(items[0].comboId).toBeTruthy()
    expect(items[0].courses[0].options.length).toBeGreaterThan(0)
  })

  /** Hidden combos stay in the list — the tab badges them (AC-02.2). */
  it('includes hidden combos', async () => {
    const { items } = await partnerMenuService.listMenuOptions()
    expect(items.some((item) => item.isHidden)).toBe(true)
  })
})

describe('createMenuOption', () => {
  it('creates a combo and returns it visible', async () => {
    const created = await partnerMenuService.createMenuOption(draft)

    expect(created.comboId).toBeTruthy()
    expect(created.isHidden).toBe(false)
    expect(created.name).toBe('Weekend Brunch')
  })

  /** 0 must survive the round trip — a complimentary combo is legitimate. */
  it('persists a price of 0', async () => {
    const created = await partnerMenuService.createMenuOption(draft)
    expect(created.pricePkr).toBe(0)
  })

  it('adds to the list', async () => {
    const before = mockMenuOptionCount()
    await partnerMenuService.createMenuOption(draft)

    expect(mockMenuOptionCount()).toBe(before + 1)
  })

  it('422s with per-field details the form can render', async () => {
    const error = await caught(partnerMenuService.createMenuOption({ ...draft, name: '' }))

    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
    const body = error.responseBody as { error: { details: { fields: Record<string, string> } } }
    expect(body.error.details.fields.name).toBeTruthy()
  })

  it('422s when a section asks for more items than it offers', async () => {
    const error = await caught(
      partnerMenuService.createMenuOption({
        ...draft,
        courses: [{ course: 'Starters', choose: 5, options: ['Soup'] }],
      }),
    )
    const body = error.responseBody as { error: { details: { fields: Record<string, string> } } }
    expect(body.error.details.fields['courses.0.choose']).toContain('choose more items')
  })
})

describe('updateMenuOption', () => {
  it('replaces name, price and every section', async () => {
    const updated = await partnerMenuService.updateMenuOption('c1', {
      name: 'Renamed',
      pricePkr: 210.5,
      courses: [{ course: 'Only Section', choose: 1, options: ['One'] }],
    })

    expect(updated.name).toBe('Renamed')
    expect(updated.pricePkr).toBe(210.5)
    // A full replace: the two seeded sections are gone, not merged.
    expect(updated.courses).toHaveLength(1)
    expect(updated.courses[0].course).toBe('Only Section')
  })

  it('sends the complete courses array', async () => {
    let body: unknown
    server.use(
      http.patch(`*${PARTNER_MENU_ENDPOINTS.menuOptionById(':comboId')}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { comboId: 'c1', ...draft, isHidden: false },
        })
      }),
    )

    await partnerMenuService.updateMenuOption('c1', draft)
    expect(body).toEqual(draft)
  })

  it('leaves the hidden flag alone — visibility has its own endpoint', async () => {
    const updated = await partnerMenuService.updateMenuOption('c2', draft)
    expect(updated.isHidden).toBe(true)
  })

  it('404s for a combo that is not the caller’s', async () => {
    const error = await caught(partnerMenuService.updateMenuOption('nope', draft))

    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })
})

describe('setMenuOptionVisibility', () => {
  /**
   * The asymmetry is deliberate and named in the spec: the request key is
   * `hidden`, the response key `isHidden`. Easy to get silently wrong, so it is
   * asserted on both sides.
   */
  it('sends `hidden` and reads back `isHidden`', async () => {
    let body: unknown
    server.use(
      http.patch(
        `*${PARTNER_MENU_ENDPOINTS.menuOptionVisibility(':comboId')}`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, data: { comboId: 'c1', isHidden: true } })
        },
      ),
    )

    const result = await partnerMenuService.setMenuOptionVisibility('c1', true)

    expect(body).toEqual({ hidden: true })
    expect(result.isHidden).toBe(true)
  })

  it('hides a visible combo', async () => {
    await expect(partnerMenuService.setMenuOptionVisibility('c1', true)).resolves.toEqual({
      comboId: 'c1',
      isHidden: true,
    })
    expect(mockMenuOption('c1')?.isHidden).toBe(true)
  })

  it('shows a hidden one again', async () => {
    await partnerMenuService.setMenuOptionVisibility('c2', false)
    expect(mockMenuOption('c2')?.isHidden).toBe(false)
  })

  /** Idempotent in both directions, so a double-tap needs no client guard. */
  it.each([
    ['already hidden', 'c2', true],
    ['already visible', 'c1', false],
  ] as const)('is a no-op success when %s', async (_label, comboId, hidden) => {
    await expect(
      partnerMenuService.setMenuOptionVisibility(comboId, hidden),
    ).resolves.toMatchObject({ isHidden: hidden })
  })

  it('404s for an unknown combo', async () => {
    expect((await caught(partnerMenuService.setMenuOptionVisibility('nope', true))).status).toBe(
      404,
    )
  })
})

describe('deleteMenuOption', () => {
  it('soft-deletes a combo so it leaves the list', async () => {
    await expect(partnerMenuService.deleteMenuOption('c1')).resolves.toEqual({
      comboId: 'c1',
      deleted: true,
    })
    expect(mockMenuOption('c1')).toBeUndefined()
  })

  /** The delete guard (BR-09). */
  it('409s while an upcoming interest table holds it, reporting the count', async () => {
    markComboInUse('c1', 2)

    const error = await caught(partnerMenuService.deleteMenuOption('c1'))

    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_MENU_OPTION_IN_USE')
    const body = error.responseBody as { error: { details: { upcomingTables: number } } }
    expect(body.error.details.upcomingTables).toBe(2)
    // Still there — a refused delete must not remove anything.
    expect(mockMenuOption('c1')).toBeDefined()
  })

  /** AC-05.3: deletable once every attached table has completed or cancelled. */
  it('succeeds once those tables have ended', async () => {
    markComboInUse('c1')
    await caught(partnerMenuService.deleteMenuOption('c1'))

    releaseCombo('c1')

    await expect(partnerMenuService.deleteMenuOption('c1')).resolves.toMatchObject({
      deleted: true,
    })
    expect(mockMenuOption('c1')).toBeUndefined()
  })

  it('404s for an unknown combo', async () => {
    expect((await caught(partnerMenuService.deleteMenuOption('nope'))).status).toBe(404)
  })
})

/** All six writes, refused while the profile is under review (BR-10). */
describe('read-only while under review', () => {
  beforeEach(() => {
    setMockProfileStatus('PENDING')
  })

  it.each([
    ['the PDF upload target', () => partnerMenuService.menuPdfUploadTarget('menu.pdf')],
    ['the PDF commit', () => partnerMenuService.commitMenuPdf('ref-1')],
    ['the PDF delete', () => partnerMenuService.deleteMenuPdf()],
    ['create', () => partnerMenuService.createMenuOption(draft)],
    ['edit', () => partnerMenuService.updateMenuOption('c1', draft)],
    ['visibility', () => partnerMenuService.setMenuOptionVisibility('c1', true)],
    ['delete', () => partnerMenuService.deleteMenuOption('c1')],
  ])('refuses %s with ERR_PROFILE_READ_ONLY', async (_label, call) => {
    const error = await caught(call())

    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_PROFILE_READ_ONLY')
  })

  /** Both reads still work; only the writes are refused. */
  it('still allows both reads', async () => {
    await expect(partnerMenuService.getMenuPdf()).resolves.toBeDefined()
    const { items } = await partnerMenuService.listMenuOptions()
    expect(items.length).toBeGreaterThan(0)
  })

  it('changes nothing', async () => {
    const before = mockMenuOptionCount()
    await caught(partnerMenuService.deleteMenuOption('c1'))

    expect(mockMenuOptionCount()).toBe(before)
    expect(mockMenuOption('c1')?.isHidden).toBe(false)
  })
})
