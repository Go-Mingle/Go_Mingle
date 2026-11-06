import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_PROFILE_ENDPOINTS } from '../../constants'
import type { PartnerContact } from '../../types'
import { useProfileContacts } from '../useProfileContacts'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()

function renderContacts(editable = true) {
  const queryClient = makeQueryClient()
  const view = renderHook(
    () => useProfileContacts(editable, { showSuccess, showError, showErrorText }),
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    },
  )
  return { ...view, queryClient }
}

/** Resolves once the initial contacts list has landed. */
async function renderLoaded(editable = true) {
  const view = renderContacts(editable)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

function contactNamed(contacts: PartnerContact[], name: string): PartnerContact {
  const found = contacts.find((contact) => contact.name === name)
  if (!found) throw new Error(`no seeded contact named ${name}`)
  return found
}

beforeEach(() => {
  resetMockProfile()
  showSuccess.mockClear()
  showError.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useProfileContacts loading', () => {
  it('loads the seeded contacts', async () => {
    const { result } = await renderLoaded()
    expect(result.current.contacts.length).toBeGreaterThan(0)
    expect(result.current.isError).toBe(false)
  })

  it('surfaces a failed list as an error state rather than an empty table', async () => {
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderContacts()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.contacts).toEqual([])
  })

  it('defaults to name ascending', async () => {
    const { result } = await renderLoaded()
    expect(result.current.sortBy).toBe('name')
    expect(result.current.sortOrder).toBe('asc')
  })
})

describe('useProfileContacts sorting', () => {
  it('flips the direction when the active column is clicked again', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySort('name'))
    expect(result.current.sortOrder).toBe('desc')
    act(() => result.current.applySort('name'))
    expect(result.current.sortOrder).toBe('asc')
  })

  /** A new column starts ascending rather than inheriting the previous direction. */
  it('resets to ascending on a new column', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySort('name'))
    expect(result.current.sortOrder).toBe('desc')

    act(() => result.current.applySort('email'))
    expect(result.current.sortBy).toBe('email')
    expect(result.current.sortOrder).toBe('asc')
  })

  it('actually re-queries with the new params', async () => {
    const seen: string[] = []
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    const { result } = await renderLoaded()
    act(() => result.current.applySort('phone'))
    await waitFor(() => {
      expect(seen.some((search) => search.includes('sortBy=phone'))).toBe(true)
    })
  })
})

describe('useProfileContacts search', () => {
  it('sends the term with its field', async () => {
    const seen: string[] = []
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('name', 'osama'))
    await waitFor(() => {
      expect(seen.some((s) => s.includes('searchField=name') && s.includes('search=osama'))).toBe(
        true,
      )
    })
  })

  /** Clearing the box must clear the field too, or the server 422s on a field with no term. */
  it('clears both halves together', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('name', 'osama'))
    expect(result.current.search).toBe('osama')

    act(() => result.current.applySearch(undefined, ''))
    expect(result.current.searchField).toBeUndefined()
    expect(result.current.search).toBe('')
  })
})

describe('useProfileContacts form', () => {
  it('opens blank for a new contact', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    expect(result.current.formOpen).toBe(true)
    expect(result.current.editing).toBeNull()
    expect(result.current.form).toEqual({ name: '', title: '', email: '', phone: '' })
  })

  it('prefills from the row being edited, mapping nulls to empty strings', async () => {
    const { result } = await renderLoaded()
    const contact: PartnerContact = {
      id: 'ct-x',
      name: 'Laiba Hassan',
      title: null,
      email: null,
      phone: null,
    }
    act(() => result.current.openEdit(contact))
    expect(result.current.editing).toBe(contact)
    expect(result.current.form).toEqual({ name: 'Laiba Hassan', title: '', email: '', phone: '' })
  })

  it('clears the previous edit when reopening for an add', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openEdit(contactNamed(result.current.contacts, 'Osama Khalil')))
    act(() => result.current.openAdd())
    expect(result.current.editing).toBeNull()
    expect(result.current.form.name).toBe('')
  })

  it('closes without clearing, so a reopen is not a surprise', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.closeForm())
    expect(result.current.formOpen).toBe(false)
  })

  it.each([
    ['empty', '', false],
    ['whitespace only', '   ', false],
    ['a single character', 'A', true],
    ['exactly the 100-char limit', 'x'.repeat(100), true],
    ['one over the limit', 'x'.repeat(101), false],
  ])('treats %s as valid=%s', async (_label, name, valid) => {
    const { result } = await renderLoaded()
    act(() => result.current.setForm({ name, title: '', email: '', phone: '' }))
    act(() => result.current.submitForm())

    // Validation runs on submit, so the verdict is the inline error's absence.
    expect(result.current.errors.name === undefined).toBe(valid)
  })

  it('refuses to submit an invalid name, inline rather than as a toast', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.submitForm())

    expect(result.current.errors.name).toBeTruthy()
    expect(result.current.blocked).toBe(true)
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  it('validates the optional phone and email inline', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.setForm({ name: 'Osama', title: '', email: 'nope', phone: '123' }))
    act(() => result.current.submitForm())

    expect(result.current.errors.email).toBeTruthy()
    expect(result.current.errors.phone).toBeTruthy()
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('clears the errors as soon as the form is edited', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.submitForm())
    expect(result.current.blocked).toBe(true)

    act(() => result.current.setForm({ name: 'Osama', title: '', email: '', phone: '' }))

    expect(result.current.blocked).toBe(false)
  })
})

/**
 * BR-15: the last contact cannot be deleted. The server refuses it with
 * `ERR_LAST_CONTACT`; this stops the partner reaching for the control at all.
 */
describe('useProfileContacts — the last-contact guard', () => {
  it('allows deletion while more than one contact remains', async () => {
    const { result } = await renderLoaded()

    expect(result.current.contacts.length).toBeGreaterThan(1)
    expect(result.current.canDelete).toBe(true)
  })

  it('withholds deletion on the last one', async () => {
    const { result } = await renderLoaded()

    // Remove all but one, then re-read.
    act(() => result.current.requestDelete(result.current.contacts[0]))
    act(() => result.current.confirmDelete())
    await waitFor(() => {
      expect(result.current.contacts).toHaveLength(1)
    })

    expect(result.current.canDelete).toBe(false)
  })

  it('still reports the server guard if it is somehow reached', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.requestDelete(result.current.contacts[0]))
    act(() => result.current.confirmDelete())
    await waitFor(() => {
      expect(result.current.contacts).toHaveLength(1)
    })

    showError.mockClear()
    act(() => result.current.requestDelete(result.current.contacts[0]))
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(result.current.contacts).toHaveLength(1)
  })
})

describe('useProfileContacts create', () => {
  it('omits the blank optional fields instead of sending empty strings', async () => {
    let body: unknown
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { id: 'ct-new', name: 'Laiba Hassan' } })
      }),
    )
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.setForm({ name: '  Laiba Hassan  ', title: '', email: '', phone: '' }))
    act(() => result.current.submitForm())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(body).toEqual({ name: 'Laiba Hassan' })
  })

  /**
   * Typed however the partner likes; stored compact. Separators are stripped and a
   * leading `+` kept — the country code is never inferred, since guessing one
   * would silently rewrite a foreign number.
   */
  /** Display spacing is stripped; the API only accepts compact E.164. */
  it.each([
    ['+92 300 123 4567', '+923001234567'],
    ['+92 (300) 123-4567', '+923001234567'],
  ])('normalises %s to %s before sending', async (typed, sent) => {
    let body: { phone?: string } | undefined
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, async ({ request }) => {
        body = (await request.json()) as { phone?: string }
        return HttpResponse.json({ success: true, data: { id: 'ct-new', name: 'Laiba' } })
      }),
    )
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.setForm({ name: 'Laiba', title: 'GM', email: 'l@a.pk', phone: typed }))
    act(() => result.current.submitForm())

    await waitFor(() => {
      expect(body?.phone).toBe(sent)
    })
  })

  /**
   * Stripping the formatting is not enough to make a number valid: without a
   * country code it fails the backend's `/^\+[1-9]\d{7,14}$/`, so it is refused
   * inline rather than sent to earn a 422.
   */
  it('refuses a local number with no country code, without sending it', async () => {
    let called = false
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, () => {
        called = true
        return HttpResponse.json({ success: true, data: { id: 'ct-new', name: 'Laiba' } })
      }),
    )
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() =>
      result.current.setForm({ name: 'Laiba', title: '', email: '', phone: '(050) 123-4567' }),
    )
    act(() => result.current.submitForm())

    expect(result.current.errors.phone).toBeTruthy()
    expect(called).toBe(false)
  })

  it('closes the form on success', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    act(() => result.current.setForm({ name: 'Laiba Hassan', title: '', email: '', phone: '' }))
    act(() => result.current.submitForm())

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(showError).not.toHaveBeenCalled()
  })

  it('reports the failure and keeps the form open so the input is not lost', async () => {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.contacts}`, () =>
        HttpResponse.json(
          { error: { code: 'ERR_VALIDATION', message: 'Bad email.' } },
          { status: 422 },
        ),
      ),
    )
    const { result } = await renderLoaded()
    act(() => result.current.openAdd())
    // Client-valid on purpose: the point is what a *server* 422 does, and an
    // invalid email would now be caught inline without a request.
    act(() =>
      result.current.setForm({ name: 'Laiba', title: '', email: 'laiba@aurelia.pk', phone: '' }),
    )
    act(() => result.current.submitForm())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(result.current.formOpen).toBe(true)
  })
})

describe('useProfileContacts update', () => {
  it('PATCHes the edited row by id', async () => {
    let seenId = ''
    server.use(
      http.patch(`*${PARTNER_PROFILE_ENDPOINTS.contacts}/:id`, ({ params }) => {
        seenId = String(params.id)
        return HttpResponse.json({ success: true, data: { id: seenId, name: 'Osama K' } })
      }),
    )
    const { result } = await renderLoaded()
    const target = contactNamed(result.current.contacts, 'Osama Khalil')
    act(() => result.current.openEdit(target))
    act(() => result.current.setForm({ ...result.current.form, name: 'Osama K' }))
    act(() => result.current.submitForm())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seenId).toBe(target.id)
  })

  it('reports a refused edit', async () => {
    server.use(
      http.patch(`*${PARTNER_PROFILE_ENDPOINTS.contacts}/:id`, () =>
        HttpResponse.json(
          { error: { code: 'ERR_PROFILE_READ_ONLY', message: 'Under review.' } },
          { status: 409 },
        ),
      ),
    )
    const { result } = await renderLoaded()
    act(() => result.current.openEdit(contactNamed(result.current.contacts, 'Osama Khalil')))
    act(() => result.current.submitForm())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(showSuccess).not.toHaveBeenCalled()
  })
})

describe('useProfileContacts delete', () => {
  it('asks for confirmation before deleting', async () => {
    const { result } = await renderLoaded()
    const target = contactNamed(result.current.contacts, 'Osama Khalil')
    act(() => result.current.requestDelete(target))
    expect(result.current.deleteTarget).toBe(target)
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('does nothing when confirmed with no target', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.confirmDelete())
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  it('drops the target on cancel', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.requestDelete(contactNamed(result.current.contacts, 'Osama Khalil')))
    act(() => result.current.cancelDelete())
    expect(result.current.deleteTarget).toBeNull()
  })

  it('deletes and clears the confirmation', async () => {
    const { result } = await renderLoaded()
    const before = result.current.contacts.length
    act(() => result.current.requestDelete(contactNamed(result.current.contacts, 'Osama Khalil')))
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(result.current.deleteTarget).toBeNull()
    await waitFor(() => {
      expect(result.current.contacts).toHaveLength(before - 1)
    })
  })

  /**
   * The last-contact guard is a business rule, not a transport failure — it still
   * has to surface, and the modal still has to close rather than hang.
   */
  it('reports the last-contact refusal and closes the confirmation', async () => {
    server.use(
      http.delete(`*${PARTNER_PROFILE_ENDPOINTS.contacts}/:id`, () =>
        HttpResponse.json(
          { error: { code: 'ERR_LAST_CONTACT', message: 'At least one contact is required.' } },
          { status: 409 },
        ),
      ),
    )
    const { result } = await renderLoaded()
    act(() => result.current.requestDelete(contactNamed(result.current.contacts, 'Osama Khalil')))
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(result.current.deleteTarget).toBeNull()
    expect(showSuccess).not.toHaveBeenCalled()
  })
})

describe('useProfileContacts read-only', () => {
  /** PENDING refuses every write server-side (BR-03); the flag mirrors that. */
  it('passes the read-only flag straight through', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)
    expect(result.current.editable).toBe(false)
    expect(result.current.contacts.length).toBeGreaterThan(0)
  })
})
