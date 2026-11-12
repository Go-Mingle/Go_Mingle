# GoMingle server

The backend for the GoMingle Admin Panel and Partner Portal: a NestJS modular
monolith on PostgreSQL.

| | |
|---|---|
| Language | TypeScript 5.9 on Node.js 20+ |
| Framework | NestJS 11 (Express) |
| Database | PostgreSQL 17, through Drizzle ORM |
| Payments | Safepay (authorize → capture → release), with a built-in simulator |
| Tests | Vitest: 12 contract scenarios, about 1,000 checked answers |

## Run it

```
npm install
npm start
```

That is all. With no `DATABASE_URL`, the server starts its own PostgreSQL and
keeps its files in `./data`; nothing has to be installed. The first start
creates the tables and two accounts:

| Portal | Email | Password |
|---|---|---|
| Admin Panel | admin@gomingle.com | Admin@123 |
| Partner Portal | partner@gomingle.com | Partner@123 |

plus the four starter catalogues (amenities, interests, topics, preference
questions). Nothing else is pre-filled.

The portals point at it with:

```
Admin Panel     VITE_API_BASE_URL=http://localhost:4000/admin
Partner Portal  VITE_API_BASE_URL=http://localhost:4000/partner
```

One-time codes (password reset, partner sign-up) are printed in this server's
console; `123456` is also accepted while `DEMO_OTP` is left at its default.

## Settings

Copy `.env.example` to `.env`. Everything is optional.

- `DATABASE_URL`: use your own PostgreSQL or AWS RDS instead of the built-in one.
- `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_ENV`: with both keys set the
  server talks to Safepay (sandbox or production); without them it uses the simulator.
- `JWT_SECRET`: set it so sign-ins survive a restart.
- `PLATFORM_FEE_PCT`: GoMingle's share of a booking (default 10).
- Email (see *Email* below): `MAILTRAP_API_TOKEN` + `MAILTRAP_INBOX_ID`, or
  `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`; `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`;
  `ADMIN_PORTAL_URL`, `PARTNER_PORTAL_URL` for links in emails.
- `GOOGLE_CLIENT_ID`: turns on Google sign-in for partners.
- `DEMO_OTP`: a fixed code accepted alongside the real one. Defaults to `123456`
  while no email provider is set, and is off once one is (set it to force one).

## Email

Every email is a template in `src/shared/email/catalog.ts` (default wording and
placeholders) that admins can edit under **Configure → Email Templates**. Sending
goes through `MailService.send(key, recipient, values)`, which fills the stored
template, delivers it and writes a row to `email_log` (Sent, Failed, Not
delivered, Switched off). A failed send never blocks the action that caused it.

| Provider | Settings | What happens |
|---|---|---|
| Mailtrap test inbox (online now) | `MAILTRAP_API_TOKEN`, `MAILTRAP_INBOX_ID` | Emails land in Mailtrap → Sandboxes, not in real inboxes |
| Mailtrap live sending | `MAILTRAP_API_TOKEN` only | Real delivery; needs a verified domain in Mailtrap |
| SMTP (Brevo, Amazon SES, …) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Real delivery through that provider |
| None (local default) | — | The email is printed in the server window |

Emails sent today: partner sign-up code, partner and admin password-reset codes,
team member added, admin user added, new restaurant application (to admins who
can approve), restaurant approved / declined / suspended / reactivated, payout
released. Code emails cannot be switched off.

## Google sign-in (Partner Portal)

`POST /partner/api/v1/partner/auth/google` takes the ID token Google Identity
Services gives the portal (`{ credential }`), checks Google's signature, the
`GOOGLE_CLIENT_ID` audience, issuer, expiry and that the email is verified. A
partner with that email is signed in; a new email gets a partner account and a
Draft restaurant (route `PROFILE_SETUP`). Admin emails cannot become partners.

`npm run reset-data` deletes the built-in database (stop the server first).

## Bookings, Guests Arrived and no-show

- Each restaurant sets a **no-show policy** in the Partner Portal (Restaurant
  Profile → No-Show Policy): a penalty per empty seat and a free-cancellation
  window. A penalty of 0 is valid. A change applies to new bookings only.
- A booking places one Safepay hold per seat, each for the penalty amount.
  Safepay cannot collect part of a hold, so a no-show collects the empty
  seats' holds in full and releases the others. Until the Mingler app
  exists, bookings are made from the Admin Panel: Finances → Escrow & payouts →
  Sandbox booking → choose an interest table.
- On the interest table, restaurant staff press **Guests Arrived** (from one
  hour before the start) to check everyone in and release the holds, or record
  a **No-show** on a booking (once the start time has passed) for some or all of
  its seats. The penalty for the empty seats goes into escrow and is paid to the
  restaurant like any other payout.
- A collection the gateway refuses is listed under Finances → Escrow & payouts →
  Failed collections, where it can be retried or closed with a note.
- Bookings nobody checks in within an hour of the start time become no-shows
  automatically (checked every 15 minutes; on Vercel on incoming requests).
- All table dates and times are **Pakistan time (UTC+05:00)**. A table can't be
  published with a start that has passed in Pakistan, and takes no bookings
  once it has started.
- Cancelling a table cancels all its bookings and gives each Mingler's money
  back: card holds are let go, payments taken on Safepay are refunded.
- A table without bookings can be deleted; one with bookings must be cancelled.

The card step (until the Mingler app does it) is done by an admin on
Finances → Escrow & payouts, on a hold that says "Awaiting payment":

- **With Safepay keys set:** **Pay on Safepay** opens Safepay's own checkout
  page. Pay there with a Safepay sandbox test card; the payment is recorded at
  Safepay and the holds are placed when you come back (or press **Check
  payment**). The simulated test card is refused in this mode.
- **Without keys:** **Add test card** (`4111 1111 1111 1111`) approves the hold
  in the built-in simulator; nothing reaches Safepay.

## On Vercel

`api/index.js` is the Vercel function; it loads `dist/serverless.js`, built from
`src/serverless.ts`. `vercel.json` builds with `npm run build` and sends every
path to that function.

On a cold start it:
1. Opens the direct database connection (`DATABASE_URL_UNPOOLED`) and takes an
   advisory lock, so two starts never migrate at once. A lock left behind by a
   frozen instance is cleared after 20 s.
2. Applies migrations and first-run data.
3. Serves requests over the pooled connection (`DATABASE_URL`).

Extra settings used online: `SEED_ADMIN_PASSWORD`, `SEED_PARTNER_PASSWORD`
(first passwords on a fresh database), `CORS_ORIGINS`, `PUBLIC_URL`, plus the
email and Google settings above.

## Layout

```
src/
  main.ts            start the database, run migrations, seed, listen
  app.module.ts      every controller and service
  config.ts          settings from the environment
  db/schema/         one file per area: the tables
  auth/              tokens, passwords, one-time codes
  admin/             Admin Panel routes   (/admin/api/...)
  partner/           Partner Portal routes (/partner/api/...)
  shared/            what both portals use: restaurants, review lifecycle,
                     interest tables, notifications, escrow, change log
  seed/              first-run accounts and starter catalogues
drizzle/             SQL migrations (generated: npm run db:generate)
test/parity/         contract scenarios
test/snapshots/      the answers each scenario is held to
```

Both portals read and write the same rows: a restaurant is one record that the
partner edits and the admin reviews, so nothing is copied between them.

## Tests

```
npm test          # all contract scenarios
npm run typecheck
```

Each scenario plays a full story through the HTTP API (for example: partner
fills the profile, submits, admin declines, partner resubmits, admin approves,
suspends, reactivates) and compares every answer with `test/snapshots`.
After an intended change to an answer, run `GM_UPDATE_SNAPSHOTS=1 npm test`
and review the snapshot diff.

## Not built yet

- Minglers, bookings, reviews and per-booking finance rows are written by the
  Mingler app. Until it exists those screens are empty.
- Files (photos, documents, menu PDF) are stored in the database; they move to
  S3 at go-live.
- The admin finance export returns a placeholder link, and the webhook
  "send test" records a delivery without posting to the endpoint.
