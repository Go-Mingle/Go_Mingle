# GoMingle Frontend Remediation — Re-Verification Report (v2)

**Project:** gomingle (Admin Portal)
**Date:** 2026-05-19
**Audited HEAD:** `5b51658` (Merge feat/v5-user-stories: delete dead code...)
**Previous Verdict:** ❌ FAIL (4 PASS / 2 WARN / 9 FAIL)
**Current Verdict:** ❌ **FAIL** (4 PASS / 2 WARN / 9 FAIL)

---

## Executive Summary

- Issues verified: **15**
- ✅ Passed: **4** (previous: 4) — _no change_
- ⚠️ Warned: **2** (previous: 2) — _no change_
- ❌ Failed: **9** (previous: 9) — _no change_
- **Net change since last audit: +0 fixed, -0 regressed.**

The branch has accumulated 10 new commits since the last audit (login button visibility, profile dropdown labels, neutral overview icons, mobile responsiveness polish, dead code deletion). None of these commits address the 9 failing items from the previous audit. Tracked metrics are effectively identical: 25 files still exceed 200 lines, the worst file is still 1,280 lines, the localStorage mock is still missing from `setupTests.ts`, and `src/shared/i18n/` still exists.

---

## Delta Table — What Changed Since Last Audit

| #   | Issue                           | Previous | Current | Status                                                                                                          |
| --- | ------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | TS Strict Mode                  | ✅       | ✅      | same                                                                                                            |
| 2   | Build & Lint                    | ✅       | ✅      | same                                                                                                            |
| 3   | Split MinglerDetailPage         | ❌       | ❌      | same                                                                                                            |
| 4   | Split ApprovalQueuePage         | ❌       | ❌      | same                                                                                                            |
| 5   | Split UsersPage                 | ❌       | ❌      | same                                                                                                            |
| 6   | Split All Oversized Files       | ❌       | ❌      | same (25 files > 200 still)                                                                                     |
| 7   | services.ts in every module     | ✅       | ✅      | same                                                                                                            |
| 8   | Inline Styles                   | ❌       | ❌      | marginal (1,011 → 964; ‑47)                                                                                     |
| 9   | `!important` in CSS             | ⚠️       | ⚠️      | same (272 occurrences, justified)                                                                               |
| 10  | Antd Row/Col/Flex multi-bp      | ⚠️       | ⚠️      | same (11 single-bp `<Col>` left)                                                                                |
| 11  | Duplicate files                 | ❌       | ❌      | same (`src/shared/i18n/` still exists, 12 importers)                                                            |
| 12  | Folder structure / real content | ❌       | ❌      | partial (1 module now compliant; 11 still stubbed)                                                              |
| 13  | i18n hardcoded strings          | ❌       | ❌      | same (Overview/Menu/Documents/Contact Details/Pending/Approved/Rejected/Visible on Mingler App still hardcoded) |
| 14  | Tests pass & coverage ≥ 90%     | ❌       | ❌      | same root cause (60/224 fail; `localStorage` mock absent)                                                       |
| 15  | Husky pre-commit                | ✅       | ✅      | same                                                                                                            |

---

## Per-Issue Detailed Results

### Issue 1 — TypeScript Strict Mode — ✅ PASS

- **Previous:** ✅ PASS
- **Current:** ✅ PASS
- **What changed:** nothing
- **Evidence:**
  - `tsconfig.app.json:19` → `"strict": true`
  - `npx tsc --noEmit` exits 0
  - `grep ": any\b"` / `" as any\b"` / `@ts-ignore|@ts-nocheck|@ts-expect-error` in `src/` → **no matches**
- **Violations:** none
- **Next action:** n/a

### Issue 2 — Build & Lint Clean — ✅ PASS

- **Previous:** ✅ PASS
- **Current:** ✅ PASS
- **Evidence:**
  - `npm run build` → exit 0 (built in 5.85s)
  - `npm run lint` (`eslint . --max-warnings 0`) → exit 0
  - `npm run typecheck` (`tsc --noEmit`) → exit 0
- **Violations:** none
- **Next action:** n/a

### Issue 3 — Split MinglerDetailPage — ❌ FAIL

- **Previous:** ❌ FAIL
- **Current:** ❌ FAIL
- **What changed:** `MinglerDetailPage.tsx` itself no longer appears in the > 200-line list, but related Mingler files still do.
- **Evidence (still > 200 lines):**
  - `src/app/modules/minglers/components/MinglerReviewsTab.tsx` — **514** lines (unchanged from baseline)
  - `src/app/modules/minglers/components/MinglerBookingsTab.tsx` — **390** lines
  - `src/app/modules/minglers/MinglersPage.tsx` — **348** lines
  - `src/app/modules/minglers/components/MinglerHero.tsx` — **268** lines
  - `src/app/modules/minglers/components/minglerColumns.tsx` — **216** lines
- **Violations remaining:** 5 oversized files in `minglers/`
- **Next action:** decompose `MinglerReviewsTab.tsx` (rating histogram, filter bar, review row, mobile card → separate files); pull `MinglerBookingsTab.tsx` summary cards and column defs into siblings.

### Issue 4 — Split ApprovalQueuePage — ❌ FAIL

- **Previous:** ❌ FAIL (641 lines)
- **Current:** ❌ FAIL — **641 lines, byte-for-byte unchanged**
- **Evidence:** `src/app/modules/approval-queue/ApprovalQueuePage.tsx` = 641 lines; sibling `ApplicationDetailPage.tsx` = **1,280 lines** (also unchanged).
- **Violations remaining:** 2 of the top-3 worst files in the project still in this module.
- **Next action:** lift tabs (Pending/Approved/Rejected) into individual files; extract the “application detail” overview/menu/documents/contact tabs from `ApplicationDetailPage.tsx` into the existing `components/` folder.

### Issue 5 — Split UsersPage — ❌ FAIL

- **Previous:** ❌ FAIL
- **Current:** ❌ FAIL
- **Evidence:** `src/app/modules/users/UsersPage.tsx` = **412 lines** (table config, filter bar, modal orchestration all inline).
- **Violations remaining:** 1 oversized page in `users/`.
- **Next action:** extract `<FilterBar />`, the column factory, and the modal switch into `components/`.

### Issue 6 — Split All Oversized Files — ❌ FAIL

- **Previous:** ❌ FAIL — 25 files > 200 lines, worst 1,280
- **Current:** ❌ FAIL — **25 files > 200 lines, worst still 1,280**
- **Top offenders (current):**
  | Lines | File |
  |------:|------|
  | 1,280 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` |
  | 641 | `src/app/modules/approval-queue/ApprovalQueuePage.tsx` |
  | 514 | `src/app/modules/minglers/components/MinglerReviewsTab.tsx` |
  | 508 | `src/app/modules/restaurants/RestaurantsPage.tsx` |
  | 430 | `src/app/modules/restaurants/RestaurantDetailPage.tsx` |
  | 423 | `src/app/modules/roles-access/RolesAccessPage.tsx` |
  | 412 | `src/app/modules/users/UsersPage.tsx` |
  | 407 | `src/app/modules/categories/CategoriesPage.tsx` |
  | 390 | `src/app/modules/minglers/components/MinglerBookingsTab.tsx` |
  | 389 | `src/app/modules/restaurants/RestaurantReviewsTab.tsx` |
  | 379 | `src/app/modules/finances/FinancesPage.tsx` |
  | 348 | `src/app/modules/minglers/MinglersPage.tsx` |
  | 342 | `src/app/modules/change-log/ChangeLogPage.tsx` |
  | 305 | `src/app/modules/categories/CategoryFormModal.tsx` |
  | 293 | `src/app/modules/restaurants/components/ReviewsTableColumns.tsx` |
  | 278 | `src/app/modules/auth/__tests__/AuthSteps.test.tsx` |
  | 273 | `src/app/modules/restaurants/RestaurantBookings.tsx` |
  | 268 | `src/app/modules/minglers/components/MinglerHero.tsx` |
  | 252 | `src/app/modules/restaurants/components/ContactDetailsTab.tsx` |
  | 245 | `src/app/modules/auth/components/LoginForm.tsx` |
  | 221 | `src/app/modules/users/__tests__/UsersPage.test.tsx` |
  | 217 | `src/app/modules/roles-access/__tests__/RolesAccessPage.test.tsx` |
  | 217 | `src/app/modules/approval-queue/components/PendingTable.tsx` |
  | 216 | `src/app/modules/minglers/components/minglerColumns.tsx` |
  | 213 | `src/app/modules/restaurants/components/RestaurantDetailHeader.tsx` |
- **Violations remaining:** 25
- **Net change vs. previous baseline:** **0 fixed, 0 regressed** in this dimension.
- **Next action:** treat this as a focused refactor sprint. The biggest 5 files alone account for ~3,275 LOC; targeted extraction of presentational sub-components and column-defs would clear most of the list.

### Issue 7 — services.ts in Every Module — ✅ PASS

- **Previous:** ✅ PASS
- **Current:** ✅ PASS
- **Evidence:**
  - `src/shared/api/httpClient.ts` exports `get/post/put/patch/delete` (verified).
  - All 12 module folders under `src/app/modules/` contain a non-empty `services.ts`:
    - approval-queue (6), auth (36), categories (22), change-log (6), dashboard (13), finances (6), loyalty (14), minglers (8), notifications (18), restaurants (10), roles-access (19), users (30)
  - `grep "fetch("` outside `httpClient.ts` / mocks / tests → **only `src/shared/api/httpClient.ts:39`** (the canonical `fetch` call). PASS.
- **Note:** the spec mentioned 13 modules; the repo contains 12 — `profile` was recently deleted (`c2fd459`). This is intentional cleanup, not a violation.

### Issue 8 — No Static Inline Styles — ❌ FAIL

- **Previous:** ❌ FAIL — 1,011 inline styles across 130 files
- **Current:** ❌ FAIL — **964 inline styles across 221 .tsx files** (only ‑47 removed)
- **Top offenders (current):**
  | Count | File |
  |------:|------|
  | 93 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` _(byte-for-byte unchanged from baseline)_ |
  | 32 | `src/app/modules/approval-queue/ApprovalQueuePage.tsx` |
  | 30 | `src/app/modules/minglers/components/MinglerReviewsTab.tsx` |
  | 28 | `src/app/modules/categories/CategoryFormModal.tsx` |
  | 27 | `src/app/modules/restaurants/RestaurantReviewsTab.tsx` |
  | 25 | `src/app/modules/minglers/components/MinglerBookingsTab.tsx` |
  | 23 | `src/app/modules/finances/FinancesPage.tsx` |
  | 22 | `src/app/modules/restaurants/RestaurantsPage.tsx` |
  | 22 | `src/app/modules/categories/CategoriesPage.tsx` |
  | 20 | `src/app/modules/change-log/ChangeLogPage.tsx` |
- **Style-object-constant cheat pattern:** `grep "const [A-Z_]+STYLE(S)? ="` → **no matches**. Good — the cheat pattern was not introduced.
- **Violations remaining:** 964 across 221 files.
- **Target:** < 50, dynamic-only.
- **Next action:** convert spacing/typography/color/layout literals to Tailwind classes; reserve `style={{}}` for genuinely dynamic values (computed colors, runtime-driven widths).

### Issue 9 — No `!important` in CSS — ⚠️ WARN (unchanged)

- **Previous:** ⚠️ WARN — heavy `!important` in `antd-overrides.css`, justified by an in-file comment
- **Current:** ⚠️ WARN — **272 occurrences** in `src/styles/antd-overrides.css`, no other CSS file affected
- **Evidence:** `Select-String !important src\styles\*.css` → 272 hits, all in `antd-overrides.css`. File header explicitly documents the trade-off:
  > `This file uses heavy !important by design. Global Ant Design class … Heavy !important here keeps the design system stable.`
- **Violations remaining:** 272 lines (all in one centrally-justified file).
- **Next action:** if the org rule is **zero tolerance**, migrate `antd-overrides.css` to the Antd v6 ConfigProvider theme tokens. If the doc’d exception is acceptable, this stays at WARN.

### Issue 10 — Antd Row/Col/Flex + useBreakpoint — ⚠️ WARN

- **Previous:** ⚠️ WARN
- **Current:** ⚠️ WARN
- **Evidence:**
  - `useBreakpoint` used in **24 files** (good).
  - `window.innerWidth` in `src/app/` → **0 hits** (good).
  - **11 single-breakpoint `<Col xs={n}>` usages without sm/md/lg siblings:**
    - `src/app/modules/approval-queue/ApprovalQueuePage.tsx:167,173,177,347,353,357,363` (7 sites)
    - `src/app/modules/users/UsersPage.tsx:130,144` (2 sites)
    - `src/app/modules/minglers/components/MinglerBookingsTab.tsx:209,233` (2 sites)
- **Violations remaining:** 11 `<Col>` instances need multi-breakpoint props.
- **Next action:** add `sm/md/lg` (and `xl` where the design demands it) to each flagged `<Col>` so layouts adapt above the `xs` breakpoint.

### Issue 11 — No Duplicate Files — ❌ FAIL

- **Previous:** ❌ FAIL — `src/shared/i18n/` existed, imported by 13 files
- **Current:** ❌ FAIL — `src/shared/i18n/` **still exists** (`src/shared/i18n/index.ts`, 60 lines, initialises i18next from `src/locales/en/*.json`) and is **imported by 12 files**
  - `src/test-utils/renderWithProviders.tsx:10`
  - `src/app/modules/users/userColumns.tsx:12`
  - `src/app/modules/change-log/components/changeLogTableHelpers.tsx:4`
  - `src/app/modules/finances/financeColumns.tsx:4`
  - `src/app/modules/minglers/components/minglerColumns.tsx:9`
  - `src/app/modules/minglers/components/MinglerDetailTabs.tsx:5`
  - `src/app/modules/restaurants/components/BookingsTableColumns.tsx:4`
  - `src/app/modules/finances/components/FinanceComplexColumns.tsx:7`
  - `src/app/modules/finances/components/FinanceBasicColumns.tsx:12`
  - `src/app/modules/roles-access/components/rolesTableHelpers.tsx:4`
  - `src/app/modules/restaurants/components/RestaurantsTableColumns.tsx:9`
  - `src/app/modules/restaurants/components/ReviewsTableColumns.tsx:17`
  - (plus `src/setupTests.ts:4` which `import './shared/i18n'` as a side effect)
- **Other duplicates / paths verified:**
  - ❌ `src/shared/i18n` exists (should be GONE)
  - ✅ `src/data/mock` absent
  - ✅ `src/index.css` absent
  - ✅ `src/App.tsx` absent
  - ✅ `src/app/modules/auth/passwordStrength.ts` absent (the canonical `src/shared/utils/passwordStrength.ts` exists and is imported by `LoginForm.tsx` + `PasswordSteps.tsx`)
  - ✅ `src/mocks/` exists
  - ✅ `src/styles/index.css` exists
  - ✅ `src/app/App.tsx` exists
  - ✅ `src/locales/en/` exists
  - ✅ `src/app/pages/` exists, `src/app/hooks/` exists
- **Violations remaining:** 1 forbidden folder (`src/shared/i18n/`) actively imported by 12 source files. If the rule is "all i18n in `src/locales/`," the bootstrap module must move under `src/locales/` (or another non-`shared/i18n` path) and all imports be rewritten.
- **Next action:** relocate `src/shared/i18n/index.ts` → e.g. `src/locales/i18n.ts`, rewrite the 12+ imports, then `rmdir` the old folder.

### Issue 12 — Folder Structure & Real Content — ❌ FAIL

- **Previous:** ❌ FAIL — 22 of 26 type/constant files were 1–3 lines
- **Current:** ❌ FAIL — **20 of 24 type/constant files are ≤ 5 lines** (stub status). Marginal improvement; problem persists.

| Module         | components/ | hooks/ | services.ts | types.ts (lines) | constants.ts (lines) | index.tsx |
| -------------- | :---------: | :----: | :---------: | :--------------: | :------------------: | :-------: |
| approval-queue |     ✅      |   ✅   |     ✅      |      **41**      |        **12**        |    ✅     |
| auth           |     ✅      |   ✅   |     ✅      |       ❌ 2       |         ❌ 1         |    ✅     |
| categories     |     ✅      |   ✅   |     ✅      |       ❌ 3       |         ❌ 1         |    ✅     |
| change-log     |     ✅      |   ✅   |     ✅      |      **6**       |         ❌ 2         |    ✅     |
| dashboard      |     ✅      |   ✅   |     ✅      |       ❌ 2       |         ❌ 1         |    ✅     |
| finances       |     ✅      |   ✅   |     ✅      |       ❌ 2       |         ❌ 2         |    ✅     |
| loyalty        |     ✅      |   ✅   |     ✅      |       ❌ 2       |         ❌ 1         |    ✅     |
| minglers       |     ✅      |   ✅   |     ✅      |       ❌ 2       |        **9**         |    ✅     |
| notifications  |     ✅      |   ✅   |     ✅      |       ❌ 2       |         ❌ 1         |    ✅     |
| restaurants    |     ✅      |   ✅   |     ✅      |      **12**      |         ❌ 2         |    ✅     |
| roles-access   |     ✅      |   ✅   |     ✅      |       ❌ 3       |         ❌ 2         |    ✅     |
| users          |     ✅      |   ✅   |     ✅      |       ❌ 3       |         ❌ 2         |    ✅     |

- **Stub files (≤ 5 lines) flagged INCOMPLETE:**
  - `auth/types.ts` (2), `auth/constants.ts` (1)
  - `categories/types.ts` (3), `categories/constants.ts` (1)
  - `change-log/constants.ts` (2)
  - `dashboard/types.ts` (2), `dashboard/constants.ts` (1)
  - `finances/types.ts` (2), `finances/constants.ts` (2)
  - `loyalty/types.ts` (2), `loyalty/constants.ts` (1)
  - `minglers/types.ts` (2)
  - `notifications/types.ts` (2), `notifications/constants.ts` (1)
  - `restaurants/constants.ts` (2)
  - `roles-access/types.ts` (3), `roles-access/constants.ts` (2)
  - `users/types.ts` (3), `users/constants.ts` (2)
- **Violations remaining:** 19 stub files across 11 modules.
- **Next action:** hoist domain types currently inlined in each module’s page/component file into `types.ts`; hoist literal constants (status sets, role lists, currency codes, API paths) into `constants.ts`.

### Issue 13 — i18n Hardcoded Strings — ❌ FAIL

- **Previous:** ❌ FAIL — list of 8 hardcoded labels in `ApplicationDetailPage.tsx`
- **Current:** ❌ FAIL — **every one of those labels is still hardcoded** in the same file:
  - `src/app/modules/approval-queue/ApplicationDetailPage.tsx`:
    - L121 — `label: 'Pending'`
    - L122 — `label: 'Approved'`
    - L123 — `label: 'Rejected'`
    - L131 — `label: 'Visible on Mingler App'`
    - L357 — `<span style={notProvidedStyle}>Pending assignment</span>`
    - L739 — text content `Documents`
    - L854 — `{ key: 'overview', label: 'Overview', children: overviewTab }`
    - L857 — `label: 'Menu'`
    - L860 — `'Menu information coming soon.'`
    - L872 — `{ key: 'documents', label: 'Documents', children: documentsTab }`
    - L875 — `label: 'Contact Details'`
    - L361 — `<OverviewField ... label="Cuisine type" .../>` (and many other `label="…"` literals at L362–L422)
- **`useTranslation` coverage:** 84 files use `useTranslation` (target ≥ 70) — meets the volume target _but_ the worst file in the codebase still doesn't use it for its labels.
- **Violations remaining:** the 8 originally-flagged strings (and dozens more `label="…"` instances in the same file).
- **Next action:** add `const { t } = useTranslation('approval-queue')` and replace every literal label with `t('…')`, with matching keys in `src/locales/en/approval-queue.json`.

### Issue 14 — Tests Pass & Coverage ≥ 90% — ❌ FAIL

- **Previous:** ❌ FAIL — 66 of 239 failing, root cause: missing `localStorage` mock in `setupTests.ts`
- **Current:** ❌ FAIL — **60 of 224 failing, same root cause**
- **Evidence:**
  - `src/setupTests.ts` configures `matchMedia`, `ResizeObserver`, and `scrollIntoView`, but **does NOT configure a `localStorage` mock**. `grep localStorage src/setupTests.ts` → no matches.
  - Failing tests crash with:
    ```
    TypeError: localStorage.getItem is not a function
      ❯ getAuthToken src/shared/api/httpClient.ts:8:23
      ❯ request    src/shared/api/httpClient.ts:26:17
    ```
  - Final tally: `Test Files 52 failed | 25 passed (77)` / `Tests 60 failed | 164 passed (224)`.
- **Coverage:** **not run** — `vitest run --coverage` was skipped because 60 tests still crash before coverage can be aggregated. Coverage thresholds cannot be evaluated.
- **Violations remaining:** 60 failing tests; coverage unknown.
- **Next action:** add a `localStorage`/`sessionStorage` mock to `setupTests.ts` (jsdom's default is a no-op stub but in this project's jsdom build it surfaces as undefined). Example:
  ```ts
  const storageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((k: string) => store[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v
      }),
      removeItem: vi.fn((k: string) => {
        delete store[k]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
      key: vi.fn(),
      get length() {
        return Object.keys(store).length
      },
    } as Storage
  })()
  Object.defineProperty(window, 'localStorage', { value: storageMock })
  Object.defineProperty(window, 'sessionStorage', { value: storageMock })
  ```

### Issue 15 — Husky Pre-Commit Hook — ✅ PASS

- **Previous:** ✅ PASS
- **Current:** ✅ PASS
- **Evidence:** `.husky/pre-commit` runs, in order:
  1. `npx lint-staged` (eslint --fix + prettier on staged files; configured under `package.json#lint-staged`)
  2. `npm run typecheck`
  3. `npm run test -- --run`
  4. `npm run build`
- **Note:** because Issue 14 currently fails, step 3 of this hook will currently block _every_ commit. The hook itself is correct; the test suite that it runs is what's broken.

---

## Regression Watch

No previously-passing item regressed. No previously-failing item improved enough to flip status. The audit is materially identical to the prior baseline.

Marginal numeric movement (not enough to change verdict):

- Inline styles: 1,011 → 964 (‑47)
- Failing tests: 66/239 → 60/224 (failure rate 27.6% → 26.8%)
- Stub `types.ts`/`constants.ts` files: 22/26 → 20/24
- `useTranslation` adoption: ≥ 70 target met (84 files)
- `MinglerDetailPage.tsx` no longer appears in the > 200-line list (other `minglers/` files still do)

---

## Outstanding Violations (sorted by severity)

| #   | Severity | Issue | File                                                             | Line                                        | Description                                                                                                                                                            |
| --- | -------- | ----- | ---------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 🔴 HIGH  | 14    | `src/setupTests.ts`                                              | –                                           | No `localStorage`/`sessionStorage` mock; 60 tests crash before assertions run.                                                                                         |
| 2   | 🔴 HIGH  | 6     | `src/app/modules/approval-queue/ApplicationDetailPage.tsx`       | 1–1280                                      | 1,280-line file (6× over the limit); contains 93 inline-style sites and the hardcoded i18n strings below.                                                              |
| 3   | 🔴 HIGH  | 6     | `src/app/modules/approval-queue/ApprovalQueuePage.tsx`           | 1–641                                       | 641 lines (3.2× over).                                                                                                                                                 |
| 4   | 🔴 HIGH  | 6     | `src/app/modules/minglers/components/MinglerReviewsTab.tsx`      | 1–514                                       | 514 lines (2.6× over).                                                                                                                                                 |
| 5   | 🔴 HIGH  | 11    | `src/shared/i18n/index.ts`                                       | 1–60                                        | Forbidden folder still exists; 12+ files still import from it.                                                                                                         |
| 6   | 🟠 MED   | 13    | `src/app/modules/approval-queue/ApplicationDetailPage.tsx`       | 121,122,123,131,357,739,854,857,860,872,875 | Hardcoded labels (Pending/Approved/Rejected/Visible on Mingler App/Pending assignment/Documents/Overview/Menu/Menu information coming soon/Documents/Contact Details). |
| 7   | 🟠 MED   | 8     | 221 .tsx files                                                   | –                                           | 964 static `style={{}}` instances.                                                                                                                                     |
| 8   | 🟠 MED   | 6     | 22 other .ts/.tsx files                                          | –                                           | All > 200 lines (see Issue 6 table).                                                                                                                                   |
| 9   | 🟠 MED   | 12    | 19 stub files across 11 modules                                  | –                                           | `types.ts`/`constants.ts` ≤ 5 lines (see Issue 12 table).                                                                                                              |
| 10  | 🟡 LOW   | 10    | `ApprovalQueuePage.tsx` `UsersPage.tsx` `MinglerBookingsTab.tsx` | various                                     | 11 `<Col xs={…}>` instances without `sm/md/lg` siblings.                                                                                                               |
| 11  | 🟡 LOW   | 9     | `src/styles/antd-overrides.css`                                  | 272 lines                                   | `!important` usage is documented as intentional; verify against the org-policy.                                                                                        |

---

## Final Master Checklist

- [x] TypeScript `strict: true` enabled
- [x] `npm run build` passes with 0 errors and 0 warnings
- [x] `npm run lint` passes with 0 errors and 0 warnings
- [x] `npm run typecheck` passes
- [ ] No source file (excluding mocks) exceeds 200 lines — **25 files violate**
- [ ] Every module has services.ts, types.ts, constants.ts (with real content), components/, hooks/, index.tsx — **11 of 12 modules ship stub types/constants**
- [x] Zero raw `fetch()` calls outside `httpClient.ts` and MSW handlers
- [ ] Zero inline `style={{}}` for static layout/colors/spacing — **964 violations**
- [x] Zero `CARD_STYLE` / `LABEL_STYLE` / similar style-object constants
- [ ] Zero `!important` in CSS files — **272 occurrences (documented as intentional)**
- [~] Antd Row/Col/Flex used for layouts; multi-breakpoint props on every `<Col>` — **11 single-bp `<Col>` instances**
- [x] `Grid.useBreakpoint()` used for responsive logic; no `window.innerWidth`
- [ ] `src/shared/i18n/` does NOT exist; all i18n in `src/locales/` — **`src/shared/i18n/index.ts` still imports from `src/locales/`**
- [x] `src/app/pages/` and `src/app/hooks/` exist
- [ ] Every user-facing string uses `t()` — **at least 11 hardcoded labels in `ApplicationDetailPage.tsx`**
- [ ] All tests pass (0 failures) — **60 failures**
- [ ] Test coverage ≥ 90% (lines, functions, statements), ≥ 85% (branches) — **not measurable (tests crash)**
- [x] `.husky/pre-commit` blocks bad commits

---

## Final Verdict

**The codebase is NOT ready to ship and must return to development.** The audit verdict is unchanged from the previous round: 4 PASS / 2 WARN / 9 FAIL. The 10 commits added since the last audit fix UI affordances (login button visibility, profile dropdown labels, neutral overview icons, dead-code deletion) and have not addressed any of the 9 systemic failures previously called out.

The four blocking must-fix items, in priority order:

1. **Restore the test suite.** Add a `localStorage` mock to `src/setupTests.ts`. 60 tests crash today; coverage cannot even be measured. This is a ~10-line fix that unblocks Issue 14 entirely.
2. **Eliminate `src/shared/i18n/`.** Move `src/shared/i18n/index.ts` into `src/locales/` (e.g. `src/locales/i18n.ts`) and rewrite the 12+ importers. This closes Issue 11.
3. **Refactor the top-5 oversized files.** `ApplicationDetailPage.tsx` (1,280), `ApprovalQueuePage.tsx` (641), `MinglerReviewsTab.tsx` (514), `RestaurantsPage.tsx` (508), `RestaurantDetailPage.tsx` (430) — together ~3,400 LOC out of place. Splitting these clears the bulk of Issues 3/4/5/6 _and_ directly removes ~180 of the 964 inline-style instances (Issue 8) _and_ makes Issue 13 (i18n in `ApplicationDetailPage.tsx`) tractable.
4. **Hoist domain types & constants.** Replace the 19 stub `types.ts`/`constants.ts` files with real content sourced from the inlined types currently living in page components.

Items 9 and 10 are minor and can ship as cleanup PRs once the four above are resolved. Item 9 (`!important`) should be confirmed against the organisation's CSS policy — if the documented exception is acceptable, it stays at WARN; otherwise it needs a migration to Antd v6 theme tokens.

---

_Audit run at `C:\Users\baber.ali_venturediv\Documents\Project\GoMingle\gomingle`, branch `main`, HEAD `5b51658`, on 2026-05-19 with Node v25.2.1 / npm 11.6.2. Read-only._
