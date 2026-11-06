import { describe, it, expect } from 'vitest'
import {
  buildPlatformStatusStyle,
  buildVisibilityStyle,
  buildAppWithContacts,
} from '../appDetailHelpers'
import type { ApplicationDetail } from '../types'

const t = ((k: string) => k) as never

describe('buildPlatformStatusStyle', () => {
  it('maps each status (case-insensitive) to a label', () => {
    expect(buildPlatformStatusStyle('PENDING', t).label).toBe('card.pending')
    expect(buildPlatformStatusStyle('active', t).label).toBe('card.approved')
    expect(buildPlatformStatusStyle('REJECTED', t).label).toBe('card.rejected')
  })

  it('falls back to the raw status for unknown values', () => {
    expect(buildPlatformStatusStyle('WEIRD', t).label).toBe('WEIRD')
  })
})

describe('buildVisibilityStyle', () => {
  it('returns the visible style when visible on app', () => {
    expect(buildVisibilityStyle(true, t).label).toBe('detail.visibleOnApp')
  })
  it('returns the not-visible style otherwise', () => {
    expect(buildVisibilityStyle(false, t).label).toBe('detail.notVisibleOnApp')
  })
})

describe('buildAppWithContacts', () => {
  const base = {
    id: 'r1',
    name: 'Wax Wine',
    cuisine: 'Bar',
    owner: 'Farida',
    phone: '123',
    email: 'f@x.pk',
    city: 'Karachi',
    submitted: '01-01-2026',
    status: 'PENDING',
  } as unknown as ApplicationDetail

  it('synthesises contacts from owner data when none are present', () => {
    const result = buildAppWithContacts(base, base as unknown as Record<string, unknown>)
    const contacts = result.contacts as { name: string }[]
    expect(contacts[0].name).toBe('Farida')
    expect(contacts).toHaveLength(2)
  })

  it('preserves existing contacts', () => {
    const record = { contacts: [{ id: 'x', name: 'Existing', title: 'T', email: 'e', phone: 'p' }] }
    const result = buildAppWithContacts(base, record)
    expect((result.contacts as { name: string }[])[0].name).toBe('Existing')
  })
})
