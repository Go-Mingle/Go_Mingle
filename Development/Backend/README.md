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
  automatically (checked every 15 minutes).

With Safepay keys set, a sandbox booking waits for a real card step in
Safepay's checkout, so its hold stays "pending payment" and a no-show has
nothing to collect (it is reported as a failed collection). To try the whole
flow without a card, leave `SAFEPAY_API_KEY` and `SAFEPAY_SECRET_KEY` empty:
the built-in simulator approves every hold.

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
