# PROJECT IDENTITY

Name: GoMingle Admin Portal
Folder: Development/Admin
Repo: github.com/Go-Mingle/Go_Mingle (Development/Admin)

## THIS IS THE ADMIN PORTAL ONLY

Never reference, import from, or mix with
gomingle_partner_portal under any circumstance.

## Tech Stack

- React 19 + TypeScript
- Ant Design 6
- Tailwind CSS 4
- Zustand 5
- Redux Toolkit 2
- React Query 5
- React Router 7
- Phosphor Icons ONLY
- i18next for translations
- MSW for mocking
- Sentry for error tracking

## Users

- Super Admins only
- Internal GoMingle team

## Protected Files — NEVER MODIFY

Unless explicitly instructed:

- src/components/Sidebar.tsx
- src/components/Topbar.tsx
- src/App.tsx
- src/index.css (append only)
- Any page marked DONE in design.md

## Code Standards

- TypeScript strict — no any types
- Functional components only
- Phosphor Icons only — no other icon libraries
- Tailwind classes only — no inline styles
- Always handle loading and error states
- Never commit directly to main
- Always create feature branch first

## API Rules

- NEVER update local state only for mutations
- ALL create/edit/delete operations MUST call the API
- ALWAYS verify the API call is made before marking a feature done
- Bearer token MUST be set from authService on every request

## Git Rules

- Branch format: feat/description or fix/description
- Commit format: feat(scope): description
- Always run npm run lint before committing
- Always run npm run type-check before committing
- Show git diff --name-only before committing
- Wait for my approval before committing

## Skills — Load Before Writing Code

Pick only the skills relevant to the work. Do not load all skills on every task.

| Trigger                                | Load these skills                                              |
| -------------------------------------- | -------------------------------------------------------------- |
| Adding a new feature (any module)      | `query-hooks` + `no-inline-styles` + `react-component-quality` |
| Refactoring a component or page        | `no-inline-styles` + `react-component-quality`                 |
| Fixing a bug in a component or page    | `no-inline-styles` (only if touching JSX)                      |
| Adding or editing MSW handlers / mocks | `msw`                                                          |
| Reviewing a PR or doing a code audit   | `react-review` (orchestrates all others)                       |
| Writing or updating tests              | none — follow existing test patterns                           |

Skill locations: `docs/skills/<name>/SKILL.md`

Available skills: `query-hooks` · `no-inline-styles` · `react-component-quality` · `msw` · `react-review` · `code-reviewer`

## Note on partnerShare

The finances module contains a field called partnerShare.
This is a legitimate finance domain field — NOT a reference
to the partner portal product. It is safe and expected.
