import { describe, it, expect, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { server } from '../../../../../../mocks/server'
import { HttpError } from '../../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import { markTableInUse, resetMockTables } from '../../../../../../mocks/data/partnerTables'
import { PARTNER_TABLES_ENDPOINTS, PARTNER_TABLES_QUERY_KEY } from '../../constants'
import { emptyAvailability } from '../../format'
import {
  useCreateTableMutation,
  useDeleteTableMutation,
  useSetTableVisibilityMutation,
  useTablesQuery,
  useUpdateTableMutation,
} from '../usePartnerTablesQueries'
import type { TableDraft } from '../../types'

const LIST = PARTNER_TABLES_ENDPOINTS.tables

const draft: TableDraft = {
  name: 'Rooftop Deck',
  availability: { ...emptyAvailability(), '5': [{ start: '18:00', end: '23:00' }] },
}

function wrapperFor(queryClient = makeQueryClient()) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  }
}

beforeEach(() => {
  resetMockProfile()
  resetMockTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useTablesQuery', () => {
  it('reads the grid under the shared query key', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => useTablesQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.items).toHaveLength(4)
    expect(queryClient.getQueryData(PARTNER_TABLES_QUERY_KEY)).toBeDefined()
  })

  it('does not fire without a session', () => {
    tokenStore.clear()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useTablesQuery(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('still loads while the profile is PENDING, so the tab can render read-only', async () => {
    setMockProfileStatus('PENDING')
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useTablesQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.items).toHaveLength(4)
  })

  it('surfaces a load failure with its status intact', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useTablesQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('table mutations — cache invalidation', () => {
  /** Seeds the cache so a test can prove the write invalidated it. */
  function seeded() {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData(PARTNER_TABLES_QUERY_KEY, { items: [] })
    return { queryClient, wrapper }
  }

  const invalidated = (queryClient: ReturnType<typeof makeQueryClient>) =>
    queryClient.getQueryState(PARTNER_TABLES_QUERY_KEY)?.isInvalidated

  it('create invalidates the list', async () => {
    const { queryClient, wrapper } = seeded()
    const { result } = renderHook(() => useCreateTableMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(draft)
    })

    expect(invalidated(queryClient)).toBe(true)
  })

  it('update invalidates the list', async () => {
    const { queryClient, wrapper } = seeded()
    const { result } = renderHook(() => useUpdateTableMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ tableId: 't1', draft })
    })

    expect(invalidated(queryClient)).toBe(true)
  })

  /**
   * Visibility is the one write that does not refetch: J6E endpoint 4 answers with
   * `{ tableId, isHidden }`, the whole truth for the row that changed, so the
   * cached list is patched in place and the toggle costs no GET.
   */
  it('visibility patches the cached row without refetching', async () => {
    const { queryClient, wrapper } = wrapperFor()
    // A patch needs something to patch, unlike the invalidation cases above.
    queryClient.setQueryData(PARTNER_TABLES_QUERY_KEY, {
      items: [
        { tableId: 't1', name: 'Terrace', isHidden: false, availability: {} },
        { tableId: 't2', name: 'Window', isHidden: false, availability: {} },
      ],
    })
    const { result } = renderHook(() => useSetTableVisibilityMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ tableId: 't1', hidden: true })
    })

    expect(invalidated(queryClient)).toBe(false)
    const cached = queryClient.getQueryData<{ items: { tableId: string; isHidden: boolean }[] }>(
      PARTNER_TABLES_QUERY_KEY,
    )
    expect(cached?.items.find((item) => item.tableId === 't1')?.isHidden).toBe(true)
    // Only the one row moves.
    expect(cached?.items.filter((item) => item.isHidden)).toHaveLength(1)
  })

  it('delete invalidates the list', async () => {
    const { queryClient, wrapper } = seeded()
    const { result } = renderHook(() => useDeleteTableMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('t4')
    })

    expect(invalidated(queryClient)).toBe(true)
  })

  it('does not invalidate when the write failed', async () => {
    const { queryClient, wrapper } = seeded()
    const { result } = renderHook(() => useCreateTableMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ ...draft, name: 'Garden Patio' }).catch(() => undefined)
    })

    expect(invalidated(queryClient)).toBeFalsy()
  })
})

describe('table mutations — errors reach the caller', () => {
  it('create surfaces the duplicate name without ending the session', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useCreateTableMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ ...draft, name: 'Garden Patio' }).catch(() => undefined)
    })

    expect((result.current.error as HttpError).code).toBe('ERR_TABLE_NAME_DUPLICATE')
    // A 409 is about the payload, not the caller — the session must survive.
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('delete surfaces the in-use guard with its count', async () => {
    markTableInUse('t1', 2)
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useDeleteTableMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('t1').catch(() => undefined)
    })

    const error = result.current.error as HttpError
    expect(error.code).toBe('ERR_TABLE_IN_USE')
    expect(error.responseBody).toMatchObject({ error: { details: { upcomingTables: 2 } } })
  })

  it('every write is refused while PENDING', async () => {
    setMockProfileStatus('PENDING')
    const { wrapper } = wrapperFor()
    const { result } = renderHook(
      () => ({
        create: useCreateTableMutation(),
        update: useUpdateTableMutation(),
        visibility: useSetTableVisibilityMutation(),
        remove: useDeleteTableMutation(),
      }),
      { wrapper },
    )

    await act(async () => {
      await Promise.all([
        result.current.create.mutateAsync(draft).catch(() => undefined),
        result.current.update.mutateAsync({ tableId: 't1', draft }).catch(() => undefined),
        result.current.visibility
          .mutateAsync({ tableId: 't1', hidden: true })
          .catch(() => undefined),
        result.current.remove.mutateAsync('t1').catch(() => undefined),
      ])
    })
    ;[
      result.current.create.error,
      result.current.update.error,
      result.current.visibility.error,
      result.current.remove.error,
    ].forEach((error) => {
      expect((error as HttpError).code).toBe('ERR_PROFILE_READ_ONLY')
    })
  })

  it('visibility sends `hidden` and reads back `isHidden`', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useSetTableVisibilityMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ tableId: 't3', hidden: false })
    })

    expect(result.current.data).toEqual({ tableId: 't3', isHidden: false })
  })
})
