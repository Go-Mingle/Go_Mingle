# React / TypeScript Frontend — Code Review Checklist

Walk each section against the changed files.

---

## 1 — Tooling, quality gates, and tests

- [ ] Lint: **0** errors and **0** warnings on touched code (`npm run lint`)
- [ ] Unit test coverage **≥ 90%** (lines, statements, functions, branches) for relevant modules
- [ ] New or changed behavior has tests in the **active sprint** (not deferred without reason)
- [ ] Code formatted with **Prettier** (repo / VS Code config — `npm run format`)
- [ ] **DRY**: no unnecessary duplication; duplication **≤ ~5%** per team threshold
- [ ] `npm run typecheck` passes with **0 errors**

## 2 — TypeScript and correctness

- [ ] **TypeScript only** — no new `.js`/`.jsx` files
- [ ] No `any`; use proper types, generics, or `unknown` + narrowing
- [ ] Types align with API contracts / shared types in `src/types/` or `src/<module>/types/`
- [ ] Hooks and effects have correct dependencies; no stale closures that break UX
- [ ] Loading, error, and empty states handled for every user-facing data fetch

## 3 — React Query v5

- [ ] `useQuery` and `useMutation` calls live in `src/<module>/hooks/` — **never inline in page or component files**
- [ ] Query keys include all variables the query depends on (e.g. `['restaurants', filters]`)
- [ ] `enabled` guard present when query depends on a param that may be undefined/null
- [ ] Mutations call `queryClient.invalidateQueries` after success — no stale reads after writes
- [ ] All three states rendered: `isPending` (loader), `isError` (error notice), `data` (content)
- [ ] Module `hooks/` directory is **not empty** if the module fetches data

## 4 — Redux Toolkit (RTK)

- [ ] **No mock/hardcoded data in `initialState`** — initial state must be empty/null/unauthenticated
- [ ] **No direct `localStorage` writes inside reducer functions** — storage side-effects belong outside reducers
- [ ] Selectors defined in the slice file and imported by components — no raw `state.slice.field` spread
- [ ] Slice state typed with a proper TypeScript interface — no `any` or `Record<string, unknown>`
- [ ] `notificationSlice.ts` — confirm no hardcoded notification objects in `initialState`

## 5 — API integration and mocking

- [ ] All API calls go through the **single shared client** in `utils/` (or project canonical module)
- [ ] **MSW v2** used for mocks — `http.*`, `HttpResponse` (never `rest.*`)
- [ ] New endpoints have a corresponding MSW handler in `src/mocks/handlers/`
- [ ] At least **one error path** (4xx or 5xx) mocked per critical route
- [ ] Fixture data lives in `src/mocks/data/` — not inlined in handler files

## 6 — Security and configuration

- [ ] No hardcoded secrets, API keys, or passwords — `import.meta.env.*` only
- [ ] Sensitive data not logged in production code paths
- [ ] Local/session storage **encrypted** in non-dev environments
- [ ] `PermissionGuard` — confirm it checks actual role, not stub that always passes
- [ ] Auth tokens not stored in plain `localStorage` — use encrypted/httpOnly approach

## 7 — UI, styling, and design system

- [ ] **No inline CSS** for layout/visuals; use **Tailwind** classes only
- [ ] Avoid `!important` unless documented exception
- [ ] **Phosphor Icons only** — no other icon libraries imported
- [ ] **Large components** split into smaller, focused components
- [ ] **Shared** repeated UI/logic moved to `src/shared/components/` or `src/shared/hooks/`
- [ ] **Responsive** behavior considered for common breakpoints
- [ ] **RTL/LTR** relies on Ant Design defaults; custom CSS does not break direction

## 8 — UX patterns

- [ ] **Centralized** app loader and **success/error notifications** — not ad hoc one-off toasts
- [ ] **Lazy loading** for routes (`React.lazy` + `Suspense`) where appropriate
- [ ] **Memoization** (`useMemo`, `useCallback`, `React.memo`) used where profiling justifies — not blanket everywhere

## 9 — Internationalization and data

- [ ] User-visible strings use **`t()`** (react-i18next), not raw string literals in JSX
- [ ] **Pagination, sorting, filtering** implemented **server-side** — FE sends params; not faking on client

## 10 — Folder structure

- [ ] Each module that fetches data has a non-empty `hooks/` directory
- [ ] Each module has a `__tests__/` directory with at least one test file
- [ ] Types declared in `src/<module>/types/` or `src/shared/types/` — not inline in component files
- [ ] Module-specific components stay in `src/<module>/components/` — only truly reusable ones go in `src/shared/components/`
- [ ] No circular dependencies introduced between modules

## 11 — Zustand (if introduced)

- [ ] Store file lives in `src/shared/stores/<name>.store.ts`
- [ ] Store wrapped with `devtools` middleware
- [ ] Does not duplicate state already managed by RTK slices
- [ ] Typed with a proper TypeScript interface — no `any`

## 12 — Observability

- [ ] Sentry (or error monitoring) captures unhandled errors in production paths
- [ ] Errors surface to users appropriately via centralized notification system

## 13 — Comments and maintainability

- [ ] **Comments** explain non-obvious **why**, not narrate obvious **what**
- [ ] Complex business rules or edge cases documented near the logic

## 14 — Architecture (light touch)

- [ ] Imports respect feature/shared split — no cross-module direct imports outside shared
- [ ] No circular dependencies introduced
- [ ] Branch/PR workflow: flag only if the change violates `main`-protection rules (no direct commits to `main`)
