# GoMingle Frontend Remediation Verification Report
**Project:** gomingle (Admin Portal)
**Date:** 2026-05-19
**Overall Verdict:** ❌ FAIL

> Read-only audit. No files modified. Environment is Windows 11 / PowerShell; cross-platform Grep (ripgrep) and Read tools were used in place of bash/grep/find.

## Executive Summary
- Issues verified: 15
- ✅ Passed: 4
- ⚠️ Warned: 2
- ❌ Failed: 9

**Top 5 critical violations to fix next:**
1. **Tests are red** — 60 of 85 test files fail; 66 of 239 individual tests fail (mostly `TypeError: localStorage.getItem is not a function` in service tests). Coverage cannot be measured. (Check 14)
2. **File-size cap broken across the board** — 25 source files exceed 200 lines. `ApplicationDetailPage.tsx` is **1280 lines** (was 925 — got worse), `ApprovalQueuePage.tsx` 641, `MinglerReviewsTab.tsx` 514, `RestaurantsPage.tsx` 508, `RolesAccessPage.tsx` 423, `UsersPage.tsx` 412, etc. (Check 3–6)
3. **Inline `style={{}}` infestation** — 1011 occurrences across 130 .tsx files (target < 50). `ApplicationDetailPage.tsx` alone has 93 inline-style attributes, nearly all static layout/spacing/colors. (Check 8)
4. **Duplicate `src/shared/i18n/` not removed** — still exists at `src/shared/i18n/index.ts` and is *actively imported* by 12 production files plus `src/setupTests.ts`. (Check 11)
5. **i18n coverage incomplete** — hardcoded UI labels in `ApplicationDetailPage.tsx` (tab labels `'Overview'`, `'Menu'`, `'Seating & Tables'`, `'Photos & Videos'`, `'Documents'`, `'Contact Details'`; status labels `'Pending'`, `'Approved'`, `'Rejected'`, `'Visible on Mingler App'`, `'Not visible on Mingler App'`). Also most `types.ts` / `constants.ts` are stub re-exports < 5 lines. (Check 12, 13)

---

## Per-Issue Results

### Issue 1 — TypeScript Strict Mode — ✅ PASS
- **What was checked:** `strict: true` in tsconfig.app.json, no `: any`, no `as any`, no `@ts-ignore/@ts-nocheck/@ts-expect-error`, typecheck clean.
- **Evidence:**
  - `tsconfig.app.json:19` → `"strict": true`
  - `grep ": any\b" src/` → 0 matches
  - `grep " as any\b" src/` → 0 matches
  - `grep "@ts-ignore|@ts-nocheck|@ts-expect-error" src/` → 0 matches
  - `npm run typecheck` → exit 0, no errors
- **Violations found:** none
- **Recommended fix:** n/a

Note: heavy `as unknown as Record<string, unknown>` chained casts exist (e.g. `ApplicationDetailPage.tsx:111`), which technically pass strict mode but defeat type safety. Worth tightening but not a Check-1 violation.

### Issue 2 — Build & Lint Clean — ✅ PASS
- **What was checked:** `npm run build`, `npm run lint`, `npm run typecheck` all clean.
- **Evidence:**
  - `npm run build` → exit 0, `✓ built in 17.28s`, no warnings.
  - `npm run lint` → exit 0 (`eslint . --max-warnings 0`), no output beyond banner.
  - `npm run typecheck` → exit 0.
- **Violations found:** none
- **Recommended fix:** n/a

### Issue 3-6 — File Size ≤ 200 Lines — ❌ FAIL
- **What was checked:** every `.ts/.tsx` under `src/` (excluding mocks) ≤ 200 lines; previously oversized files now ≤ 200; extracted `components/` files also ≤ 200.
- **Evidence:** 25 files exceed 200 lines:

| Lines | File |
|------:|------|
| 1280 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` (was 925 — got WORSE) |
| 641 | `src/app/modules/approval-queue/ApprovalQueuePage.tsx` (was 1002) |
| 514 | `src/app/modules/minglers/components/MinglerReviewsTab.tsx` |
| 508 | `src/app/modules/restaurants/RestaurantsPage.tsx` (was 579) |
| 430 | `src/app/modules/restaurants/RestaurantDetailPage.tsx` |
| 423 | `src/app/modules/roles-access/RolesAccessPage.tsx` (was 515) |
| 412 | `src/app/modules/users/UsersPage.tsx` (was 990) |
| 407 | `src/app/modules/categories/CategoriesPage.tsx` |
| 390 | `src/app/modules/minglers/components/MinglerBookingsTab.tsx` |
| 389 | `src/app/modules/restaurants/RestaurantReviewsTab.tsx` |
| 379 | `src/app/modules/finances/FinancesPage.tsx` (was 830) |
| 348 | `src/app/modules/minglers/MinglersPage.tsx` (was 814) |
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

  - **MinglerDetailPage.tsx is not in the list** — it was extracted to multiple tab components, but those components themselves exceed 200 lines (`MinglerReviewsTab.tsx:514`, `MinglerBookingsTab.tsx:390`, `MinglerHero.tsx:268`).
  - All 8 previously-flagged module roots still exceed 200 lines except `MinglerDetailPage.tsx`.
- **Violations found:** 25
- **Recommended fix:** Decompose `ApplicationDetailPage.tsx`, `ApprovalQueuePage.tsx`, `MinglerReviewsTab.tsx`, `RestaurantsPage.tsx`, `RolesAccessPage.tsx`, `UsersPage.tsx`, `CategoriesPage.tsx`, `MinglerBookingsTab.tsx`, `RestaurantReviewsTab.tsx`, `FinancesPage.tsx`, `MinglersPage.tsx`, `ChangeLogPage.tsx`, etc. into smaller `components/` files. Extract inline-style constants into Tailwind classes (this alone removes hundreds of lines).

### Issue 7 — services.ts in Every Module — ✅ PASS
- **What was checked:** httpClient exists and exports get/post/put/patch/delete; every module has a non-empty services.ts; no raw `fetch()` outside httpClient/MSW; typed params and return types.
- **Evidence:**
  - `src/shared/api/httpClient.ts` exports `httpClient.{get, post, put, patch, delete}` (typed `<T>` generics) ✓
  - All 13 modules contain `services.ts` (approval-queue, auth, categories, change-log, dashboard, finances, loyalty, minglers, notifications, profile, restaurants, roles-access, users).
  - Only one `fetch(` match: `src/shared/api/httpClient.ts:39` (allowed).
  - 0 imports of `axios` or other HTTP libs anywhere in `src/`.
  - Spot-check on `usersService`, `approvalQueueService`, `financesService` — all functions typed with explicit `Promise<T>` returns and typed DTOs.
- **Violations found:** none
- **Recommended fix:** n/a

### Issue 8 — No Static Inline Styles — ❌ FAIL
- **What was checked:** ≤ 50 inline `style={{` occurrences, all remaining must be dynamic-only.
- **Evidence:**
  - `grep "style={{" src/ --include="*.tsx"` → **1011 occurrences across 130 files**.
  - Top offenders:
    - `src/app/modules/approval-queue/ApplicationDetailPage.tsx` — 93
    - `src/app/modules/approval-queue/ApprovalQueuePage.tsx` — 32
    - `src/app/modules/minglers/components/MinglerReviewsTab.tsx` — 30
    - `src/app/modules/categories/CategoryFormModal.tsx` — 28
    - `src/app/modules/restaurants/RestaurantReviewsTab.tsx` — 27
    - `src/app/modules/minglers/components/MinglerBookingsTab.tsx` — 25
    - `src/app/modules/finances/FinancesPage.tsx` — 23
    - `src/app/modules/categories/CategoriesPage.tsx` — 22
    - `src/app/modules/restaurants/RestaurantsPage.tsx` — 22
    - `src/app/modules/restaurants/RestaurantDetailPage.tsx` — 20
  - Static-only samples (verified by reading source):
    - `ApprovalQueuePage.tsx:18-26` — `CARD_STYLE` literal applied via inline `style={CARD_STYLE}` (static padding/background/border/radius).
    - `ApprovalQueuePage.tsx:28-36` — `LABEL_STYLE` constant (static font-size/weight/colors).
    - `ApplicationDetailPage.tsx:177-189` — `statusBadge` static inline `display`, `height`, `padding`, `borderRadius`, `fontSize`, `fontWeight`, `fontFamily`, `flexShrink` (only `background`/`color` are dynamic).
    - `UsersPage.tsx:132-140` — static `overflow`, `textOverflow`, `whiteSpace` inline.
    - `ApprovalQueuePage.tsx:187-193` — `style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-divider)' }}` — pure static layout.
- **Violations found:** ≥ 961 static inline styles (1011 − ~50 dynamic budget).
- **Recommended fix:** Lift `CARD_STYLE` / `LABEL_STYLE` / `VALUE_STYLE` / `ACTION_BTN` etc. into Tailwind utility classes or scoped CSS modules. Limit `style={{}}` to truly dynamic values (`width: progress + '%'`, color computed from data, etc.).

### Issue 9 — No !important in CSS — ⚠️ WARN
- **What was checked:** zero `!important` in CSS files; if any remain, justified with a comment.
- **Evidence:**
  - Matches limited to **one file**: `src/styles/antd-overrides.css` (no matches anywhere else).
  - Header comment at `src/styles/antd-overrides.css:1-6` explains: *"This file uses heavy !important by design. Global Ant Design class rules ... frequently override our utility classes & inline rules in unpredictable orders ... IMPORTANT: never copy !important onto inline style={{}} props."*
  - `src/index.css` correctly **does not exist** (only `src/styles/index.css`).
- **Violations found:** Letter-of-the-rule (`PASS only if empty`) — 1 file with heavy `!important` exists, but the spec-mandated justification comment is present at the top of the file.
- **Recommended fix:** Document this design exception in CLAUDE.md and lock the file with an eslint-css rule limiting future creep. The justified, scoped use is reasonable; the audit-script-literal "empty file" criterion is what causes the WARN.

### Issue 10 — Antd Row/Col/Flex + useBreakpoint — ⚠️ WARN
- **What was checked:** ≥ 10 files using Row/Col, ≥ 5 using Flex, ≥ 3 using `useBreakpoint`, 0 `window.innerWidth` in `src/app/`, every `<Col>` responsive.
- **Evidence:**
  - 113 files import from `'antd'`.
  - `useBreakpoint` used in **23 files** (target ≥ 3) ✓.
  - `window.innerWidth` in `src/app/`: **0 matches** ✓.
  - **No bare `<Col span={...}>` found** (0 matches).
  - However, several `<Col>` use a single `xs={12}` only with no `sm`/`md`/`lg` siblings (e.g. `ApprovalQueuePage.tsx:167, 173, 177, 347, 353, 357, 363`; `UsersPage.tsx:130, 144`; `MinglerBookingsTab.tsx:209, 233`). Functionally responsive (50/50 on all sizes) but technically violates the "every Col must have responsive props (xs/sm/md/lg)" plural criterion.
- **Violations found:** 11+ Col usages with single-breakpoint props only.
- **Recommended fix:** Either accept "single xs prop = responsive" as the convention (the columns are visibly responsive in practice), or add explicit `sm`/`md` siblings where the intent is to keep 2-col on tablet and stack on mobile. Update the audit spec to reflect whichever stance.

### Issue 11 — No Duplicate Files — ❌ FAIL
- **What was checked:** absence of `src/data/mock/`, `src/index.css`, `src/App.tsx`, `src/app/modules/auth/passwordStrength.ts`, **`src/shared/i18n/`**; presence of `src/mocks/`, `src/styles/index.css`, `src/app/App.tsx`, `src/shared/utils/passwordStrength.ts`, `src/locales/en/`; no broken imports.
- **Evidence:**
  - ❌ `src/shared/i18n/index.ts` **still exists** (1636 bytes).
  - Actively imported by:
    - `src/setupTests.ts:4` → `import './shared/i18n'`
    - `src/test-utils/renderWithProviders.tsx:10` → `import i18n from '../shared/i18n'`
    - `src/app/modules/users/userColumns.tsx:12`
    - `src/app/modules/change-log/components/changeLogTableHelpers.tsx:4`
    - `src/app/modules/roles-access/components/rolesTableHelpers.tsx:4`
    - `src/app/modules/finances/financeColumns.tsx:4`
    - `src/app/modules/finances/components/FinanceComplexColumns.tsx:7`
    - `src/app/modules/finances/components/FinanceBasicColumns.tsx:12`
    - `src/app/modules/minglers/components/MinglerDetailTabs.tsx:5`
    - `src/app/modules/restaurants/components/BookingsTableColumns.tsx:4`
    - `src/app/modules/minglers/components/minglerColumns.tsx:9`
    - `src/app/modules/restaurants/components/RestaurantsTableColumns.tsx:9`
    - `src/app/modules/restaurants/components/ReviewsTableColumns.tsx:17`
  - ✅ All other forbidden paths absent.
  - ✅ All other required paths present (`src/mocks/`, `src/styles/index.css`, `src/app/App.tsx`, `src/shared/utils/passwordStrength.ts`, `src/locales/en/`).
- **Violations found:** 1 directory + 13 imports.
- **Recommended fix:** Move `src/shared/i18n/index.ts` to the canonical location (likely `src/configs/i18n.ts` or `src/locales/i18n.ts`), update all 13 importers, then delete `src/shared/i18n/`.

### Issue 12 — Folder Structure — ❌ FAIL
- **What was checked:** all required top-level folders; per-module table for components/, hooks/, services.ts, types.ts, constants.ts, index.tsx; `types.ts` and `constants.ts` each > 5 lines of real content.
- **Evidence:**

| Module | components/ | hooks/ | services.ts | types.ts | constants.ts | index.tsx |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|
| approval-queue | ✅ | ✅ | ✅ | ✅ (41L) | ⚠️ (12L) | ✅ |
| auth | ✅ | ✅ | ✅ | ❌ (2L) | ❌ (1L) | ✅ |
| categories | ✅ | ✅ | ✅ | ❌ (3L) | ❌ (1L) | ✅ |
| change-log | ✅ | ✅ | ✅ | ❌ (6L *re-export*) | ❌ (2L) | ✅ |
| dashboard | ✅ | ✅ | ✅ | ❌ (2L) | ❌ (1L) | ✅ |
| finances | ✅ | ✅ | ✅ | ❌ (2L) | ❌ (2L) | ✅ |
| loyalty | ✅ | ✅ | ✅ | ❌ (2L) | ❌ (1L) | ✅ |
| minglers | ✅ | ✅ | ✅ | ❌ (2L) | ⚠️ (9L) | ✅ |
| notifications | ✅ | ✅ | ✅ | ❌ (2L) | ❌ (1L) | ✅ |
| profile | ✅ | ✅ | ✅ | ❌ (2L) | ❌ (1L) | ✅ |
| restaurants | ✅ | ✅ | ✅ | ⚠️ (12L *re-export only*) | ❌ (2L) | ✅ |
| roles-access | ✅ | ✅ | ✅ | ❌ (3L) | ❌ (2L) | ✅ |
| users | ✅ | ✅ | ✅ | ❌ (3L) | ❌ (2L) | ✅ |

  - All 13 modules contain *all six* required artifacts, but **most `types.ts` and `constants.ts` are 1–3-line stub re-exports** — they do not contain "> 5 lines of real content" per the audit criterion. The actual types live in `components/types.ts` or are co-located with services.
  - Top-level folders all present: `src/{app,assets,configs,interfaces,locales,mocks,routes,shared,styles}` and `src/app/{atoms,molecules,modules,pages,layout,hooks}` ✓.
- **Violations found:** 22 of 26 (types.ts + constants.ts × 13) files are below the > 5-line threshold.
- **Recommended fix:** Either (a) consolidate the real type definitions into the module root `types.ts` (canonical) and remove the `components/types.ts` redundancy, or (b) relax the audit criterion to "exists and re-exports the canonical types" — but as currently written the spec requires real content.

### Issue 13 — i18n Coverage — ❌ FAIL
- **What was checked:** locales folder size, useTranslation file count, no hardcoded UI strings.
- **Evidence:**
  - `src/locales/en/` contains 14 files (common.json + 13 module namespaces) ✓
  - `useTranslation` used in **96 files** under `src/app/` (target ≥ 70) ✓
  - **Hardcoded UI strings in `ApplicationDetailPage.tsx`:**
    - Line 121: `label: 'Pending'`
    - Line 122: `label: 'Approved'`
    - Line 123: `label: 'Rejected'`
    - Line 131: `label: 'Visible on Mingler App'`
    - Line 136: `label: 'Not visible on Mingler App'`
    - Line 854: `label: 'Overview'` (tab)
    - Line 857: `label: 'Menu'` (tab)
    - Line 865: `label: 'Seating & Tables'` (tab)
    - Line 871: `label: 'Photos & Videos'` (tab)
    - Line 872: `label: 'Documents'` (tab)
    - Line 875: `label: 'Contact Details'` (tab)
    - Plus placeholder copy `'Menu information coming soon.'` (line 860), `'Seating and table management coming soon.'` (line 868).
- **Violations found:** at least 12 hardcoded user-facing strings in ApplicationDetailPage.tsx alone. (Other files likely contain similar issues; not exhaustively swept.)
- **Recommended fix:** Move all `label:` literals into the `approval-queue` locale namespace and wrap with `t('detail.tabs.overview')` etc. Add an ESLint rule (`react/jsx-no-literals` or custom) to prevent regressions. Note: organization-instruction wording — "Mingler App" should be reviewed (the org guidance is about "GoMingle"/"VenDians" wording, not "Mingler", but the same principle applies: avoid hard-coded brand strings in source).

### Issue 14 — Test Coverage ≥ 90% — ❌ CRITICAL FAIL
- **What was checked:** every module has `__tests__/`, ≥ 40 test files, `npm run test` all pass, coverage thresholds met, MSW used.
- **Evidence:**
  - Every module has `__tests__/` ✓
  - **86 test files** discovered (target ≥ 40) ✓
  - **`npm run test -- --run` exited with code 1**:
    - `Test Files  60 failed | 25 passed (85)`
    - `Tests       66 failed | 173 passed (239)`
    - Duration 147.02s.
  - Dominant failure pattern: `TypeError: localStorage.getItem is not a function` thrown from `src/shared/api/httpClient.ts:8` (`getAuthToken`). Affects every service test — `auth`, `approval-queue`, `categories`, `change-log`, `dashboard`, `finances`, `loyalty`, `minglers`, `notifications`, `profile`, `roles-access`, `users`. Suggests the global `localStorage` polyfill isn't present in the test environment for these specs (root cause likely a jsdom/`globals: true` env mismatch or a missing `localStorage` shim — `src/setupTests.ts:1-46` polyfills `matchMedia` and `ResizeObserver` but not `localStorage`).
  - Component test failures (`KpiCard`, `LoginForm`, `CategoryFormModal`, ...) appear to be downstream of the same env issue or related.
  - 20 test files import `from 'msw'` / `http.get` / `http.post` ✓ (MSW usage present).
  - `vite.config.ts:30-35` defines coverage thresholds `lines/functions/statements: 90, branches: 85` ✓.
  - `npm run test:coverage` was **not executed** because the underlying test run already fails. Coverage numbers cannot be reported.
- **Violations found:**
  - 60 test files failing
  - 66 individual tests failing
  - Coverage thresholds unverifiable (tests don't complete green).
- **Recommended fix:** Add `localStorage` polyfill (or use jsdom's built-in via correct env: `// @vitest-environment jsdom` on service test files, or set `environmentMatchGlobs`). Or guard `getAuthToken` with `typeof localStorage !== 'undefined'`. Re-run the suite, then run `npm run test:coverage` to confirm 90/85/90/90.

### Issue 15 — Husky Pre-Commit Hook — ✅ PASS
- **What was checked:** `.husky/pre-commit` invokes lint, typecheck, test, build (or lint-staged); scripts exist; lint-staged config present.
- **Evidence:**
  - `.husky/pre-commit` (300 bytes) contains:
    ```sh
    npx lint-staged
    npm run typecheck
    npm run test -- --run
    npm run build
    ```
  - `package.json:6-18` has scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:run`, `test:ui`, `test:coverage`, `prepare: "husky"`, `format`.
  - `package.json:19-27` contains `lint-staged` config (`*.{ts,tsx}` → eslint+prettier; `*.{css,json,md}` → prettier).
  - Husky shim at `.husky/_/husky.sh` is implied by `npx lint-staged` style.
  - PowerShell `Get-Item` shows `Mode: -a----` — Windows lacks POSIX `x` bit, but git for Windows + husky 9 runs the hook regardless.
- **Violations found:** none
- **Recommended fix:** n/a. Note: because `npm run test -- --run` is currently red (Issue 14), this hook would *block every commit*. Fix Issue 14 to keep developers unblocked.

---

## Violation Index (sorted by severity)

| # | Severity | Issue | File | Line | Description |
|---|----------|-------|------|------|-------------|
| 1 | 🔴 Critical | 14 | (whole suite) | — | 60/85 test files fail; 66/239 tests fail; coverage unmeasurable |
| 2 | 🔴 Critical | 14 | `src/shared/api/httpClient.ts` | 8 | `localStorage.getItem` not available in test env — cascades into all service tests |
| 3 | 🔴 Critical | 3-6 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` | 1280 lines | 6.4× over the 200-line cap; got WORSE since the prior remediation |
| 4 | 🔴 Critical | 11 | `src/shared/i18n/index.ts` | — | Forbidden duplicate path still exists |
| 5 | 🟠 High | 11 | `src/setupTests.ts` | 4 | Production setup imports forbidden `./shared/i18n` |
| 6 | 🟠 High | 11 | `src/test-utils/renderWithProviders.tsx` | 10 | Imports forbidden `../shared/i18n` |
| 7 | 🟠 High | 11 | `src/app/modules/users/userColumns.tsx` | 12 | Imports forbidden `shared/i18n` |
| 8 | 🟠 High | 11 | `src/app/modules/finances/financeColumns.tsx` | 4 | Imports forbidden `shared/i18n` |
| 9 | 🟠 High | 11 | `src/app/modules/finances/components/FinanceComplexColumns.tsx` | 7 | Imports forbidden `shared/i18n` |
| 10 | 🟠 High | 11 | `src/app/modules/finances/components/FinanceBasicColumns.tsx` | 12 | Imports forbidden `shared/i18n` |
| 11 | 🟠 High | 11 | `src/app/modules/change-log/components/changeLogTableHelpers.tsx` | 4 | Imports forbidden `shared/i18n` |
| 12 | 🟠 High | 11 | `src/app/modules/roles-access/components/rolesTableHelpers.tsx` | 4 | Imports forbidden `shared/i18n` |
| 13 | 🟠 High | 11 | `src/app/modules/minglers/components/MinglerDetailTabs.tsx` | 5 | Imports forbidden `shared/i18n` |
| 14 | 🟠 High | 11 | `src/app/modules/minglers/components/minglerColumns.tsx` | 9 | Imports forbidden `shared/i18n` |
| 15 | 🟠 High | 11 | `src/app/modules/restaurants/components/BookingsTableColumns.tsx` | 4 | Imports forbidden `shared/i18n` |
| 16 | 🟠 High | 11 | `src/app/modules/restaurants/components/RestaurantsTableColumns.tsx` | 9 | Imports forbidden `shared/i18n` |
| 17 | 🟠 High | 11 | `src/app/modules/restaurants/components/ReviewsTableColumns.tsx` | 17 | Imports forbidden `shared/i18n` |
| 18 | 🟠 High | 8 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` | 93 occurrences | Heavy static inline styles |
| 19 | 🟠 High | 8 | `src/app/modules/approval-queue/ApprovalQueuePage.tsx` | 32 occurrences | Static `CARD_STYLE`/`LABEL_STYLE` consts inlined via `style={…}` |
| 20 | 🟠 High | 8 | 130 .tsx files | total 1011 | Inline `style={{` count is ~20× the spec budget |
| 21 | 🟠 High | 3-6 | `src/app/modules/approval-queue/ApprovalQueuePage.tsx` | 641 | 3.2× cap |
| 22 | 🟠 High | 3-6 | `src/app/modules/minglers/components/MinglerReviewsTab.tsx` | 514 | 2.6× cap |
| 23 | 🟠 High | 3-6 | `src/app/modules/restaurants/RestaurantsPage.tsx` | 508 | 2.5× cap |
| 24 | 🟠 High | 3-6 | `src/app/modules/restaurants/RestaurantDetailPage.tsx` | 430 | 2.2× cap |
| 25 | 🟠 High | 3-6 | `src/app/modules/roles-access/RolesAccessPage.tsx` | 423 | 2.1× cap |
| 26 | 🟠 High | 3-6 | `src/app/modules/users/UsersPage.tsx` | 412 | 2.1× cap |
| 27 | 🟠 High | 3-6 | `src/app/modules/categories/CategoriesPage.tsx` | 407 | 2.0× cap |
| 28 | 🟠 High | 3-6 | 18 more files >200 | — | (full list above) |
| 29 | 🟡 Medium | 13 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` | 121-136, 854-875 | Hardcoded UI strings (`'Pending'`, `'Approved'`, `'Rejected'`, tab labels) |
| 30 | 🟡 Medium | 12 | `src/app/modules/auth/types.ts` | 2L | Stub re-export only — < 5 lines real content |
| 31 | 🟡 Medium | 12 | `src/app/modules/auth/constants.ts` | 1L | `// No module-level constants yet` only |
| 32 | 🟡 Medium | 12 | 20 more types/constants files | — | All < 5 lines real content (see Issue 12 table) |
| 33 | 🟡 Medium | 10 | `src/app/modules/approval-queue/ApprovalQueuePage.tsx` | 167,173,177,347,353,357,363 | `<Col xs={12}>` without sm/md/lg siblings |
| 34 | 🟡 Medium | 10 | `src/app/modules/users/UsersPage.tsx` | 130, 144 | `<Col xs={12}>` without other breakpoints |
| 35 | 🟡 Medium | 10 | `src/app/modules/minglers/components/MinglerBookingsTab.tsx` | 209, 233 | `<Col xs={12}>` without other breakpoints |
| 36 | 🟢 Low | 1 | `src/app/modules/approval-queue/ApplicationDetailPage.tsx` | 111-118 | `as unknown as Record<string,unknown>` chained casts — passes strict but defeats type safety |
| 37 | 🟢 Low | 9 | `src/styles/antd-overrides.css` | full file | Heavy `!important` (justified by header comment, but contravenes the "PASS only if empty" letter) |

---

## Final Master Checklist (from the prompt pack)

- [x] TypeScript `strict: true` enabled in tsconfig.app.json
- [x] `npm run build` passes with 0 errors and 0 warnings
- [x] `npm run lint` passes with 0 errors and 0 warnings
- [x] `npm run typecheck` passes
- [ ] No source file (excluding mocks) exceeds 200 lines — **25 violators**
- [ ] Every module has services.ts, types.ts, constants.ts, components/, hooks/, index.tsx — files exist but **22/26 types/constants are < 5 lines**
- [x] Zero raw fetch() calls outside httpClient.ts and MSW handlers
- [ ] Zero inline `style={{}}` for static layout/colors/spacing — **1011 occurrences**
- [ ] Zero !important in CSS files — heavy use in `antd-overrides.css` (justified)
- [x] Antd Row/Col/Flex used for layouts; Grid.useBreakpoint() for responsive logic
- [ ] No duplicate files (mocks, App.tsx, index.css, etc.) — **`src/shared/i18n/` still present + 13 importers**
- [x] src/app/pages/ and src/app/hooks/ exist
- [ ] Every user-facing string uses t() — **hardcoded tab/status labels in ApplicationDetailPage.tsx**
- [ ] Test coverage ≥90% (lines, functions, statements), ≥85% (branches) — **tests fail; coverage unmeasurable**
- [x] .husky/pre-commit blocks bad commits

---

## Final Verdict

❌ **The codebase must return to development before shipping.**

The good news: TypeScript strictness, the HTTP-client refactor, husky/lint-staged plumbing, build pipeline, lint cleanliness, and the per-module skeleton (services.ts in every module, no rogue `fetch`, no `axios`, no `any`/`@ts-ignore`) are all genuinely in place. Those are real wins worth preserving.

The blockers: (1) **the test suite is red** — 60 of 85 files fail, primarily because `localStorage` isn't polyfilled where `httpClient` is exercised, which cascades through every service test. Fix this first; the pre-commit hook is currently un-passable. (2) **The 200-line cap was not actually enforced** — `ApplicationDetailPage.tsx` regressed from 925 → 1280 lines and 24 other files are over. (3) **The inline-style hygiene rule was largely ignored** — 1011 `style={{` occurrences across 130 files, the vast majority being static layout/spacing/colors that belong in Tailwind or `antd-overrides.css`. (4) **The `src/shared/i18n/` duplicate was never removed** and is now load-bearing across 13 files including `setupTests.ts`. (5) **Hardcoded UI labels** ("Overview", "Menu", "Approved", "Visible on Mingler App") in the largest detail page invalidate the i18n claim.

Must-fix list, in order:
1. Polyfill `localStorage` (or env-guard `getAuthToken`) so the test suite turns green; then run `test:coverage` and confirm 90/85/90/90.
2. Decompose `ApplicationDetailPage.tsx` (1280 → ≤ 200) and the other 24 oversized files; lift inline-style consts into Tailwind in the same pass — they're the bulk of the lines and the bulk of the inline-style violations.
3. Relocate `src/shared/i18n/index.ts` (suggest `src/configs/i18n.ts`), update all 13 importers, delete the directory.
4. Replace hardcoded labels in `ApplicationDetailPage.tsx` with `t(...)` calls under the `approval-queue` namespace; add `react/jsx-no-literals` ESLint rule as a guardrail.
5. Either populate the stub `types.ts` / `constants.ts` per module with the canonical type/constant definitions, or relax the audit's "> 5 lines real content" criterion in the spec — pick one.

Estimated effort: 3–5 engineer-days for items 1, 3, 4; items 2 and 5 are 5–10 days depending on how aggressively the largest pages are decomposed.
