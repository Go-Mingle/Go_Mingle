# GoMingle API

Backend for the GoMingle **Admin Panel** and **Partner Portal**. It is a Node.js (Express) service that issues its own JWTs and serves the full REST contract both portals are built against.

```
Backend
├── src/
│   ├── server.js            HTTP server, CORS, logging, routing
│   ├── config.js            settings (env-overridable)
│   ├── portals.js           /admin and /partner routers, auth guard, sign-up and session scoping
│   ├── auth/
│   │   ├── users.js         accounts (bcrypt), lockout, one-time codes, demo seed
│   │   ├── tokens.js        JWT access tokens (HS256) + rotating refresh tokens
│   │   ├── adminAuth.js     /admin/api/v1/auth/*
│   │   └── partnerAuth.js   /partner/api/v1/partner/auth/*
│   └── contracts/dispatch.js  serves a route from a portal's contract module
├── contracts/               admin.mjs, partner.mjs: generated route modules + seed data
├── scripts/build-contracts.mjs
└── test/api.test.js         end-to-end API tests (node:test)
```

## Run it

```bash
npm install
npm start            # http://localhost:4000
npm test             # 23 API tests incl. the full cross-portal lifecycle (Node 22+)
```

Point the portals at it:

| Portal | Variables |
|---|---|
| Admin Panel | `VITE_MSW_ENABLED=false` `VITE_API_BASE_URL=http://localhost:4000/admin` `VITE_AUTH_MODE=api` |
| Partner Portal | `VITE_ENABLE_MOCKS=false` `VITE_API_BASE_URL=http://localhost:4000/partner` `VITE_AUTH_MODE=api` |

The `run-gomingle.bat` / `run-gomingle.sh` launchers in the parent folder set all of this up.

## Demo accounts

| Portal | Email | Password |
|---|---|---|
| Admin Panel (Super Admin) | admin@gomingle.com | Admin@123 |
| Partner Portal (Aurelia, Clifton) | partner@gomingle.com | Partner@123 |

New partners can sign up from the Partner Portal. The 6-digit e-mail code is printed in the API console window. The demo code `123456` is also accepted (`DEMO_OTP` to change it).

## What the API does

**One platform, two portals.** Both portals share a single persistent store (`data/gomingle-db.json`), so whatever one side does, the other sees:

| Partner Portal | → | Admin Panel |
|---|---|---|
| Signs up (e-mail code) and gets a new, empty restaurant | | |
| Fills the profile, uploads cover photo + documents, adds a payout bank account (IBAN) | | |
| **Sends for approval** | → | Appears in the **Approval Queue** with its documents; admin gets a notification |
| Sees *Under review* (profile read-only) | ← | **Decline** with a reason |
| Sees the reason, fixes, resubmits | → | Back in the queue, marked *resubmitted* |
| Gets the full portal and an "approved" notification | ← | **Approve** with a category; restaurant joins the **Restaurants** directory |
| Edits profile, contacts, amenities, photos | → | Restaurant detail shows the partner's latest data |
| Gets a notification | ← | Suspend / reactivate |
| Adds a team member | | The team member can sign in to the same restaurant |

The amenity list partners pick from is the catalogue admins manage under **Amenities**, including the icons.

**Authentication**
- Passwords are stored as bcrypt hashes.
- Access tokens are HS256 JWTs. Each token works on its own portal only.
- Refresh tokens rotate on every use and are revoked on logout or password change.
- Five failed sign-ins lock an account for 15 minutes.
- Both portals support forgot-password and change-password; partners can also self sign-up.

**Per-restaurant data.** Every partner restaurant has its own isolated copy of the partner domain: profile, contacts, menu, tables, media, documents, team, inbox and webhooks. A new restaurant starts empty. The demo restaurant Aurelia (`partner@gomingle.com`) comes with sample menus, bookings and finances.

**Routes.** There are about 245 routes. Request validation, response envelopes and error codes match the portals exactly, because they are generated from the portals' typed contract modules (`npm run build:contracts -- ../Admin ../Partner`). The cross-portal behaviour above is implemented in `src/integration.js` and `src/portals.js`.

**Persistence.** The data file keeps accounts, partner restaurants (profile, contacts, amenities, status and rejection history) and the admin restaurant and application records they produce. Delete `data/gomingle-db.json` to reset the demo. Operational demo data that isn't part of the onboarding flow is kept in memory only: menus, bookings, finances, roles and loyalty settings.

## Payments: Safepay with escrow

Stripe does not operate in Pakistan, so card payments go through **[Safepay](https://getsafepay.com)**, a Karachi-based gateway licensed by the State Bank of Pakistan. GoMingle uses Safepay's separate *authorize* and *capture* steps to hold each Mingler payment in escrow:

```
booking ──authorize──▶ AUTHORIZED ──capture──▶ IN_ESCROW ──release──▶ RELEASED
 (card hold)              │  (24-hour mark)       │  (event completed)  (net paid to restaurant IBAN)
                          └─void──▶ VOIDED        └─refund──▶ REFUNDED (reason required)
```

- **Authorize:** a hold is placed on the Mingler's card when a seat is booked (`do_capture: false`). No money moves yet.
- **Capture:** funds are collected into GoMingle's Safepay merchant balance and held in escrow.
- **Release:** after the event, the restaurant's share (amount minus `PLATFORM_FEE_PCT`, default 10%) is paid to the IBAN it registered. The release is refused if no payout account exists.
- **Void / refund:** cancels a hold, or returns captured money to the Mingler.

Restaurants add and edit their payout account on the **Payout Account** tab of their profile (`GET`/`PUT /partner/api/v1/partner/restaurant/payout-account`). It asks for the account title, bank and a Pakistani IBAN, checked with mod-97. The IBAN is only ever returned masked (`PK72 •••• 1234`); sending the masked value back keeps the number on file. A hosted page at `/payouts/setup/:restaurantId` does the same for links opened outside the portal. Admins run the ledger from **Finances → Escrow & payouts**. Partners see their balance on **Finances**.

| Route | Purpose |
|---|---|
| `GET /admin/api/v1/escrow?status=` | Gateway, totals, transactions, active restaurants |
| `POST /admin/api/v1/escrow/test-booking` | Place a sandbox card hold (stands in for the Mingler app) |
| `POST /admin/api/v1/escrow/:id/{capture,void,release,refund}` | Move a transaction; partners are notified on capture and release |
| `GET /partner/api/v1/partner/escrow` | The signed-in restaurant's escrow position and payouts |
| `GET`/`PUT /partner/api/v1/partner/restaurant/payout-account` | The restaurant's payout bank account (IBAN masked) |

**Simulator vs. your Safepay sandbox.** With no keys set, `src/payments/safepay.js` runs a built-in simulator with the same state machine, so the demo works offline. Put your Safepay sandbox keys in `Backend/.env` (copy `.env.example`): the key that starts with `sec_` goes in `SAFEPAY_API_KEY`, the long secret in `SAFEPAY_SECRET_KEY`. Restart the API and its startup line shows `Payments  Safepay sandbox (https://sandbox.api.getsafepay.com)`. Empty keys switch back to the simulator. The seeded sample transactions stay local in both modes; only bookings you create go to Safepay. The live path follows Safepay's documented endpoints but has not been run against a real sandbox account from this build, so test it once with your keys before the demo. In live mode the Mingler enters the card in Safepay's checkout (with 3-D Secure) before a hold is authorised.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | Listen port |
| `PUBLIC_URL` | `http://localhost:PORT` | Origin browsers use (upload/media URLs) |
| `JWT_SECRET` | random per start | Signing secret. Set it to keep sessions across restarts |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | 7200 / 604800 s | Token lifetimes |
| `CORS_ORIGINS` | any localhost port | Extra allowed origins, comma-separated |
| `DEMO_OTP` | 123456 | Extra one-time code accepted for demos |
| `DATA_FILE` | `data/gomingle-db.json` | Where the persistent store is written |
| `SAFEPAY_ENV` | sandbox | `sandbox` or `production` (picks the Safepay host) |
| `SAFEPAY_API_KEY` / `SAFEPAY_SECRET_KEY` | unset | Safepay keys. Unset runs the built-in simulator |

Any of these can go in `Backend/.env` (one `KEY=value` per line; see `.env.example`). Values set in the shell take priority. `.env` is git-ignored, so keys are never committed.
| `PLATFORM_FEE_PCT` | 10 | GoMingle's cut when escrow is released |

## Limits of this build (what the production NestJS service adds)

The SRS targets a NestJS modular monolith on ECS with PostgreSQL, Redis, OpenSearch, Cognito and a payment gateway (Safepay here). This service is the demo stand-in for that system. It does not include:

- **A relational database.** The data file stands in for PostgreSQL.
- **Real e-mail, SMS or push.** Codes are printed to the console.
- **Real payouts.** Payments use the Safepay simulator unless you add sandbox keys. Releasing escrow records the payout to the restaurant's IBAN; the bank transfer itself (Raast/IBFT from GoMingle's account) is not automated, because Safepay does not document a marketplace payout API.
- **Fine-grained admin roles.** The seeded admin is Super Admin.
- **Mobile-app bookings.** Booking and finance figures are sample data until the Mingler app is connected.
