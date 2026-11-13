# GoMingle end-to-end tests

Playwright tests that drive the **Admin Panel** and **Partner Portal** in a real browser against a running **GoMingle API**, and check that what each screen shows is exactly what the API holds.

## What is covered

| Suite | What it checks |
|---|---|
| `seed.setup.ts` | Runs one realistic journey through the API so every screen has data: the partner completes the restaurant profile (photo, payout account, tables, menus) and submits it; the admin approves it with a category, publishes an interest table on the partner's table and menus, and takes four bookings through escrow (held, captured, released, refunded). Then it signs in to both portals. |
| `api.sweep.spec.ts` | Calls every read endpoint of both portals: no server errors, no `undefined`/`NaN`/`[object Object]`/non-finite numbers in any response, every call under 800 ms. Every endpoint refuses a missing token, and admin endpoints refuse a partner token. |
| `admin.crawl.spec.ts` | Opens every Admin Panel screen and every tab of the detail screens: no console errors, no failed API calls, no broken images, no untranslated text keys, no broken values on screen. |
| `partner.crawl.spec.ts` | The same for every Partner Portal screen and tab. |
| `admin.values.spec.ts` | Restaurant list and detail, menus and tables, finances (to the rupee), escrow totals and rows, interest tables, categories, users and the notification badge match the API. |
| `partner.values.spec.ts` | Restaurant profile, menus, tables, interest tables, finances and escrow match the API, and the same restaurant reads the same on both portals. |

## Running it

Start a fresh API and both portals (production builds are closest to Vercel):

```bash
cd Development/Backend && npm run build && DATA_DIR=/tmp/gm-e2e node dist/main.js &
cd Development/Admin && VITE_MSW_ENABLED=false VITE_API_BASE_URL=http://localhost:4000/admin VITE_AUTH_MODE=api npm run build && npx vite preview --port 5173 &
cd Development/Partner && VITE_ENABLE_MOCKS=false VITE_API_BASE_URL=http://localhost:4000/partner VITE_AUTH_MODE=api npm run build && npx vite preview --port 5174 &
```

Then:

```bash
cd Development/E2E
npm ci
npx playwright install chromium   # once
npx playwright test               # everything
npx playwright test --project=api # API only
npx playwright show-report        # the HTML report
```

`Development/run-gomingle.sh` (dev servers) works too.

The suite seeds data, so point it at a **fresh local install**, never at the live deployment. `E2E_API_URL`, `E2E_ADMIN_URL`, `E2E_PARTNER_URL` and the `E2E_*_EMAIL` / `E2E_*_PASSWORD` variables override the defaults.

GitHub Actions runs the whole suite on every pull request (`.github/workflows/ci.yml`) and keeps the HTML report as a build artifact.
