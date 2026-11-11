# Frontend Engineering Guidelines

**Purpose:** All React/TypeScript code MUST follow these guidelines **100%**. Treat every rule as mandatory.
Backend is already developed in java, we only work on frontend integration part.

---

## Tools & Frameworks

- **Framework:** React 19 with TypeScript
- **Language:** TypeScript with **strict mode** (`strict: true` in tsconfig)
- **UI Library:** Ant Design v6.3.7 (primary); use Antd components for layout and forms (with theme tokens)
- **Styling:** Tailwind CSS v4.2 +Tailwind for custom styling; Ant Design theme for design tokens
- **Build:** Vite
- **Routing:** React Router v7
- **Data fetching:** React Query v5(TanStack Query v5) with browser fetch function- intercepter
- **State:** Redux Toolkit (global); React Query (server state)
- **i18n:** i18next v26.0.8— all user-facing strings via `t()`, http-backend
- **Testing:** Vitest + React Testing Library
- **Mocking:** MSW (for dev)
- **Quality:** ESLint, Prettier; 0 lint/type errors, husky, before commit
- **Sentry:** for error logging and tracking
- **Recharts v3.8.1:** for interactive charts
- **SonarQube** scanner in Bitbucket Pipelines

---

## Project Structure (Reference)

Use this structure so modules can be selected and revamped independently. Generated code MUST that fits this layout.

### Root level

```
project-root/
├── public/                    # Static assets (favicon, manifest)
├── src/
├── .env.example
├── .eslintrc
├── .prettierrc
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js         # If using Tailwind
```

### Source directory (`src/`)

```
src/
├── app/                              # Application shell & feature modules
│   ├── atoms/                        # Atomic UI (single responsibility, no composition)
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── ...
│   ├── molecules/                    # Shared composed components (atoms + simple logic), used across modules
│   │   ├── Header/
│   │   ├── FormModal/
│   │   ├── DataTable/
│   │   └── ...
│   ├── modules/                      # Feature modules (business logic)
│   │   ├── leave-management/
│   │   │   ├── components/           # Feature-specific molecules (small composites used only by this module)
│   │   │   ├── hooks/
│   │   │   ├── services.ts
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── index.tsx
│   │   ├── auth/
│   │   └── ...
│   ├── pages/                        # Page-level route components
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── employee/
│   │   ├── manager/
│   │   └── hr/
│   ├── layout/                       # App shell (sidebar, header, main content)
│   │   └── AppLayout.tsx
│   └── hooks/                        # App-wide hooks
│       └── use*.ts
│
├── assets/
│   ├── icons/
│   ├── images/
│   └── ...
│
├── configs/
│   ├── env.ts
│   ├── routeNames.ts
│   └── ...
│
├── locales/                          # i18n
│   ├── en/
│   │   ├── common.json
│   │   └── leave.json
│   └── ...
│
├── routes/
│   ├── AppRoutes.tsx
│   ├── AppRouterProvider.tsx
│   └── ...
│
├── shared/
│   ├── store/                        # Redux slices
│   ├── utils/                        # formatDate, getInitials, etc.
│   └── ui/                           # Shared primitives (if not in app/atoms)
│
├── interfaces/                       # Shared TypeScript types (or types/)
│   └── *.ts
│
├── mocks/                            # Mock data & MSW handlers (dev only)
│   ├── handlers/
│   └── data/
│
├── styles/                           # Global CSS, theme, Antd overrides
│   ├── index.css
│   ├── theme.css
│   └── antd-overrides.css
│
├── App.tsx
├── main.tsx
└── setupTests.ts
```

### Feature module pattern (`app/modules/[Feature]/`)

Each feature MUST follow this pattern for easy selection and revamp. The **components/** folder holds the feature’s **molecules** — small composite components (atoms + simple logic) used only by this module.

```
modules/[FeatureName]/
├── components/           # Feature-specific molecules (StatCard, StatusTag, LeaveDetailDrawer, etc.)
├── hooks/                # Feature-specific hooks
├── __tests__/            # Unit tests for this module
├── services.ts           # API / data fetching
├── types.ts              # Feature types
├── constants.ts          # Optional
└── index.tsx             # Module entry/export
```

### Atomic design mapping

| Level         | Location                                                | Purpose                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atoms**     | `app/atoms/`                                            | Single responsibility; no composition (Button, Input, Tag). Reusable across the app.                                                                                                                                                                        |
| **Molecules** | `app/molecules/` **or** `modules/[Feature]/components/` | **Shared:** `app/molecules/` — composed of atoms, used across modules (Header, FormModal, DataTable). **Feature-specific:** `modules/[Feature]/components/` — small composite components (StatCard, StatusTag, LeaveDetailDrawer) used only by that module. |
| **Modules**   | `app/modules/`                                          | Features with services, hooks, business logic; each module calls its own`components/` (molecules).                                                                                                                                                          |
| **Pages**     | `app/pages/`                                            | Route-mounted compositions of modules & molecules.                                                                                                                                                                                                          |
| **Layout**    | `app/layout/`                                           | Shell (sidebar, header, main content area).                                                                                                                                                                                                                 |

### Key directories summary

| Directory                 | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `atoms/`                  | Small reusable UI primitives (app-wide).                                |
| `molecules/`              | Shared composed components (modals, forms, tables) used across modules. |
| `modules/`                | Business features; each has its own`components/` (feature molecules).   |
| `modules/.../components/` | Feature-specific molecules — small composites used only by that module. |
| `pages/`                  | Page-level route components.                                            |
| `layout/`                 | App shell and navigation.                                               |
| `configs/`                | Route names, env, constants.                                            |
| `locales/`                | i18n translation files.                                                 |
| `routes/`                 | React Router setup.                                                     |
| `shared/utils/`           | HTTP client, formatters, auth helpers.                                  |
| `interfaces/`             | Shared TypeScript types.                                                |
| `mocks/`                  | MSW handlers, mock data.                                                |
| `styles/`                 | Global and theme styles.                                                |

### File naming

- **Components:** PascalCase (`UserProfile.tsx`, `StatCard.tsx`)
- **Hooks:** camelCase, `use` prefix (`useAuth.ts`, `useLeaveQueries.ts`)
- **Utils/Services:** camelCase (`auth.ts`, `formatting.ts`)
- **Types:** PascalCase for types/interfaces (`User.ts`, `Leave.ts`)
- **Tests:** `*.test.tsx`, `*.test.ts` or `__tests__/`

---

## Code Generation Rules — MUST Ensure

### 1. Architecture & structure

- **MUST** use the folder structure above (atoms, molecules, modules, pages, layout, configs, locales, routes, shared, styles).
- **MUST** keep each feature in its own module under `app/modules/[Feature]/` with components (feature molecules), hooks, services, types.
- **MUST** place feature-specific molecules (small composite components) inside `modules/[Feature]/components/`; only shared molecules that cross modules go in `app/molecules/`.
- **MUST** avoid cross-module imports; modules use shared/ and configs only.
- **MUST** lazy-load page components via `React.lazy()` and wrap with `<Suspense>`.
- **MUST** use a single router (e.g. React Router) with route definitions in `routes/`.

### 2. Component size

- **MUST** keep every component file under **200 lines**. If a file grows beyond that, split into smaller components or extract hooks/utils.
- **MUST** place each component in its own file (one component per file for non-trivial components).
- **MUST** extract repeated TSX blocks (e.g. modals, filter bars, stat rows) into molecules — in `app/molecules/` if shared, or in `modules/[Feature]/components/` if feature-specific.

### 3. DRY — no duplication

- **MUST** put shared logic (e.g. `getLeaveTypeColor`, `getStatusColor`, `getInitials`, date formatting) in `shared/utils/` or module-level utils and import them; do not copy-paste the same function across files.
- **MUST** reuse a single definition for constants (e.g. status colors, leave types) in one place (e.g. `constants.ts` or theme); do not redefine in multiple components.
- **MUST** extract repeated UI patterns (e.g. filter row, detail drawer, approval chain) into shared molecules or feature molecules in the relevant module’s `components/` folder.
- **MUST** avoid duplicated logic or repeated blocks of 10+ lines in more than one file.

### 4. TypeScript — strict, no `any`

- **MUST** use TypeScript with `strict: true` in tsconfig.
- **MUST NOT** use `any`. Use proper types or `unknown` with type guards.
- **MUST** define interfaces or types for all component props (e.g. `StatCardProps`, `LeaveDetailDrawerProps`).
- **MUST** type all event handlers (e.g. `React.ChangeEvent<HTMLInputElement>`, not `e: any`).
- **MUST** type form values (e.g. `ApplyLeaveFormValues`) and API responses; do not use `values: any` or `stats: any`.

### 5. Styling — Tailwind, no inline

- **MUST** use Tailwind CSS classes for layout, spacing, colors, typography. Do not use inline `style={{}}` for these.
- **MUST NOT** use inline styles for structural layout (e.g. `display: 'flex'`, `gap`, `padding`, `width`) — use Tailwind classes (e.g. `flex`, `gap-4`, `p-4`, `w-full`) or Ant Design layout components.
- **MUST NOT** use `!important` in CSS; resolve specificity via Tailwind or Ant Design theme instead.
- **MUST** use Ant Design's **Row**, **Col**, and **Flex** for grids and flex layouts; use responsive breakpoint props (`xs`, `sm`, `md`, `lg`) on `Col` for responsive behavior.
- **MUST** use responsive Tailwind classes (`sm:`, `md:`, `lg:`) where custom responsive behavior is needed beyond Antd grid.

### 6. Performance — memoization & lazy loading

- **MUST** use `React.lazy()` for all page-level components (e.g. EmployeeDashboard, ManagerDashboard, HRDashboard) and wrap with `<Suspense fallback={...}>`.
- **MUST** use `useCallback` for handlers passed to child components or used in dependency arrays but in react 19 it handling automatically so if not required then not use.
- **MUST** use `useMemo` for derived data (e.g. filtered/sorted lists) and for expensive computations but in react 19 it handling automatically so if not required then not use.
- **MUST** use React Query (`useQuery`/`useMutation`) for server state; do not rely only on local useState + useEffect for data fetching.
- **MUST** consider `React.memo` for list items or heavy presentational components that receive stable props.

### 7. Responsiveness — Antd grid & breakpoints

- **MUST** use Ant Design **Row** and **Col** for all grid layouts (stat cards, filter bars, form rows, card grids). Do not replace with raw `div` + inline flex.
- **MUST** set responsive breakpoint props on **Col** (e.g. `xs={24} sm={12} lg={6}`) so layouts adapt to screen size; do not use only fixed `span={12}` for multi-column layouts.
- **MUST** use **Grid.useBreakpoint()** from Ant Design for mobile detection (e.g. sidebar collapse, drawer vs sidebar). Do not use `window.innerWidth` or manual resize listeners.
- **MUST** use consistent gutter on Row (e.g. `gutter={[16, 16]}` or `gutter={[24, 16]}`).
- **MUST** use Ant Design **Flex** when a flex layout is needed without a full grid (e.g. `Flex vertical gap={16}`).
- **MUST** ensure no hardcoded pixel widths break layout on small screens (e.g. avoid fixed `width: 900px` without a max-width or responsive alternative).

### 8. Testing

- **MUST** add unit tests for all services (e.g. leaveService, formatting utils) and for shared molecules and feature molecules (e.g. StatCard, StatusTag).
- **MUST** place tests next to the code (`*.test.ts` / `*.test.tsx`) or in `__tests__/` inside the module.
- **MUST** use Vitest and React Testing Library; mock external APIs (e.g. via MSW or jest.mock).
- MUST have Test coverage over 90%
- MUST Not have error and failing tests
- MUST to Cover all acceptance criteria for the user story

### 9. Other mandatory practices

- **MUST** use i18next `t()` for every user-facing string; no hardcoded English in JSX.
- **MUST** use a single date library (e.g. dayjs); do not mix moment, date-fns, and dayjs in the same module.
- **MUST** use one primary UI system (Ant Design) for layout and forms; avoid mixing MUI and Ant Design in the same feature.
- **MUST** provide loading and error states (e.g. Spin, Alert, ErrorBoundary) for async flows.
- **MUST** keep mock data in `mocks/data/` or `services/mockData.ts` and access it via services only; do not embed large mock arrays inside component files.

### 10. Security guidelines:

- MUST OWASP compliant over 8.5
- Accessibility: MUST accessibility complient, ensuring the web app complies with standards like WCAG (Web Content Accessibility Guidelines) for users with disabilities.

### 11. Performance optimization:

- MUST check the web performance and lighthouse score should be over 80%
- MUST keep the application performance on every page through react profiler or any other tool with web standerds to give the seemless user experience
- MUST page load time less then 3second

---

## Ant Design usage summary

| Use case           | Component                       | Example                                                               |
| ------------------ | ------------------------------- | --------------------------------------------------------------------- |
| Page grid          | Row + Col                       | `<Row gutter={[16,16]}><Col xs={24} sm={12} lg={6}>...</Col></Row>`   |
| Responsive columns | Col with breakpoints            | `<Col xs={24} sm={12} lg={6} xl={4}>`                                 |
| Flex layout        | Flex                            | `<Flex vertical gap={16}>` or `<Flex justify="space-between">`        |
| Mobile detection   | Grid.useBreakpoint()            | `const screens = Grid.useBreakpoint(); const isMobile = !screens.lg;` |
| Forms              | Form, Input, Select, DatePicker | Ant Design form components                                            |
| Tables             | Table                           | With typed columns and dataSource                                     |
| Feedback           | message, Spin, Alert, Modal     | Centralized feedback                                                  |

---

## Suggested tech stack

- **Framework:** React 19 + TypeScript (strict)
- **Build:** Vite
- **UI:** Ant Design v6.3.7(primary) + Tailwind CSS v4.2
- **State:** Redux Toolkit (global) + React Query v5(server)
- **Routing:** React Router v7
- **i18n:** i18next v26.0.8
- **Testing:** Vitest + React Testing Library (+ MSW for dev)
- **Quality:** ESLint, Prettier, 0 lint/type errors, husky for pre-commit (make build before commit on local to check test faliure)

---

## Checklist before finalizing code

- [ ] Folder structure matches the reference (atoms, molecules, modules, pages, layout, routes, shared, styles).
- [ ] No file over 200 lines.
- [ ] No `any`; all props, state, and handlers typed.
- [ ] No inline styles for layout; Tailwind + Antd Row/Col/Flex used.
- [ ] No `!important` in CSS.
- [ ] Row/Col used with breakpoints (xs, sm, md, lg) for responsive layouts.
- [ ] Grid.useBreakpoint() used for mobile behavior; no raw window.innerWidth.
- [ ] React.lazy + Suspense for page components.
- [ ] useCallback/useMemo where appropriate.
- [ ] Shared logic in utils/ or hooks; no duplicated logic across files.
- [ ] All user-facing strings in t().
- [ ] Unit tests for services and shared components.
- [ ] One date library; one primary UI library (Ant Design).
- [ ] Page and component performace over 80 with lighthouse or any other recomended tools
- [ ] Page load time must be <=3 secconds

---

_Use this document as the single source of truth for frontend code. Adapt the structure only where the project explicitly requires it (e.g. extra top-level folders) and ask from user for review._
