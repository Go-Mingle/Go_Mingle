# GoMingle Admin Panel

The back office for GoMingle's team: approve restaurants, run interest tables and bookings, follow the money in escrow, and manage the catalogues, roles and admin accounts behind the platform.

**Live:** https://gomingle-admin.vercel.app · API: https://gomingle-api.vercel.app

| | |
|---|---|
| Stack | React 19, TypeScript, Vite, Ant Design 6, Tailwind CSS 4, TanStack Query, Redux Toolkit, i18next |
| Icons | Phosphor only |
| Tests | Vitest + Testing Library (about 2,300 tests), MSW for the API; browser tests in [`../E2E`](../E2E/README.md) |
| Design | Candlelit brand, light and dark themes, phone layouts; boards and screenshots in [`Design/Admin`](../../Design/Admin/README.md) |

## What it does

| Area | Screens |
|---|---|
| Overview | **Dashboard** with charts and a PDF export; **Ctrl+K** search for pages, restaurants, Minglers, admin users and booking references |
| Restaurants | Directory with filters, **bulk suspend/reactivate**, **CSV export**; restaurant detail (profile, schedule, menu, photos, documents, bookings, reviews, Partner Portal access); **Manage** menu to edit details, tables, menus, contacts, amenities and photos on the restaurant's behalf; archive and restore |
| Approval queue | Pending and declined applications, review screen, approve with a category or decline with a reason, **bulk approve/decline**, CSV export |
| Interest tables | Create and edit tables at a restaurant; bookings with change-seats, **bulk cancel** and CSV export |
| Minglers | List and detail, suspend/reactivate (one or many), CSV export |
| Finances | Revenue, payouts, **Escrow & payouts** (holds, captures, releases, failed collections, sandbox bookings) |
| Catalogues | Amenities (icon library), categories, email templates, loyalty, preference questions, interests and topics |
| Platform | Notifications (and **message restaurants**), change log, timer settings |
| Access | Roles & access (per-module permissions), admin users (suspend, reset password, **turn off two-step**), **Security**: two-step sign-in, signed-in devices and the "require two-step for everyone" rule |

Every screen is gated by the admin's role (`shared/services/permissions.ts`); the sidebar, search and routes all read the same rules.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173, with the mock API (MSW)
```

Against a real API (see [`../Backend`](../Backend/README.md)):

```bash
VITE_MSW_ENABLED=false VITE_API_BASE_URL=http://localhost:4000/admin VITE_AUTH_MODE=api npm run dev
```

`../run-gomingle.sh` (or `.bat` on Windows) starts the API and both portals together.

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
    router.tsx        routes, lazy pages, permission guards
    layout/           shell: floating dock sidebar, top bar, Ctrl+K command palette, user menu
    modules/<area>/   one folder per area: page, components, services, hooks, types, tests
    atoms/ molecules/ shared building blocks (buttons, modals, bulk-action bar, CSV export, empty states)
    visual/           charts, dashboard PDF, motion helpers
  shared/
    api/              HTTP client (token refresh, act-as header, session handling)
    theme/            light/dark tokens and the circle theme transition
    utils/            CSV, bulk runner, dates, errors
  locales/en/         every string, one file per area
  mocks/              MSW handlers used by tests and `npm run dev`
  styles/             Tailwind entry and brand CSS
```

## Conventions

- Tailwind classes for layout and colour (`var(--color-…)` tokens); no inline styles in new code.
- Phosphor icons only. Strings go through i18next (`locales/en/*.json`).
- Nothing is imported from the Partner portal; shared ideas are copied deliberately.
- Each change is logged in the version history in the root `README.md` and on Jira.
