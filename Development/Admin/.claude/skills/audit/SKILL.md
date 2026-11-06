---
name: codebase-auditor
description: Full codebase quality audit orchestrator for the GoMingle Admin Portal. Scans the entire src/ directory against all best practices, generates a priority-rated report (HIGH/MEDIUM/LOW) using the report-template.md, verifies MSW handler coverage, checks test coverage, and produces a score out of 100.
---

# Full Codebase Audit — GoMingle Admin Portal

Run this when the user asks to audit the full codebase for quality, best practices, or code health.

## How to invoke

User says:

> "Audit the entire codebase using `docs/audit/SKILL.md` and generate the full report."

Output: a priority-rated report written to `docs/audit/report.md` using `docs/audit/report-template.md`.

---

## Audit workflow

### Phase 1 — Gather signals (run all simultaneously)

```bash
npm run lint          # capture full output — every error and warning
npm run typecheck     # capture all TS errors
npm run test:coverage # capture coverage % per file and totals
```

Save all output. If commands fail to run, note why and continue manually.

### Phase 2 — Folder structure scan

Walk `src/` and check against these rules:

1. Every module under `src/` that has a page or component fetching data must have a non-empty `hooks/` directory
2. Every module must have a `__tests__/` directory with at least one test file
3. Types must live in `src/<module>/types/` or `src/shared/types/` — not inline in component files
4. `src/shared/components/` — only truly reusable components (not module-specific ones)
5. `src/mocks/data/` — one fixture file per domain module

Flag every violation with: module name, rule broken, severity.

### Phase 3 — React Query audit

For every module that renders a list or fetches data:

1. Search for `useQuery` and `useMutation` calls in page/component files → each is a **HIGH** finding
2. Search for `useQuery` in `hooks/` files → verify `enabled`, query key completeness, all 3 states rendered
3. Search for `useMutation` in `hooks/` files → verify `invalidateQueries` called on success
4. Check query key consistency across modules

### Phase 4 — RTK slice audit

For each file in `src/shared/store/`:

1. Check `initialState` for any hardcoded mock/test data → **HIGH** if found
2. Check for `localStorage` writes inside reducer functions → **HIGH** if found
3. Check that selectors are defined and exported from the slice file
4. Check that slice state is properly typed (no `any`, no `Record<string, unknown>`)

### Phase 5 — Security audit

Check these specific files:

| File                            | Check                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| `src/app/PermissionGuard.tsx`   | Always renders children regardless of role? → **HIGH**        |
| `src/shared/store/authSlice.ts` | Tokens stored in plain unencrypted `localStorage`? → **HIGH** |
| Any component file              | Hardcoded secrets or API keys? → **HIGH**                     |
| Any component file              | Sensitive data logged via `console.*`? → **MEDIUM**           |

Tag security findings with OWASP category (A01–A10).

### Phase 6 — MSW coverage audit

Read `src/mocks/handlers/index.ts` and all handler files. For each module in `src/`:

1. List all API paths the module calls (search for `apiClient.get/post/patch/delete` or fetch calls)
2. Check each path has a corresponding MSW handler
3. Check each handler has at least one success path AND one error path
4. Check pagination params are handled for list endpoints

See `docs/skills/msw/patterns.md` section 6 for known gaps.

### Phase 7 — TypeScript quality

Search across `src/`:

1. Any `any` type usage → **HIGH** per occurrence
2. Any `Record<string, unknown>` used as a component prop type → **MEDIUM**
3. Non-null assertions (`!`) on values that could legitimately be null → **MEDIUM**
4. Missing return types on exported functions → **LOW**

### Phase 8 — i18n audit

Search for string literals inside JSX (text between tags or in props like `placeholder`, `title`, `label`):

1. Visible UI strings not wrapped in `t()` → **MEDIUM** per component
2. Hardcoded language-specific text (dates, currency formats) → **MEDIUM**

### Phase 9 — Dependency audit

Check `package.json`:

1. Packages declared as dependencies but with zero usage in `src/` → **LOW** (e.g. Zustand — 0 stores found)
2. Dev dependencies accidentally imported in production code → **MEDIUM**

---

## Scoring

Score out of 100 using this formula:

| Category                    | Max Points | Deductions                                                                        |
| --------------------------- | ---------- | --------------------------------------------------------------------------------- |
| TypeScript (no `any`)       | 15         | -3 per `any` usage (max 15)                                                       |
| Test coverage ≥ 90%         | 20         | -2 per module below 90%                                                           |
| React Query (hooks pattern) | 15         | -5 per inline useQuery in page                                                    |
| RTK quality                 | 10         | -5 per mock data in initialState, -5 for raw localStorage in reducer              |
| Security                    | 20         | -10 for PermissionGuard stub, -5 for plain token storage, -5 per hardcoded secret |
| MSW coverage                | 10         | -2 per missing handler                                                            |
| Folder structure            | 5          | -1 per violation                                                                  |
| i18n compliance             | 5          | -1 per un-translated string (max 5)                                               |

Score < 70 = Needs significant work  
Score 70–89 = Acceptable with fixes  
Score ≥ 90 = Meets quality gate

---

## Output

Write findings to `docs/audit/report.md` using the template at `docs/audit/report-template.md`.

Return to the user:

- The score
- Count of HIGH / MEDIUM / LOW findings
- Path to the report file
- Top 3 most impactful fixes to make first
