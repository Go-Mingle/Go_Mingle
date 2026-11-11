# GoMingle Admin Panel — User Stories

**Version:** v5 | **Date:** May 2026
**Prepared by:** GoMingle Product Team
**Project:** GoMingle MVP | 24 Weeks | Fixed Cost
**Classification:** Confidential

---

## Global Conventions

- All dates in **DD-MM-YYYY** format
- All timestamps in **DD-MM-YYYY HH:MM** in Asia/Dubai timezone (UTC+4)
- All list views paginated at **25 rows per page**
- Status terminology: Users = Active / Deactivated | Restaurants and Minglers = Active / Suspended
- All numeric values in **AED** unless stated
- Brand name is **GoMingle** throughout

---

## Story Index

| ID    | Module                    | Status |
| ----- | ------------------------- | ------ |
| SA0   | Login                     | -      |
| SA0.2 | Forgot Password           | -      |
| SA0.3 | My Profile                | -      |
| SA0.4 | Sign Out                  | -      |
| SA1   | Dashboard                 | -      |
| SA2   | Roles and Access          | -      |
| SA3   | Users                     | -      |
| SA4   | Categories                | -      |
| SA5   | Loyalty Configuration     | -      |
| SA6   | Restaurants               | -      |
| SA7   | Approval Queue            | -      |
| SA8   | Minglers                  | -      |
| SA9   | Finances                  | -      |
| SA10  | Booking Timers (Settings) | -      |
| SA11  | Amenities Management      | -      |
| SA12  | Change Log                | -      |
| SA13  | In-Portal Notifications   | -      |

---

## SA0 – Login

**As an** Admin or Super Admin user,
**I want to** log in with my email address and password and have a time-limited session that renews automatically while I am active,
**So that** I can access the portal securely and inactive sessions expire without manual intervention.

### Scope

**In Scope:**

- Login using email address and password
- Session establishment on successful authentication
- Role permissions loaded — navigation reflects only permitted modules
- Failed attempt tracking with lockout after 5 consecutive failures
- Automatic unlock after 15-minute lockout period
- Access token valid for 2 hours; refresh token valid for 7 days
- Silent session renewal while refresh token is valid
- Session terminated and redirect to login when both tokens expire

**Out of Scope:** Self-registration, Social or OAuth login, Multi-factor authentication

### Acceptance Criteria

- [ ] **AC1 – Successful login and role loading**
  - When a user submits a registered email and correct password
  - Then system authenticates, retrieves role, renders permitted navigation modules
  - And issues access token (2hr) and refresh token (7 days)

- [ ] **AC2 – Invalid credentials**
  - When a user submits unregistered email or wrong password
  - Then system displays error: "email or password is incorrect"
  - And records failed attempt with timestamp
  - And user remains on login page

- [ ] **AC3 – Account lockout after 5 failures**
  - When a user fails to log in 5 consecutive times
  - Then system locks account for 15 minutes
  - And displays lock message with remaining unlock time
  - And records lockout event with timestamp

- [ ] **AC4 – Login attempt while locked**
  - When a user attempts login while account is locked
  - Then system rejects attempt regardless of credentials
  - And displays remaining lockout duration

- [ ] **AC5 – Automatic unlock**
  - When 15 minutes have elapsed since lockout
  - Then system automatically unlocks account and resets failure counter to zero

- [ ] **AC6 – Silent session renewal**
  - When access token expires but refresh token is still valid (within 7 days)
  - Then system silently issues new access token without requiring re-login

- [ ] **AC7 – Session expiry after inactivity**
  - When both access and refresh tokens have expired
  - Then system terminates session and redirects to login page

- [ ] **AC8 – Role change reflected on next login**
  - When a user's role has been changed since their last session
  - Then system loads updated role permissions on next successful login

### Field Validation

| Field         | Required | Rule                        | Error Message             |
| ------------- | -------- | --------------------------- | ------------------------- |
| Email address | Yes      | Valid email format, trimmed | Email address is required |
| Password      | Yes      | Minimum 1 character         | Password is required      |

### Edge Cases

- Email with leading/trailing spaces — system trims before validation
- Deactivated account — same invalid credentials error as unregistered email
- User logged in on two devices; one refresh token expires — that device's session terminates independently

### Errors

- Email or password is incorrect
- Account is temporarily locked — try again in X minutes

---

## SA0.2 – Forgot Password

**As an** Admin or Super Admin user,
**I want to** reset my password by entering my registered email address and verifying a one-time code sent to that address,
**So that** I can regain access independently with protection against automated OTP abuse.

### Scope

**In Scope:**

- Password reset by entering registered email address
- 6-digit OTP sent to that email with 10-minute expiry
- OTP rate limiting: max 3 requests per email per 10-minute window
- New password complexity enforcement
- New password must differ from current password
- Password change logged with timestamp

**Out of Scope:** Password reset via SMS, Security questions

### Acceptance Criteria

- [ ] **AC1 – OTP sent for registered email**
  - When a user submits a registered email on the forgot password page
  - Then system sends a 6-digit numeric OTP valid for 10 minutes
  - And displays message to check inbox

- [ ] **AC2 – OTP rate limiting**
  - When a user requests 3 OTPs for the same email within any 10-minute window
  - Then system blocks further requests for 10 minutes from the third request
  - And displays message about maximum OTP requests

- [ ] **AC3 – Email address not found**
  - When a user submits an unregistered email
  - Then system displays the same confirmation message as for registered email
  - And does not generate or send any OTP

- [ ] **AC4 – Valid OTP within expiry**
  - When a user submits the correct 6-digit OTP within 10 minutes
  - Then system presents the new password entry form

- [ ] **AC5 – Incorrect OTP**
  - When a user submits an OTP that does not match
  - Then system displays error: "code is invalid"

- [ ] **AC6 – Expired OTP**
  - When a user submits the OTP after 10-minute expiry
  - Then system displays error: "code has expired"
  - And provides option to request a new OTP (subject to rate limiting)

- [ ] **AC7 – Password updated successfully**
  - When a user submits a valid new password meeting all complexity rules and differing from current
  - Then system updates password, logs change with timestamp (DD-MM-YYYY HH:MM Asia/Dubai), redirects to login

- [ ] **AC8 – Password fails requirements**
  - When a user submits a password failing any complexity rule or identical to current
  - Then system displays specific error per unmet requirement and does not update password

### Field Validation

| Field         | Required | Rule                                                    | Error Message                                       |
| ------------- | -------- | ------------------------------------------------------- | --------------------------------------------------- |
| Email address | Yes      | Valid email format                                      | Enter a valid email address                         |
| OTP           | Yes      | Exactly 6 numeric digits                                | Enter the 6-digit code sent to your email           |
| New password  | Yes      | Min 8 chars, uppercase, lowercase, number, special char | Password must meet all complexity requirements      |
| New password  | Yes      | Must not match current password                         | New password must differ from your current password |

### Edge Cases

- Multiple OTPs requested before rate limit — only most recently generated code is valid
- OTP expiry measured from generation time, not email delivery time
- Browser closed mid-flow — process abandoned, must restart

### Errors

- OTP is invalid
- OTP has expired — please request a new code
- Too many OTP requests — please wait 10 minutes before trying again
- Password does not meet complexity requirements
- New password must differ from your current password

---

## SA0.3 – My Profile

**As an** Admin or Super Admin user,
**I want to** update my own name and change my password from a dropdown in the portal header and see my registered email address,
**So that** I can keep my account details accurate and manage my own session from any page without raising a support request.

### Scope

**In Scope:**

- Avatar dropdown in top-right header on every portal page
- Update own full name
- Change own password — requires OTP verification sent to registered email
- View registered email address — read-only
- Sign out of current session
- OTP rate limiting: max 3 requests per email per 10-minute window

**Out of Scope:** Changing own email address, Profile photo upload, Deleting own account, Changing own role

### Acceptance Criteria

- [ ] **AC1 – Avatar dropdown accessible from all pages**
  - When an authenticated user clicks their name or avatar in top-right header
  - Then system displays dropdown with: Change Name, Change Password, Sign Out
  - And registered email address shown as read-only field in dropdown

- [ ] **AC2 – Change Name**
  - When a user selects Change Name and submits a new full name
  - Then system updates the full name on the account
  - And updated name reflected in portal header and Users list
  - And change recorded in change log

- [ ] **AC3 – Change Password**
  - When a user selects Change Password
  - Then system sends 6-digit OTP to registered email
  - And after valid OTP verification, presents new password form
  - And on valid new password submission, updates password and logs change

- [ ] **AC4 – OTP rate limiting**
  - When a user requests 3 OTPs for password change within any 10-minute window
  - Then system blocks further OTP requests for 10 minutes
  - And displays wait message

- [ ] **AC5 – Sign Out**
  - When a user selects Sign Out
  - Then system terminates active session and redirects to login page

### Field Validation

| Field        | Required | Rule                                                    | Error Message                                       |
| ------------ | -------- | ------------------------------------------------------- | --------------------------------------------------- |
| Full name    | Yes      | Minimum 1 character                                     | Full name is required                               |
| OTP          | Yes      | Exactly 6 numeric digits                                | Enter the 6-digit code sent to your email           |
| New password | Yes      | Min 8 chars, uppercase, lowercase, number, special char | Password must meet all complexity requirements      |
| New password | Yes      | Must not match current password                         | New password must differ from your current password |

### Errors

- Full name is required
- OTP is invalid
- OTP has expired — please request a new code
- Too many OTP requests — please wait 10 minutes
- Password does not meet complexity requirements
- New password must differ from your current password

---

## SA0.4 – Sign Out

**As an** Admin or Super Admin user,
**I want to** sign out of my current session from the avatar dropdown on any portal page,
**So that** my session is terminated immediately and my tokens cannot be reused if I leave a browser open.

### Scope

**In Scope:**

- Sign out from avatar dropdown in portal header
- Both access and refresh tokens invalidated on sign out
- Redirect to login page immediately on sign out

**Out of Scope:** Sign out of all sessions across multiple devices, Viewing or managing active sessions

### Acceptance Criteria

- [ ] **AC1 – Sign Out option in avatar dropdown**
  - When an authenticated user clicks avatar in top-right header
  - Then dropdown displays: Change Name, Change Password, Sign Out
  - And Sign Out is always the last option

- [ ] **AC2 – Session terminated on sign out**
  - When a user selects Sign Out
  - Then system immediately invalidates access and refresh tokens
  - And redirects user to login page

- [ ] **AC3 – Tokens cannot be reused after sign out**
  - When a previously valid token is presented after sign out
  - Then system rejects the token and does not grant access

- [ ] **AC4 – Back navigation blocked after sign out**
  - When a user signs out and presses browser back button
  - Then system does not restore authenticated session
  - And redirects to login page if any authenticated route accessed

- [ ] **AC5 – Sign Out accessible from every page**
  - When a user is on any portal page
  - Then avatar dropdown with Sign Out is accessible from persistent header

### Edge Cases

- Session already expired before clicking Sign Out — treated as already signed out, shows login page
- Portal open in two tabs, sign out from one — other tab shows login or session-expired message on next action
- Sign out while long-running action in progress — action abandoned, user redirected to login

### Errors

- Session already expired — you have been signed out

---

## SA1 – Dashboard

> ⚠️ **Note:** Dashboard removed from scope per v5 documentation.

**As an** Admin or Super Admin user,
**I want to** see a live overview of platform activity and receive notifications about key platform events from the portal header,
**So that** I can assess status immediately, stay informed and navigate to priority actions quickly.

### Scope

**In Scope:**

- Four metric summary cards with Today / This Week / This Month period toggle and trend
- Top 5 Restaurants table filterable by This Week or This Month
- Approval Queue widget with inline search and approve/reject actions
- Bookings bar chart (daily counts for current week Mon–Sun)
- Revenue by Source donut chart (commissions vs penalty fees for current month)

**Out of Scope:** Real-time auto-refresh, Exporting dashboard data, Custom date ranges

### Acceptance Criteria

- [ ] **AC1 – Dashboard loads with four metric cards**
  - Four cards: Active Restaurants, Pending Approvals, Active Minglers, Earnings (AED)
  - Each card shows metric value and trend vs prior period

- [ ] **AC2 – Active Restaurants card**
  - Shows count of Active restaurants and change vs same period in previous week

- [ ] **AC3 – Pending Approvals card**
  - Shows count of registrations awaiting review and age of oldest application

- [ ] **AC4 – Active Minglers card**
  - Shows count of Active Mingler accounts and percentage change vs prior period

- [ ] **AC5 – Earnings card**
  - Shows total AED earned by platform (GoMingle share) and percentage change

- [ ] **AC6 – Period toggle on metric cards**
  - When user selects Today / This Week / This Month on any card
  - Then that card recalculates independently; other cards unaffected

- [ ] **AC7 – Top 5 Restaurants table**
  - Shows top 5 restaurants by revenue contribution
  - Each row: rank, restaurant name, total AED revenue, total booking count
  - Toggle: This Week / This Month

- [ ] **AC8 – Approval Queue widget**
  - Shows pending applications in submission order: restaurant name, cuisine, owner name, Pending status
  - Each entry has Reject and Approve actions
  - Search field filters by restaurant name or owner name
  - "Open queue" link navigates to full Approval Queue module

- [ ] **AC9 – Bookings bar chart**
  - Bar chart: booking count per day for current week (Mon–Sun) with total count

- [ ] **AC10 – Revenue by Source chart**
  - Donut chart: commission revenue vs penalty fee revenue for current month
  - Shows AED amounts per source, total combined, percentage trend vs previous month

### Edge Cases

- No pending applications — Approval Queue widget shows empty state
- No bookings in current week — bar chart shows zero values for all days
- Metric data cannot be retrieved — affected section shows error; other sections load independently

### Errors

- Dashboard data could not be loaded — please refresh the page

---

## SA2 – Roles and Access

**As an** Admin or Super Admin user,
**I want to** create, edit and delete roles that define which modules each portal user can access,
**So that** access to platform functions is controlled.

### Scope

**In Scope:**

- View all roles with name, assigned modules and user count
- Create role with name and module permission selection
- Full access option granting access to all current and future modules
- Dashboard permission requires at least one other module also selected
- Edit and delete roles
- Pagination: 25 rows per page, default sort by role name ascending

**Out of Scope:** Creating user accounts from this screen, Assigning roles from this screen

### Available Modules for Selection

Dashboard, Approval Queue, Minglers, Loyalty, Roles and Access, Change Log, Restaurants, Booking, Finances, Categories, Users, Reviews

### Acceptance Criteria

- [ ] **AC1 – Roles list with pagination**
  - When user opens Roles and Access
  - Then system displays all roles: name, module chips, user count
  - Super Admin role shows "Full access" chip instead of individual chips
  - Paginated at 25 per page, default sort by role name ascending

- [ ] **AC2 – Sortable columns**
  - Role name column: ascending on first click, descending on second

- [ ] **AC3 – Create role**
  - When user submits valid role name and selects at least one module (not just Dashboard)
  - Then system creates role, makes it available for assignment, records in change log

- [ ] **AC4 – Full access option**
  - When full access enabled on a role
  - Then system grants access to all current and future modules

- [ ] **AC5 – Available modules for selection**
  - All 12 modules listed above are selectable when creating or editing a role

- [ ] **AC6 – Booking permission scope**
  - Booking permission grants access to Bookings tab within Restaurant and Mingler detail pages only
  - Booking is not a standalone navigable module

- [ ] **AC7 – Edit a role**
  - When user modifies name or module selection and saves
  - Then changes apply immediately to all users on that role
  - And change recorded in change log

- [ ] **AC8 – Delete role with no users assigned**
  - When user confirms deletion of a role with zero users
  - Then system removes role and records deletion in change log

- [ ] **AC9 – Delete blocked when users assigned**
  - When user attempts to delete a role with users assigned
  - Then system prevents deletion and displays message to reassign users first

- [ ] **AC10 – Duplicate role name**
  - When user submits a name identical to existing role
  - Then system displays error and does not save

### Field Validation

| Field            | Required | Rule                            | Error Message                            |
| ---------------- | -------- | ------------------------------- | ---------------------------------------- |
| Role name        | Yes      | Min 1 character, must be unique | Role name is required and must be unique |
| Module selection | Yes      | At least 1 module               | Select at least one module               |

### Errors

- Role name already exists
- Cannot delete this role — users are currently assigned to it

---

## SA3 – Users

**As an** Admin or Super Admin user,
**I want to** create, view, edit and delete portal user accounts using email as the login credential and reset any user's password directly,
**So that** every team member has the right access from the start and account management can be performed without the user needing to self-serve.

### Scope

**In Scope:**

- View all portal users: full name, email, role, status
- Search by name or email
- Create user: full name, email, role, status, password, confirm password
- Edit user details, role or status (email not editable after creation)
- Reset another user's password directly — system emails user on password change
- Delete a user account
- Pagination: 25 rows per page, default sort by full name ascending

**Out of Scope:** Users editing own profile (SA0.3), Sending login credentials by email on creation, Changing email after creation

### Acceptance Criteria

- [ ] **AC1 – Users list with pagination**
  - Displays: full name, email, assigned role, current status
  - Paginated at 25 per page, default sort by full name ascending

- [ ] **AC2 – Sortable columns**
  - Full name and email columns sortable: ascending on first click, descending on second

- [ ] **AC3 – Search**
  - Filters to users whose full name or email contains the search term

- [ ] **AC4 – Create a new user**
  - When user completes form with all required fields and passwords match
  - Then system creates account, shows in list, records in change log

- [ ] **AC5 – Email is the login credential**
  - Email address is the credential for login
  - Creating admin responsible for communicating credentials to new user
  - System does not send login credentials by email on creation

- [ ] **AC6 – Email must be unique**
  - When user submits already-registered email
  - Then system displays error and does not create account

- [ ] **AC7 – Status options**
  - Available statuses: Active and Deactivated
  - Deactivated account cannot log in to portal

- [ ] **AC8 – Reset another user's password**
  - When admin resets password with valid new password meeting complexity rules
  - Then system updates password, sends email notification to account owner
  - And records action in change log with acting admin, timestamp and affected account

- [ ] **AC9 – Edit a user**
  - When admin modifies full name, role or status and saves
  - Then system updates account and records in change log
  - Email field shown as read-only on edit form

- [ ] **AC10 – Delete a user**
  - When admin confirms deletion
  - Then system permanently removes account and records in change log

- [ ] **AC11 – Password mismatch on create**
  - When password and confirm password fields do not match
  - Then system displays error and does not create account

### Field Validation

| Field            | Required      | Rule                                                    | Error Message                                               |
| ---------------- | ------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Full name        | Yes           | Min 1 character                                         | Full name is required                                       |
| Email address    | Yes           | Valid format, unique                                    | Enter a valid email address; that address is already in use |
| Role             | Yes           | One existing role                                       | A role must be assigned                                     |
| Status           | Yes           | Active or Deactivated                                   | Status is required                                          |
| Password         | Yes on create | Min 8 chars, uppercase, lowercase, number, special char | Password must meet all complexity requirements              |
| Confirm password | Yes on create | Must match Password                                     | Passwords do not match                                      |
| New password     | Yes on reset  | Min 8 chars, uppercase, lowercase, number, special char | Password must meet all complexity requirements              |

### Errors

- That email address is already in use
- Enter a valid email address
- Passwords do not match
- Password does not meet complexity requirements

---

## SA4 – Categories

**As an** Admin or Super Admin user,
**I want to** create, edit and delete restaurant categories that define Commission % on Bill Amount, Minimum Commission Amount, Penalty % and Minimum Penalty Amount,
**So that** both commission and penalty rules are consistently enforced and protected against very low-value transactions.

### Scope

**In Scope:**

- View all categories: name, description, Commission %, Min Commission (AED), Penalty %, Min Penalty (AED), restaurant count
- Create, edit and delete categories
- Pagination: 25 rows per page, default sort by category name ascending

**Out of Scope:** Assigning categories to restaurants (done in SA7), Per-restaurant overrides

### Business Rules

- **Commission floor:** apply whichever is greater — (bill × Commission %) or Minimum Commission Amount
- **Penalty floor:** apply whichever is greater — (penalty amount × Penalty %) or Minimum Penalty Amount
- Both floor mechanisms are entirely independent of each other

### Acceptance Criteria

- [ ] **AC1 – Categories list with pagination**
  - Displays: name, description, Commission % on Bill Amount, Min Commission Amount (AED), Penalty %, Min Penalty Amount (AED), assigned restaurant count
  - Paginated at 25 per page, default sort by name ascending

- [ ] **AC2 – Sortable columns**
  - Category name column sortable: ascending on first click, descending on second

- [ ] **AC3 – Create a new category**
  - When user submits unique name, description, and all four valid numeric fields
  - Then system saves category, makes it available for Approval Queue assignment
  - And records in change log

- [ ] **AC4 – Commission floor calculation**
  - When post-dining bill processed: apply max(bill × Commission %, Min Commission Amount)

- [ ] **AC5 – Penalty floor calculation**
  - When no-show penalty captured: apply max(penalty × Penalty %, Min Penalty Amount)

- [ ] **AC6 – Commission and penalty floors are independent**
  - Each calculation performed independently; neither affects the other

- [ ] **AC7 – Edit a category**
  - When user modifies any field and saves
  - Then updated rules apply immediately and prospectively to all assigned restaurants
  - And change recorded in change log with old values, new values, acting user, timestamp

- [ ] **AC8 – Delete permitted when no restaurants assigned**
  - When user confirms deletion of category with zero restaurants
  - Then system removes category and records in change log

- [ ] **AC9 – Delete blocked when restaurants assigned**
  - When user attempts to delete category with assigned restaurants
  - Then system prevents deletion and displays message

- [ ] **AC10 – Validation failure**
  - Commission %: zero, negative, or non-numeric → error
  - Min Commission Amount: zero, negative, non-numeric, or decimal → error
  - Penalty %: zero, negative, or non-numeric → error
  - Min Penalty Amount: zero, negative, non-numeric, or decimal → error

- [ ] **AC11 – Duplicate category name**
  - When user submits identical name to existing category
  - Then system displays error and does not save

### Field Validation

| Field                       | Required | Rule                               | Error Message                                |
| --------------------------- | -------- | ---------------------------------- | -------------------------------------------- |
| Category name               | Yes      | Min 1 char, unique                 | Category name is required and must be unique |
| Description                 | No       | Free text                          | —                                            |
| Commission % on Bill Amount | Yes      | Positive numeric                   | Must be a positive number                    |
| Min Commission Amount (AED) | Yes      | Positive whole number, no decimals | Must be a positive whole number              |
| Penalty %                   | Yes      | Positive numeric                   | Must be a positive number                    |
| Min Penalty Amount (AED)    | Yes      | Positive whole number, no decimals | Must be a positive whole number              |

### Errors

- Category name already exists
- Commission % on Bill Amount must be a positive number
- Minimum Commission Amount must be a positive whole number
- Penalty % must be a positive number
- Minimum Penalty Amount must be a positive whole number
- Cannot delete this category — restaurants are currently assigned to it

---

## SA5 – Loyalty Configuration

**As an** Admin or Super Admin user,
**I want to** configure earn rate, earn cap, redeem rate and minimum spend using whole number values with each panel saving independently,
**So that** loyalty economics can be adjusted without requiring both sides to update simultaneously and point calculations are based on net billed amounts before VAT and tip.

### Scope

**In Scope:**

- Configure earn rate: AED spent per 1 point (positive whole number)
- Configure earn cap: maximum points per single booking (positive whole number)
- Configure redeem rate: points required for AED 1 discount (positive whole number)
- Configure minimum spend to redeem: minimum bill in AED (positive whole number)
- Points earned on billed amount BEFORE VAT and tip
- Earn and redeem panels save independently

**Out of Scope:** Points on no-show penalties, Points on VAT/tip, Per-restaurant loyalty variations, Points expiry

### Acceptance Criteria

- [ ] **AC1 – Both panels displayed**
  - When user opens Loyalty Configuration
  - Then Earn rate panel and Redeem rate panel displayed side by side with current active values

- [ ] **AC2 – Earn rate panel fields**
  - AED spent per 1 point: current value with helper showing active earn rate
  - Cap per booking: current value with helper stating max points per booking

- [ ] **AC3 – Save earn rate**
  - When user submits valid whole numbers for both earn rate fields
  - Then system updates earn rate and cap; all post-save bill payments use updated rate
  - And change recorded in change log with old values, new values, acting user, timestamp

- [ ] **AC4 – Redeem rate panel fields**
  - Points needed for AED 1 off: current value with helper showing active redemption rate
  - Min spend to redeem: current value in AED with helper about minimum bill required

- [ ] **AC5 – Save redeem rate**
  - When user submits valid whole numbers for both redeem rate fields
  - Then system updates redeem rate and minimum spend
  - And change recorded in change log

- [ ] **AC6 – Panels save independently**
  - When user saves only one panel
  - Then only that panel's values updated; other panel unchanged

- [ ] **AC7 – Points earned on net billed amount before VAT and tip**
  - Points calculated on billed amount BEFORE VAT and tip
  - No points on VAT, tip, or no-show penalty amounts

- [ ] **AC8 – Validation failure**
  - Any value that is zero, negative, non-numeric, or contains decimal → specific error for that field; panel not saved

### Field Validation

| Field                       | Required | Rule                  | Error Message                   |
| --------------------------- | -------- | --------------------- | ------------------------------- |
| AED spent per 1 point       | Yes      | Positive whole number | Must be a positive whole number |
| Cap per booking             | Yes      | Positive whole number | Must be a positive whole number |
| Points needed for AED 1 off | Yes      | Positive whole number | Must be a positive whole number |
| Min spend to redeem (AED)   | Yes      | Positive whole number | Must be a positive whole number |

### Errors

- AED spent per 1 point must be a positive whole number
- Cap per booking must be a positive whole number
- Points needed for AED 1 off must be a positive whole number
- Min spend to redeem must be a positive whole number
- Loyalty service unavailable — please try again

---

## SA6 – Restaurants

**As an** Admin or Super Admin user,
**I want to** view approved restaurants and open a nine-tab detail page with full visibility of profile, contacts, documents, amenities, menu, bookings, reviews, working hours and seating, and cancel any booking directly from the bookings tab,
**So that** I have complete operational visibility and can act on bookings without navigating elsewhere.

### Tab Order

Overview · Contacts · Documents · Amenities · Menu · Bookings · Reviews · Schedule & Opening Hours · Seating & Tables

### Scope

**In Scope:**

- View all approved restaurants: name, cuisine, category, city, status, booking count, join date
- Nine-tab detail page
- Cancel any booking from Bookings tab
- Suspend and unsuspend from detail page
- Change assigned category from detail page

**Out of Scope:** Admin editing working hours, Admin editing amenities from restaurant detail, Admin editing seating configuration

### Acceptance Criteria

- [ ] **AC1 – Restaurant list with pagination and sorting**
  - Displays: name, cuisine, category, city, status, total booking count, join date (DD-MM-YYYY)
  - Paginated at 25 per page, default sort by join date descending

- [ ] **AC2 – Detail page opens on Overview tab**
  - When admin clicks a restaurant row
  - Then detail page opens with Overview tab active in correct tab order

- [ ] **AC3 – Overview tab content**
  - Assigned category, cuisine type, total seating capacity, city, full address, GPS location
  - Owner name, owner phone, email, business registration number
  - Alcohol (yes/no), house rules (text), dress code (text), join date (DD-MM-YYYY)
  - Partner-controlled visibility status shown as read-only

- [ ] **AC4 – Contacts tab**
  - All contact persons: role, name, phone, email

- [ ] **AC5 – Documents tab**
  - All uploaded business documents with Preview and Download actions; no file size shown

- [ ] **AC6 – Amenities tab**
  - Full list of platform amenities as checkboxes; restaurant-selected shown as checked
  - Read-only in this view — managed via SA11 Amenities

- [ ] **AC7 – Menu tab**
  - Restaurant menu categories, item names, and prices

- [ ] **AC8 – Bookings tab — all statuses**
  - All bookings regardless of status: Approved, Waiting, Declined, Completed, Cancelled by Restaurant, Cancelled by Mingler, No-Show, Pending Payment, Arrived
  - Paginated at 25 per page; search by Mingler name; filter by status

- [ ] **AC9 – Booking row-click navigation**
  - Click Mingler name → full Mingler profile detail page
  - Click anywhere else on row → booking detail view with two tabs: Booking Detail and Itemised Bill
  - Itemised Bill tab disabled for non-Completed bookings

- [ ] **AC10 – Booking Detail tab content**
  - Booking ID, restaurant name, Mingler name, date (DD-MM-YYYY), party size, status, bill amount

- [ ] **AC11 – Admin cancel booking from list**
  - When admin clicks Cancel on a booking row
  - Then system cancels booking, changes status to Cancelled, records in change log
  - And Mingler notified via in-app notification and email

- [ ] **AC12 – Admin cancel booking from detail view**
  - When admin selects Cancel in booking detail view
  - Then same behaviour as AC11

- [ ] **AC13 – Reviews tab — row-click navigation**
  - Click Mingler name → full Mingler profile detail page
  - Click anywhere else on review row → review detail view

- [ ] **AC14 – Reviews tab — delete a review**
  - When admin confirms deletion
  - Then system permanently removes review and records in change log
  - No separate module permission required — any user with Restaurants access can delete reviews

- [ ] **AC15 – Schedule & Opening Hours tab**
  - Shows working hours per day of week
  - Read-only for admin — partners edit from partner portal

- [ ] **AC16 – Seating & Tables tab**
  - Seating categories, seating options, and tables in read-only view

- [ ] **AC17 – Deactivation blocked when active bookings exist**
  - When admin attempts to deactivate restaurant with Approved or Waiting bookings
  - Then system prevents deactivation and displays message to cancel all bookings first

- [ ] **AC18 – Suspend and unsuspend**
  - Suspend Active restaurant → status becomes Suspended, removed from discovery, new bookings blocked, existing confirmed bookings preserved, action logged
  - Unsuspend → status returns to Active, restaurant discoverable again

- [ ] **AC19 – Change category**
  - When admin selects new category and confirms
  - Then new commission and penalty rules apply prospectively to all future transactions
  - And change recorded in change log with previous category, new category, acting user, timestamp

### Field Validation

| Field                 | Required | Rule                             |
| --------------------- | -------- | -------------------------------- |
| Search term           | No       | Any text                         |
| Category filter       | No       | Select from available categories |
| City filter           | No       | Select from available cities     |
| Status filter         | No       | Active or Suspended              |
| Booking status filter | No       | Select from all booking statuses |

### Errors

- Cannot deactivate — this restaurant has active bookings; cancel all bookings first
- Cannot cancel — this booking is already in a final status
- No restaurants found matching that search or filter

---

## SA7 – Approval Queue

**As an** Admin or Super Admin user,
**I want to** click any application row to open its detail page showing all submitted information across tabs and approve it with a category or reject it with a written reason,
**So that** I have complete visibility of every submission before deciding.

### Tab Order (Application Detail)

Overview · Contacts · Documents · Amenities · Menu · Schedule & Opening Hours
_(Bookings, Reviews, Seating & Tables NOT shown pre-approval)_

### Scope

**In Scope:**

- Pending tab (default) and Rejected tab
- Click row → application detail page
- Approve with category assignment → activates account, sends welcome email
- Reject with mandatory reason (minimum 10 characters)

**Out of Scope:** Editing application content on behalf of applicant, Bulk approve or reject

### Acceptance Criteria

- [ ] **AC1 – Pending tab default, Rejected tab**
  - When user opens Approval Queue
  - Then Pending tab shown by default: restaurant name, owner name, owner phone, owner email, city, submission date, uploaded file count
  - And Rejected tab shows rejected applications with rejection reason

- [ ] **AC2 – Row click opens application detail**
  - When user clicks any row
  - Then system opens application detail page with correct tab order
  - Overview opens by default; Bookings, Reviews, Seating & Tables NOT shown

- [ ] **AC3 – Approve with category**
  - When user selects a category and confirms approval
  - Then restaurant status → Active, category assigned, welcome email sent
  - Application removed from Pending tab, action logged

- [ ] **AC4 – Reject with mandatory reason**
  - When user submits rejection reason of at least 10 characters
  - Then application moves to Rejected tab with reason and timestamp stored

### Field Validation

| Field              | Required       | Rule                    | Error Message                                   |
| ------------------ | -------------- | ----------------------- | ----------------------------------------------- |
| Category selection | Yes on approve | One from available list | A category must be selected before approving    |
| Rejection reason   | Yes on reject  | Minimum 10 characters   | Rejection reason must be at least 10 characters |

### Errors

- A category must be selected before approving
- Rejection reason must be at least 10 characters
- This application has already been actioned

---

## SA8 – Minglers

**As an** Admin or Super Admin user,
**I want to** view Mingler accounts, open a detailed profile with identity questions and eating preferences, and navigate to a Mingler profile from any booking or review row across the portal by clicking the Mingler name,
**So that** I have complete Mingler visibility from a single consistent navigation pattern.

### Tab Order (Mingler Detail)

Overview · About · Payment Methods · Bookings · Reviews

### Scope

**In Scope:**

- View all Mingler accounts: Name, Phone, Email, Joined, Bookings, Loyalty Points, Status, Suspend button
- Full detail page with five tabs
- Suspend and unsuspend — loyalty points and data preserved

**Out of Scope:** Editing Mingler personal details, Viewing full unmasked card numbers, Permanently deleting Mingler in MVP

### Acceptance Criteria

- [ ] **AC1 – Minglers list**
  - Displays: Name, Phone, Email, Joined, Bookings, Loyalty Points, Status, Suspend button
  - Paginated at 25 per page, default sort by join date descending

- [ ] **AC2 – About tab — About Me section**
  - Section 1 labelled "About Me": Name, Birthdate, Energy Drive, Relationship Status, Children, Profession Industry, Profession, Personal Interests
  - Football team (shown only if Football in interests)
  - Cricket team (shown only if Cricket in interests)
  - Pets, Budget, Enneagram Type
  - Unanswered questions show as blank

- [ ] **AC3 – About tab — Mingler Eating Preferences section**
  - Section 2 labelled "Mingler Eating Preferences": Culinary restrictions, Allergies, Favourite cuisines, Favourite dishes
  - Alcohol (yes/no)
  - Favourite drinks (shown only if Alcohol = yes)
  - Favourite cocktail (shown only if Alcohol = yes)

- [ ] **AC4 – Bookings tab row-click**
  - When admin clicks anywhere on a booking row
  - Then system opens booking detail view with: Booking Detail tab and Itemised Bill tab
  - Booking Detail shows: Booking ID, Restaurant, Date (DD-MM-YYYY), Party Size, Status, Bill amount
  - Itemised Bill tab disabled for non-Completed bookings

- [ ] **AC5 – Reviews tab row-click**
  - When admin clicks anywhere on a review row (including restaurant name)
  - Then system opens review detail view

- [ ] **AC6 – Cross-portal Mingler name navigation**
  - When admin clicks Mingler name in any booking or review row anywhere in portal
  - Then system opens full Mingler profile detail page with all tabs

- [ ] **AC7 – Suspend and unsuspend**
  - Suspend Active Mingler → status becomes Suspended, loyalty points and data preserved, action logged

### Field Validation

| Field         | Required | Rule                  |
| ------------- | -------- | --------------------- |
| Search term   | No       | Name, phone, or email |
| Status filter | No       | Active or Suspended   |

### Edge Cases

- Mingler has not answered any identity questions — About Me shows all question labels with blank values
- Football/Cricket team: shown only if those sports appear in personal interests
- Favourite drinks/cocktail: shown only if Alcohol = yes
- Itemised Bill tab shown but disabled for non-Completed bookings

### Errors

- No Minglers found matching that search or filter

---

## SA9 – Finances

**As an** Admin or Super Admin user,
**I want to** view a paginated transaction grid and click any row to see the full financial breakdown including partner share, GoMingle share, VAT, tip and loyalty deductions,
**So that** I can scan the ledger quickly and drill into the detail of any individual transaction.

### Scope

**In Scope:**

- Transaction grid: Booking ID, Restaurant, Mingler, Date (DD-MM-YYYY), Type, Total
- Row click → transaction detail: Partner Share, GoMingle Share, VAT, Tip, Loyalty Redeemed (−AED X (Y pts))
- Search by restaurant name, booking ID, or Mingler name
- Filter by transaction type (Booking Commission or Penalty)
- Export visible grid to CSV
- Pagination: 25 per page, default sort by date descending

**Out of Scope:** Summary metric cards, Initiating/modifying/cancelling payments, Payout schedules

### Acceptance Criteria

- [ ] **AC1 – Transaction grid with pagination and sorting**
  - Each row: Booking ID, Restaurant name, Mingler name, Date (DD-MM-YYYY), Type, Total (AED)
  - Paginated at 25 per page, default sort by date descending

- [ ] **AC2 – Sortable columns**
  - Restaurant name and date columns sortable

- [ ] **AC3 – Row click opens transaction detail**
  - Shows: Partner Share (AED), GoMingle Share (AED), VAT (AED), Tip (AED)
  - Loyalty Redeemed shown as −AED X (Y pts) where X = AED value, Y = points consumed
  - No loyalty redeemed → Loyalty Redeemed shows dash
  - VAT or Tip of zero → shows AED 0

- [ ] **AC4 – Transaction type display**
  - Booking Commission and Penalty visually distinguished in Type column

- [ ] **AC5 – Search**
  - Filters by restaurant name, booking ID, or Mingler name

- [ ] **AC6 – Filter by transaction type**
  - Shows only transactions of selected type

- [ ] **AC7 – Export to CSV**
  - Generates CSV of all currently visible rows respecting active search and filter
  - File made available for download

### Edge Cases

- No transactions match search/filter → empty state message
- Loyalty Redeemed = zero → shows dash in transaction detail
- Restaurant name in grid hoverable → tooltip shows city and address with map link opening in new tab

### Errors

- Financial data could not be loaded — please refresh
- CSV export failed — please try again

---

## SA10 – Booking Timers (Settings)

**As an** Admin or Super Admin user,
**I want to** configure global defaults and per-restaurant overrides for the Auto No-Show Timer, Waiting Auto-Decline Timer and Booking Cancellation Window in the admin Settings screen,
**So that** no-show penalties are always captured on time, Waiting bookings are resolved automatically, and Minglers cannot cancel at the last minute when restaurants have prepared for their arrival.

### Scope

**In Scope:**

- Settings left-menu item in Configure section
- Two sections: Global Defaults and Per-Restaurant Overrides
- Auto No-Show Timer: minutes after scheduled time → auto No-Show + penalty capture
- Waiting Auto-Decline Timer: minutes in Waiting before auto-decline
- Booking Cancellation Window: minutes before booking time when Mingler can no longer cancel
- Global defaults and per-restaurant overrides for all three timers
- Partner can cancel at any time — Booking Cancellation Window applies to Minglers only
- All changes prospective — in-flight bookings retain timer value active at creation

**Out of Scope:** Partner configuring any timer, Pausing or resetting individual booking timers

### Acceptance Criteria

- [ ] **AC1 – Settings screen structure**
  - Two sections: Global Defaults (all three timers editable) and Per-Restaurant Overrides

- [ ] **AC2 – Save global defaults**
  - When admin enters valid positive whole numbers for all three fields and saves
  - Then system saves values, applies to all restaurants without override
  - And records in change log with acting user and timestamp

- [ ] **AC3 – Per-Restaurant Overrides section**
  - Paginated list of all restaurants (25 per page) with current values for all three timers
  - Each value labelled as per-restaurant override or inherited global default
  - Searchable by restaurant name

- [ ] **AC4 – Set and clear per-restaurant overrides**
  - Set override → system saves and records in change log
  - Clear override → system reverts to global default for that timer

- [ ] **AC5 – Per-restaurant override takes precedence**
  - Per-restaurant value used for all bookings at that restaurant; global default ignored for that timer

- [ ] **AC6 – Auto No-Show Timer fires**
  - When booking's scheduled time has passed by Auto No-Show Timer duration AND booking is Approved
  - Then system changes status to No-Show, triggers Safepay penalty capture, records in change log

- [ ] **AC7 – Manual No-Show: status immediate, penalty waits for timer**
  - When partner manually marks Approved booking as No-Show
  - Then status changes to No-Show immediately
  - And Safepay penalty capture fires when Auto No-Show Timer elapses from scheduled booking time
  - If timer already elapsed → penalty fires immediately

- [ ] **AC8 – Waiting Auto-Decline Timer fires**
  - When booking has been in Waiting status for Waiting Auto-Decline Timer duration
  - Then system changes status to Declined and records in change log

- [ ] **AC9 – Booking Cancellation Window enforced for Minglers**
  - When Mingler attempts to cancel within Booking Cancellation Window before scheduled time
  - Then system prevents cancellation and informs Mingler that window has passed

- [ ] **AC10 – Partner cancellation unaffected by Booking Cancellation Window**
  - Partner can cancel at any time; Booking Cancellation Window has no effect on partner cancellations

- [ ] **AC11 – No timer information shown to partner**
  - No countdown timers, timer durations, or timer values shown anywhere in partner portal

- [ ] **AC12 – Prospective only**
  - New timer values apply only to bookings created after the change
  - In-flight bookings retain timer value active at creation

- [ ] **AC13 – Validation**
  - Any timer value that is zero, negative, non-numeric, or decimal → specific error; not saved

### Field Validation

| Field                                     | Required | Rule                           | Error Message                              |
| ----------------------------------------- | -------- | ------------------------------ | ------------------------------------------ |
| Global Auto No-Show Timer (mins)          | Yes      | Positive whole number          | Must be a positive whole number            |
| Global Waiting Auto-Decline Timer (mins)  | Yes      | Positive whole number          | Must be a positive whole number            |
| Global Booking Cancellation Window (mins) | Yes      | Positive whole number          | Must be a positive whole number            |
| Per-restaurant timers (all three)         | No       | Positive whole number or blank | Must be a positive whole number if entered |

### Errors

- Timer value must be a positive whole number
- Cancellation window has passed — this booking can no longer be cancelled (shown to Mingler)
- Changes saved (confirmation on successful save)

---

## SA11 – Amenities Management

**As an** Admin or Super Admin user,
**I want to** create, edit and delete platform amenities from a dedicated left-menu item so that restaurants can select from a consistent catalogue and deleted amenities are automatically removed from all restaurant profiles,
**So that** the amenity catalogue is always accurate and consistent across the platform.

### Scope

**In Scope:**

- Amenities left-menu item in Configure section
- View all platform amenities: name, description, restaurant count
- Create amenity (name required, description optional)
- Edit amenity name or description
- Delete amenity — automatically removes from all restaurant profiles
- 18 default amenities pre-loaded at platform setup

**Out of Scope:** Assigning amenities to restaurants directly from admin, Creating amenity categories in MVP

### Default Amenities (18)

1. Wi-Fi free
2. Access for people of determination
3. Valet free
4. Outdoor terrace
5. View: sea
6. View: landmark (e.g. Burj)
7. View: green (garden, parks)
8. Swimming pool access
9. Family-friendly amenities (toys / play area)
10. Baby changing table
11. Office-friendly areas (plug, Wi-Fi)
12. Safety essentials
13. Toilets worth visiting
14. Hidden secret gems
15. Instagramable viewpoint
16. Professional cocktail mixologist
17. Live music on fixed days
18. Romantic nest tables

### Acceptance Criteria

- [ ] **AC1 – Amenities list**
  - Displays: name, description, number of restaurants using each amenity
  - Paginated at 25 per page, default sort by amenity name ascending

- [ ] **AC2 – Create amenity**
  - When admin submits unique name and optional description
  - Then system saves amenity, makes it available for restaurants to select
  - And records in change log

- [ ] **AC3 – Edit amenity**
  - When admin modifies name or description
  - Then system updates amenity; updated name/description appear on all restaurant profiles that have it selected
  - And change recorded in change log

- [ ] **AC4 – Delete amenity**
  - When admin confirms deletion
  - Then system permanently removes amenity from platform catalogue
  - And automatically removes from all restaurant profiles that had it selected
  - And records deletion in change log

- [ ] **AC5 – Duplicate name blocked**
  - When admin submits already-existing amenity name
  - Then system displays error and does not save

- [ ] **AC6 – Restaurant view of amenities**
  - When restaurant partner views Amenities tab in their portal
  - Then system displays all platform amenities as checkbox list
  - Previously selected amenities shown as checked
  - Partner can check/uncheck and save

### Field Validation

| Field        | Required | Rule                    | Error Message                               |
| ------------ | -------- | ----------------------- | ------------------------------------------- |
| Amenity name | Yes      | Min 1 character, unique | Amenity name is required and must be unique |
| Description  | No       | Free text               | —                                           |

### Errors

- Amenity name already exists
- Amenity name is required

---

## SA12 – Change Log

**As an** Admin or Super Admin user,
**I want to** view a paginated searchable audit trail of every platform change with table name, identity and unambiguous Asia/Dubai timestamps and export the results,
**So that** I can identify exactly what changed, where and by whom at any time and produce compliance records without ambiguity.

### Scope

**In Scope:**

- View all change log entries in reverse chronological order
- Search by admin username, table name, identity, or module
- Filter by action type (Create, Update, Delete) and by module
- Export to CSV with all columns and timestamps (DD-MM-YYYY HH:MM Asia/Dubai)
- Pagination: 25 per page, default sort by timestamp descending
- Each entry is immutable — cannot be edited or deleted

**Out of Scope:** Real-time streaming of new entries, Custom date range filter in MVP

### Modules Covered

Categories, Approval Queue, Restaurants (including review moderation), Roles and Access, Loyalty, Users (including password resets and My Profile changes), Finances, Minglers (including review moderation)

### Acceptance Criteria

- [ ] **AC1 – Change log with pagination and sorting**
  - Each row: Timestamp (DD-MM-YYYY HH:MM Asia/Dubai UTC+4), Admin (@username with avatar initials), Action (Create/Update/Delete), Table Name, Identity, Old Value, New Value, Module
  - Paginated at 25 per page, default sort by timestamp descending

- [ ] **AC2 – Sortable columns**
  - Timestamp column sortable: ascending on first click, descending on second

- [ ] **AC3 – Search**
  - Filters to entries where admin username, table name, identity, or module contains the search term

- [ ] **AC4 – Filter by action type**
  - Shows only entries with selected type: Create, Update, or Delete

- [ ] **AC5 – Filter by module**
  - Shows only entries belonging to the selected module

- [ ] **AC6 – Export to CSV**
  - Generates CSV of all currently visible entries respecting active search and filter
  - Includes all columns with timestamps in DD-MM-YYYY HH:MM Asia/Dubai timezone

- [ ] **AC7 – Entries are immutable**
  - No option to edit or delete any change log entry

- [ ] **AC8 – Modules covered**
  - All modules listed above generate change log entries

- [ ] **AC9 – Create and Delete value display**
  - Create action: Old Value column displays dash
  - Delete action: New Value column displays dash

### Edge Cases

- No entries yet → empty state message
- Search and filter applied together → shows entries satisfying all active conditions
- Action affects multiple fields → each changed field is a separate log entry

### Errors

- Change log data could not be loaded — please refresh
- CSV export failed — please try again

---

## SA13 – In-Portal Notifications

**As an** Admin or Super Admin user,
**I want to** receive in-portal notifications from a persistent icon in the portal header, mark individual or all notifications as read, and click through to the relevant record,
**So that** I am proactively informed of platform activity and can act without manually checking each module.

### Scope

**In Scope:**

- Notification icon in portal header on every page
- Unread count badge (capped at 99+)
- Dropdown panel showing 5 most recent notifications
- Per-item Mark as read and Mark all as read
- Unread items show coloured left border
- View all notifications link → full notifications page
- Full page: paginated list with filter by type, search by content, sort by date
- Deep-link from notification to relevant record
- Notifications retained for 90 days then auto-purged
- Recipients determined by module access (not a separate SA2 permission)

**Out of Scope:** Email or SMS delivery, User-configurable preferences, Archiving/pinning/deleting individual notifications, Real-time push without page interaction in MVP

### Notification Types

| Type Key              | Icon            | Description                                   | Recipients              |
| --------------------- | --------------- | --------------------------------------------- | ----------------------- |
| new_registration      | Star/badge icon | New restaurant registration submitted         | Approval Queue access   |
| restaurant_approved   | Restaurant icon | Restaurant approved and live on GoMingle app | Restaurants access      |
| restaurant_suspended  | Restaurant icon | Restaurant suspended or unsuspended           | Restaurants access      |
| category_changed      | Tag icon        | Restaurant category changed                   | Restaurants access      |
| commission_payout     | AED icon        | Commission payout processed                   | Finance access          |
| portal_user_created   | Person icon     | New portal user account created               | Users access            |
| mingler_suspended     | Person icon     | Mingler account suspended or unsuspended      | Minglers access         |
| scheduled_maintenance | Gear icon       | Platform maintenance announcement             | All authenticated users |
| review_flagged        | Star icon       | A review flagged for inappropriate content    | Restaurants access      |

### Acceptance Criteria

- [ ] **AC1 – Notification icon present on all portal pages**
  - Notification icon visible in top-right header area on every portal page

- [ ] **AC2 – Unread badge**
  - Badge shows unread count; capped at "99+" when count exceeds 99
  - No badge when zero unread notifications

- [ ] **AC3 – Dropdown panel: 5-item preview**
  - Shows 5 most recent notifications in reverse chronological order
  - Panel header shows "Notifications" and current unread count badge
  - Each item: category icon, notification title (bold), relative timestamp (e.g. "12d ago"), description body
  - Empty state: "No notifications yet" when no notifications exist

- [ ] **AC4 – Mark all as read**
  - When user clicks Mark all as read in panel header
  - Then all notifications marked as read; badge removed; all items update to read state immediately

- [ ] **AC5 – Per-item Mark as read and visual treatment**
  - Unread: coloured left border + Mark as read link
  - Mark as read: removes border, removes link, decrements badge by one
  - Read: no border, no Mark as read link

- [ ] **AC6 – Deep-link on item click**
  - Click notification item (not Mark as read link) → navigates to relevant record
  - Restaurant notification → restaurant detail page
  - Mingler notification → Mingler profile page
  - Portal user notification → Users list filtered to that user
  - No navigable record → marks as read, no navigation

- [ ] **AC7 – View all notifications link**
  - Click "View all notifications" → closes dropdown, opens full notifications page

- [ ] **AC8 – Full notifications page: access and default state**
  - Paginated list of all notifications in reverse chronological order
  - Default: all types, no active search or filter
  - 25 per page with page navigation and total record count

- [ ] **AC9 – Full page: each row**
  - Category icon, notification title, full description body
  - Absolute timestamp (DD-MM-YYYY HH:MM Asia/Dubai UTC+4)
  - Read/unread visual state (coloured left border for unread)

- [ ] **AC10 – Full page: filter by notification type**
  - Reloads list with only selected notification type
  - Filter clearable to return to unfiltered view

- [ ] **AC11 – Full page: search by content**
  - Filters by title or description body containing search term (case-insensitive)

- [ ] **AC12 – Full page: sort**
  - Sort options: Newest first (default) or Oldest first

- [ ] **AC13 – Full page: mark as read**
  - Per-item Mark as read on full page: marks as read, updates row, decrements header badge
  - Mark all as read available on full page with same behaviour as dropdown

- [ ] **AC14 – Full page: deep-link on row click**
  - Same deep-link rules as AC6

- [ ] **AC15 – Notification retention: 90 days**
  - Notifications older than 90 days automatically purged silently

- [ ] **AC16 – Badge count consistency**
  - Unread badge count updates consistently whether user is in dropdown or on full page

- [ ] **AC17 – Client-provided: trigger list and copy templates** _(OPEN — awaiting client input)_
  - When client provides complete list of triggers, target audiences, and copy templates
  - Then system implements each trigger type accordingly
  - Title max 60 characters, Body max 160 characters — enforced at generation time

### Edge Cases

- Two sessions simultaneously — marking read in one does not update other until refresh
- New notification generated while dropdown is open — appears on next panel open or page refresh
- Role changes and user loses module access — no longer receives notifications for that module; previously received remain for 90 days
- All 5 dropdown items unread — Mark all as read clears ALL user notifications, not just visible 5
- Notification's linked record deleted — deep-link shows appropriate not-found message
- More than 99 unread — badge shows "99+"; full page shows accurate total count
- Full page zero results after filter/search → empty state: "No notifications match your filter"

### Errors

- Notification data could not be loaded — please refresh the page
- Mark as read failed — please try again
- No notifications match your filter
- No notifications yet

---

## Coverage Tracking

Use this section to track implementation status after running an automated code audit.

| Story | Module                    | Status                | Notes                      |
| ----- | ------------------------- | --------------------- | -------------------------- |
| SA0   | Login                     | -                     |                            |
| SA0.2 | Forgot Password           | -                     |                            |
| SA0.3 | My Profile                | -                     |                            |
| SA0.4 | Sign Out                  | -                     |                            |
| SA1   | Dashboard                 | ⚠️ Removed from scope | Per v5 docs                |
| SA2   | Roles and Access          | -                     |                            |
| SA3   | Users                     | -                     |                            |
| SA4   | Categories                | -                     |                            |
| SA5   | Loyalty Configuration     | -                     |                            |
| SA6   | Restaurants               | -                     |                            |
| SA7   | Approval Queue            | -                     |                            |
| SA8   | Minglers                  | -                     |                            |
| SA9   | Finances                  | -                     |                            |
| SA10  | Booking Timers (Settings) | -                     |                            |
| SA11  | Amenities Management      | -                     |                            |
| SA12  | Change Log                | -                     |                            |
| SA13  | In-Portal Notifications   | -                     | AC17 awaiting client input |

**Status Key:**

- `- ` = Not yet audited
- `✅` = Complete — fully implemented
- `⚠️` = Partial — exists but missing something
- `❌` = Missing — not implemented at all

---

_GoMingle MVP | Admin Panel User Stories v5 | GoMingle | Confidential_
