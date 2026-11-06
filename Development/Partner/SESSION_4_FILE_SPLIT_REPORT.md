# Session 4 — File Size Split: ApplicationDetailPage.tsx (Issue 6)

**Project:** gomingle (Admin Portal)
**Date:** 2026-05-20
**Branch:** main (working tree, **NOT committed** per user instruction)
**Issue targeted:** Issue 6 — File size ≤ 200 lines (guideline Section 2), specifically the 1,280-line audit worst-offender `ApplicationDetailPage.tsx`.

---

## Section 1: File Size Summary

### Before this session

| File                                                       |        Lines |
| ---------------------------------------------------------- | -----------: |
| `src/app/modules/approval-queue/ApplicationDetailPage.tsx` | **1,280** ❌ |

### After this session

| File                                                                           |   Lines |   Status    |
| ------------------------------------------------------------------------------ | ------: | :---------: |
| `src/app/modules/approval-queue/ApplicationDetailPage.tsx`                     | **200** | ✅ at limit |
| `src/app/modules/approval-queue/appDetailHelpers.ts` (new)                     |      58 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailHero.tsx` (new)            |     167 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailOverviewTab.tsx` (new)     |     166 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailApproveModal.tsx` (new)    |     169 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailDeclineModal.tsx` (new)    |     169 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailDocumentsTab.tsx` (new)    |     155 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailVideosCard.tsx` (new)      |     146 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailPhotosCard.tsx` (new)      |     123 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailActionButtons.tsx` (new)   |      81 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailDeclinedBanner.tsx` (new)  |      51 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailPlaceholderTab.tsx` (new)  |      34 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailPhotosVideosTab.tsx` (new) |      14 |     ✅      |
| `src/app/modules/approval-queue/components/AppDetailNotProvided.tsx` (new)     |       6 |     ✅      |
| `src/app/modules/approval-queue/components/utils.ts` (extended, +12 lines)     |      26 |     ✅      |

**All 14 new/edited files are ≤ 200 lines.** Total LOC across the new files: ~1,365 (slightly more than the original 1,280 because of typed props interfaces, individual imports, and prop-drilling boilerplate — a normal trade-off for splitting a monolith).

### Repo-wide oversized file count

| Snapshot           |                                          Files > 200 lines |
| ------------------ | ---------------------------------------------------------: |
| V2 baseline        |                                                         25 |
| After this session | **24** (`ApplicationDetailPage.tsx` removed from the list) |

---

## Section 2: New Components Created

| #   | File                                                     | Lines | Props interface                                                                                                                                                      | Purpose                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `AppDetailNotProvided.tsx`                               |     6 | _(none)_                                                                                                                                                             | The italicised "Not provided" placeholder span used inside `OverviewField.value`.                                                                                                                                                        |
| 2   | `AppDetailPlaceholderTab.tsx`                            |    34 | `{ icon: ReactNode; label: string }`                                                                                                                                 | "Coming soon" placeholder card used by the Menu and Seating & Tables tabs.                                                                                                                                                               |
| 3   | `AppDetailActionButtons.tsx`                             |    81 | `{ onApproveClick: () => void; onDeclineClick: () => void }`                                                                                                         | The pair of Decline / Approve buttons rendered inside the hero; uses `Grid.useBreakpoint` to flex on mobile.                                                                                                                             |
| 4   | `AppDetailDeclinedBanner.tsx`                            |    51 | `{ rejectedOnDate: string; rejectedReason: string \| undefined }`                                                                                                    | The red "Application Declined" banner shown above the tabs for rejected applications.                                                                                                                                                    |
| 5   | `AppDetailHero.tsx`                                      |   167 | `{ application; isPending; platformStatusStyle; visibilityStyle; onApproveClick; onDeclineClick }`                                                                   | The avatar + name + status badges + meta line + actions block at the top of the page. Contains an internal `StatusBadge` sub-component.                                                                                                  |
| 6   | `AppDetailOverviewTab.tsx`                               |   166 | `{ application; category; seatingCapacity; averageBill; operatingHours; website; mingleFriendly; area; mapsUrl }`                                                    | The "Restaurant Details" + "Location & Address" `OverviewField` grid (the Overview tab body).                                                                                                                                            |
| 7   | `AppDetailPhotosCard.tsx`                                |   123 | `{ application }`                                                                                                                                                    | Photos grid card (1 of 2 cards in the media tab).                                                                                                                                                                                        |
| 8   | `AppDetailVideosCard.tsx`                                |   146 | `{ application }`                                                                                                                                                    | Videos grid card (1 of 2 cards in the media tab).                                                                                                                                                                                        |
| 9   | `AppDetailPhotosVideosTab.tsx`                           |    14 | `{ application }`                                                                                                                                                    | Composes Photos + Videos cards into the "Photos & Videos" tab.                                                                                                                                                                           |
| 10  | `AppDetailDocumentsTab.tsx`                              |   155 | `{ application }`                                                                                                                                                    | Documents grid (with the file-type icon helper inlined).                                                                                                                                                                                 |
| 11  | `AppDetailApproveModal.tsx`                              |   169 | `{ open; applicationName; selectedCategory; categoryOptions; onCategoryChange; onCancel; onConfirm }`                                                                | The "Approve application?" modal. Note: named to avoid collision with the existing `components/ApproveModal.tsx` (which is used by the queue list page, not the detail page).                                                            |
| 12  | `AppDetailDeclineModal.tsx`                              |   169 | `{ open; applicationName; declineReason; onReasonChange; onCancel; onConfirm }`                                                                                      | The "Decline application?" modal with the textarea and char counter. Same naming rationale as #11.                                                                                                                                       |
| 13  | `appDetailHelpers.ts` (sibling, not under `components/`) |    58 | exports `buildPlatformStatusStyle(currentStatus, t)`, `buildVisibilityStyle(isApproved, t)`, `buildAppWithContacts(application, appRecord)`, type `StatusBadgeStyle` | Pure helpers extracted out of the page body to keep the orchestrator at exactly 200 lines.                                                                                                                                               |
| 14  | `components/utils.ts` (extended)                         |    26 | exports `AVATAR_PALETTE`, `getAvatarColor`, `getInitials`, `notProvidedStyle`                                                                                        | Existing file; added `getInitials` and `notProvidedStyle`. JSX-returning `getFileIcon` was deliberately _not_ added here (would have forced a `.tsx` rename); it's inlined into `AppDetailDocumentsTab.tsx` instead — its only consumer. |

All new files have **typed props interfaces** (no `any`).

---

## Section 3: Parent → Child Communication

Pure prop drilling. No new Context, no new custom hooks were introduced.

**`ApplicationDetailPage` (orchestrator) holds the state:**

- `activeTab`, `approveModalOpen`, `declineModalOpen`, `selectedCategory`, `declineReason`
- `localStatus`, `localRejection` (for the optimistic approve/decline flow)
- The `messageApi` toast instance from `Antd`

**Data flow downward:**

- `<AppDetailHero>` ← `application`, derived status styles, plus callbacks to open the two modals.
- `<AppDetailDeclinedBanner>` ← `rejectedOnDate`, `rejectedReason`.
- `<AppDetailOverviewTab>` ← `application` + 8 individual derived field values (`category`, `seatingCapacity`, …). Could be refactored later into a single typed `OverviewData` object — out of scope this session.
- `<AppDetailPlaceholderTab>` ← `icon` + `label`.
- `<AppDetailPhotosVideosTab>` and `<AppDetailDocumentsTab>` ← `application`.
- `<AppDetailApproveModal>` ← `open`, `applicationName`, `selectedCategory`, `categoryOptions` + 3 callbacks.
- `<AppDetailDeclineModal>` ← `open`, `applicationName`, `declineReason` + 3 callbacks.

Each child component owns its own `useTranslation('approval-queue')` and (where needed) `Grid.useBreakpoint()` — they don't receive `t` or `isMobile` as props. This is the cleanest pattern and aligns with how the rest of the codebase already does things.

---

## Section 4: Guideline Compliance Checklist

- [x] **All files ≤ 200 lines** — Section 2. Every newly-created file and the orchestrator itself are within the limit.
- [x] **Every new file has a typed props interface** — Section 4. All 11 React component files declare an `interface XxxProps` block; the 2 helper files use named function signatures.
- [x] **No new `any` types** — Section 4. Diff search of added lines for `: any\b` / ` as any\b` → **0 hits**.
- [x] **No new inline styles introduced** — Section 5. Diff search showed 2 hits for `style={{`, both of which are identical relocations of the existing `style={{ color: 'var(--color-text-subtle)' }}` from L859/L867 of the original file (the ForkKnife and Chair icons inside the placeholder-card props). The byte-for-byte same style string moved from inline JSX literal to a prop value — not a new style. The Issue 8 inline-style work is still intact for a future session.
- [x] **No new `!important`** — Section 5. 0 hits in the diff.
- [x] **All hardcoded strings still using `t()`** — Section 9. Every previously-wrapped `t(…)` call was preserved verbatim during the extraction. No new English literals introduced (the back-button "Back to approval queue" pre-existed as a literal and was not part of this session's scope).
- [x] **Build clean** — `npm run build` exit 0, built in 6.63 s, 0 errors, 0 warnings.
- [x] **Lint clean** — `npm run lint` (`eslint . --max-warnings 0`) exit 0.
- [x] **Typecheck clean** — `npm run typecheck` exit 0.
- [x] **Module tests pass** — `npx vitest run src/app/modules/approval-queue/__tests__` → **36/36 passed**, 0 failed. No documented flaky test in this module's targeted run.

### Diff summary

```
src/app/modules/approval-queue/ApplicationDetailPage.tsx                |  200 lines (was 1,280) — 1,080 lines removed
src/app/modules/approval-queue/appDetailHelpers.ts                      |   58 lines (new)
src/app/modules/approval-queue/components/AppDetailHero.tsx             |  167 lines (new)
src/app/modules/approval-queue/components/AppDetailOverviewTab.tsx      |  166 lines (new)
src/app/modules/approval-queue/components/AppDetailApproveModal.tsx     |  169 lines (new)
src/app/modules/approval-queue/components/AppDetailDeclineModal.tsx     |  169 lines (new)
src/app/modules/approval-queue/components/AppDetailDocumentsTab.tsx     |  155 lines (new)
src/app/modules/approval-queue/components/AppDetailVideosCard.tsx       |  146 lines (new)
src/app/modules/approval-queue/components/AppDetailPhotosCard.tsx       |  123 lines (new)
src/app/modules/approval-queue/components/AppDetailActionButtons.tsx    |   81 lines (new)
src/app/modules/approval-queue/components/AppDetailDeclinedBanner.tsx   |   51 lines (new)
src/app/modules/approval-queue/components/AppDetailPlaceholderTab.tsx   |   34 lines (new)
src/app/modules/approval-queue/components/AppDetailPhotosVideosTab.tsx  |   14 lines (new)
src/app/modules/approval-queue/components/AppDetailNotProvided.tsx      |    6 lines (new)
src/app/modules/approval-queue/components/utils.ts                      |   +12 lines (added getInitials, notProvidedStyle)
```

Total new files: **13** (12 .tsx + 1 .ts). Total modified files: **2** (`ApplicationDetailPage.tsx`, `components/utils.ts`).

---

## Section 5: UI Verification Required (User Manual Step) 🚨

This was a structural refactor with **no intended visual change**. Every `className`, every `style={{…}}`, every conditional render branch, every JSX wrapper element was copied verbatim from the original into the new child components. The orchestrator's render path is now a sequence of component calls that produce identical DOM to the pre-refactor output.

Per the absolute "UI MUST NOT CHANGE" rule, please verify in `npm run dev`:

### The two states (pending and rejected) and all six tabs

For a **pending application** (e.g. open any application in the Pending tab):

- **Hero** — avatar, name, "Pending" and "Not visible on Mingler App" status pills (mobile) or in-line (desktop); "Decline" / "Approve" buttons render in the correct order with the correct hover transition.
- **Overview tab** — Restaurant Details: Category, Cuisine type, Seating capacity (with the new `{{count}} seats` interpolation), Average bill, Operating hours, Website, Mingle Friendly. Location & Address: Full address (full-width), Area / District, City, and "View on map" link when address is present.
- **Menu tab** — placeholder card with ForkKnife icon and "Menu information coming soon." text.
- **Seating & Tables tab** — placeholder card with Chair icon and "Seating and table management coming soon." text.
- **Photos & Videos tab** — Photos card (6-col desktop / 2-col mobile grid) and Videos card with play icon overlay.
- **Documents tab** — file-type icons (PDF / xls / csv / jpg etc.) in a 3-col desktop / 1-col mobile grid.
- **Contact Details tab** — `ContactDetailsTab` from `restaurants/components/` (was already a shared component; unchanged this session).

Then click **Approve** — verify the modal opens with header "Approve application?", category select, the helper text "A category must be selected before approval can proceed.", Cancel/Confirm approval buttons. Select a category, click Confirm approval — the application's status changes to Approved, the modal closes, the success toast appears.

Click **Decline** — verify the modal opens with header "Decline application?", textarea with 500-char limit, "Ready to submit" / "Minimum 10 characters required" indicator, Cancel/Confirm decline buttons. Type 10+ chars, click Confirm decline — the status changes to Rejected, the rejection banner appears.

For a **rejected application** (e.g. open one from the Rejected tab):

- Hero shows "Rejected" + "Not visible on Mingler App" badges and no action buttons.
- Below the hero, the **red declined banner** shows: "Application Declined" + "Declined on {date}" + the rejection reason in a quoted-blockquote style.

### Three viewports

Spot-check at 1440 px (desktop) / 768 px (tablet, exact `md` breakpoint) / 375 px (mobile). The mobile hero should stack vertically with the badges wrapping; the tabs become a `<Select>` dropdown.

---

## Section 6: Next Steps

1. Working tree is ready for review. **Nothing committed.**
2. Inspect with:
   ```
   git status
   git diff --stat
   git diff src/app/modules/approval-queue/ApplicationDetailPage.tsx
   ```
3. Walk through the page in `npm run dev` per Section 5 at 375 / 768 / 1440 px.
4. Hand off to designer for a final UI parity check (if not already done as part of Session 3).
5. After designer approval, commit manually. Recommended commit message:

   ```
   refactor(approval-queue): split ApplicationDetailPage into sub-components per guideline Section 2

   Reduces ApplicationDetailPage.tsx from 1,280 → 200 lines (the audit's worst
   file-size offender). All extracted pieces are ≤ 170 lines with typed props
   interfaces and own their useTranslation hook.

   New files (under components/ unless noted):
     - AppDetailHero.tsx (167) — avatar + name + status badges + actions
     - AppDetailActionButtons.tsx (81) — the Decline / Approve buttons
     - AppDetailOverviewTab.tsx (166) — Restaurant Details + Location & Address
     - AppDetailPlaceholderTab.tsx (34) — generic "coming soon" tab card
     - AppDetailPhotosVideosTab.tsx (14) — composes Photos + Videos cards
     - AppDetailPhotosCard.tsx (123)
     - AppDetailVideosCard.tsx (146)
     - AppDetailDocumentsTab.tsx (155)
     - AppDetailApproveModal.tsx (169)
     - AppDetailDeclineModal.tsx (169)
     - AppDetailDeclinedBanner.tsx (51)
     - AppDetailNotProvided.tsx (6)
     - ../appDetailHelpers.ts (58) — buildPlatformStatusStyle, buildVisibility-
       Style, buildAppWithContacts

   Existing components/utils.ts extended with getInitials + notProvidedStyle
   (AVATAR_PALETTE / getAvatarColor were already there).

   No UI / no business logic / no inline-style changes — pure structural split.
   ```

6. Husky pre-commit will block on the documented `users/UsersPage.test.tsx > creates a new user` parallelism-flaky test (Session 1 parking lot) — same `--no-verify` pattern as Sessions 1-3.

---

## Section 7: Audit Impact

| Issue                     | Before this session                                                            | After this session                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 6 — File size ≤ 200 lines | ❌ FAIL — 25 files > 200, worst was `ApplicationDetailPage.tsx` at 1,280 lines | ⚠️ **PARTIAL — major progress** — 24 files > 200; the worst file is now `ApprovalQueuePage.tsx` at 641 lines |

Note: Issue 6 is not yet fully ✅ — there are still 24 files over 200 lines. The audit's worst-offender file is now resolved; the next biggest targets (in priority order) are `ApprovalQueuePage.tsx` (641), `MinglerReviewsTab.tsx` (514), `RestaurantsPage.tsx` (508), `RestaurantDetailPage.tsx` (430), `RolesAccessPage.tsx` (423), `UsersPage.tsx` (412), `CategoriesPage.tsx` (407).

No other audit issues regress. The Session 3 i18n work is preserved verbatim — every `t(…)` call from the original was carried through into the appropriate child component.

---

## Section 8: Open Items / Out-of-Scope

1. **`ApprovalQueuePage.tsx` (641 lines)** — next-biggest file in the same module. Similar extraction pattern would apply.
2. **24 other oversized files** in other modules — separate Issue 6 sessions.
3. **Inline-style conversion** (Issue 8 — 964 inline styles) — every extracted file still carries its original inline styles verbatim. Issue 8 cleanup is a separate session.
4. **`Back to approval queue`** literal text in `ApplicationDetailPage.tsx:171` — pre-existing hardcoded string the i18n key `detail.backToQueue` already exists for. Could be wired in a future i18n micro-session.
5. **`AppDetailOverviewTab` accepts 9 individual props** — could be condensed into a single typed `OverviewData` object for cleanliness, but that's nit-level and the prompt forbade "improvements" beyond what the task required.
6. **`ApproveModal.tsx` (existing, used by the queue list page) and `AppDetailApproveModal.tsx` (new, used by the detail page) coexist with similar names.** The naming convention is consistent with the existing `AppDetailOverviewField.tsx` / `OverviewField.tsx`-style separation in this codebase. If a future cleanup wants to unify them, that's a separate refactor.

---

_Generated at `C:\Users\baber.ali_venturediv\Documents\Project\GoMingle\gomingle` on branch `main`, 2026-05-20. Working tree only — no git commits made._
