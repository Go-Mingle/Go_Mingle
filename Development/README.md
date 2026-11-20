# GoMingle: Admin Panel, Partner Portal and API

NUCES MS Practicum: GoMingle social dining and restaurant booking platform (Karachi).

**Version 0.7.4** (12 Nov 2026). See *Version history* at the end.

**Live:** Admin Panel https://gomingle-admin.vercel.app · Partner Portal https://gomingle-partner.vercel.app · API https://gomingle-api.vercel.app. See *Online on Vercel* below.

```
GoMingle/
├── Backend/      Backend: NestJS (TypeScript) on PostgreSQL, JWT auth, Safepay escrow
├── Admin/         Admin Panel: React 19 + TypeScript + Ant Design
├── Partner/       Partner Portal: React 19 + TypeScript + Ant Design
├── Mingler/   Mingler app: Flutter (scaffold, rebranded)
├── run-gomingle.bat   Windows: install and start everything
└── run-gomingle.sh    macOS / Linux: install and start everything
```

## Start the demo

1. Install **Node.js 20 or newer** (LTS from https://nodejs.org).
2. Windows: double-click **`run-gomingle.bat`**. macOS/Linux: run `./run-gomingle.sh`.
3. The first run installs dependencies, which takes a few minutes, and the API creates its own PostgreSQL database (nothing to install: it is downloaded with the dependencies and kept in `Backend/data/`). Three server windows then open, and the browser opens both portals.

| What | URL | Sign in |
|---|---|---|
| Admin Panel | https://gomingle-admin.vercel.app/ |
| Partner Portal | https://gomingle-partner.vercel.app/login |
| API | https://gomingle-api.vercel.app/health | `GET /health` |

Both sign-in screens show the account. To stop everything, close the three server windows.

**Light and dark mode:** use the moon / sun button in the top bar of either portal. Until you pick one, the portals follow your computer's setting; your choice is remembered. The GoMingle logo turns white in dark mode.

**This is a clean install.** Apart from those two accounts, the only data is a starter set in the four pick-lists, so the platform is usable from the first sign-in: **16 amenities**, **43 interests** in 8 groups, **12 topics** and **9 preference questions**. Edit or delete any of it. There are no categories, restaurants, Minglers, interest tables or bookings. The partner account starts with an empty Draft restaurant. Everything you enter is saved and survives restarts. **Data from version 0.5 and earlier is not carried over:** this version stores everything in PostgreSQL and starts fresh. Your old folder is not touched, so keep it if you need what you entered there.

**Suggested first run (about 10 minutes):**
0. **Admin Panel:** add a category (e.g. *Premium*, 12%) under **Categories**. Approval needs a category. Amenities, interests, topics and preference questions are already filled in.
1. **Partner Portal:** sign in as partner@gomingle.com, or click *Create an account*, enter any e-mail and the 6-digit code from the **GoMingle API** window (`123456` also works), then set a password.
2. Fill in the Overview (name, cuisine, address, owner, phones), upload a cover photo under *Photos & Videos* and a trade licence under *Documents*, then click **Add Payout Account**: it opens the *Payout Account* tab, where you enter the account title, bank and IBAN (for example `PK72 HABB 0012 3456 7890 1234`) and save. A yellow box on the profile lists anything still missing before *Send for Approval* turns on.
3. Click **Send for Approval**. The profile turns read-only, *Under review*.
4. **Admin Panel → Approval Queue:** the restaurant is listed and the bell shows a new notification. Open it to see the profile and documents.
5. **Decline** with a reason. The partner sees it on their profile, fixes it and resubmits.
6. **Approve** with a category. The restaurant appears under **Restaurants**, and the partner gets the full portal, the category's commission, and an "approved" notification.
7. **Partner:** add table areas with timings under *Table Timings* and menu options under *Menu Options*. They appear on the restaurant's **Schedule** and **Menu** tabs in the Admin Panel straight away.
8. **Admin → Interest Tables:** create one at the restaurant, picking a topic, one of the partner's tables and menu options. The partner sees it under *Interest Tables*.
9. **Escrow (Safepay):** in the Admin Panel open **Finances → Escrow & payouts**. Click *Sandbox booking*, pick the new restaurant and place a card hold. Then **Capture** it into escrow and **Release** it: the restaurant is paid its share minus the 10% GoMingle fee. The partner gets a notification for each step and sees the balance on **Finances**.
10. **No-show policy (Partner):** on the Restaurant Profile open the **No-Show Policy** tab (under the `…` at the end of the tabs if it does not fit) and set a penalty per empty seat, for example PKR 1,500. Zero is allowed.
11. **Book a table (Admin):** create an interest table at the restaurant whose start time is a few minutes ago (today's date, Karachi time). In **Finances → Escrow & payouts → Sandbox booking** choose the restaurant and that interest table, enter a name and seats, and place the hold. One card hold is placed **per seat**, each for the penalty amount, so three seats show as three rows. Make two bookings.
12. **Check-in (Partner):** open the interest table → **Bookings**. Use **No-show** on one booking and enter how many seats stayed empty: the holds for those seats are collected in full and the holds for the other seats are released. Then press **Guests Arrived**: the remaining bookings are checked in, their holds are released and the table is completed. The Admin Panel shows the collected penalties under **Escrow & payouts**, ready to release to the restaurant.
13. **Failed collections (Admin):** if Safepay refuses a collection or a release, it appears at the top of **Escrow & payouts** under *Failed collections* with the booking, seat, amount and Safepay's reason, and the admins get a notification. **Retry** tries it again (when it goes through, the amount is added to the booking); **Close…** closes it with a note and releases the card hold. Nothing is retried automatically.

> Steps 9 to 13 with the Safepay sandbox keys in `Backend/.env`: a sandbox booking then waits for a real card step in Safepay's checkout, so its hold stays *pending payment* and a no-show reports "Penalty not collected yet". To try the full money flow without a card, empty `SAFEPAY_API_KEY` and `SAFEPAY_SECRET_KEY` in that file and restart: the built-in simulator approves every hold.

Everything is saved under `Backend/data/`, so it survives restarts. To wipe it and start fresh, stop the servers and run `npm run reset-data` in `Backend`.

The end-to-end suite in [`E2E`](E2E/README.md) plays this journey automatically in a browser and checks every screen of both portals against the API. GitHub Actions runs it on every pull request.

## Running pieces by hand

```bash
cd Backend && npm install && npm start

cd Admin && npm ci --ignore-scripts
VITE_MSW_ENABLED=false VITE_API_BASE_URL=http://localhost:4000/admin VITE_AUTH_MODE=api npm run dev

cd Partner && npm ci --ignore-scripts
VITE_ENABLE_MOCKS=false VITE_API_BASE_URL=http://localhost:4000/partner VITE_AUTH_MODE=api npm run dev -- --port 5174
```

Running `npm run dev` in a portal with no variables gives a frontend-only mode for UI development: every API call is answered in the browser by Mock Service Worker using the test fixtures (sample restaurants and so on). The release runs against the API, which has no sample data.

Each portal's `.env.example` documents every variable (backend URL, auth mode, Cognito, mocks).

## Quality checks

```bash
cd Admin   && npm run typecheck && npm run lint && npm run test:run
cd Partner && npm run typecheck && npm run lint && npm run test:run
cd Backend && npm run typecheck && npm test
```

## Online on Vercel

Each folder is its own Vercel project in the `go-mingle` team: `Admin` → `gomingle-admin`, `Partner` → `gomingle-partner`, `Backend` → `gomingle-api`. Each has a `vercel.json` next to its `package.json`.

- **Deploys:** merging a pull request into `main` deploys to production. Every other branch gets a preview link (previews ask for a Vercel sign-in).
- **Portals:** static Vite builds. `VITE_API_BASE_URL` points at the API (`https://gomingle-api.vercel.app/admin` and `/partner`), `VITE_AUTH_MODE=api`, mocks off. These are Vercel environment variables, read at build time.
- **API:** `Backend/api/index.js` hands every request to the compiled NestJS app (`Backend/src/serverless.ts`).
  - Database: Neon PostgreSQL (`DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` for migrations). Migrations and first-run data are applied on start.
  - The no-show check runs on incoming requests, at most every 5 minutes.
- **API settings on Vercel:** `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `SEED_PARTNER_PASSWORD`, `CORS_ORIGINS` (the two portal addresses), `PUBLIC_URL`, `SAFEPAY_ENV`, `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `PLATFORM_FEE_PCT`, `MAILTRAP_API_TOKEN`, `MAILTRAP_INBOX_ID`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `ADMIN_PORTAL_URL`, `PARTNER_PORTAL_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. The Partner Portal also has `VITE_GOOGLE_CLIENT_ID`. Change them under the project's *Settings → Environment Variables*, then redeploy.
- **Logs:** Vercel → project → *Logs*. The API prints `[boot]` lines on a cold start and one line per request.

## Notes

- Backend details, configuration and current limits are in `Backend/README.md`. The main limits: email goes to the Mailtrap test inbox online and to the API window locally (no SMS yet), payments are Safepay sandbox ( Safepay uses the sandbox keys in `Backend/.env` locally or the Vercel settings online; empty them to use the offline simulator), and Mingler bookings, reviews and finance figures stay empty until the Mingler app is connected.
- Production sign-in is still AWS Cognito. Set `VITE_AUTH_MODE=cognito` and the pool variables.
- The mobile app's bundle id is now `com.gomingle.customer`. Register that id in Firebase before building release apps.
- The Flutter app still pulls the Ethr UI SDK from its original Bitbucket repository. That URL in `pubspec.yaml` is the only place the old company name remains, because the package can only be fetched from where it is hosted.

## Version history

| Version | Date | What changed |
|---|---|---|
| 0.13.11 | 20 Nov 2026 | API: `auth/totp.ts` (RFC 6238 on node:crypto, ±1 step, replay-proof via `totp_last_step`; secrets sealed with AES-256-GCM; hashed backup codes), `AdminSecurityService` and `admin_sessions` (migration 0021: `admin_users` two-step columns, `refresh_tokens.session_id`); access tokens carry `sid`, so a signed-out session fails at once with `ERR_SESSION_REVOKED`; `POST auth/login` answers `{ mfaRequired, mfaToken }` then `POST auth/login/verify`; `/admin/api/v1/security` (overview, two-step setup/enable/disable/backup-codes, sessions, policy); `ERR_TWO_STEP_REQUIRED` from `AdminGuard` when the policy is on; `POST users/:id/reset-two-step`. Admin: `modules/security` (Security page, set-up modal with a lazily loaded `qrcode`), `TwoStepCodeStep` on sign-in, `OtpInput` rewritten; tests `two-step.test.ts`, unit, E2E `admin.security.spec.ts` (GM-346) |
| 0.13.9 | 20 Nov 2026 | `themeTransition.ts` (both portals): the reveal is a CSS `@keyframes gm-theme-reveal` on `::view-transition-new(root)` driven by `--gm-vt-x/y/r`, set before `startViewTransition`, cleaned up on `finished`; `html.gm-theme-vt *` disables CSS transitions while switching, which caused the flash back (GM-351) |
| 0.13.8 | 20 Nov 2026 | Admin `layout/command/`: `CommandPalette` (antd Modal, combobox + listbox with `aria-activedescendant`, grouped results, match highlight, recent items in localStorage), `CommandPaletteTrigger` in the `Topbar` (Ctrl/⌘+K anywhere), `useCommandSearch` (restaurants, Minglers, admin users, booking by reference, each gated by the role's modules), `commandModel` (page list, ranking, `bookingRefFrom`); `/users?open=<id>` opens that user; API `GET /admin/bookings/:idOrRef` also returns `interestTableId` and `restaurantId`; unit tests and E2E `admin.command-palette.spec.ts` (GM-344) |
| 0.13.7 | 20 Nov 2026 | API: admin act-as on Partner restaurant routes (`X-GoMingle-Restaurant`, Restaurants permission, `ActAsAuditInterceptor` names each item), `POST restaurants/:id/archive|restore` (migration 0020), `PATCH admin/bookings/:id` seats, `DELETE notifications/:id`, `POST notifications/broadcast` (`GOMINGLE_ANNOUNCEMENT`), timer settings from code; change-log ids random-suffixed (GM-350). Admin: `restaurants/manage/*` drawers via `restaurantClient()`, `ChangeSeatsModal`, `BroadcastModal`, Timer Settings page; E2E `admin.workflow-manage.spec.ts` (GM-342) |
| 0.13.6 | 20 Nov 2026 | `visual/dashboardPdf.ts` (jsPDF + jspdf-autotable, loaded only on export) and `ExportPdfButton`, shown through a new `actions` slot on `InsightsDashboard`; Partner passes the restaurant name from the profile query; unit tests read the generated PDF text (GM-340) |
| 0.13.5 | 20 Nov 2026 | Admin `MobileEmpty` molecule on 11 phone lists; phone name search on Restaurants and Minglers; `RestaurantDetailHeader` cover banner on phones; E2E `admin/partner.responsive.spec.ts` (+`support/responsive.ts`): 390 and 768 wide, every route and tab, fails on sideways scroll or clipped content, `GM_SHOTS` saves screenshots (GM-341) |
| 0.13.4 | 20 Nov 2026 | Partner `ImportDialog` molecule (pick, preview, run, result) and `shared/utils/spreadsheet.ts` (RFC 4180 CSV parser, header mapping, .xlsx via `read-excel-file`, loaded only when used; 500 rows / 2 MB); `ImportUsersDialog` and `ImportContactsDialog` send each row through the existing create endpoints; E2E `partner.import.spec.ts` (GM-339) |
| 0.13.3 | 20 Nov 2026 | Auth stage layout D: `.gm-stage` is a two-column grid from 1024px (`.gm-stage-story` + form), a compact row below; `CyclingWord` in `BrandPanel` (20 `brandPanel.guests`, 2.4 s each, pause button, stops while the tab is hidden, still under reduced motion); `shared/theme/themeTransition.ts` (View Transitions circle reveal from the switch, `.gm-theme-fade` fallback); pill tab hover no longer overrides the selected tab; E2E inventory records headings as screen readers hear them (ignores aria-hidden) (GM-336, GM-337) |
| 0.13.1 | 20 Nov 2026 | Floating dock shell: `.gm-dock` / `.gm-dock-slot` / `.gm-topbar` in `brand.css` (dock re-scopes the sidebar tokens), pill tabs for `.ant-tabs-top` inside `.gm-app-main`; Partner `ProfileHeader` and Admin `RestaurantDetailHeader` render a cover banner; admin restaurant detail API now returns `coverUrl` (GM-337) |
| 0.13.0 | 19 Nov 2026 | Auth screens use `.gm-stage` (full-bleed, theme-aware glow); `BrandPanel` renders the gathering guests, cycling headline (sr-only full text) and embers, all CSS (no new dependencies); motion ends by ~4.5 s for WCAG 2.2.2; sign-in inventory baseline updated for the new headline only (GM-336) |
| 0.12.2 | 19 Nov 2026 | Inline splash in `index.html` (theme set before first paint, faded out by `hideSplash()` in `main.tsx`), `TableLoader` atom as antd's global Spin indicator and Partner route fallback, `SeatMap` seats in `--brand-warm/--brand-cool`, `.gm-app-main h1` display font, radii 14/18 (GM-338, GM-337) |
| 0.12.1 | 19 Nov 2026 | `BrandPanel` rebuilt (animated `GoMingleMark`, floor cards in Partner, points in Admin), `.gm-auth-hero/.gm-auth-card/.gm-auth-form/.gm-rise` in `brand.css`, `ThemeSwitch` pill in `AuthThemeScope`, Partner `SignUpProgress`; all motion off under reduced motion (GM-336) |
| 0.12.0 | 19 Nov 2026 | Tokens in `styles/index.css` re-pointed to Candlelit (light + dark), new `--color-on-accent`, `styles/brand.css` (logo + motion), `GoMingleLogo`/`GoMingleMark` as inline SVG, antd themes in `styles/theme.ts`, chart palette validated with the dataviz checker; hard-coded teal/Poppins replaced with tokens; `AuthThemeScope` carries `ThemeToggle` (GM-334, GM-335) |
| 0.11.3 | 19 Nov 2026 | E2E `*.inventory.spec.ts` + `E2E/inventory/*.json`: fails if any recorded UI item disappears; re-record with `GM_UPDATE_INVENTORY=1`, then `=intersect` on a fresh seed (GM-343). `Database` listens for pool `error` so a dropped connection no longer crashes the API (GM-347, `test/features/db-connection-drop.test.ts`) |
| 0.11.2 | 19 Nov 2026 | Admin amenities: `iconLibrary.ts` + `IconLibraryPicker`; API accepts `iconName` on create/update, validated against the bundled Phosphor set, 422 otherwise (GM-333, `test/features/amenity-icon-library.test.ts`) |
| 0.11.1 | 19 Nov 2026 | Bookings claim seats with one conditional update (`seats_booked + n <= max_guests`) before card holds; failures give seats back (GM-330, `test/features/last-seat-race.test.ts`). Partner: `FEATURES.integrations = false` hides Integrations and redirects `/integrations` (GM-331) |
| 0.11.0 | 18 Nov 2026 | Team API: list readable by every member (`role`, `email`, `canManage`), writes owner-only (403 `ERR_OWNER_ONLY`) (GM-317, GM-318). Admin: `PATCH`/`DELETE /admin/api/v1/restaurants/:id/logins/:loginId`, `isOwner` on give access, last-active-owner guard under a row lock (409 `ERR_LAST_OWNER`), change log in words (GM-319). Photos: migration 0019 (cover crop, profile photo and crop), `PUT /partner/api/v1/partner/restaurant/photos/:mediaId/{cover,profile}`, `POST …/photos/crop-upload-url`, `GET …/photo-roles`, `DELETE …/profile-photo`; Admin avatar = profile photo, else cover (GM-320). Partner: `react-easy-crop` 6.2.4 |
| 0.10.0 | 16 Nov 2026 | Dashboards with charts on both portals from `GET /admin/api/dashboard/overview` and `GET /partner/api/v1/partner/dashboard` (`?days=7|30|90`, figures by Pakistan calendar day) (GM-312); shared visual kit in each portal under `src/app/visual/` with `styles/visual.css`: skeletons, page transitions, count-up, confetti, seat map, progress ring, escrow flow, charts (GM-313, GM-314); E2E checks both dashboards against the API |
| 0.9.2 | 16 Nov 2026 | Interest table and booking status pills redesigned (GM-311); Partner Portal sends unknown addresses home (GM-315) |
| 0.7.3 | 11 Nov 2026 | Interest table times are Pakistan time in the Admin form and the API; no bookings once a table has started (GM-258); cancelling a table cancels its bookings and refunds the Minglers (GM-259); Create & publish no longer flashes "Required" (GM-260); edit and delete interest tables (GM-261); Safepay-only card step when Safepay is connected (GM-262) |
| 0.8.0 | 12 Nov 2026 | Email through Mailtrap (any SMTP provider later) with a log of every send (GM-274); Configure → Email Templates in the Admin Panel: edit, live preview, send a test, switch off, restore default, recent emails, its own Roles & Access module (GM-275); *Continue with Google* on the Partner Portal sign-in and sign-up (GM-276); the fixed demo code stops working once email is set up |
| 0.7.4 | 12 Nov 2026 | A stray internal label on a live test payment renamed to "Safepay test payment" (migration 0014) and docs cleaned up (GM-267); escrow screens no longer show the gateway or sandbox line (GM-268); the Partner login never shows demo credentials in a built portal (GM-269); Admin Finances amount column no longer pinned (GM-270); partner interest table header and overview show topic, date and Pakistan time with dashes for empty fields (GM-271); wider rows-per-page picker on Users (GM-272); escrow wording tidied: no "Simulated" note on bill rows, "Payments in escrow" title, sentence-case greeting (GM-273) |
| Vercel | 11 Nov 2026 | Online on Vercel with a Neon database (GM-257) |
| 0.7.2 | 11 Nov 2026 | Finances on both portals from real bookings, dinner bill at check-in, Safepay checkout for the admin card step (GM-256) |
| 0.7.1 | 11 Nov 2026 | Admin card step for holds awaiting payment (GM-255), payout column and seats-booked fixes |
| 0.7 | 11 Nov 2026 | No-show penalties no longer need a partial capture, which Safepay does not offer: one card hold per seat, collected or released whole (GM-203); *Failed collections* in the Admin Panel with Retry and Close (GM-254) |
| 0.6 | 11 Nov 2026 | Backend rebuilt as a NestJS modular monolith on PostgreSQL (GM-243, GM-244), same screens and behaviour; Guests Arrived check-in (GM-38), no-show penalty (GM-203) and no-show policy (GM-204); dashboard revenue from real data |
| 0.5 | 9 Nov 2026 | Partner "Visible on Mingler app" switch now shows correctly in the Admin Panel; light/dark mode in both portals with a white logo in dark mode; starter Amenities, Interests, Topics and Preference Questions (Jira GM-238 to GM-241) |
| 0.4 | 9 Nov 2026 | End-to-end test fixes (menus, tables and timings reach Admin, roles reach Users, cover photo, change log, restart-safe data); clean install without demo data (Jira GM-213 to GM-233) |
| 0.3 | 6 Nov 2026 | Set the restaurant's map pin by pasting a Google Maps link |
| 0.2 | 6 Nov 2026 | Restaurant payout bank account (IBAN) and hosted payout set-up page |
| 0.1 | 6 Nov 2026 | Safepay sandbox keys read from `Backend/.env` |
| 0 | 6 Nov 2026 | First working build: both portals on the GoMingle API, Karachi/PKR rebrand, Safepay escrow |

The same history is on GitHub (Go-Mingle/Go_Mingle) as tags `v0` to `v0.5` and `release/v0.6` … `release/v0.8.0` branches, merged into `main` through pull requests.

