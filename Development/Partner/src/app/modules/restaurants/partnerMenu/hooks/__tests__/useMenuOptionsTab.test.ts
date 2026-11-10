import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  markComboInUse,
  mockMenuOption,
  mockMenuOptionCount,
  releaseCombo,
  resetMockMenu,
} from '../../../../../../mocks/data/partnerMenu'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MENU_ENDPOINTS } from '../../constants'
import { useMenuOptionsTab } from '../useMenuOptionsTab'
import type { MenuOption } from '../../types'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

function renderTab(editable = true) {
  const queryClient = makeQueryClient()
  const view = renderHook(() => useMenuOptionsTab(editable, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

async function renderLoaded(editable = true) {
  const view = renderTab(editable)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

const find = (list: MenuOption[], name: string): MenuOption => {
  const found = list.find((item) => item.name === name)
  if (!found) throw new Error(`no seeded combo named ${name}`)
  return found
}

/** Writes only — the list read fires on mount and is not what these assert. */
function trackWrites() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET' && request.url.includes('/restaurant/menu-options')) {
      seen.push(`${request.method} ${new URL(request.url).pathname}`)
    }
  })
  return () => seen
}

/** Fills the modal with a client-valid combo. */
function fillValid(current: ReturnType<typeof useMenuOptionsTab>, name = 'Weekend Brunch') {
  act(() => {
    current.setName(name)
  })
  act(() => {
    current.setPrice(0)
  })
  act(() => {
    current.patchSection(0, { course: 'Starters', choose: 1, options: ['Soup', 'Salad'] })
  })
}

beforeEach(() => {
  resetMockProfile()
  resetMockMenu()
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  server.events.removeAllListeners()
})

describe('useMenuOptionsTab — loading', () => {
  it('loads the combos with their courses', async () => {
    const { result } = await renderLoaded()

    expect(result.current.options.length).toBeGreaterThan(0)
    expect(find(result.current.options, 'Signature Levantine').courses).toHaveLength(2)
    expect(result.current.isError).toBe(false)
  })

  /** Hidden combos are badged, never filtered out (AC-02.2). */
  it('keeps hidden combos in the list', async () => {
    const { result } = await renderLoaded()

    expect(find(result.current.options, 'Seafood Set').isHidden).toBe(true)
  })

  it('surfaces a failed read as an error state, not an empty grid', async () => {
    server.use(
      http.get(`*${PARTNER_MENU_ENDPOINTS.menuOptions}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderTab()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.options).toEqual([])
  })
})

describe('useMenuOptionsTab — the add modal', () => {
  /**
   * One empty section, not the prototype's three pre-named ones: every section
   * now needs at least one item, so three empties would open the modal already
   * carrying three errors.
   */
  it('opens with a single empty section', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })

    expect(result.current.formOpen).toBe(true)
    expect(result.current.editing).toBeNull()
    expect(result.current.draft).toEqual({
      name: '',
      pricePkr: 0,
      courses: [{ course: '', choose: 1, options: [] }],
    })
  })

  it('creates the combo and closes on save', async () => {
    const before = mockMenuOptionCount()
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    fillValid(result.current)
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option added.')
    expect(mockMenuOptionCount()).toBe(before + 1)
  })

  it('shows the new combo in the grid', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    fillValid(result.current)
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.options.some((item) => item.name === 'Weekend Brunch')).toBe(true)
    })
  })

  /** A complimentary combo is legitimate; 0 must not read as "no price given". */
  it('saves a price of 0', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    fillValid(result.current)
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(find(result.current.options, 'Weekend Brunch').pricePkr).toBe(0)
  })

  it('trims the name and the section fields before sending', async () => {
    let body: unknown
    server.use(
      http.post(`*${PARTNER_MENU_ENDPOINTS.menuOptions}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            success: true,
            data: { comboId: 'c-x', isHidden: false, name: 'x', pricePkr: 0, courses: [] },
          },
          { status: 201 },
        )
      }),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('  Weekend Brunch  ')
    })
    act(() => {
      result.current.patchSection(0, { course: '  Starters  ', choose: 1, options: [' Soup ', ''] })
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(body).toBeDefined()
    })
    expect(body).toEqual({
      name: 'Weekend Brunch',
      pricePkr: 0,
      // The blank item is dropped rather than sent as an empty option.
      courses: [{ course: 'Starters', choose: 1, options: ['Soup'] }],
    })
  })
})

describe('useMenuOptionsTab — validation', () => {
  /** The seven documented rules never cost a round trip. */
  it('reports a client-side failure inline and sends nothing', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.submit()
    })

    expect(result.current.errors.name).toBeTruthy()
    expect(result.current.errors.sections?.[0]?.options).toBeTruthy()
    expect(result.current.formOpen).toBe(true)
    expect(writes()).toEqual([])
  })

  it('reports choosing more items than the section offers', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Brunch')
    })
    act(() => {
      result.current.patchSection(0, { course: 'Starters', choose: 3, options: ['Soup'] })
    })
    act(() => {
      result.current.submit()
    })

    expect(result.current.errors.sections?.[0]?.choose).toBe(
      "You can't ask diners to choose more items than the section offers.",
    )
  })

  it('clears the inline errors once the combo is valid', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.submit()
    })
    expect(result.current.errors.name).toBeTruthy()

    fillValid(result.current)
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(result.current.errors).toEqual({})
  })

  /**
   * The form mirrors every documented rule, so a 422 means client/server drift.
   * It still has to point at the offending input — a toast alone would leave the
   * partner hunting.
   */
  it('maps a server 422 onto inline errors as well as a toast', async () => {
    server.use(
      http.post(`*${PARTNER_MENU_ENDPOINTS.menuOptions}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_VALIDATION',
              message: 'Please correct the highlighted fields.',
              details: {
                fields: {
                  name: 'That name is already taken.',
                  'courses.0.options': 'Soup is not available.',
                },
              },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    fillValid(result.current)
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.errors.name).toBe('That name is already taken.')
    })
    expect(result.current.errors.sections?.[0]?.options).toBe('Soup is not available.')
    expect(showErrorText).toHaveBeenCalledWith('Please correct the highlighted fields.')
    // Left open so the partner can fix it without retyping.
    expect(result.current.formOpen).toBe(true)
  })
})

describe('useMenuOptionsTab — the edit modal', () => {
  it('opens pre-filled from the combo', async () => {
    const { result } = await renderLoaded()
    const target = find(result.current.options, 'Signature Levantine')

    act(() => {
      result.current.openEdit(target)
    })

    expect(result.current.editing?.comboId).toBe(target.comboId)
    expect(result.current.draft.name).toBe('Signature Levantine')
    expect(result.current.draft.pricePkr).toBe(180)
    expect(result.current.draft.courses).toHaveLength(2)
  })

  /** Deep-copied, so an abandoned edit cannot corrupt the cached list. */
  it('does not mutate the cached combo while editing', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openEdit(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.patchSection(0, { course: 'Changed', options: ['Only'] })
    })

    expect(find(result.current.options, 'Signature Levantine').courses[0].course).toBe(
      'Main Course',
    )
  })

  it('saves the edit', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openEdit(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.setName('Renamed Set')
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option updated.')
    await waitFor(() => {
      expect(result.current.options.some((item) => item.name === 'Renamed Set')).toBe(true)
    })
  })

  /** PATCH is a full replace: a removed section is genuinely gone. */
  it('sends the whole section list, so removing one deletes it', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openEdit(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.removeSection(1)
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(find(result.current.options, 'Signature Levantine').courses).toHaveLength(1)
  })

  it('adds a section', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.addSection()
    })

    expect(result.current.draft.courses).toHaveLength(2)
  })

  it('discards the draft when the modal is cancelled', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openEdit(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.setName('Abandoned')
    })
    act(() => {
      result.current.closeForm()
    })

    expect(result.current.formOpen).toBe(false)
    expect(find(result.current.options, 'Signature Levantine').name).toBe('Signature Levantine')
  })

  it('reports a failed save without closing the modal', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.openEdit(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith(
        "Your application is under review and can't be edited right now.",
      )
    })
    expect(result.current.formOpen).toBe(true)
  })
})

describe('useMenuOptionsTab — hide and show (US-04)', () => {
  it('hides a visible combo once confirmed', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.options, 'Signature Levantine'))
    })
    expect(result.current.visibilityTarget?.name).toBe('Signature Levantine')

    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(find(result.current.options, 'Signature Levantine').isHidden).toBe(true)
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option hidden from diners.')
    expect(result.current.visibilityTarget).toBeNull()
  })

  /**
   * The toggle used to refetch the whole list after the PATCH. J6D endpoint 8
   * answers with `{ comboId, isHidden }` — the whole truth for the row that
   * changed — so the cache is patched instead and the toggle costs no GET.
   */
  it('costs no follow-up read', async () => {
    // Counted through MSW's own events so the seeded handler keeps answering.
    let reads = 0
    const count = ({ request }: { request: Request }) => {
      if (request.method === 'GET' && request.url.includes('/menu-options')) reads += 1
    }
    server.events.on('request:start', count)
    const { result } = await renderLoaded()
    const before = reads

    act(() => {
      result.current.requestVisibility(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(find(result.current.options, 'Signature Levantine').isHidden).toBe(true)
    })
    expect(reads).toBe(before)
    server.events.removeListener('request:start', count)
  })

  it('shows a hidden combo again', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.options, 'Seafood Set'))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(find(result.current.options, 'Seafood Set').isHidden).toBe(false)
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option shown to diners again.')
  })

  /** Nothing changes until the dialog is accepted (BR-08). */
  it('changes nothing when the confirmation is dismissed', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.cancelVisibility()
    })

    expect(result.current.visibilityTarget).toBeNull()
    expect(mockMenuOption('c1')?.isHidden).toBe(false)
  })

  it('reports a refused toggle and closes the dialog', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.requestVisibility(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.visibilityTarget).toBeNull()
    expect(mockMenuOption('c1')?.isHidden).toBe(false)
  })

  it('does nothing when confirmed with no target', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmVisibility()
    })

    expect(writes()).toEqual([])
  })
})

describe('useMenuOptionsTab — delete (US-05)', () => {
  it('removes the combo once confirmed', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    expect(result.current.deleteTarget?.name).toBe('Signature Levantine')

    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.options.some((item) => item.name === 'Signature Levantine')).toBe(false)
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option removed.')
    expect(result.current.deleteTarget).toBeNull()
  })

  it('deletes nothing when the confirmation is dismissed', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.cancelDelete()
    })

    expect(result.current.deleteTarget).toBeNull()
    expect(mockMenuOption('c1')).toBeDefined()
  })

  it('does nothing when confirmed with no target', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmDelete()
    })

    expect(writes()).toEqual([])
  })

  it('reports an ordinary failure as a toast, with no blocked dialog', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.blocked).toBeNull()
  })
})

describe('useMenuOptionsTab — the delete guard (BR-09)', () => {
  it('opens the blocked dialog carrying the upcoming-table count', async () => {
    markComboInUse('c1', 2)
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })
    expect(result.current.blocked?.option.comboId).toBe('c1')
    expect(result.current.blocked?.upcomingTables).toBe(2)
    // The delete confirmation gives way to the blocked one.
    expect(result.current.deleteTarget).toBeNull()
    // And nothing was removed.
    expect(mockMenuOption('c1')).toBeDefined()
  })

  it('raises no toast — the dialog carries the message', async () => {
    markComboInUse('c1')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })
    expect(showErrorText).not.toHaveBeenCalled()
  })

  /**
   * The escape hatch BR-09 intends, and the reason the dialog offers an action
   * rather than only an explanation: one click hides the combo.
   */
  it('hides the combo straight from the dialog', async () => {
    markComboInUse('c1')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    act(() => {
      result.current.hideFromBlocked()
    })

    await waitFor(() => {
      expect(mockMenuOption('c1')?.isHidden).toBe(true)
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option hidden from diners.')
    expect(result.current.blocked).toBeNull()
    // Hidden, not deleted — it is still on the interest tables holding it.
    expect(mockMenuOption('c1')).toBeDefined()
  })

  it('leaves the combo visible when the dialog is dismissed', async () => {
    markComboInUse('c1')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    act(() => {
      result.current.dismissBlocked()
    })

    expect(result.current.blocked).toBeNull()
    expect(mockMenuOption('c1')?.isHidden).toBe(false)
  })

  it('does nothing when the hide action fires with no blocked combo', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.hideFromBlocked()
    })

    expect(writes()).toEqual([])
  })

  it('reports a failure from the hide action', async () => {
    markComboInUse('c1')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    server.use(
      http.patch(`*${PARTNER_MENU_ENDPOINTS.menuOptionVisibility(':comboId')}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Something went wrong.' } },
          { status: 500 },
        ),
      ),
    )
    act(() => {
      result.current.hideFromBlocked()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith('Something went wrong.')
    })
    expect(result.current.blocked).toBeNull()
  })

  /** AC-05.3: deletable once every attached table has completed or cancelled. */
  it('deletes once the upcoming tables have ended', async () => {
    markComboInUse('c1')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })
    act(() => {
      result.current.dismissBlocked()
    })

    releaseCombo('c1')

    act(() => {
      result.current.requestDelete(find(result.current.options, 'Signature Levantine'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(mockMenuOption('c1')).toBeUndefined()
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu option removed.')
  })
})

describe('useMenuOptionsTab — read-only (BR-10)', () => {
  it('passes the flag through so the controls can be withheld', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    expect(result.current.editable).toBe(false)
    // The grid still renders; only the writes are refused.
    expect(result.current.options.length).toBeGreaterThan(0)
  })
})
