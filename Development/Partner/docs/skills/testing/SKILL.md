---
name: testing
description: Mandatory test workflow for the GoMingle Partner Web app. Activate on EVERY code change — new feature, refactor, or bug fix. Requires creating/updating tests for the components, hooks, and modules affected by the change, keeping the whole suite green, and keeping coverage at or above the enforced thresholds (lines 90, functions 90, statements 90, branches 85) for both changed files and overall, so the SonarQube quality gate does not fail on merge. Uses Vitest 4 + Testing Library + jsdom, MSW v2 for data, and the shared renderWithProviders helper.
---

# Testing & Coverage (Non-negotiable)

This app's CI runs a **SonarQube quality gate** on `dev` and `qa`. The gate consumes
`coverage/lcov.info` produced by `npm run test:coverage`. If new code is uncovered or a
test fails, the pipeline fails and the merge is blocked. This skill is what prevents that.

## When to activate

**Always, on any code change** — implementing a feature, refactoring, or fixing a bug.
If you touched a `.ts`/`.tsx` file under `src/`, this skill applies.

## The hard rules

1. **Every changed unit gets a test.** For each component, hook, util, or slice you add or
   modify, add or update its test so the new/changed behavior is exercised. Do not leave new
   branches, props, states, or error paths uncovered.
2. **The whole suite must pass.** Run `npm run test:run`. Zero failures — no `.skip`, no
   `.only`, no commenting-out to make it green.
3. **Coverage must stay at or above threshold.** Run `npm run test:coverage`. Both overall
   and the files you changed must meet: **lines ≥ 90, functions ≥ 90, statements ≥ 90,
   branches ≥ 85**. If your change drops coverage below threshold, add tests until it recovers.
4. **Never lower the thresholds** in `vite.config.ts` to make the gate pass. Fix the tests.
5. **Data-touching tests use MSW v2** (`http.*` / `HttpResponse`) — see the `msw` skill.
   Override per-test with `server.use(...)` for error/edge paths; never hit a real network.

## Conventions (match the existing suite)

- **Location:** co-locate tests in the module's `__tests__/` directory
  (e.g. `src/app/modules/restaurants/__tests__/RestaurantsPage.test.tsx`). Shared/atom/layout
  tests live in the matching `__tests__/` next to the code.
- **Naming:** `*.test.ts` / `*.test.tsx`. **Never `*.spec.*`** — the suite has zero spec files.
- **Render:** use `renderWithProviders` from `src/test-utils/renderWithProviders.tsx` (it wires
  Redux, React Query, AntD ConfigProvider, Router, and i18n) — do not hand-roll providers.
- **Setup:** global setup is `src/setupTests.ts` (jsdom polyfills, MSW lifecycle, storage mocks).
  Don't duplicate that per file.
- **Queries:** prefer role/text/label queries and `findBy*`/`waitFor` for async UI, matching the
  existing tests. Assert on user-visible behavior, not implementation details.

## Required workflow before you consider a change done

1. Write/update the tests for the affected units (happy path + the error/empty/loading states
   the code handles — those branches count toward the branch threshold).
2. `npm run test:run` → all green.
3. `npm run test:coverage` → overall and changed files at or above thresholds. Read the summary;
   if any changed file is below, add the missing cases.
4. `npm run lint` and `npm run typecheck` → clean (the pre-commit hook enforces these too).
5. Only then commit. The pre-commit hook runs `vitest related` on staged files and the build;
   the pre-push and CI run the fuller gate.

## What NOT to do

- Do not mark a feature/fix complete with failing or skipped tests.
- Do not exclude your new source files from coverage to dodge the threshold.
- Do not write tests that assert nothing meaningful just to inflate coverage — cover real behavior.
- Do not introduce `any` in test files; keep them TypeScript-strict like the rest of the code.
