# GoMingle Admin Panel — Coverage Report

**Audit Date:** 2026-05-21  
**User Stories Version:** v5 (May 2026)  
**Audited by:** Automated code audit  
**Project:** GoMingle MVP | GoMingle

---

## Summary

| Status            | Count  |
| ----------------- | ------ |
| ✅ COMPLETE       | 0      |
| ⚠️ PARTIAL        | 16     |
| ❌ MISSING        | 1      |
| **Total Stories** | **17** |

> **Critical cross-cutting gap:** Almost every write operation (create, edit, delete, suspend, save) operates on local React state only and never calls the real API. The service layer (`services.ts`) files are implemented but not wired to UI mutations in most modules. This is the single highest-priority issue spanning the entire portal.

> **Note on SA1:** Dashboard is marked "removed from scope per v5" in the user stories doc, but the code is fully implemented. The route `/dashboard` hard-redirects to `/restaurants`, making it unreachable. Treated as ⚠️ PARTIAL.

---

## Full Story Coverage

---

### SA0 – Login

**Status: ⚠️ PARTIAL**

| AC  | Description                                        | Status | Notes                                                                                                                                                                                   |
| --- | -------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Successful login, role loading, tokens issued      | ⚠️     | Form present; onFinish uses hardcoded DEMO_EMAIL/DEMO_PASSWORD check instead of `authService.login()`; token never stored in `auth-token` key that `httpClient` reads for Bearer header |
| AC2 | Invalid credentials error, failed attempt recorded | ⚠️     | Error messages shown; failed attempt counter uses localStorage; but no real API call validates credentials                                                                              |
| AC3 | Lockout after 5 failures, 15-min timer             | ♻️     | **Superseded — see the note below.** The prototype's `MAX_ATTEMPTS`/`LOCKOUT_DURATION_MS`/`auth-lockout` localStorage lockout was removed by CR-019; enforcement is the Pre-Auth Lambda |
| AC4 | Login blocked while locked                         | ♻️     | **Superseded.** The form is deliberately never disabled client-side — only the Lambda can reject the attempt, and it does so before the password is checked                              |
| AC5 | Auto-unlock after 15 minutes                       | ♻️     | **Superseded.** The lock auto-expires with its Redis TTL server-side; nothing is computed from local state on mount                                                                      |
| AC6 | Silent session renewal                             | ✅     | `AuthGuard` dispatches `renewAccessTokenAction` when access token expired but refresh token valid                                                                                       |
| AC7 | Session expiry redirect                            | ✅     | `AuthGuard` dispatches `expireSessionAction`, redirects to `/login`                                                                                                                     |
| AC8 | Role change reflected on next login                | ❌     | `PermissionGuard` is a stub — it ignores the `module` prop and passes all authenticated users unconditionally; role-based navigation never filtered                                     |

**Key missing:** Real `authService.login()` call; `auth-token` localStorage key never written (every API request goes out without a Bearer header); `PermissionGuard` is a non-functional stub; Sidebar nav not filtered by role.

> **Lockout note (MET-1240, 2026-08-24).** The AC3–AC5 rows above describe the
> pre-integration prototype and are no longer the specification. CR-019, applied
> to the Partners pool by J2 BR-02, moves lockout to a Cognito Pre-Authentication
> Lambda with the counter and lock flag in Redis (`auth:fail:{sub}`,
> `auth:lock:{sub}`), keyed by Cognito `sub` and therefore device-independent. A
> browser-owned counter is bypassed by clearing a key, so the client deliberately
> tracks nothing and `auth-lockout` is dead in every build — there are tests
> asserting a stale entry is ignored. The client's whole obligation is to render
> the Lambda's rejection copy verbatim, which `useLoginForm`'s
> `PRE_AUTH_REJECTED` arm does. Reading these rows as "the feature's shape" is
> what produced MET-1240.

---

### SA0.2 – Forgot Password

**Status: ⚠️ PARTIAL**

| AC  | Description                                     | Status | Notes                                                                                                                                           |
| --- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | OTP sent for registered email                   | ⚠️     | Request OTP step present; `handleSendOtp` uses a fake 800ms timeout — `authService.requestOtp()` is never called                                |
| AC2 | OTP rate limiting (3 per 10 min)                | ❌     | No rate-limit counter, no UI block, no `OTP_REQUEST_MAX` constant                                                                               |
| AC3 | Unregistered email shows same message           | ✅     | Same confirmation message regardless of email registration status                                                                               |
| AC4 | Valid OTP within expiry shows new-password form | ⚠️     | `handleVerifyOtp` accepts any 6-digit code — no API call, no expiry check                                                                       |
| AC5 | Incorrect OTP error                             | ❌     | No wrong-code error state — any code passes                                                                                                     |
| AC6 | Expired OTP error + resend option               | ❌     | No expiry error; 60-second resend countdown present but does not enforce 10-min OTP TTL                                                         |
| AC7 | Password updated, logged, redirect              | ⚠️     | UI steps complete; `handleSavePassword` never calls a password-reset API endpoint                                                               |
| AC8 | Password fails complexity → error               | ⚠️     | `getStrength()` enforces uppercase/digit/special/min-8 and blocks Save; mismatch shown; but "must differ from current password" check is absent |

**Key missing:** All three API calls (request OTP, verify OTP, set password) use fake delays; OTP rate limiting entirely absent.

---

### SA0.3 – My Profile

**Status: ⚠️ PARTIAL**

| AC  | Description                                           | Status | Notes                                                                                                                                                 |
| --- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Avatar dropdown accessible from all pages             | ✅     | `UserMenuDropdown` in persistent `Topbar`                                                                                                             |
| AC2 | Change Name — updates name, reflects everywhere       | ⚠️     | Updates Redux + localStorage only; no API call; change log not recorded                                                                               |
| AC3 | Change Password — OTP verification, then new password | ❌     | `ChangePasswordModal` skips OTP entirely — `profile.json` has OTP i18n keys but modal only asks for current + new password with a 1-second fake delay |
| AC4 | OTP rate limiting (3 per 10 min)                      | ❌     | Not implemented (OTP step absent)                                                                                                                     |
| AC5 | Sign Out                                              | ✅     | Confirmation modal → `logoutAction` → redirect to `/login`                                                                                            |

**Additional gap:** `EditProfileModal` renders email as an editable field (not read-only as required); this modal is never opened from the dropdown but the field constraint is wrong.

---

### SA0.4 – Sign Out

**Status: ⚠️ PARTIAL**

| AC  | Description                              | Status | Notes                                                                                                                   |
| --- | ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| AC1 | Sign Out in avatar dropdown, always last | ✅     | Present with confirmation modal                                                                                         |
| AC2 | Session terminated, redirect to login    | ⚠️     | Client-side state cleared, redirect works; but `authService.logout()` never called — server-side tokens not invalidated |
| AC3 | Tokens cannot be reused after sign out   | ❌     | Server never told to invalidate tokens; `auth-token` key (used by `httpClient`) not cleared on logout                   |
| AC4 | Back navigation blocked after sign out   | ✅     | `AuthGuard` uses `<Navigate replace>` preventing back-navigation to authenticated routes                                |
| AC5 | Sign Out accessible from every page      | ✅     | Part of persistent Topbar                                                                                               |

---

### SA1 – Dashboard _(Removed from scope per v5)_

**Status: ⚠️ PARTIAL**

> The story itself is marked out-of-scope. The code exists but the route `/dashboard` is a hard `<Navigate to="/restaurants">` — page is unreachable. No sidebar entry. Documented here for completeness.

| AC      | Description                        | Status | Notes                                               |
| ------- | ---------------------------------- | ------ | --------------------------------------------------- |
| AC1     | Four metric cards                  | ✅     | Code present in `DashboardPage.tsx` / `KpiCard.tsx` |
| AC2–AC5 | Individual KPI cards               | ✅     | All four cards implemented with trend text          |
| AC6     | Per-card independent period toggle | ✅     | `Segmented` component in `KpiCard`                  |
| AC7     | Top 5 Restaurants table            | ⚠️     | Period toggle present but does not filter data      |
| AC8     | Approval Queue widget              | ⚠️     | Reject (×) button has no onClick handler            |
| AC9     | Bookings bar chart                 | ✅     | Recharts `BarChart` with daily data                 |
| AC10    | Revenue by Source donut chart      | ✅     | Recharts `PieChart`                                 |

**Route is a redirect — page unreachable in any role.**

---

### SA2 – Roles and Access

**Status: ⚠️ PARTIAL**

| AC   | Description                                           | Status | Notes                                                                                                         |
| ---- | ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| AC1  | Roles list, pagination 25/pg, name-asc default        | ⚠️     | Pagination at 25; list shown; `defaultSortOrder: 'ascend'` not set on name column — initial sort is API order |
| AC2  | Name column sortable                                  | ✅     | Sorter on name column                                                                                         |
| AC3  | Create role with valid name + ≥1 non-Dashboard module | ✅     | `RoleFormModal` with all validations                                                                          |
| AC4  | Full access option                                    | ✅     | Checkbox sets `fullAccess`; "Full access" chip shown in table                                                 |
| AC5  | All 12 modules selectable                             | ✅     | All 12 modules defined in `RoleFormModal` and `rolesTableHelpers`                                             |
| AC6  | Booking permission scope note                         | ✅     | Booking is non-standalone, note present in form                                                               |
| AC7  | Edit role, changes apply immediately, change log      | ⚠️     | Edit works; no change log API call made                                                                       |
| AC8  | Delete role with no users                             | ✅     | Delete confirmed and fires                                                                                    |
| AC9  | Delete blocked when users assigned                    | ✅     | `hasUsers` guard shows info modal with no delete action                                                       |
| AC10 | Duplicate role name error                             | ❌     | No `onError` handler on save mutation; 409 from backend silently swallowed                                    |

---

### SA3 – Users

**Status: ⚠️ PARTIAL**

| AC   | Description                                       | Status | Notes                                                                                                                          |
| ---- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | Users list, paginated 25/pg, name-asc default     | ⚠️     | Pagination at 25; `defaultSortOrder` not set                                                                                   |
| AC2  | Sortable name and email columns                   | ✅     | Sorters present                                                                                                                |
| AC3  | Search by name or email                           | ⚠️     | Search filter only on name column — email search absent                                                                        |
| AC4  | Create user with all required fields              | ⚠️     | Modal UI complete; `handleNewSave` updates local state only, never calls `usersService.create()`                               |
| AC5  | Email is login credential, no auto-send           | ✅     | System sends no credentials email on create                                                                                    |
| AC6  | Email must be unique                              | ❌     | No `onError` handler; duplicate email error silently swallowed                                                                 |
| AC7  | Status: Active / Deactivated                      | ✅     | Both statuses in the form                                                                                                      |
| AC8  | Reset another user's password, email notification | ⚠️     | `ResetPasswordModal` present; `handleSendPasswordReset` shows success toast but never calls `usersService.sendPasswordReset()` |
| AC9  | Edit user, email read-only, change log            | ⚠️     | Email disabled in `EditUserModal` ✓; `handleEditSave` updates local state only, never calls API; no change log                 |
| AC10 | Delete user, change log                           | ⚠️     | Confirmation modal present; delete updates local state only                                                                    |
| AC11 | Password mismatch error on create                 | ✅     | Custom validator in `NewUserModal`                                                                                             |

**Additional gap:** Password complexity beyond min-8 not enforced in either `NewUserModal` or `ResetPasswordModal` — uppercase, lowercase, digit, special character rules are absent.

---

### SA4 – Categories

**Status: ⚠️ PARTIAL**

| AC   | Description                                          | Status | Notes                                                                                                                                       |
| ---- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | List with all 6 columns, paginated 25/pg, name-asc   | ⚠️     | All columns shown; pagination at 25; `defaultSortOrder: 'ascend'` not set                                                                   |
| AC2  | Name column sortable                                 | ✅     | Sorter present                                                                                                                              |
| AC3  | Create category, all fields, change log              | ⚠️     | `categoriesService.create()` called; no change log API call                                                                                 |
| AC4  | Commission floor calculation                         | N/A    | Backend logic — frontend displays values                                                                                                    |
| AC5  | Penalty floor calculation                            | N/A    | Backend logic — frontend displays values                                                                                                    |
| AC6  | Independent calculations                             | N/A    | Backend concern                                                                                                                             |
| AC7  | Edit category, change log with old/new values        | ⚠️     | `categoriesService.update()` called; no change log                                                                                          |
| AC8  | Delete when no restaurants assigned                  | ✅     | Allowed when `restaurantCount === 0`                                                                                                        |
| AC9  | Delete blocked when restaurants assigned             | ✅     | Blocked with message when `restaurantCount > 0`                                                                                             |
| AC10 | Validation: positive numbers, whole numbers for mins | ❌     | Inputs are plain `<Input>` with `inputMode='decimal'`; no `min=1` rule, no integer constraint — zero, negative, and decimal values accepted |
| AC11 | Duplicate name error                                 | ❌     | No `onError` handler on mutation; silently swallowed                                                                                        |

---

### SA5 – Loyalty Configuration

**Status: ⚠️ PARTIAL**

| AC  | Description                                | Status | Notes                                                                                                                                      |
| --- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Both panels displayed side-by-side         | ✅     | Flex layout with `EarnRateCard` + `RedeemRateCard`                                                                                         |
| AC2 | Earn rate panel fields                     | ✅     | AED/point and cap per booking fields present                                                                                               |
| AC3 | Save earn rate, change log                 | ❌     | `handleSaveEarn` updates local `useState` only — `loyaltyService` is never imported or called; values reset on page refresh; no change log |
| AC4 | Redeem rate panel fields                   | ✅     | Points/AED and min spend fields present                                                                                                    |
| AC5 | Save redeem rate, change log               | ❌     | Same issue as AC3 — local state only                                                                                                       |
| AC6 | Panels save independently                  | ✅     | Separate handlers per panel                                                                                                                |
| AC7 | Points on net billed amount before VAT/tip | N/A    | Backend logic                                                                                                                              |
| AC8 | Validation: positive whole numbers         | ✅     | `InputNumber` with `min=1`, `precision=0` on all four fields                                                                               |

**Critical gap:** `LoyaltyPage` never fetches or persists data via `loyaltyService`. The service and type are implemented but completely unwired from the UI.

---

### SA6 – Restaurants

**Status: ⚠️ PARTIAL**

| AC   | Description                                               | Status | Notes                                                                                                                                                   |
| ---- | --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | List with all columns, paginated 25/pg, join date desc    | ⚠️     | All columns present; pagination at 25; `defaultSortOrder: 'descend'` not set on join date column                                                        |
| AC2  | Detail opens on Overview, correct tab order               | ⚠️     | Overview is default ✓; tab order has extra "Photos & Videos" tab between Menu and Bookings (not in spec); "Seating & Tables" tab is absent              |
| AC3  | Overview tab all fields                                   | ✅     | GPS/map link, alcohol, house rules, dress code, owner info all shown                                                                                    |
| AC4  | Contacts tab                                              | ✅     | Role/name/phone/email for all contacts                                                                                                                  |
| AC5  | Documents tab — preview/download, no file size            | ✅     | File icons + download overlay; no file size displayed                                                                                                   |
| AC6  | Amenities tab — checkboxes, read-only                     | ⚠️     | Amenities shown as icon-badge cards, not checkboxes as specified                                                                                        |
| AC7  | Menu tab — categories/items/prices                        | ✅     | Present                                                                                                                                                 |
| AC8  | Bookings tab — all statuses, search, filter, 25/pg        | ⚠️     | All statuses, search, filter present; pagination is 10/page not 25/page                                                                                 |
| AC9  | Mingler name → profile; row → booking detail with 2 tabs  | ✅     | Navigation and two-tab modal implemented; Itemised Bill disabled for non-Completed                                                                      |
| AC10 | Booking Detail tab content                                | ✅     | All required fields present                                                                                                                             |
| AC11 | Admin cancel from list                                    | ✅     | Cancel action on booking rows                                                                                                                           |
| AC12 | Admin cancel from booking detail view                     | ❌     | Booking detail modal has `footer:null`; no cancel button inside the detail view                                                                         |
| AC13 | Reviews tab — Mingler name → profile; row → review detail | ⚠️     | Row click opens review detail ✓; Mingler name in reviews does NOT navigate to Mingler profile (no `navigate('/minglers/:id')` in `ReviewsTableColumns`) |
| AC14 | Delete review, change log                                 | ⚠️     | Delete works; no change log recorded                                                                                                                    |
| AC15 | Schedule tab read-only                                    | ✅     | Read-only, no edit controls                                                                                                                             |
| AC16 | Seating & Tables tab                                      | ❌     | Tab key `seating-tables` exists in `restaurants.json` i18n but is never added to `buildTabItems()` — tab is completely absent                           |
| AC17 | Deactivation blocked when active bookings exist           | ❌     | No active-booking guard before deactivation; status change has no booking check                                                                         |
| AC18 | Suspend and unsuspend                                     | ✅     | Both actions on list and detail page; requires min-10 char reason                                                                                       |
| AC19 | Change category with change log                           | ⚠️     | `ChangeCategoryModal` functional; no change log API call                                                                                                |

---

### SA7 – Approval Queue

**Status: ⚠️ PARTIAL**

| AC  | Description                                           | Status | Notes                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Pending tab default, Rejected tab with reason         | ✅     | Pending tab default; rejected tab shows reason + timestamp; pending shows all required columns including file count                                                                                                                                                                                                                  |
| AC2 | Row click → application detail with correct tabs      | ⚠️     | Row click navigates to `ApplicationDetailPage` ✓; tab order is wrong: actual tabs are Overview · Menu · Seating & Tables · Photos & Videos · Documents · Contact Details; **Amenities** and **Schedule & Opening Hours** tabs are missing; **Seating & Tables** and **Photos & Videos** are present but must not appear pre-approval |
| AC3 | Approve with category, status → Active, welcome email | ⚠️     | Category required ✓; removes from pending list ✓; status is never set to `Active` persistently; no welcome email sent; no service call (only `getAll` exists in `approvalQueueService`); no action log                                                                                                                               |
| AC4 | Reject with min-10 char reason, moves to Rejected     | ✅     | 10-char validation enforced; record moved to Rejected tab with reason and timestamp                                                                                                                                                                                                                                                  |

---

### SA8 – Minglers

**Status: ⚠️ PARTIAL**

| AC  | Description                                            | Status | Notes                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | List with all columns, paginated 25/pg, join date desc | ⚠️     | All columns present; pagination at 25; `defaultSortOrder: 'descend'` not set on joined column                                                                                                                                    |
| AC2 | About tab — Section 1 "About Me" with all fields       | ⚠️     | All identity fields present including conditional Football/Cricket teams ✓; section heading is "Mingler Identity Questions" not "About Me" as specified                                                                          |
| AC3 | About tab — Section 2 "Mingler Eating Preferences"     | ⚠️     | All eating preference fields present including conditional drinks/cocktail ✓; implemented as a **separate tab** ("Preferences") not as Section 2 within the About tab; heading is "Preferences" not "Mingler Eating Preferences" |
| AC4 | Bookings tab row-click → detail with 2 tabs            | ✅     | Modal with Booking Detail + Itemised Bill (disabled for non-Completed)                                                                                                                                                           |
| AC5 | Reviews tab row-click → review detail                  | ✅     | Modal opens on row click                                                                                                                                                                                                         |
| AC6 | Click Mingler name anywhere in portal → profile        | ⚠️     | Only wired in `RestaurantBookings.tsx`; not implemented in Finances, Change Log, Reviews, or other portal locations with Mingler name references                                                                                 |
| AC7 | Suspend and unsuspend, data preserved                  | ⚠️     | Modals present; loyalty points preserved in state mutation ✓; `minglersService` has no suspend endpoint — change is local state only                                                                                             |

**Structural deviation:** Spec defines one "About" tab containing two labelled sections. Implementation has two separate tabs: "About" (identity) and "Preferences" (eating). This affects tab order and count.

---

### SA9 – Finances

**Status: ⚠️ PARTIAL**

| AC  | Description                                              | Status | Notes                                                                                                                                                                                         |
| --- | -------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Grid with all columns, paginated 25/pg, date desc        | ⚠️     | All 6 columns present; pagination at 25; `defaultSortOrder: 'descend'` not set on date column                                                                                                 |
| AC2 | Restaurant name and date columns sortable                | ✅     | Both have sorter functions                                                                                                                                                                    |
| AC3 | Row click → detail with all financial fields             | ⚠️     | Modal shows Partner Share/GoMingle Share/VAT/Loyalty Redeemed correctly; Loyalty shows `−AED X (Y pts)` ✓; Loyalty dash when zero ✓; **zero Tip renders `—` instead of `AED 0`** as required |
| AC4 | Type column visually distinguishes Commission vs Penalty | ✅     | Color-coded badges (green / amber)                                                                                                                                                            |
| AC5 | Search by restaurant name, booking ID, Mingler name      | ✅     | Search filter dropdowns on all three columns                                                                                                                                                  |
| AC6 | Filter by transaction type                               | ✅     | Column-level filter for commission / penalty                                                                                                                                                  |
| AC7 | Export visible rows to CSV                               | ✅     | `handleExportCsv` calls `exportToCsv` respecting active filters                                                                                                                               |

---

### SA10 – Booking Timers (Settings)

**Status: ❌ MISSING**

No settings module exists anywhere in the codebase. There is no:

- `/settings` or `/booking-timers` route
- Settings page component
- Module directory under `src/app/modules/`
- `ModuleKey` entry
- Sidebar item

All 13 acceptance criteria (global defaults, per-restaurant overrides, Auto No-Show Timer, Waiting Auto-Decline Timer, Booking Cancellation Window, timer logic, validation) are entirely unimplemented.

---

### SA11 – Amenities Management

**Status: ⚠️ PARTIAL**

| AC  | Description                                                          | Status | Notes                                                                                                                                    |
| --- | -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | List: name, description, restaurant count; paginated 25/pg, name-asc | ⚠️     | Name and restaurant count shown; **description column absent** (field not in `Amenity` type); `defaultSortOrder` not set                 |
| AC2 | Create amenity (name required, optional description)                 | ⚠️     | `amenitiesService.create()` called ✓; **no description field** in create form or type                                                    |
| AC3 | Edit amenity — name/description, update all restaurants              | ❌     | No edit button in the actions column; no edit modal; `amenitiesService.update()` exists in service layer but is never called from the UI |
| AC4 | Delete — removes from all restaurant profiles, change log            | ⚠️     | Delete with warning about restaurant removal ✓; no change log API call                                                                   |
| AC5 | Duplicate name blocked                                               | ❌     | No `onError` handler on `createMutation`; duplicate name silently swallowed                                                              |
| AC6 | Restaurant view of amenities (partner portal)                        | N/A    | Partner portal is out of scope for this audit                                                                                            |

---

### SA12 – Change Log

**Status: ⚠️ PARTIAL**

| AC  | Description                                      | Status | Notes                                                                                                                                                                                                              |
| --- | ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | All 8 columns, paginated 25/pg, timestamp desc   | ⚠️     | 6 of 8 columns present (Timestamp, Admin, Action, Old Value, New Value, Module); **Table Name** and **Identity** columns are absent from `ChangeLogTable` and `LogRow` type; `defaultSortOrder: 'descend'` not set |
| AC2 | Timestamp column sortable                        | ✅     | `localeCompare` sorter present                                                                                                                                                                                     |
| AC3 | Search by admin, table name, identity, module    | ⚠️     | Search by admin username and values present; search by table name and identity impossible (columns absent)                                                                                                         |
| AC4 | Filter by action type (Create/Update/Delete)     | ✅     | Column-level filter                                                                                                                                                                                                |
| AC5 | Filter by module                                 | ✅     | Page-level Select dropdown                                                                                                                                                                                         |
| AC6 | Export to CSV with all columns                   | ⚠️     | CSV exports 7 fields; missing Table Name and Identity fields                                                                                                                                                       |
| AC7 | Entries immutable — no edit/delete               | ✅     | No edit or delete actions rendered                                                                                                                                                                                 |
| AC8 | All modules covered                              | ⚠️     | Module filter lists: Categories, Approval Queue, Restaurants, Roles & Access, Loyalty, Minglers, Users, Finance; missing: Bookings, Notifications, Settings                                                        |
| AC9 | Create → Old Value dash; Delete → New Value dash | ✅     | Implemented in `ChangeLogTable`                                                                                                                                                                                    |

---

### SA13 – In-Portal Notifications

**Status: ⚠️ PARTIAL**

| AC   | Description                                                                         | Status | Notes                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | Notification icon on all pages                                                      | ✅     | Bell icon in persistent `Topbar`                                                                                                                             |
| AC2  | Unread badge capped at 99+                                                          | ✅     | `unreadCount > 99 ? '99+' : String(unreadCount)`                                                                                                             |
| AC3  | Dropdown: 5 most recent, icons, title, relative timestamp, description, empty state | ⚠️     | Shows **6 items** (`.slice(0, 6)`) not 5; empty state message absent (empty div rendered instead)                                                            |
| AC4  | Mark all as read                                                                    | ✅     | Present in dropdown header and full page                                                                                                                     |
| AC5  | Per-item mark as read, colored left border                                          | ✅     | Unread: 3px colored left border + "Mark as read" link; read: no border                                                                                       |
| AC6  | Deep-link on item click → relevant record                                           | ❌     | `Notification` type has no `link`/`targetId` field; no `navigate()` call in `NotificationCard` or `NotificationPopover`; clicking notifications does nothing |
| AC7  | "View all notifications" link                                                       | ⚠️     | Button present; `onViewAll` in `Topbar` only calls `setBellOpen(false)` — does not navigate to `/notifications`                                              |
| AC8  | Full page: paginated 25/pg                                                          | ❌     | `NotificationsPage` has no pagination component; flat list                                                                                                   |
| AC9  | Full page rows: all fields + absolute timestamp                                     | ✅     | `NotificationCard` shows icon, title, description, `dayjs` absolute timestamp, read/unread border                                                            |
| AC10 | Full page: filter by notification type                                              | ✅     | Type `Select` with 6 options                                                                                                                                 |
| AC11 | Full page: search by content                                                        | ❌     | No search input in `NotificationsPage`; the `MagnifyingGlass` icon imported is used as empty-state illustration only                                         |
| AC12 | Full page: sort newest/oldest toggle                                                | ❌     | Always newest-first (hardcoded); no sort toggle control                                                                                                      |
| AC13 | Full page: per-item mark as read                                                    | ✅     | `NotificationCard` dispatches `markAsRead(id)`                                                                                                               |
| AC14 | Full page: deep-link on row click                                                   | ❌     | Same as AC6 — no navigation                                                                                                                                  |
| AC15 | 90-day retention / auto-purge                                                       | ❌     | No TTL, no expiry filter, no backend purge call; store uses in-memory mock data                                                                              |
| AC16 | Badge count consistency across dropdown and full page                               | ✅     | Both derive from same Redux store slice                                                                                                                      |
| AC17 | Client-provided trigger list and copy templates                                     | ⚠️     | Marked OPEN in user stories — awaiting client input                                                                                                          |

---

## Prioritised Build List

These are ordered by business impact × implementation complexity. Items at the top unblock the most functionality.

### P1 — Blockers (cannot go live without these)

| #   | Story         | Item                                                                                                                                                                                                                                                                         | Impact                                         |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Cross-cutting | **Wire all write mutations to real API** — every module uses local `useState`; `usersService`, `rolesService`, `categoriesService`, `loyaltyService`, `amenitiesService`, `minglersService`, and `approvalQueueService` methods exist but are never called from UI mutations | All modules non-functional for persistent data |
| 2   | SA0           | **Real `authService.login()` integration** — replace `DEMO_EMAIL` check; populate `auth-token` in localStorage so `httpClient` Bearer header works                                                                                                                           | Every API call fails silently                  |
| 3   | SA0 / SA2     | **Unblock `PermissionGuard`** — call `hasAccess(role, module)` from `permissions.ts` (already implemented) instead of the current stub; filter Sidebar nav using `getAccessibleModules()`                                                                                    | Security: all roles see all modules            |
| 4   | SA10          | **Build Booking Timers / Settings module** — global defaults and per-restaurant overrides for Auto No-Show Timer, Waiting Auto-Decline Timer, Booking Cancellation Window; all 13 ACs                                                                                        | Entire module missing                          |
| 5   | SA0.4         | **Server-side logout** — call `authService.logout()` to invalidate tokens server-side; clear `auth-token` from localStorage                                                                                                                                                  | Tokens reusable after sign-out                 |

### P2 — High Priority (core user flows broken)

| #   | Story | Item                                                                                                                                                                                                                                      |
| --- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | SA0.2 | Replace fake OTP delays with real `authService.requestOtp()` and `authService.verifyOtp()` calls; add wrong-code and expired-code error states                                                                                            |
| 7   | SA0.2 | Implement OTP rate limiting (3 requests per 10-minute window)                                                                                                                                                                             |
| 8   | SA0.3 | Implement OTP verification step in `ChangePasswordModal` (i18n strings already prepared in `profile.json`)                                                                                                                                |
| 9   | SA7   | Fix Application Detail page tabs: add Amenities and Schedule & Opening Hours; remove Seating & Tables and Photos & Videos (per spec, pre-approval tabs are Overview · Contacts · Documents · Amenities · Menu · Schedule & Opening Hours) |
| 10  | SA6   | Build Seating & Tables tab in restaurant detail (i18n key and placeholder exist in `restaurantDetailTabs.tsx`)                                                                                                                            |
| 11  | SA6   | Add active-booking guard before restaurant deactivation (AC17)                                                                                                                                                                            |
| 12  | SA6   | Add Cancel button inside booking detail modal (AC12)                                                                                                                                                                                      |
| 13  | SA13  | Implement deep-link navigation on notification click — add `targetId`/`targetType` to `Notification` type and `navigate()` in `NotificationCard` (AC6, AC14)                                                                              |
| 14  | SA13  | Fix "View all notifications" `onViewAll` handler to `navigate('/notifications')` instead of just closing the popover (AC7)                                                                                                                |

### P3 — Medium Priority (visible gaps in existing screens)

| #   | Story             | Item                                                                                                                                                              |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | SA8               | Merge "About" and "Preferences" into one About tab with two labelled sections ("About Me" and "Mingler Eating Preferences") as specified (AC2/AC3 structural fix) |
| 16  | SA3               | Add email search to Users table (currently only name is searchable)                                                                                               |
| 17  | SA3 / SA4 / SA0.2 | Enforce full password complexity (uppercase + lowercase + digit + special char) in `NewUserModal` and `ResetPasswordModal`                                        |
| 18  | SA4               | Replace plain `<Input>` on numeric category fields with `<InputNumber min={1}>` (commission/penalty %) and `<InputNumber min={1} precision={0}>` (min amounts)    |
| 19  | SA12              | Add **Table Name** and **Identity** columns to `ChangeLogTable` and `LogRow` type                                                                                 |
| 20  | SA11              | Build Edit amenity modal (service method already exists — needs UI wiring)                                                                                        |
| 21  | SA11              | Add `description` field to `Amenity` type, create form, and list table                                                                                            |
| 22  | SA13              | Add pagination (25/page) to `NotificationsPage` (AC8)                                                                                                             |
| 23  | SA13              | Add search input to `NotificationsPage` — filter by title/description (AC11)                                                                                      |
| 24  | SA13              | Add sort toggle (Newest / Oldest) to `NotificationsPage` (AC12)                                                                                                   |
| 25  | SA13              | Fix dropdown to show 5 items (`.slice(0, 5)`) and add empty-state message (AC3)                                                                                   |
| 26  | SA6               | Wire Mingler name in Reviews tab to navigate to Mingler profile (AC13)                                                                                            |
| 27  | SA8               | Extend Mingler-name-click navigation to Finances and other portal modules (AC6)                                                                                   |

### P4 — Polish / Conformance

| #   | Story | Item                                                                                                                                                |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | All   | Add `defaultSortOrder` props: join date desc on Restaurants/Minglers, name asc on Roles/Categories/Amenities, timestamp desc on Change Log/Finances |
| 29  | All   | Add `onError` handlers to all save/create/delete mutations to surface duplicate-name and other server errors                                        |
| 30  | All   | Wire change log API calls on all create/update/delete operations across all modules                                                                 |
| 31  | SA9   | Zero Tip in transaction detail should display `AED 0` not `—`                                                                                       |
| 32  | SA5   | Add `earnCap` and `redeemMinSpend` to `LoyaltySettings` type so all four fields round-trip through the API                                          |
| 33  | SA6   | Change bookings tab `pageSize` from 10 to 25 (AC8)                                                                                                  |
| 34  | SA7   | Persist approved restaurant status to `Active` via API; trigger welcome email on approval                                                           |
| 35  | SA13  | Implement 90-day notification retention/purge (AC15) — likely a backend scheduled job but frontend filter should not display expired items          |
| 36  | SA11  | Add `onError` handler to `createMutation` to surface duplicate amenity name errors                                                                  |
| 37  | SA2   | Add `onError` handler to save mutation to surface duplicate role name error                                                                         |
| 38  | SA11  | Assign `amenities` as its own `ModuleKey` (currently using `categories` key in `PermissionGuard`)                                                   |

---

_GoMingle MVP | Admin Panel Coverage Report | GoMingle | Confidential_
