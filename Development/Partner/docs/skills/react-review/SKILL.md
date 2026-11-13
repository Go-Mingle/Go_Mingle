---
name: review-reactjs-code
description: >
  File or module-level checklist review for React/TypeScript. Walks lint, coverage ≥ 90%, DRY,
  Prettier, no `any`, shared HTTP client, MSW mocking, Tailwind-only styling, `t()` i18n,
  React Query v5 custom-hook pattern, RTK slice quality, Zustand conventions, and folder
  structure. Produces a Blocking / Warnings / Suggestions report.

  SCOPE: a specific component, hook, page, or module. NOT for full PR or feature-branch review
  — use `code-reviewer` for that (it runs this checklist as a sub-step).

  Trigger: user says "review this component / hook / file", "check this page", "audit this
  module", or points at one or more specific src/ files without asking for a full PR review.
---

# Review React / TypeScript Frontend Code

Perform systematic reviews of React changes using the competency checklist and concrete examples.

## When to apply

- User points at one or more specific files/modules and asks for a review ("review this hook", "check UsersPage", "audit the amenities module")
- Does **not** trigger on "review my PR", "review this branch", "review the whole feature" — those go to `code-reviewer`
- Full codebase audit: combine with `docs/audit/SKILL.md` as the orchestrator

## Review workflow

### Step 1 — Confirm scope

- Apply this checklist to React/TS/UI/API-client/MSW files.
- If scope is unclear, ask: _"Should I review a specific module, a PR diff, or the whole codebase?"_

### Step 2 — Gather the code

| Scenario       | Action                  |
| -------------- | ----------------------- |
| Staged         | `git diff --staged`     |
| Working tree   | `git diff`              |
| Branch vs main | `git diff main...HEAD`  |
| Specific paths | Read those files        |
| Full audit     | Walk all `src/` modules |

### Step 3 — Automated signals

Run project scripts when available:

```bash
npm run lint          # must be 0 errors, 0 warnings
npm run typecheck     # must pass clean
npm run test:coverage # target ≥ 90%
```

Summarize pass/fail in the review.

### Step 4 — Checklist pass

Walk [checklist.md](checklist.md) against changed files. Note gaps with file/line when possible.

### Step 5 — Report

Use the output template in [examples.md](examples.md). Prefer **Blocking** / **Warnings** / **Suggestions** with category tags:

**Correctness**, **Security**, **TypeScript**, **Testing**, **DRY**, **API client**, **MSW**, **i18n**, **Styling**, **Performance**, **Observability**, **Architecture**, **React Query**, **RTK**, **Zustand**, **Folder Structure**

## Quick reference: competency rules

| Area        | Expectation                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Lint        | 0 errors and 0 warnings                                                                                      |
| Unit tests  | Coverage **≥ 90%** (lines, statements, functions, branches); tests written in the same sprint as the feature |
| Duplication | DRY; duplication **not more than ~5%**                                                                       |
| Formatting  | Prettier (VS Code + repo config)                                                                             |
| Language    | TypeScript only; **no `any`**                                                                                |
| API calls   | Single shared HTTP client function in `utils`                                                                |
| Mocking     | MSW v2 (`http.*`, `HttpResponse`) — see `docs/skills/msw/SKILL.md`                                           |
| Styling     | Tailwind classes only; no inline CSS; no `!important`                                                        |
| i18n        | Static UI strings wrapped in `t()`                                                                           |
| Data lists  | Pagination, sorting, filtering on the **server**                                                             |
| Secrets     | No hardcoded secrets; use `import.meta.env.*`                                                                |
| Storage     | Local storage **encrypted** outside non-dev environments                                                     |
| UX          | App-wide loader + success/error notifications centralized; lazy load routes; memoize where justified         |

## React Query v5 patterns

React Query is used for all server state. Key rules:

- **Custom hooks only** — `useQuery` and `useMutation` must live in `src/<module>/hooks/` (e.g. `useRestaurants.ts`), never called inline inside page or component files
- Query key factory pattern: `['restaurants', filters]` — include all variables the query depends on
- `enabled` guard required whenever a query depends on a param that may be undefined
- Mutations must call `queryClient.invalidateQueries` after success — never stale-read after write
- `isPending` / `isError` / `data` destructured and all three states rendered

```ts
// Correct pattern
export function useRestaurants(filters: RestaurantFilters) {
  return useQuery({
    queryKey: ['restaurants', filters],
    queryFn: () => apiClient.get<RestaurantsResponse>('/restaurants', { params: filters }),
  });
}

// Wrong — never do this in a page component
const { data } = useQuery({ queryKey: ['restaurants'], queryFn: ... });
```

## Redux Toolkit (RTK) rules

RTK manages global UI state (auth, notifications, ui slices). Key rules:

- **No mock data in `initialState`** — `initialState` must reflect the real empty/unauthenticated state
- **No direct `localStorage` writes inside reducers** — use `extraReducers` with middleware or call storage helpers outside the reducer
- Selectors must be defined in the slice file and imported — no inline `state.auth.token` spread throughout components
- Slice state must be typed with a proper interface — no `any` or `Record<string, unknown>`

## Zustand conventions

Zustand is declared as a dependency but currently has zero stores. If introduced:

- Must follow slice pattern with `devtools` middleware wrapping the store
- Store file lives in `src/shared/stores/<name>.store.ts`
- Never duplicate state that already lives in RTK slices

## Folder structure rules

Expected structure per module:

```
src/
├── <module>/
│   ├── components/    # module-specific components
│   ├── hooks/         # React Query hooks (must not be empty for modules using queries)
│   ├── pages/         # page-level components
│   ├── types/         # module-specific types
│   └── __tests__/     # unit tests
└── shared/
    ├── components/    # reusable components
    ├── hooks/         # reusable hooks
    ├── store/         # RTK slices
    └── types/         # shared types
```

Flag as **Blocking** if:

- A module uses React Query but its `hooks/` directory is empty
- A module has no `__tests__/` directory or zero test files
- Types are declared inline in components instead of in `types/` files

## Additional resources

- Full checklist: [checklist.md](checklist.md)
- Example review outputs: [examples.md](examples.md)
- MSW patterns: `docs/skills/msw/SKILL.md` and `docs/skills/msw/patterns.md`

## Reminders

- Focus on changed code; expand to shared utilities only when behavior depends on them.
- RTL/LTR is handled by Ant Design — flag only if custom layout breaks bidi.
- Branching/PR strategy: mention only when the change clearly violates `main`-protection rules.
