# PROJECT IDENTITY

Name: GoMingle Partner Web
Repo: github.com/Go-Mingle/Go_Mingle (Development/Partner)

## THIS IS THE PARTNER WEB APP ONLY

This codebase was bootstrapped from the GoMingle Partner Portal UI (UI-only,
MSW-backed) and will be integrated with real backend APIs over time. Its
engineering standards mirror the GoMingle Admin Portal.

Never reference, import from, or mix with the admin portal
(gomingle-admin-web / gomingle_admin_portal) under any circumstance.

## Tech Stack

- Vite 8 (SPA) + React 19 + TypeScript (strict)
- Ant Design 6
- Tailwind CSS 4 (CSS-first `@theme`; no tailwind.config / no PostCSS)
- Redux Toolkit 2 (global state) + React Query 5 (server state)
- Zustand 5 (available; RTK is the primary store)
- React Router 7
- Phosphor Icons ONLY
- i18next for translations
- MSW for mocking (the app currently runs entirely on mock data)
- Sentry for error tracking
- Vitest 4 + Testing Library + jsdom (test runner)

## Users

- Partner / vendor (restaurant) accounts

## Protected Files — NEVER MODIFY

Unless explicitly instructed:

- src/app/layout/Sidebar.tsx
- src/app/layout/Topbar.tsx
- src/app/App.tsx
- src/styles/index.css (append only)
- Any page marked DONE in design.md

## Code Standards

- TypeScript strict — no any types
- Functional components only
- Phosphor Icons only — no other icon libraries
- Tailwind classes only — no inline styles
- Always handle loading and error states
- Never commit directly to main
- Always create a feature branch first

## API Rules

- NEVER update local state only for mutations
- ALL create/edit/delete operations MUST call the API
- ALWAYS verify the API call is made before marking a feature done
- Bearer token MUST be set from the auth layer on every request
- Data flows through the single shared HTTP client (src/shared/api/httpClient.ts);
  MSW intercepts it today, a real backend replaces MSW later

## Git Rules

- Branch format: feat/description or fix/description
- Commit format: feat(scope): description
- Always run `npm run lint` before committing
- Always run `npm run typecheck` before committing
- Show `git diff --name-only` before committing
- Wait for approval before committing

## Testing & Coverage — Non-negotiable

Every feature or bug fix MUST keep the test suite green and coverage at or above
the enforced thresholds (lines 90, functions 90, statements 90, branches 85), so
the SonarQube quality gate does not fail on merge. See the `testing` skill for the
required workflow — it is mandatory on any code change.

## Skills — Load Before Writing Code

Pick only the skills relevant to the work. Do not load all skills on every task.

| Trigger                                | Load these skills                                                          |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Adding a new feature (any module)      | `query-hooks` + `no-inline-styles` + `react-component-quality` + `testing` |
| Refactoring a component or page        | `no-inline-styles` + `react-component-quality` + `testing`                 |
| Fixing a bug in a component or page    | `no-inline-styles` (if touching JSX) + `testing`                           |
| Adding or editing MSW handlers / mocks | `msw`                                                                      |
| Writing or updating tests              | `testing`                                                                  |
| Reviewing a PR or doing a code audit   | `react-review` (orchestrates all others)                                   |

Skill locations: `docs/skills/<name>/SKILL.md`

Available skills: `query-hooks` · `no-inline-styles` · `react-component-quality` ·
`msw` · `testing` · `react-review` · `code-reviewer` · `audit`

## Note on partnerShare

The finances module contains a field called partnerShare.
This is a legitimate finance domain field — safe and expected.
