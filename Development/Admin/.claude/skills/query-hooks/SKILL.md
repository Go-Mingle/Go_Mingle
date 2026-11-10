---
name: query-hooks
description: Enforces React Query v5 hook isolation for the GoMingle Admin Portal. All useQuery and useMutation calls must live in src/<module>/hooks/ files — never inline in page or component files. Covers hook file naming, loading/error state rendering, mutation dual-callback pattern, and queryClient.invalidateQueries placement. Activate when writing or reviewing any file that fetches server data.
---

# Query Hooks Pattern

All server state in the GoMingle Admin Portal is managed through **React Query v5**. This skill enforces where and how `useQuery` and `useMutation` are called.

## The hard rule

> `useQuery`, `useMutation`, and `useQueryClient` must **never** appear in a page file or component file. They belong exclusively in `src/app/modules/<module>/hooks/` files.

This is required by the audit and by CLAUDE.md.

## When to activate

- Writing a new data-fetching feature
- Reviewing any `.tsx` file in `src/app/modules/`
- The user says "add fetch", "load data from API", or "wire up the API"
- A diff imports `useQuery` or `useMutation` outside a `hooks/` directory

## File naming convention

| Hook purpose         | File name                                                             |
| -------------------- | --------------------------------------------------------------------- |
| List query           | `use<Module>Query.ts`                                                 |
| Detail query (by id) | `use<Module>DetailQuery.ts`                                           |
| Create mutation      | `useCreate<Module>Mutation.ts` or co-located in `use<Module>Query.ts` |
| Update mutation      | `useUpdate<Module>Mutation.ts` or co-located                          |
| Delete mutation      | `useDelete<Module>Mutation.ts` or co-located                          |

Co-locating create/update/delete mutations in the same file as the list query is acceptable and preferred for small modules.

## Hook file template

```ts
// src/app/modules/restaurants/hooks/useRestaurantsQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { restaurantsService } from '../restaurantsService'

const QUERY_KEY = ['restaurants'] as const

export function useRestaurantsQuery() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => restaurantsService.getAll(),
  })
}

export function useCreateRestaurantMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRestaurantDto) => restaurantsService.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useUpdateRestaurantMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRestaurantDto }) =>
      restaurantsService.update(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useDeleteRestaurantMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restaurantsService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
```

## Page file template (after hooks are extracted)

```tsx
// src/app/modules/restaurants/RestaurantsPage.tsx
import { Spin, Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { useRestaurantsQuery, useDeleteRestaurantMutation } from './hooks/useRestaurantsQuery'

export function RestaurantsPage() {
  const { t } = useTranslation('restaurants')
  const { data: restaurants = [], isPending, isError } = useRestaurantsQuery()
  const deleteMutation = useDeleteRestaurantMutation()

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        void message.success(t('messages.deleted')) // toast in page
      },
    })
  }

  return <RestaurantsTable data={restaurants} onDelete={handleDelete} />
}
```

## Dual-callback pattern for mutations

The hook's `onSuccess` handles **cache invalidation**. The page's `mutate(data, { onSuccess })` callback handles **UI feedback** (toasts, modal close, form reset). Never do both in the same place.

```ts
// Hook — cache only
onSuccess: () => {
  void qc.invalidateQueries({ queryKey: QUERY_KEY })
}

// Page — UI only
mutation.mutate(payload, {
  onSuccess: () => {
    closeModal()
    void message.success(t('messages.created'))
  },
})
```

## Loading and error states

Every page that uses a query **must** render all three states:

```tsx
const { data = [], isPending, isError } = useXyzQuery()

if (isPending) return <Spin className="flex justify-center mt-20" />
if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

// happy path
return <XyzTable data={data} />
```

Never skip `isPending` or `isError` guards — missing them causes blank screens or unhandled exceptions on network failure.

## Detail queries with id param

```ts
export function useRestaurantDetailQuery(id: string) {
  return useQuery({
    queryKey: ['restaurants', id],
    queryFn: () => restaurantsService.getById(id),
    enabled: !!id, // required — id may be undefined on first render
  })
}
```

Always include `enabled: !!id` when the query key contains a route param.

## Violations checklist

Scan for these patterns in page and component files. All are **Blocking**:

| Pattern                                                  | Location it appears               | Fix                                                 |
| -------------------------------------------------------- | --------------------------------- | --------------------------------------------------- |
| `import { useQuery } from '@tanstack/react-query'`       | `*Page.tsx` or `components/*.tsx` | Move query to `hooks/` file                         |
| `import { useMutation } from '@tanstack/react-query'`    | `*Page.tsx` or `components/*.tsx` | Move mutation to `hooks/` file                      |
| `import { useQueryClient } from '@tanstack/react-query'` | `*Page.tsx` or `components/*.tsx` | Move `invalidateQueries` call to hook's `onSuccess` |
| `useQuery({` inline in a component                       | anywhere outside `hooks/`         | Extract to hook                                     |
| `useMutation({` inline in a component                    | anywhere outside `hooks/`         | Extract to hook                                     |
| Missing `if (isPending)` guard                           | page using a query hook           | Add before JSX return                               |
| Missing `if (isError)` guard                             | page using a query hook           | Add before JSX return                               |
| `queryClient.invalidateQueries` inside a page            | page file                         | Move to hook's `onSuccess`                          |

## Modules with confirmed hooks (as of audit fixes)

All 11 modules have hook files created. Pages still requiring inline-hook cleanup:

- `PreferenceQuestionsPage.tsx` — imports `useQuery`, `useMutation`, `useQueryClient` inline
- `RolesAccessPage.tsx` — imports `useQuery`, `useMutation`, `useQueryClient` inline
- `FinancesPage.tsx` — imports `useQuery` inline
- `MinglerDetailPage.tsx` — imports `useQuery` inline
- `RestaurantDetailPage.tsx` — imports `useQuery`, `useQueryClient` inline
- `AmenitiesPage.tsx` — imports `useQuery`, `useMutation`, `useQueryClient` inline

## Report format

```
BLOCKING — Inline React Query hooks detected
  AmenitiesPage.tsx:3   import { useQuery, useMutation, useQueryClient }
                        → remove; use useAmenitiesQuery from ./hooks/useAmenitiesQuery
  AmenitiesPage.tsx:132 useQuery({ queryKey: ['amenities'], ... }) inline in page
                        → replace with const { data, isPending, isError } = useAmenitiesQuery()
  AmenitiesPage.tsx:148 useMutation({ mutationFn: amenitiesService.create })
                        → replace with useCreateAmenityMutation() from hooks file

BLOCKING — Missing loading/error guards
  FinancesPage.tsx      no isPending / isError render guards after useFinancesQuery()
                        → add: if (isPending) return <Spin ...>; if (isError) return <Alert ...>
```
