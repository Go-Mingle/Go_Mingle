# guideline.md — GoMingle Admin Panel

## Project

**Project Name:** GoMingle Admin Panel
**Client:** GoMingle
**Built by:** GoMingle
**Project Lead:** [Project Lead Name]

> For all design system information — colours, typography, spacing, components, themes, responsive breakpoints, and Do's/Don'ts — refer to `design.md` in the project root. This file covers technical implementation, architectural rules, and code quality standards only.

---

## Stack

| Concern             | Technology                                                         |
| ------------------- | ------------------------------------------------------------------ |
| Framework           | ReactJS (latest stable)                                            |
| Language            | TypeScript — strict mode mandatory                                 |
| Styling             | Tailwind CSS v4 (CSS-first config via `@theme` in `src/index.css`) |
| Routing             | React Router v7                                                    |
| Data Fetching       | React Query + Hey API (Swagger → React Query code generation)      |
| State Management    | Zustand (latest stable)                                            |
| Testing             | Vitest + React Testing Library                                     |
| API Mocking         | MSW (Mock Service Worker)                                          |
| Localisation        | i18next — `t()` required on all UI strings                         |
| Quality Tools       | ESLint, Prettier, SonarLint                                        |
| Git Hooks           | Husky — pre-commit runs lint + type-check + test                   |
| Icons               | lucide-react (only icon library — no others)                       |
| Conditional Classes | clsx (only classname utility — no cx, cn, or others)               |

---

## Architectural Principles

### Module-First Architecture

Each business domain is a self-contained module. The central router loads modules lazily and never contains business logic. Each module owns its internal routing, components, services, store slice, types, and constants.

- **No cross-module imports.** Module A must never import directly from Module B. If shared logic is needed, it belongs in `src/shared/`.
- **No domain logic in shared/ui.** The shared UI layer is a component library, not a feature. It must remain domain-agnostic.
- **Modules are independently scalable.** A new developer can build a module end-to-end without reading any other module's code.

### Atomic Design Mapping

| Atomic Layer           | Location                           | What Belongs Here                                            |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Atoms (Primitives)     | `src/shared/ui/primitives/`        | Button, Input, Chip, Badge, Checkbox, Radio, Tooltip         |
| Molecules (Composites) | `src/shared/ui/composites/`        | Modal, DataTable, SearchBar, FilterChip group                |
| Organisms (Patterns)   | `src/shared/ui/patterns/`          | Sidebar, Topbar, PageLayout, ErrorState                      |
| Domain Components      | `src/modules/{module}/components/` | Module-specific UI with React Query calls and business logic |
| Pages                  | `src/modules/{module}/pages/`      | Route entry points — compose components, apply layout        |

**Key constraint:** `shared/ui` may be imported by modules, but `shared/ui` must never import from any module.

---

## Project Folder Structure

```
src/
 ├── app/                        # Central router — lazy-loads all modules
 ├── assets/                     # Static assets (images, SVGs)
 ├── modules/                    # Feature modules — one per business domain
 │    ├── auth/
 │    │    ├── components/       # Domain-specific UI + React Query hooks
 │    │    ├── pages/            # Route-level entry points (lazy-loaded)
 │    │    ├── services/         # API calls scoped to this module
 │    │    ├── store/            # Module-scoped Zustand slice
 │    │    ├── types/            # TypeScript interfaces for this domain
 │    │    └── constants/        # Module-level constants (no magic strings)
 │    └── [module-name]/...      # Repeat structure for each module
 ├── shared/
 │    ├── ui/
 │    │    ├── primitives/       # Atoms — Button, Input, Badge, Chip, etc.
 │    │    ├── composites/       # Molecules — Modal, DataTable, etc.
 │    │    └── patterns/         # Organisms — Sidebar, Topbar, PageLayout
 │    ├── i18n/
 │    │    └── en/               # English locale JSON files (default)
 │    ├── services/              # Cross-module services (auth, permissions)
 │    ├── store/                 # Global Zustand store (theme, user session)
 │    └── utils/                 # Pure helper functions, formatters
 ├── data/
 │    └── mock/                  # MSW handlers and mock data matching API shapes
 └── index.tsx                   # App entry point
```

**Data flow rule — always follow this direction:**

```
Page → Component → React Query hook → Service → (Store | MSW mock)
```

Never skip levels. A Page must not call a service directly. A component must not reach into another module's store.

---

## Theme System — Technical Implementation

The design system details (colours, tokens, what differs between the Admin Panel, Partner Portal, and Mobile App surfaces) live in `design.md`. This section covers only the implementation pattern.

The Admin Panel runs in **light mode only**. There is no user-facing theme toggle. The theme attribute is set once at app mount and does not change.

### App Mount

In `App.tsx`, set the theme attribute synchronously before the component tree renders to prevent any flash of unstyled content:

```typescript
document.documentElement.dataset.theme = 'light' // Admin Panel — always light
```

### CSS Variable Definitions — `src/index.css`

All surface-sensitive colour tokens are defined as CSS custom properties in a single block, since the Admin Panel has only one theme:

```css
:root,
[data-theme='light'] {
  /* GoMingle Admin Panel light theme tokens — see design.md for all values */
  --color-page: #f4f6f8;
  --color-sidebar: #ffffff;
  --color-topbar: #ffffff;
  --color-card: #ffffff;
  --color-border: rgba(0, 0, 0, 0.08);
  --color-accent: #0fa79d;
  --color-text: #0d2233;
  --color-text-muted: #4a6274;
  --color-text-subtle: rgba(30, 51, 68, 0.4);
  --color-input: #ffffff;
  --color-input-border: #d1d9e0;
  --color-hover: rgba(15, 167, 157, 0.06);
  --color-divider: rgba(0, 0, 0, 0.06);
}
```

Never define component colours anywhere other than `src/index.css`.

---

## Responsive Implementation

Responsive layout behaviour per breakpoint is defined in `design.md`. This section covers the implementation rules that apply in code.

### Tailwind Breakpoint Mapping

| Tailwind Prefix       | Width    | Platform Tier                  |
| --------------------- | -------- | ------------------------------ |
| (none / mobile-first) | < 640px  | Mobile                         |
| `md:`                 | ≥ 768px  | Tablet                         |
| `lg:`                 | ≥ 1024px | Desktop-SM (minimum authoring) |
| `xl:`                 | ≥ 1280px | Desktop (standard target)      |
| `2xl:`                | ≥ 1536px | Desktop-LG                     |

### Implementation Rules

- Write mobile-first CSS — apply the mobile layout without a prefix, then layer `md:` and `lg:` overrides progressively.
- Data table column visibility at smaller breakpoints is controlled by Tailwind responsive hidden classes (`hidden lg:table-cell`), not JavaScript.
- Complex authoring modules must render a `<ScreenSizePrompt />` component at `< lg` instead of the authoring UI.
- The `<ScreenSizePrompt />` component lives in `src/shared/ui/patterns/ScreenSizePrompt.tsx`.
- Modal dialogs switch to a bottom-sheet layout at `< md` — built into the shared `Modal` primitive.

### Responsive Testing Requirements

Before marking any module complete, verify these viewport widths in the browser:

1. `1440px` — primary target, full layout, all table columns visible
2. `1280px` — standard desktop, verify no horizontal overflow
3. `1024px` — minimum authoring, all interactions working, sidebar collapsed to icon rail
4. `768px` — tablet, reduced columns, authoring modules show screen-size prompt
5. `375px` — mobile, read-only summary views, no horizontal scroll

---

## Conventions

### Component Rules

- Functional components with TypeScript interfaces only — no class components
- All props must have explicit TypeScript interfaces
- No `any` type — strict TypeScript throughout
- All icons from `lucide-react` only
- All conditional classNames via `clsx`
- All UI strings wrapped in `t()` from `i18next`
- All API calls via React Query — never `useEffect` + `fetch`
- All modal overlays via the shared `Modal` primitive — never implement overlay logic inline
- Avoid inline CSS — use Tailwind utilities

### Naming Conventions

- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities and hooks
- Hooks: always prefixed with `use`
- Services: named after the domain — `authService.ts`, `restaurantService.ts`, `financeService.ts`
- Constants: `SCREAMING_SNAKE_CASE` for true constants
- Route paths: kebab-case — `/dashboard`, `/restaurant-management`, `/finance`, `/change-log`

### CSS / Styling Rules

- All surface-sensitive colours via CSS variables — see `design.md` for the complete token list
- Tailwind utility classes for spacing, layout, flex, grid — not inline `style={{}}`
- Never use arbitrary Tailwind values for colours that exist in the CSS variable system
- `@theme` block in `src/index.css` is the only place to extend Tailwind tokens — no `tailwind.config.js` (Tailwind v4)

### Figma Mapping

Every component added to `src/shared/ui/` must have a matching node in the project's Figma design system file. After adding a new shared component:

1. Create the corresponding Figma frame using Figma Make
2. Update `docs/figma-mapping.md` with the component name, Figma node ID, source path, and file key

---

## Module Build Status

Update this list as modules are completed. Mark each with `[x]` when done.

### Foundation (shared/ui)

- [ ] App Shell — Topbar, Sidebar, PageLayout
- [ ] Theme System — CSS variable system (light mode), no toggle required
- [ ] UI Primitives — Button, Input, Badge, Chip, Checkbox, Radio, Tooltip
- [ ] UI Composites — Modal, DataTable, SearchBar
- [ ] UI Patterns — Sidebar, Topbar, PageLayout, ErrorState, ScreenSizePrompt

### Super Admin Modules

- [ ] SA0 — Authentication (Login, Session Management)
- [ ] SA1 — Role and Access Management (Roles, Admin User provisioning)
- [ ] SA2 — Change Log (Platform-wide audit trail with filters)
- [ ] SA3 — Category Management (Commission category CRUD)

### Admin Modules

- [ ] A0 — Dashboard (Live platform metrics, role-gated navigation)
- [ ] A1 — Restaurant Management (Onboarding approvals, account lifecycle)
- [ ] A2 — User Management (Mingler account management)
- [ ] A3 — Finance (Revenue Overview, Payout Oversight)
- [ ] A4 — Loyalty Configuration (Loyalty programme settings)

---

## Best Practices

### Code Quality

- **Lint and format**: Zero ESLint warnings or errors. Prettier enforced on every save and on commit via Husky.
- **TypeScript strict mode**: No `any`, no escape hatches, no non-null assertions without an explanatory comment.
- **DRY principle**: If a pattern appears in more than two places, abstract it into `src/shared/utils/` or a custom hook.
- **Component size**: If a component exceeds ~150 lines, split it. Pages compose components and should not contain significant JSX.
- **Comment complex logic**: Any non-obvious logic should have an inline comment explaining the intent — not what the code does, but why.

### Testing & Coverage

- Unit test coverage target: **≥ 80%** per module, measured by Vitest.
- Tests are written in the same sprint as the feature — never deferred.
- **MSW** is the only mechanism for API mocking in tests.
- React Testing Library — test behaviour from the user's perspective, not implementation details.
- Each shared/ui primitive must have tests covering all visual states (default, hover, focus, disabled, error).

### Security

- No hardcoded credentials, API keys, or sensitive configuration — use environment variables via `import.meta.env`.
- Encrypt `localStorage` in non-development environments for sensitive values.
- Centralised permission checks — role-based access logic lives in `src/shared/services/permissions.ts`. Sub-module visibility for each admin role is resolved here; never inline permission checks in module components.
- All UI strings via `t()` — never render user-provided strings directly without sanitisation.
- Each package version pinned at an exact version in `package.json` — no `^` or `~` prefixes.
- Run `npm audit` as part of CI; block deploys on high-severity vulnerabilities.

### Performance

- All module pages lazy-loaded via `React.lazy()` — the central router never eagerly imports module code.
- Use `React.memo`, `useMemo`, `useCallback` only where profiling shows a genuine re-render problem.
- React Query handles caching and background refetching — do not add a secondary manual cache.
- Support server-side pagination, sorting, and filtering for all data table modules (Restaurant list, User list, Change Log, Payout Oversight).

### API & Data

- All API calls go through `src/shared/services/` or a module's own `services/` folder.
- Hey API generates typed React Query hooks from the Swagger spec — use generated types.
- Mock data lives in `src/data/mock/` and is accessed only via MSW handlers.
- Support pagination, sorting, and filtering at the API layer from the first implementation.

### Collaboration & Workflow

- **Branching**: `feature/{module-name}` for module builds, `fix/{description}` for bug fixes, `chore/{description}` for tooling.
- **Pull Requests**: every PR requires at least one peer review before merge; verify the layout at 1440px, 1024px, and 768px before approving.
- **Pre-commit**: Husky runs `eslint`, `tsc --noEmit`, and `vitest run` — all three must pass before a commit is accepted.
- **guideline.md updates**: when a module is marked complete or a new convention is established, update this file in the same PR.

---

## Expected Outcomes

By the end of the project, the codebase must satisfy all of the following:

- Strictly typed TypeScript throughout — zero `any`, zero type suppressions
- Zero ESLint issues, consistent Prettier formatting across all files
- Modular, reusable components with centralised utilities — no duplicated logic
- All surface-sensitive colours driven by CSS variables — every screen verified in light mode at all five target breakpoints
- Role-based module visibility working correctly — unpermitted modules never rendered, not shown as disabled
- Secure handling of sensitive data (commission values, Safepay account IDs, admin credentials) with encrypted local storage in production builds
- ≥ 80% unit test coverage per module with MSW-mocked API calls
- Consistent PR and branching workflow with automated quality gates on every commit
