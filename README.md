# GoMingle

**Social Dining & Restaurant Booking Platform**
*Discover restaurants. Secure tables. Create memories.*

![Program](https://img.shields.io/badge/Program-NUCES%20MS%20Practicum-1f6feb)
![Phase](https://img.shields.io/badge/Phase-Development-brightgreen)
![Products](https://img.shields.io/badge/Products-3-informational)
![User%20Stories](https://img.shields.io/badge/User%20Stories-51-success)

---

## Table of Contents

- [Overview](#overview)
- [Team](#team)
- [Problem Statement](#problem-statement)
- [Core Flow](#core-flow)
- [Products](#products)
- [Technology Stack](#technology-stack)
- [Delivery Plan](#delivery-plan)
- [Scope Estimate](#scope-estimate)
- [Live Environment](#live-environment)
- [Repository Structure](#repository-structure)
- [Documentation Index](#documentation-index)
- [Key Assumptions and Dependencies](#key-assumptions-and-dependencies)
- [Contributing](#contributing)

---

## Overview

GoMingle is a social dining and restaurant booking platform for the Karachi food and beverage market. It combines curated restaurant discovery, group coordination and verified post-dining reviews, and it gives restaurants a way to enforce booking commitments.

This repository is the single source of truth for the project: requirement analysis, formal documentation, design assets and source code. It was prepared by **Team GoMingle** as part of the **NUCES MS Practicum**.

## Team

**Team GoMingle**, NUCES MS Practicum

| Name | Roll No. |
|---|---|
| Syed Rameez Ali | 25K-8302 |
| Rahim Ahmed Khan | 25K-8303 |
| Sheikh Raees Raza | 25K-8323 |

**Current phase: Development.** Requirements and specifications are complete; the `Development` folders are where active work now happens.

## Problem Statement

Karachi has over 2,600 licensed restaurants, yet the sector has an unresolved structural gap:

- **Restaurants cannot enforce booking commitments.** Industry estimates put the no-show rate at 5-20% of reservations. With an average cover of PKR 2,500-4,000, the annual cost runs into hundreds of millions of PKR.
- **Diners lack a trusted, social-first platform.** There is no single place combining curated discovery, group coordination and reviews that cannot be faked.

## Core Flow

The MVP is deliberately focused on one end-to-end journey:

```mermaid
flowchart LR
    A[Discover] --> B[Book]
    B --> C[Secure with card]
    C --> D[Dine]
    D --> E[Pay in app]
    E --> F[Verified review]
```

| Capability | How it works |
|---|---|
| **Booking commitment** | A card pre-authorisation hold is placed at booking and captured at the 24-hour confirmation trigger. No-show penalties follow in Phase 2. |
| **Platform fee** | Post-dining in-app payment is split to the restaurant after an admin-configured platform commission on every confirmed booking. |
| **Verified reviews** | Reviews unlock only after a booking reaches *Completed* status, so the review corpus cannot be faked. |
| **Phase 2 data foundation** | Every booking, arrival and review builds the dataset needed for AI analytics and dynamic pricing. |

## Products

GoMingle is delivered as three products that share one backend:

| Product | Audience | Platform |
|---|---|---|
| **Mingler App** | Diners | Flutter, iOS and Android |
| **Partner Portal** | Restaurant partners | Web (React.js) |
| **Admin Panel** | GoMingle operations team | Web (React.js) |

## Technology Stack

| Layer | Technology |
|---|---|
| Mobile app | Flutter (single codebase for iOS and Android) |
| Web (Partner Portal, Admin Panel) | React.js |
| Backend | NestJS modular monolith (today on Vercel, planned AWS ECS Fargate) |
| Data | PostgreSQL (today Neon via Vercel; planned Amazon RDS), Redis (locking and queues), Elasticsearch / OpenSearch (discovery) |
| Auth | Amazon Cognito behind an Application Load Balancer |
| Infrastructure | AWS CDK, hosted in AWS `me-central-1` (UAE) |
| Notifications | Firebase FCM, email and SMS gateways |
| Security | OWASP Top 10 scanning via Snyk in CI/CD, AES-256 at rest, TLS 1.3 in transit. No card data is stored on GoMingle infrastructure. |

## Delivery Plan

A 42-week, phase-gated plan following a hybrid Agile approach with five formal milestone gates and a specs-first build process.

| Phase | Weeks | Focus |
|---|---|---|
| **1. Requirements & Specs** (complete) | W1-W11 | Requirements, feature specs and sign-off, UI/UX design in Figma, system and API architecture, AWS CDK stacks, CI/CD setup |
| **2. Development** (current) | W12-W32 | Infrastructure, NestJS backend (6 modules), payment pre-auth lifecycle, Flutter Mingler App, Partner Portal and Admin Panel. Staging checkpoint at W20 |
| **3. Regression & UAT Deployment** | W33-W42 | Full regression, security scan, client UAT (W36-W38), production deployment, hypercare and 30-day post-deployment checks |

The specification phase locks **3 products, 16 features and 50 sub-features** before production code begins.

## Scope Estimate

User stories were sized using T-shirt estimates (relative complexity, not hours).

| Product | XS | S | M | L | XL | XXL | Stories |
|---|---:|---:|---:|---:|---:|---:|---:|
| Partner Portal | 1 | 3 | 4 | 4 | 1 | 0 | 13 |
| Admin Panel | 1 | 5 | 4 | 5 | 0 | 1 | 16 |
| Mingler App | 2 | 5 | 7 | 5 | 2 | 1 | 22 |
| **Total** | **4** | **13** | **15** | **14** | **3** | **2** | **51** |

## Live Environment

The Admin Panel, Partner Portal and API run on **Vercel** (team `go-mingle`), deployed from this repository:

| Product | Address | Vercel project | Source folder |
|---|---|---|---|
| Admin Panel | https://gomingle-admin.vercel.app | `gomingle-admin` | `Development/Admin` |
| Partner Portal | https://gomingle-partner.vercel.app | `gomingle-partner` | `Development/Partner` |
| API | https://gomingle-api.vercel.app (`/health`) | `gomingle-api` | `Development/Backend` |

- **Flow:** work happens on a `release/vX.Y.Z` or `fix/...` branch, which gets a Vercel preview; merging the pull request into `main` deploys to production.
- **Database:** Neon PostgreSQL (free tier, Washington D.C. `iad1`) from the Vercel marketplace, connected to `gomingle-api` with the prefix `DATABASE` (`DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` direct). Migrations run by themselves when the API starts.
- **Payments:** Safepay **sandbox**. The keys live only in the `gomingle-api` project's environment variables on Vercel (and in a local `.env`), never in git.
- **Email:** sent through **Mailtrap**. For now emails land in the team's Mailtrap test inbox (Mailtrap → Sandboxes → My Inbox), not in real inboxes; switching to real delivery is a settings change (see `Development/Backend/README.md`). Admins edit the wording under **Configure → Email Templates**.
- **Google sign-in:** the Partner Portal offers *Continue with Google* (Google Cloud OAuth client; authorised origins `https://gomingle-partner.vercel.app` and `http://localhost:5174`).
- **First sign-in passwords** on a fresh database come from `SEED_ADMIN_PASSWORD` and `SEED_PARTNER_PASSWORD` on Vercel; the well-known local passwords do not work online.
- **Tracking:** every change is a Jira issue in project **GM** (Jira keys appear in commit messages and pull requests) and a row in the release table below.

All times on interest tables are **Pakistan time (PKT, UTC+05:00)**, wherever the person using the portals is.

## Repository Structure

```
Go_Mingle/
├── Requirement Analysis/
│   ├── User Stories/                          Admin, Partner and Mingler user stories + T-shirt sizing
│   └── Practicum QnA/                         Answers to practicum queries
├── Documentation/
│   ├── Project Proposal/                      Project proposal presentation
│   ├── Requirement Specification Document/    Requirement specification + legal feasibility assessment
│   └── Project Plan/                          Project plan spreadsheet
├── Design/
│   ├── Admin/                                 Admin Panel designs
│   ├── Partner/                               Partner Portal designs
│   ├── Mingler/                               Mingler App designs
│   └── Design Document/                       System design diagrams (architecture, ERD, schema, class, use case, DFD, flowcharts)
└── Development/
    ├── Admin/                                 Admin Panel: React 19 + TypeScript + Ant Design
    ├── Partner/                               Partner Portal: React 19 + TypeScript + Ant Design
    ├── Mingler/                               Mingler App: Flutter (scaffold)
    ├── Backend/                               GoMingle API: NestJS + PostgreSQL, shared by both portals
    ├── README.md                              How to run the platform locally
    └── run-gomingle.sh / run-gomingle.bat     Install and start the API and both portals
```

The `Design` folders are scaffolded and filled in as work lands for each product.

## Releases

Releases up to `v0.5` are tags; later ones are `release/vX.Y.Z` branches merged into `main` through pull requests. To run any of them locally, follow [Development/README.md](Development/README.md); `main` is what runs on Vercel.

| Release | Date | Highlights |
|---|---|---|
| `v0.7.3` | 11 Nov 2026 | Interest table times are Pakistan time everywhere; tables take no bookings once started; cancelling a table cancels its bookings and gives the Minglers' money back; admins can edit and delete interest tables; Safepay-only card step when Safepay is connected (GM-258 to GM-262) |
| `v0.8.0` | 12 Nov 2026 | Email for partners and admins: sign-up and password-reset codes, team and admin welcomes, restaurant approved / declined / suspended / reactivated, payout released and new applications, all editable under Configure → Email Templates with preview, test send and a delivery log; *Continue with Google* on the Partner Portal (GM-274 to GM-276) |
| `v0.7.4` | 12 Nov 2026 | Cleaner, more professional portals: no payment-gateway environment labels on the escrow screens, no demo sign-in box on the Partner login, partner interest table header shows topic, date and Pakistan time; UI polish on Finances and Users; Jira reorganised into Admin / Partner / Mingler / UI Enhancements epics (GM-267 to GM-273) |
| Vercel | 11 Nov 2026 | Admin Panel, Partner Portal and API live on Vercel with a Neon database (GM-257) |
| `v0.7.2` | 11 Nov 2026 | Finances on both portals from real bookings; dinner bill at check-in; Safepay checkout for the admin card step (GM-256) |
| `v0.7.1` | 11 Nov 2026 | Admin test-card step (GM-255); payout column and seats-booked fixes |
| `v0.7` | 11 Nov 2026 | One card hold per seat; Failed collections screen (GM-203, GM-254) |
| `v0.6` | 11 Nov 2026 | Backend rebuilt in NestJS + PostgreSQL; Guests Arrived, no-show penalty and policy (GM-38, GM-203, GM-204, GM-243, GM-244) |
| `v0.5` | 9 Nov 2026 | Partner visibility shown correctly in Admin; light/dark mode in both portals; starter amenities, interests, topics and preference questions |
| `v0.4` | 9 Nov 2026 | End-to-end test fixes across both portals; clean install without demo data |
| `v0.3` | 6 Nov 2026 | Restaurant map pin from a Google Maps link |
| `v0.2` | 6 Nov 2026 | Restaurant payout bank account (IBAN) |
| `v0.1` | 6 Nov 2026 | Safepay sandbox configuration |
| `v0` | 6 Nov 2026 | First working build of the Admin Panel, Partner Portal and API |

Secrets are never committed: `Development/Backend/.env` (Safepay keys) is git-ignored. Copy `Development/Backend/.env.example` to `.env` and add your own keys. Online, the same settings are Vercel environment variables.

## Documentation Index

### Requirement Analysis

| Document | Description |
|---|---|
| [Admin Panel User Stories](Requirement%20Analysis/User%20Stories/Admin_Panel_User_Stories.docx) | User stories for the Admin Panel |
| [Partner Portal User Stories](Requirement%20Analysis/User%20Stories/Partner_Portal_User_Stories.docx) | User stories for the Partner Portal |
| [Mingler App User Stories](Requirement%20Analysis/User%20Stories/Mingler_App_User_Stories.docx) | User stories for the Mingler App |
| [User Stories T-Shirt Sizing](Requirement%20Analysis/User%20Stories/User_Stories_T-Shirt_Sizing.xlsx) | Relative complexity estimates for all 51 stories |
| [Practicum Queries Answered](Requirement%20Analysis/Practicum%20QnA/Practicum_Queries_Answered.docx) | Answers to practicum queries |

### Project Documentation

| Document | Description |
|---|---|
| [Project Proposal](Documentation/Project%20Proposal/Project_Proposal.pptx) | Problem, solution, timeline, strategy and assumptions |
| [Requirement Specification Document](Documentation/Requirement%20Specification%20Document/Requirement_Specification_Document.docx) | Business context, solution architecture, traceability matrix, roadmap, cost breakdown and risk management |
| [Legal Feasibility Assessment](Documentation/Requirement%20Specification%20Document/Legal_Feasibility_Assessment.docx) | Legal and compliance review of the booking commitment mechanic |
| [Project Plan](Documentation/Project%20Plan/Project_Plan.xlsx) | Schedule and milestones |

### Design Document

| Document | Description |
|---|---|
| [Design Document](Design/Design%20Document/README.md) | Architecture, ERD, database schema, class diagram, use case diagram, data flow diagrams (level 0 and 1) and flowcharts, each as Mermaid source + SVG + PNG (Jira epic GM-278) |
| Sprint capacity and velocity | On Jira: task GM-277 and every sprint goal. Team of 3 at 2 hours a day; 2-week sprints (Sprint 0–15) aligned to the project plan with the semester break 19 Dec – 24 Jan; velocity 55 points per sprint; all 61 stories estimated (271 points) |

## Key Assumptions and Dependencies

The 42-week timeline depends on the following inputs. Any slippage affects the delivery window.

- Payment gateway sandbox and production accounts
- Specifications frozen by the end of Week 11
- Practicum supervisor reviews and sign-offs within agreed academic timelines
- At least 3-5 sample restaurant profiles (real or simulated) for UAT by Week 32
- Legal compliance of the pre-authorisation penalty mechanic with Pakistan's consumer protection principles and the payment gateway's terms

The full list is in the Project Proposal and the Requirement Specification Document.

## Contributing

1. Keep each artifact in the folder that matches its product (`Admin`, `Partner` or `Mingler`) and phase (`Requirement Analysis`, `Documentation`, `Design` or `Development`).
2. Use descriptive file names with underscores, for example `Project_Plan.xlsx`.
3. Create a branch for each change and open a pull request rather than committing directly to `main` once development begins.
4. Write clear commit messages, for example `docs: update project plan` or `feat(mingler): add booking screen`.

---

<sub>NUCES MS Practicum | Team GoMingle</sub>
