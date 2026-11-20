# GoMingle Partner Portal

Where a restaurant lists itself on GoMingle and runs its tables: profile and photos, table areas and timings, set menus, interest tables and bookings, check-in and no-shows, payouts, team and notifications.

**Live:** https://gomingle-partner.vercel.app · API: https://gomingle-api.vercel.app

| | |
|---|---|
| Stack | React 19, TypeScript, Vite, Ant Design 6, Tailwind CSS 4, TanStack Query, Redux Toolkit, i18next |
| Icons | Phosphor only |
| Tests | Vitest + Testing Library, MSW for the API; browser tests in [`../E2E`](../E2E/README.md) |
| Design | Candlelit brand, light and dark themes, phone layouts; boards and screenshots in [`Design/Partner`](../../Design/Partner/README.md) |

## What it does

| Area | Screens |
|---|---|
| Sign in | Email and password or Google; sign-up with an emailed code; password reset |
| Restaurant profile | Overview, payout account, contacts (import from Excel/CSV), documents, amenities, menu options, table timings, interest tables, photos (cover and profile, cropped), no-show policy; **Send for approval** with a checklist of what's missing |
| Dashboard | Bookings and revenue charts for a date range, upcoming tables, **PDF export** |
| Interest tables | Each table's bookings, **Guests arrived** and **No-show** (per empty seat), GoMingle announcements |
| Finances | Balance, escrow, payouts and penalties |
| Users | The team: add one or **import many from Excel/CSV**, roles, suspend, reset passwords (owners only) |
| Notifications | Bookings, approvals, payouts and messages from GoMingle |

A GoMingle super admin can also make these changes on the restaurant's behalf from the Admin Panel. They go through the same routes and rules and are recorded in the change log.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5174, with the mock API (MSW)
```

Against a real API (see [`../Backend`](../Backend/README.md)):

```bash
VITE_ENABLE_MOCKS=false VITE_API_BASE_URL=http://localhost:4000/partner VITE_AUTH_MODE=api npm run dev
```

| Script | |
|---|---|
| `npm run build` | Type-check and production build |
| `npm run lint` | ESLint, no warnings allowed |
| `npm run typecheck` | `tsc -b` |
| `npm run test:run` | All unit and component tests once |
| `npm run format` | Prettier |

## Layout

```
src/
  app/
    modules/<area>/   restaurants (profile tabs), dashboard, finances, users, notifications, auth, …
    atoms/ molecules/ shared building blocks (import dialog, empty states, modals)
    visual/           charts, dashboard PDF, motion helpers
  shared/
    api/              HTTP client and session handling
    theme/            light/dark tokens and the circle theme transition
    utils/            spreadsheet reader (CSV/xlsx), dates, errors
  locales/en/         every string
  mocks/              MSW handlers used by tests and `npm run dev`
```

## Conventions

- Tailwind classes and `var(--color-…)` tokens; Phosphor icons; strings through i18next.
- Nothing is imported from the Admin Panel.
- Each change is logged in the version history in the root `README.md` and on Jira.
