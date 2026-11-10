# Session 3 — i18n Hardcoded Strings (Issue 13)

**Project:** gomingle (Admin Portal)
**Date:** 2026-05-20
**Branch:** main (working tree, **NOT committed** per user instruction)
**Files modified:** 2
**Issue targeted:** Issue 13 — Hardcoded English strings (guideline Section 9)
**Scope:** ApplicationDetailPage.tsx only — the audit's flagged worst-offender file. 15 strings fixed.

---

## Section 1: Strings Fixed Per Module

| Module         | Strings Fixed | New Keys Added | Existing Keys Reused |
| -------------- | ------------: | -------------: | -------------------: |
| approval-queue |        **15** |          **8** |                **3** |
| **Total**      |        **15** |          **8** |                **3** |

No other modules were touched this session. The user can run Session 3 again to extend coverage to the remaining modules / lower-priority strings (see Section 8).

---

## Section 2: ApplicationDetailPage.tsx — All 10 Known Offenders + 5 Adjacent

The user's audit identified 10 known offenders. All 10 are now using `t()`. Five adjacent strings (the inverse "Not visible…" / "Pending assignment" + 3 remaining tab labels) were fixed in the same pass to keep the file's i18n state consistent.

| #   | Original (V2 baseline)                                                                    | Line | After this session                                  |
| --- | ----------------------------------------------------------------------------------------- | ---: | --------------------------------------------------- |
| 1   | `'Pending'` (badge label)                                                                 | L121 | `t('card.pending')`                                 |
| 2   | `'Approved'` (badge label)                                                                | L122 | `t('card.approved')` _(new key)_                    |
| 3   | `'Rejected'` (badge label)                                                                | L123 | `t('card.rejected')`                                |
| 4   | `'Visible on Mingler App'`                                                                | L131 | `t('detail.visibleOnApp')` _(new key)_              |
| 5   | `'Not visible on Mingler App'` _(adjacent — inverse of #4)_                               | L136 | `t('detail.notVisibleOnApp')` _(new key)_           |
| 6   | `'Pending assignment'`                                                                    | L357 | `t('detail.pendingAssignment')` _(new key)_         |
| 7   | `Documents` (Photos card sibling `<h3>`)                                                  | L739 | `{t('detail.tabs.documents')}`                      |
| 8   | `label: 'Overview'` (tab)                                                                 | L854 | `label: t('detail.tabs.overview')`                  |
| 9   | `label: 'Menu'` (tab)                                                                     | L857 | `label: t('detail.tabs.menu')` _(new key)_          |
| 10  | `'Menu information coming soon.'` (tab placeholder)                                       | L860 | `t('detail.menuComingSoon')` _(new key)_            |
| 11  | `label: 'Seating & Tables'` (tab) _(adjacent — Priority 2)_                               | L864 | `label: t('detail.tabs.seatingTables')` _(new key)_ |
| 12  | `'Seating and table management coming soon.'` (tab placeholder) _(adjacent — Priority 2)_ | L867 | `t('detail.seatingComingSoon')` _(new key)_         |
| 13  | `label: 'Photos & Videos'` (tab) _(adjacent — Priority 2)_                                | L870 | `label: t('detail.tabs.media')`                     |
| 14  | `label: 'Documents'` (tab)                                                                | L872 | `label: t('detail.tabs.documents')`                 |
| 15  | `label: 'Contact Details'` (tab)                                                          | L875 | `label: t('detail.tabs.contacts')`                  |

Also activated `useTranslation` in the file: previously declared as `const { t: _t } = useTranslation('approval-queue'); void _t` (renamed and discarded). Now `const { t } = useTranslation('approval-queue')` — the hook output is consumed.

---

## Section 3: New Translation Keys Added (`src/locales/en/approval-queue.json`)

**Added 8 keys** — all values are byte-equivalent to the original JSX literals so rendered text is identical:

Added to `card.*`:

```json
"approved": "Approved"
```

Added to `detail.tabs.*`:

```json
"menu": "Menu",
"seatingTables": "Seating & Tables"
```

Added directly under `detail`:

```json
"menuComingSoon": "Menu information coming soon.",
"seatingComingSoon": "Seating and table management coming soon.",
"pendingAssignment": "Pending assignment",
"visibleOnApp": "Visible on Mingler App",
"notVisibleOnApp": "Not visible on Mingler App"
```

JSON file went from 150 → 158 lines. `node -e "JSON.parse(...)"` validates cleanly. All 14 locale JSONs across `src/locales/en/` parse cleanly.

**Side note (pre-existing, NOT touched):** `approval-queue.json` contains pre-existing duplicate top-level keys (`table`, `detail`, `approve` appear twice). I deliberately added all new keys to the _second / winning_ occurrence of `detail` and to the single-occurrence `card` block to avoid being silently swallowed by JS's last-wins deserialisation. The duplicate-key cleanup is out of scope for Session 3 (it would be a wider locale-file audit).

**Three existing keys reused** (verified case-identical to the original JSX literal):

- `card.pending` — "Pending"
- `card.rejected` — "Rejected"
- `detail.tabs.overview` — "Overview"
- `detail.tabs.documents` — "Documents" (used twice)
- `detail.tabs.media` — "Photos & Videos"
- `detail.tabs.contacts` — "Contact Details"

---

## Section 4: useTranslation Count

- **Before Session 3:** 84 files in `src/app/`
- **After Session 3:** 84 files (no new file gained the hook — `ApplicationDetailPage.tsx` already had it imported but commented-out)

Target ≥ 70 — exceeded throughout.

---

## Section 5: Guideline Compliance Checklist

- [x] All user-facing strings via `t()` — Section 9 _(within scope: the 15 strings in ApplicationDetailPage.tsx; broader codebase still has open work)_
- [x] No new inline styles — Section 5 (diff search: 0 new `style={{`)
- [x] No new `!important` — Section 5 (diff search: 0)
- [x] No new `any` — Section 4 (diff search: 0)
- [x] All files still ≤ pre-session line counts — Section 2 (`ApplicationDetailPage.tsx`: 1,280 → **1,279** lines, no new oversize regression; the file remains > 200 from V2 baseline, but is _not_ worse)
- [x] **Build passes** — `npm run build` exit 0, built in 6.72 s, 0 errors, 0 warnings
- [x] **Lint passes** — `npm run lint` exit 0, 0 errors, 0 warnings
- [x] **Typecheck passes** — `npm run typecheck` exit 0
- [x] **Test results unchanged** — `npx vitest run src/app/modules/approval-queue/__tests__` → 6 files, 36 tests, **36 passed, 0 failed**
- [x] **JSON files all valid** — `node -e "JSON.parse(...)"` exit 0 for all 14 locale JSONs

### Diff stats

```
src/app/modules/approval-queue/ApplicationDetailPage.tsx | 33 +++++++++++-----------
src/locales/en/approval-queue.json                       |  8 ++++++
2 files changed, 24 insertions(+), 17 deletions(-)
```

---

## Section 6: UI Verification Required (User Manual Step) 🚨

Per the absolute rule "TEXT MUST RENDER IDENTICALLY," every JSON value was set to the byte-exact original literal. Verification still needed in browser:

Open the dev server (`npm run dev`) and navigate to **Approval Queue → click any application**. At each tab, verify the displayed text is **byte-identical** to before:

1. **Status badge** (top-right of detail page):
   - Pending application → badge reads "Pending"
   - Approved application → badge reads "Approved"
   - Rejected application → badge reads "Rejected"
2. **Visibility chip** (next to status badge, approved applications only):
   - "Visible on Mingler App" (green) for approved
   - "Not visible on Mingler App" (red) for non-approved (if rendered)
3. **Overview tab → "Application Details" section**: when no category is assigned, the field reads "Pending assignment" in italic muted text.
4. **Documents tab**: header reads "Documents".
5. **Tab bar** order and labels (left to right): "Overview", "Menu", "Seating & Tables", "Photos & Videos", "Documents", "Contact Details" — all identical.
6. **Menu tab** placeholder: "Menu information coming soon."
7. **Seating & Tables tab** placeholder: "Seating and table management coming soon."

If any text differs (typo, casing, punctuation), please report which string — the most likely cause would be a JSON parser keeping the wrong key from the file's pre-existing duplicate top-level keys, in which case the fix is to clean up the JSON (separate Session 3.5 ticket).

### Test viewports

The strings are static text labels, so the visual is identical at every viewport. Spot-check at **1440 px / 768 px / 375 px** to confirm no unexpected layout interaction.

---

## Section 7: Next Steps

1. Working tree is ready for review. **Nothing committed.**
2. Inspect:
   ```
   git status
   git diff
   ```
3. After visual verification, commit manually. Recommended commit message:

   ```
   feat(i18n): wrap hardcoded UI strings in ApplicationDetailPage.tsx with t() per guideline Section 9

   15 strings now use t() — all 10 audit-flagged offenders plus 5 closely-related
   tab labels and placeholders to keep the file's i18n state consistent.

   New keys added to src/locales/en/approval-queue.json:
   - card.approved
   - detail.tabs.menu
   - detail.tabs.seatingTables
   - detail.menuComingSoon
   - detail.seatingComingSoon
   - detail.pendingAssignment
   - detail.visibleOnApp
   - detail.notVisibleOnApp
   ```

4. Husky pre-commit will block on the documented parallelism-flaky tests — use `--no-verify` (same pattern as Sessions 1 and 2).

---

## Section 8: Out-of-Scope Items (Future Sessions)

This session was deliberately limited to ApplicationDetailPage.tsx (audit's worst-offender) per the scope rule. The following hardcoded strings remain in the same file and elsewhere — **NOT fixed in Session 3**:

### Still hardcoded in `ApplicationDetailPage.tsx`

- **OverviewField labels** (10 instances on lines 338–421): "Category", "Cuisine type", "Seating capacity", "Average bill", "Operating hours", "Website", "Mingle Friendly", "Full address", "Area / District", "City"
- **SectionCard titles**: "Location & Address" (L402) and similar
- **Photos card** `<h3>` (L490): "Photos"
- `<NotProvided />` helper (L78): "Not provided"
- "Application Declined" (L987), "Declined on {date}" (L990) — corresponding keys already exist in JSON (`detail.declinedTitle`, `detail.declinedOn`); just need to be wired in
- Numerous OverviewField `value` strings like "{seatingCapacity} seats" (interpolated)

### Other modules with known hardcoded strings (not in this session)

- `approval-queue/ApprovalQueuePage.tsx` (641 lines, also a file-size offender)
- The other 11 modules contain varying degrees of remaining hardcoded text

### Pre-existing JSON cleanup opportunity (NOT a regression)

`src/locales/en/approval-queue.json` has duplicate top-level keys (`table`, `detail`, `approve`). At parse time the _last_ occurrence wins; the first blocks are dead code. This is an architectural cleanup, not a remediation issue — could be done in a dedicated locale-file refactor.

### Recommended next session

Either:

- **Session 3.5:** continue ApplicationDetailPage.tsx — finish the 10 remaining OverviewField labels + Photos `<h3>` + "Not provided" + "Application Declined"/"Declined on" wiring. Adds ~14 strings. ~30 min.
- **Session 3b:** apply the same pattern to ApprovalQueuePage.tsx (the 641-line worst sibling).
- **Session 3.json:** clean up duplicate keys in `src/locales/en/approval-queue.json` (low-risk, no UI impact).

---

## Section 9: Audit Impact

| Issue                       | V2 baseline                                                   | After Session 1 | After Session 2 (uncommitted) | After Session 3 (uncommitted)                                                                                                   |
| --------------------------- | ------------------------------------------------------------- | --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 13 — i18n Hardcoded Strings | ❌ FAIL (≥ 11 hardcoded in `ApplicationDetailPage.tsx` alone) | ❌ FAIL         | ❌ FAIL                       | **⚠️ PARTIAL** — all 10 named audit offenders fixed; ~14 lower-priority strings remain in same file, plus broader codebase work |

No other audit issues regress or change with this session.

---

_Generated at `C:\Users\baber.ali_venturediv\Documents\Project\GoMingle\gomingle` on branch `main`, 2026-05-20. Working tree only — no git commits made._
