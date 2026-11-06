# design.md — GoMingle Admin Panel

## Overview

**GoMingle Admin Panel** is the internal operations platform for managing the GoMingle dining and social discovery ecosystem. It serves two distinct user types — Super Admins who configure and govern the platform, and role-based Admin users who handle day-to-day restaurant onboarding, user management, finance oversight, and loyalty configuration. The design system prioritises clarity, data scannability, and operational efficiency across every touchpoint.

The Admin Panel is a **light-mode-only** platform. It is a focused, professional tool — colours are reserved exclusively for status indicators, key metrics, and brand signals. The goal is a clean, modern, data-first interface that keeps operators oriented and efficient without visual distraction.

The Partner Portal (restaurant-facing) and Mobile App (Mingler-facing) each have their own distinct visual treatment as described in the Platform-Specific Surfaces section below. All three surfaces share the same token names but resolve to different values as documented here.

---

## Brand Foundation

**Tagline:** Elevated dining. Effortless mingling.

**Brand Values:** Elevated · Connected · Effortless · Warm · Modern

**Primary Brand Colours:**

| Role           | Hex       | Notes                                               |
| -------------- | --------- | --------------------------------------------------- |
| Teal (Primary) | `#0FA79D` | Main brand colour — CTAs, active states, links      |
| Teal Dark      | `#0C8C84` | Small text on white — achieves WCAG AAA (7.2:1)     |
| Teal Light     | `#E6F7F6` | Tinted backgrounds, active nav, chip fills          |
| Coral (Accent) | `#FF6B5B` | Urgency, social signals — use on dark surfaces only |
| Coral Dark     | `#E5503F` | Destructive actions on white — WCAG AA (4.5:1)      |
| Navy           | `#0D2233` | Primary text, sidebar, app background canvas        |
| Navy Mid       | `#1A3347` | App card surfaces, elevated dark layers             |

---

## Colors

### Admin Panel — Light Mode Only

The Admin Panel uses a single light theme. There is no dark mode for this surface. All CSS variable names follow the shared token convention; values are set once in `:root`.

- **Page Background** (`--color-page`, `#F4F6F8`): Full-page canvas — a cool near-white that distinguishes it from card surfaces
- **Sidebar** (`--color-sidebar`, `#FFFFFF`): Left navigation panel — white with a right border to separate it from page content
- **Topbar** (`--color-topbar`, `#FFFFFF`): Global action bar — white with a bottom border
- **Card / Panel** (`--color-card`, `#FFFFFF`): All surface containers, data panels, and form areas
- **Card Border** (`--color-border`, `rgba(0, 0, 0, 0.08)`): Subtle card outlines — light and non-intrusive
- **Primary Accent** (`--color-accent`, `#0FA79D`): Teal — links, CTAs, active nav indicators, focus rings
- **Primary Text** (`--color-text`, `#0D2233`): Navy — headings, data labels, primary content — 16.1:1 contrast on white
- **Secondary Text** (`--color-text-muted`, `#4A6274`): Descriptions, helper text, table secondary values
- **Subtle Text** (`--color-text-subtle`, `rgba(30, 51, 68, 0.4)`): Timestamps, metadata, placeholder text
- **Input Background** (`--color-input`, `#FFFFFF`): Form field fill
- **Input Border** (`--color-input-border`, `#D1D9E0`): Field outline at rest
- **Hover State** (`--color-hover`, `rgba(15, 167, 157, 0.06)`): Teal-tinted row and button hover surface
- **Divider** (`--color-divider`, `rgba(0, 0, 0, 0.06)`): Table row lines, section separators

### Partner Portal — Light Mode with Brand Presence

The Partner Portal shares the same base light tokens as the Admin Panel but overrides the header, sidebar, and accent treatments to give restaurant owners a stronger sense of GoMingle brand ownership.

- **Header / Topbar** (`--color-topbar`, `#0FA79D`): Full teal header — white text on top
- **Sidebar** (`--color-sidebar`, `#0D2233`): Navy sidebar with teal active state indicator
- **Active Nav Item** (`--color-nav-active`, `rgba(15, 167, 157, 0.15)`): Teal wash behind active nav items — teal right border 3px
- **Card / Panel** (`--color-card`, `#FFFFFF`): White card surfaces on a `#F4F6F8` canvas
- **Primary Accent** (`--color-accent`, `#0FA79D`): Teal — all interactive elements, CTAs, active states
- **Metric Accent A** (`--color-metric-a`, `#0FA79D`): Teal for operational metrics (bookings, covers)
- **Metric Accent B** (`--color-metric-b`, `#FF6B5B`): Coral for social/engagement metrics (ratings, reviews)
- All other tokens (text, border, input, hover, divider) are identical to the Admin Panel values above

### Mobile App — Dark Mode (Minglers)

The Mingler mobile app runs exclusively in dark mode, using the navy canvas to create an immersive, premium dining discovery experience. Both brand colours — Teal and Coral — are fully expressed.

- **Page Background** (`--color-page`, `#0D2233`): Full navy canvas
- **Card / Surface** (`--color-card`, `rgba(255, 255, 255, 0.05)`): Frosted dark card surfaces
- **Elevated Surface** (`--color-card-elevated`, `#1A3347`): Slightly lighter navy for elevated layers
- **Primary Accent** (`--color-accent`, `#0FA79D`): Teal — all primary interactive elements, CTAs, active tab indicators
- **Secondary Accent** (`--color-accent-secondary`, `#FF6B5B`): Coral — urgency badges, social counts, "tonight only" signals
- **Primary Text** (`--color-text`, `#FFFFFF`): White — all primary content
- **Secondary Text** (`--color-text-muted`, `rgba(255, 255, 255, 0.6)`): Descriptions, secondary metadata
- **Subtle Text** (`--color-text-subtle`, `rgba(255, 255, 255, 0.35)`): Timestamps, placeholder text
- **Border** (`--color-border`, `rgba(255, 255, 255, 0.08)`): Dark-appropriate card outlines
- **Divider** (`--color-divider`, `rgba(255, 255, 255, 0.06)`): List separators

### Brand Constants (Theme-Invariant)

These values are identical across all surfaces and themes.

- **Brand Gradient**: `linear-gradient(135deg, #0FA79D, #0C8C84)` — used for hero strips and primary CTAs. Exposed as `.bg-brand-gradient`
- **Primary Accent**: `#0FA79D` — primary interactive colour across all platforms
- **Success**: `#1A8A5A` — confirmed bookings, active restaurants, positive actions
- **Warning**: `#B06000` — pending review, caution state, payout issues
- **Error / Destructive**: `#C0392B` — critical failure, destructive actions, flagged accounts
- **Info**: `#1565C0` — informational callouts, Mingle Friendly badges, new feature notices

### Semantic Colours (Theme-Invariant)

Used for status badges, system states, and validation feedback across all platforms:

- **Success** (`#1A8A5A` text / `#E6F5EE` background): Active restaurants, confirmed bookings, completed payouts
- **Warning** (`#B06000` text / `#FFF3E0` background): Pending applications, accounts awaiting review, restricted Safepay accounts
- **Error** (`#C0392B` text / `#FDEDEC` background): Flagged reviews, failed verifications, destructive action confirmation
- **Info** (`#1565C0` text / `#E3F0FF` background): Mingle Friendly designation, informational notices

### WCAG 2.1 Contrast Compliance

All primary text and interactive colour pairings meet WCAG 2.1 AA at minimum. The table below documents key pairings:

| Combination                   | Ratio  | Normal Text | Large Text |
| ----------------------------- | ------ | ----------- | ---------- |
| Teal Dark `#0C8C84` on White  | 7.2:1  | AAA         | AAA        |
| Teal `#0FA79D` on White       | 4.6:1  | AA          | AAA        |
| White on Teal `#0FA79D`       | 4.6:1  | AA          | AAA        |
| Navy `#0D2233` on White       | 16.1:1 | AAA         | AAA        |
| White on Navy `#0D2233`       | 16.1:1 | AAA         | AAA        |
| Coral Dark `#E5503F` on White | 4.5:1  | AA          | AAA        |
| Gray `#4A6274` on White       | 5.1:1  | AA          | AAA        |
| Success `#1A8A5A` on White    | 7.1:1  | AAA         | AAA        |
| Warning `#B06000` on White    | 7.0:1  | AAA         | AAA        |
| Error `#C0392B` on White      | 7.3:1  | AAA         | AAA        |

**Critical rule:** Coral `#FF6B5B` achieves only 3.1:1 on white and must never be used as text on light backgrounds. It is permitted for text and badges exclusively on dark navy surfaces (app dark mode), and as a decorative fill with non-text content on all surfaces.

---

## Typography

GoMingle uses a single typeface across all platforms: **Poppins** (Google Fonts). It is geometric, clean, warm, and readable — qualities that match the brand values of elevated, effortless, and modern. No additional typefaces are permitted.

- **Display / Heading Font**: Poppins — used for all page-level headings, hero display values, and prominent metrics
- **UI Font**: Poppins — used for all body text, labels, descriptions, navigation items, and table content
- **Mono Font**: JetBrains Mono — used for version tags, numeric identifiers in data tables, commission values, and Safepay account IDs where digit alignment matters

### Type Scale

| Role        | Font           | Size | Weight | Line Height | Usage                                                            |
| ----------- | -------------- | ---- | ------ | ----------- | ---------------------------------------------------------------- |
| Display     | Poppins        | 40px | 800    | 1.1         | Hero numbers, large display values, splash screen                |
| H1          | Poppins        | 32px | 700    | 1.2         | Page-level headings                                              |
| H2          | Poppins        | 24px | 600    | 1.25        | Section headings, panel titles                                   |
| H3          | Poppins        | 20px | 600    | 1.3         | Card headings, modal titles                                      |
| H4          | Poppins        | 16px | 500    | 1.35        | Label headings, column headers, sidebar section titles           |
| Body LG     | Poppins        | 16px | 400    | 1.7         | Lead descriptions, onboarding copy                               |
| Body        | Poppins        | 14px | 400    | 1.7         | Standard interface text, table cell content                      |
| Small       | Poppins        | 12px | 400    | 1.6         | Secondary labels, status descriptions                            |
| Caption     | Poppins        | 11px | 500    | 1.4         | Timestamps, metadata, helper text, last-updated notices          |
| Label / Tag | Poppins        | 11px | 600    | —           | Uppercase column headers, chip labels — letter-spacing 0.08em    |
| Code / Mono | JetBrains Mono | 13px | 400    | 1.6         | Commission values, Safepay IDs, version tags, numeric identifiers |

### Tailwind Font Utilities

Define these in `src/index.css` under `@theme`:

```css
font-ui:      /* Poppins — all standard UI text */
font-display: /* Poppins — large display values and prominent headings */
font-mono:    /* JetBrains Mono — commission values, IDs, numeric data */
```

---

## Icons

**Icon library: Phosphor Icons — the only permitted icon library for this project.**

Phosphor Icons is the single icon system used across the entire GoMingle Admin Portal. No other icon library is permitted. lucide-react, react-icons, heroicons, Material Icons, Font Awesome, and any other icon package must not be used. If an icon from another library exists in the codebase it must be replaced with the Phosphor equivalent.

### Installation

```bash
npm install @phosphor-icons/react
```

### Import pattern

Always import individual icons by name from @phosphor-icons/react. Never import the entire library.

```tsx
import { House, UserCircle, ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react'
```

### Weight system

Phosphor icons have six weights: Thin, Light, Regular, Bold, Fill, Duotone. The weight to use depends on the context:

| Weight  | Use case                                                                   |
| ------- | -------------------------------------------------------------------------- |
| Regular | Default for all UI icons — navigation, table actions, form field prefixes  |
| Bold    | Emphasis contexts — empty state icons, feature highlight icons             |
| Fill    | Active/selected states — active nav item icon, selected toggle, status dot |
| Light   | Decorative backgrounds, large illustrative icons in empty states           |
| Duotone | Not used in the Admin Portal                                               |
| Thin    | Not used in the Admin Portal                                               |

### Size scale

All icon sizes must be one of these values. Never use an arbitrary pixel size outside this scale.

| Token    | Size | Use case                                                           |
| -------- | ---- | ------------------------------------------------------------------ |
| icon-xs  | 12px | Inline text icons, badge indicators                                |
| icon-sm  | 16px | Table action buttons, form field prefix icons, breadcrumb icons    |
| icon-md  | 18px | Sidebar navigation icons, button icons, tab icons                  |
| icon-lg  | 24px | Page header icons, card header icons, empty state supporting icons |
| icon-xl  | 32px | Empty state primary icons, feature illustration icons              |
| icon-2xl | 48px | Full-page empty state icons, onboarding illustration icons         |

### Colour rules

- Navigation icons (inactive): `var(--color-text-muted)`
- Navigation icons (active): `var(--color-accent)`
- Button icons: inherit the button's text colour — do not override separately
- Table action icons (default): `var(--color-text-muted)`
- Table action icons (destructive): `var(--color-error)`
- Form field prefix icons: `var(--color-text-subtle)`
- Empty state icons: `var(--color-text-subtle)`
- Status/semantic icons: match the semantic colour of the context (success, warning, error, info)
- Never hardcode a hex colour on an icon — always use a CSS variable

### Common icon mappings for this project

| Purpose                 | Phosphor Icon name   | Weight  |
| ----------------------- | -------------------- | ------- |
| Back navigation         | ArrowLeft            | Regular |
| Forward / proceed       | ArrowRight           | Regular |
| Close / dismiss         | X                    | Regular |
| Search                  | MagnifyingGlass      | Regular |
| Filter                  | Funnel               | Regular |
| Edit / pencil           | PencilSimple         | Regular |
| Delete / trash          | Trash                | Regular |
| View / eye              | Eye                  | Regular |
| Hide                    | EyeSlash             | Regular |
| Download                | DownloadSimple       | Regular |
| Upload                  | UploadSimple         | Regular |
| Add / plus              | Plus                 | Regular |
| Settings / cog          | GearSix              | Regular |
| User                    | User                 | Regular |
| Users                   | Users                | Regular |
| User edit               | UserGear             | Regular |
| User check              | UserCheck            | Regular |
| Restaurant / fork-knife | ForkKnife            | Regular |
| Approval / clipboard    | ClipboardText        | Regular |
| Finance / wallet        | Wallet               | Regular |
| Categories / tag        | Tag                  | Regular |
| Loyalty / star          | Star                 | Regular |
| Change log / scroll     | Scroll               | Regular |
| Roles / shield          | ShieldCheck          | Regular |
| Notifications / bell    | Bell                 | Regular |
| Bell off                | BellSlash            | Regular |
| Check / confirm         | Check                | Regular |
| Check circle            | CheckCircle          | Regular |
| Warning triangle        | Warning              | Regular |
| Info circle             | Info                 | Regular |
| Error circle            | XCircle              | Regular |
| Pause / suspend         | PauseCircle          | Regular |
| Play / video            | Play                 | Regular |
| Expand / fullscreen     | ArrowsOut            | Regular |
| Map pin / location      | MapPin               | Regular |
| Navigation / directions | NavigationArrow      | Regular |
| Phone                   | Phone                | Regular |
| Mail / email            | Envelope             | Regular |
| Globe / website         | Globe                | Regular |
| File / document         | File                 | Regular |
| File text / PDF         | FileText             | Regular |
| Image file              | Image                | Regular |
| Folder                  | Folder               | Regular |
| Folder open             | FolderOpen           | Regular |
| Calendar                | Calendar             | Regular |
| Clock / time            | Clock                | Regular |
| Chart bar               | ChartBar             | Regular |
| Chart donut             | ChartDonut           | Regular |
| Lock                    | Lock                 | Regular |
| Key / password          | Key                  | Regular |
| Sign out / logout       | SignOut              | Regular |
| Chevron down            | CaretDown            | Regular |
| Chevron right           | CaretRight           | Regular |
| Chevron left            | CaretLeft            | Regular |
| Chevron up              | CaretUp              | Regular |
| External link           | ArrowSquareOut       | Regular |
| Drag handle             | DotsSixVertical      | Regular |
| More options            | DotsThree            | Regular |
| Refresh                 | ArrowClockwise       | Regular |
| Copy                    | Copy                 | Regular |
| Image off / no image    | ImageBroken          | Regular |
| Video off / no video    | VideoCameraSlash     | Regular |
| Search no results       | MagnifyingGlassMinus | Regular |
| No notifications        | BellSlash            | Regular |
| Store / shop            | Storefront           | Regular |
| Star filled (ratings)   | Star                 | Fill    |
| Star empty (ratings)    | Star                 | Regular |
| Hamburger / menu        | List                 | Regular |
| Checkmark active nav    | Check                | Fill    |

### Usage in components

```tsx
// Correct — import individually, set size and weight explicitly
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
<ArrowLeft size={16} weight="regular" color="var(--color-accent)" />
<MagnifyingGlass size={16} weight="regular" />

// Correct — size from the scale, colour from CSS variable
<Trash size={16} weight="regular" style={{ color: 'var(--color-error)' }} />

// Incorrect — do not use any other library
import { ArrowLeft } from 'lucide-react'; // BANNED
import { FaArrowLeft } from 'react-icons/fa'; // BANNED

// Incorrect — do not hardcode colours
<ArrowLeft color="#0FA79D" /> // use CSS variable instead
```

## Spacing

**Spacing system: 4-point grid — all spacing values are multiples of 4px.**

Every margin, padding, gap, width, height (where not content-driven), and positional offset in the codebase must be a multiple of 4. Values like 5px, 7px, 10px, 13px, 15px, 18px, 22px are not permitted unless they are a font-size or icon-size value from the defined scales.

### Spacing token scale

| Token    | Value | CSS variable      | Primary use                                                    |
| -------- | ----- | ----------------- | -------------------------------------------------------------- |
| space-0  | 0px   | —                 | Explicit zero reset                                            |
| space-1  | 4px   | `var(--space-1)`  | Icon-to-text gap, badge internal padding                       |
| space-2  | 8px   | `var(--space-2)`  | Tight component padding, chip padding, between inline elements |
| space-3  | 12px  | `var(--space-3)`  | Form item gap (small), list item internal spacing              |
| space-4  | 16px  | `var(--space-4)`  | Default padding, form field padding, nav item padding          |
| space-5  | 20px  | `var(--space-5)`  | Card section gap, between toolbar and table                    |
| space-6  | 24px  | `var(--space-6)`  | Card internal padding, between sibling cards                   |
| space-8  | 32px  | `var(--space-8)`  | Page content outer padding (desktop), section vertical gap     |
| space-10 | 40px  | `var(--space-10)` | Large section separation                                       |
| space-12 | 48px  | `var(--space-12)` | Page-level vertical rhythm                                     |
| space-16 | 64px  | `var(--space-16)` | Hero and splash screen padding                                 |

### Component-level spacing rules

These rules are derived from the 4-point grid and apply without exception:

**Cards:** internal padding 24px all sides (space-6). Gap between sibling cards 20px (space-5). Card header bottom border padding-bottom 16px (space-4), margin-bottom 20px (space-5).

**Tables:** cell padding 12px vertical, 16px horizontal (space-3 space-4). Row height is content-driven — do not set a fixed height. Header cell padding 12px 16px. Gap between toolbar row and table 16px (space-4).

**Sidebar:** nav item height 40px. Nav item padding 0 12px. Gap between nav items 4px (space-1). Section divider margin 8px 12px (space-2 space-3). Logo area height 64px padding 0 20px.

**Topbar:** height 56px. Padding 0 24px. Gap between topbar right-side elements 24px (space-6).

**Modals:** header padding 24px 28px 0 (space-6 space-7 0). Body padding 16px 28px 24px. Footer padding 16px 28px 24px. Gap between footer buttons 8px (space-2).

**Forms:** gap between form items 16px (space-4). Label to input gap 4px (space-1). Input height 40px. Input padding 0 12px (space-3).

**Buttons:** small: padding 6px 12px, height 28px. Default: padding 8px 16px, height 36px. Large: padding 10px 20px, height 44px. Icon gap inside button 6px (space-1 + 2).

**Page header:** page title margin-top 0. Subtitle margin-top 4px (space-1). Gap between page header and first content section 24px (space-6).

**Empty states:** icon to text gap 12px (space-3). Text to action button gap 16px (space-4). Vertical padding 40px (space-10) minimum.

### CSS variable definitions

Add these to :root in src/index.css:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Tailwind usage

In Tailwind v4, spacing utilities map to the 4-point grid. Use only these Tailwind spacing values: p-1 (4px), p-2 (8px), p-3 (12px), p-4 (16px), p-5 (20px), p-6 (24px), p-8 (32px), p-10 (40px), p-12 (48px), p-16 (64px) and their directional equivalents (px-, py-, pt-, pr-, pb-, pl-). Do not use p-1.5, p-2.5, p-3.5 or any half-step values.

## Border Radius

| Token | Value | Component Usage                               |
| ----- | ----- | --------------------------------------------- |
| xs    | 4px   | Status badges, small chips, tags              |
| sm    | 6px   | Buttons, input fields, dropdowns, small cards |
| md    | 10px  | Cards, data panels, search bars               |
| lg    | 16px  | Modals, flyout panels, large containers       |
| xl    | 24px  | Hero sections, feature cards                  |
| pill  | 100px | Avatars, circular indicators, pill badges     |

---

## Elevation

Shadows are intentionally subtle in the Admin Panel — they must never compete with data content. The app dark-mode surfaces use opacity layering rather than shadows for elevation.

| Level   | Value                         | Usage                                           |
| ------- | ----------------------------- | ----------------------------------------------- |
| sm      | `0 1px 3px rgba(0,0,0,0.06)`  | Chips, row hover, inline highlights             |
| DEFAULT | `0 2px 6px rgba(0,0,0,0.08)`  | Cards, dropdowns, default elevated surface      |
| md      | `0 4px 16px rgba(0,0,0,0.10)` | Elevated cards, sticky topbar, focused modals   |
| lg      | `0 8px 32px rgba(0,0,0,0.12)` | Modal overlays, flyout drawers, command palette |

For teal-tinted shadows on primary interactive elements (e.g. active CTA buttons), use: `0 4px 16px rgba(15, 167, 157, 0.25)`.

---

## Theme System

### Implementation Rules

The Admin Panel operates in **light mode only**. There is no theme toggle on the Admin or Partner portals. The mobile app operates in **dark mode only**. Because these surfaces are separate applications, each simply sets its theme on mount without a user-facing toggle.

- Theme is applied as a `data` attribute on `<html>`: `data-theme="light"` (Admin/Partner) or `data-theme="dark"` (Mobile App)
- **ALL** surface-sensitive colours must use CSS variables — never hardcoded Tailwind tokens or hex values
- On app mount, `App.tsx` sets `document.documentElement.dataset.theme` synchronously to prevent flash

### CSS Variable Usage in Components

**Correct — always use CSS variables for surface-sensitive colours:**

```tsx
className = 'bg-[var(--color-card)]'
className = 'text-[var(--color-text)]'
className = 'border-[var(--color-border)]'
className = 'hover:bg-[var(--color-hover)]'
```

**Incorrect — breaks cross-surface consistency:**

```tsx
className = 'bg-white' /* hardcoded, won't work on dark app surface */
className = 'text-gray-900' /* bypasses the token system */
className = 'bg-[#0D2233]' /* hardcoded navy, no token reference */
```

**Exceptions — brand constants are surface-invariant and may be used directly:**

- Brand gradient: `.bg-brand-gradient`
- Semantic colours (success, warning, error, info)
- Teal and Coral accent values when used in explicitly brand-constant contexts (e.g. logo rendering)

---

## Platform-Specific Surfaces

### Super Admin Portal — Light, Data-First, Minimal Colour

Purpose: Platform governance. Colour used only for status indicators and one or two key metric accents. Everything else is navy text on white or light-gray surfaces. Admins must scan and act fast — visual noise is a direct cost to operational efficiency.

Colour restraint rules for this surface: the primary accent (Teal) appears only on active nav states, primary CTAs, and focus rings. Coral does not appear as a foreground colour on this surface. Semantic colours (success/warning/error/info) are used exclusively for status badges and system alerts.

### Partner Portal — Branded, Operator-Focused

Purpose: Restaurant management. Teal is the dominant brand signal — it appears in the header, active sidebar states, and primary CTAs. The navy sidebar creates clear structural hierarchy. Partners should feel they are operating within the GoMingle brand without being distracted from their operational tasks. Coral appears only as an accent for social or engagement-oriented metrics (ratings, review counts).

### Mobile App — Full Brand, Immersive Dark Mode

Purpose: Dining discovery and social mingling for end users. Both brand colours are fully expressed. Teal is the primary interactive colour across all tap targets, CTAs, and navigation. Coral communicates urgency, social proof, and limited availability ("2 spots left", "Tonight only"). The navy canvas creates a premium, exclusive atmosphere appropriate for elevated dining experiences.

---

## Components

### Buttons

#### Variants

- **Primary**: `#0FA79D` Teal fill, white text. Used for all primary CTAs — Approve, Save, Submit, Reserve. Teal Dark on hover.
- **Secondary**: transparent fill, `var(--color-text)` text, `1.5px var(--color-accent)` border. Secondary actions — View Details, Edit Profile.
- **Ghost**: transparent fill, `var(--color-text-muted)` text, no border. Tertiary non-critical actions — Cancel, Back.
- **Destructive**: `#C0392B` Error fill, white text. Destructive actions — Suspend Account, Permanently Deactivate, Delete Category.
- **Dark** (Admin Panel specific): `#0D2233` Navy fill, white text. High-emphasis non-CTA actions — Export, Change Log.

#### Sizes

| Size | Padding   | Font Size | Height |
| ---- | --------- | --------- | ------ |
| sm   | 6px 14px  | 12px      | 30px   |
| md   | 8px 20px  | 13px      | 38px   |
| lg   | 10px 24px | 14px      | 44px   |

#### Disabled State

- 0.4 opacity applied to all variants
- `cursor-not-allowed`
- All hover and focus states suppressed

---

### Status Badges

GoMingle uses status badges extensively across restaurant accounts, user accounts, booking records, and payout entries. All badges use the semantic colour system.

| Badge           | Text Colour | Background | Use Case                                         |
| --------------- | ----------- | ---------- | ------------------------------------------------ |
| Active          | `#1A8A5A`   | `#E6F5EE`  | Active restaurants, active user accounts         |
| Pending         | `#B06000`   | `#FFF3E0`  | Pending onboarding applications, awaiting review |
| Inactive        | `#4A6274`   | `#F4F6F8`  | Deactivated accounts, disabled states            |
| Suspended       | `#C0392B`   | `#FDEDEC`  | Suspended restaurant or user accounts            |
| Flagged         | `#C0392B`   | `#FDEDEC`  | Flagged reviews, restricted Safepay accounts      |
| Verified        | `#0C8C84`   | `#E6F7F6`  | Verified restaurant credentials                  |
| Mingle Friendly | `#1565C0`   | `#E3F0FF`  | Restaurant designated as social-dining enabled   |

---

### Cards

- **Default**: `var(--color-card)` fill, `1px var(--color-border)` border, 10px radius
- **Elevated**: `var(--color-card)` fill, no border, `DEFAULT` shadow, 10px radius
- **Metric Card**: `var(--color-card)` fill, no border, `sm` shadow, 10px radius — used for dashboard KPI tiles
- **Internal padding**: 24px on all sides

---

### Inputs

| State    | Border                       | Fill                 | Shadow                            |
| -------- | ---------------------------- | -------------------- | --------------------------------- |
| Default  | `1.5px #D1D9E0`              | `var(--color-input)` | none                              |
| Hover    | `1.5px rgba(15,167,157,0.4)` | `var(--color-input)` | none                              |
| Focus    | `2px #0FA79D`                | `var(--color-input)` | `0 0 0 3px rgba(15,167,157,0.12)` |
| Error    | `2px #C0392B`                | `var(--color-input)` | `0 0 0 3px rgba(192,57,43,0.12)`  |
| Disabled | `1px var(--color-border)`    | `var(--color-hover)` | none                              |

- **Height**: 42px — **Padding**: 10px 14px — **Radius**: 6px

---

### Data Tables

Data tables are the primary interface component across Restaurant Management, User Management, Finance, and Change Log modules.

- **Row height**: 48px — **Cell padding**: 8px 16px
- **Divider**: `1px solid var(--color-divider)` between rows
- **Row hover**: `var(--color-hover)` teal-tinted background
- **Header**: `var(--color-text-muted)` text, 11px / 600 uppercase, letter-spacing 0.08em
- **Primary cell text**: 14px / 400 `var(--color-text)` for identifiers and names
- **Secondary cell text**: 14px / 400 `var(--color-text-muted)` for metadata and dates
- **Numeric / ID columns**: JetBrains Mono, 13px, for commission values and Safepay IDs
- **Status column**: always contains a badge component — never raw text for status values
- **Actions column**: icon buttons only (18px Phosphor icons) with tooltip on hover — never text links in table rows

---

### Sidebar Navigation

- **Background**: `var(--color-sidebar)`
- **Width**: 240px expanded, 64px icon-only collapsed
- **Nav item height**: 44px — **Padding**: 0 16px
- **Active item**: `var(--color-hover)` teal-tinted background, `3px solid var(--color-accent)` left border
- **Inactive item text**: `var(--color-text-muted)` — 14px / 500
- **Active item text**: `var(--color-accent)` — 14px / 600
- **Icon size**: 18px
- **Collapse toggle**: chevron icon at bottom of sidebar — collapses to icon-only rail at 64px

The Admin Panel sidebar shows only the sub-modules permitted by the logged-in admin's assigned role. Unpermitted modules are not rendered — they are not shown in a disabled state, they are simply absent.

---

## Responsive Guidelines

The GoMingle Admin Portal must be fully responsive across all breakpoints from 320px mobile to 1920px widescreen. Every page, component, and layout must be tested and verified at each breakpoint before a module is considered complete. No horizontal scrolling is permitted at any viewport width.

### Breakpoint definitions

| Name | Min width | Max width | Target device                            |
| ---- | --------- | --------- | ---------------------------------------- |
| xs   | 320px     | 479px     | Small mobile, older phones               |
| sm   | 480px     | 767px     | Standard mobile                          |
| md   | 768px     | 1023px    | Tablet portrait and landscape            |
| lg   | 1024px    | 1279px    | Small laptop, minimum full-feature width |
| xl   | 1280px    | 1439px    | Standard desktop                         |
| 2xl  | 1440px    | 1919px    | Large desktop — primary design target    |
| 3xl  | 1920px    | —         | Widescreen, 4K                           |

### Tailwind breakpoint mapping

```css
/* In src/index.css @theme block */
--breakpoint-sm: 480px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1440px;
--breakpoint-3xl: 1920px;
```

Tailwind prefixes: `sm:` (480px+), `md:` (768px+), `lg:` (1024px+), `xl:` (1280px+), `2xl:` (1440px+). Always write mobile-first — base styles apply to xs/sm, then progressively enhance with breakpoint prefixes.

### Layout shell behaviour by breakpoint

**Sidebar:**

- 2xl and xl (≥1280px): 240px expanded, collapsible to 64px icon-only via toggle button
- lg (1024–1279px): 64px icon-only by default, expandable to 240px via toggle
- md (768–1023px): hidden by default, opens as a 280px overlay drawer on top of content triggered by a hamburger menu icon in the topbar; closes on backdrop click or Escape key
- sm and xs (<768px): hidden by default, opens as a full-width bottom sheet drawer triggered by hamburger icon in the topbar; drawer height 80vh, drag handle at top

**Topbar:**

- All breakpoints: always visible, full width, height 56px, position sticky top 0, z-index 100
- md and below: show a hamburger menu icon (Phosphor List icon, 20px) on the left side of the topbar to trigger the sidebar drawer
- sm and xs: hide the breadcrumb text, keep notification bell and profile cluster

**Content area:**

- 2xl and xl: padding 32px (space-8)
- lg: padding 24px (space-6)
- md: padding 16px (space-4)
- sm and xs: padding 12px (space-3)

**Main layout container:**

- max-width 1680px, centred with margin 0 auto at 3xl viewports so content does not stretch excessively on 4K screens

### Grid system by breakpoint

**4-column metric/KPI card grids (Dashboard, Mingler overview):**

- 2xl and xl: 4 columns
- lg and md: 2 columns
- sm and xs: 1 column

**3-column grids (Finance KPIs):**

- 2xl, xl, lg: 3 columns
- md: 2 columns (wrap the third card to a new row)
- sm and xs: 1 column

**2-column grids (detail page overview cards, loyalty page):**

- 2xl, xl, lg: 2 columns
- md, sm, xs: 1 column

**Side-by-side chart rows (Bookings chart + Revenue by Source):**

- 2xl, xl, lg: 2 columns equal width
- md, sm, xs: 1 column stacked

**Definition list grids inside cards (Snapshot, Contact Person, Application Details):**

- lg and above: 2 columns
- md and below: 1 column

### Table behaviour by breakpoint

Tables must never produce horizontal scroll. Control column visibility using responsive Tailwind classes on each column's render and header cell.

**2xl and xl (≥1280px):** all columns visible.

**lg (1024–1279px):** hide low-priority secondary columns. For each table the hidden columns at this breakpoint are:

- Restaurants table: hide Joined date
- Minglers table: hide Phone
- Users table: hide Last active
- Finances table: hide Loyalty Points Used
- Change Log table: hide Module
- Approval Queue table: hide Phone and Email (keep Restaurant, Owner, City, Submitted, View)

**md (768–1023px):** show only the primary identification column, Status, and Actions. All other columns hidden.

- All tables: show Name/Restaurant/Title, Status badge, Actions column only

**sm and xs (<768px):** switch from a horizontal table to a vertical card list. Each row becomes a stacked card with: background var(--color-card), border 1px var(--color-border), border-radius var(--radius-md), padding 16px, margin-bottom 8px. Inside the card, the primary name/title in 14px 600 on the first line, status badge to its right, key secondary fields in 12px var(--color-text-muted) stacked below, action buttons in a flex row at the bottom of the card.

### Modal behaviour by breakpoint

**lg and above:** centred overlay, max-width 560px, border-radius var(--radius-xl), box-shadow var(--shadow-modal).

**md:** centred overlay, max-width calc(100vw - 48px), same border-radius.

**sm and xs:** full-screen bottom sheet. Position fixed, bottom 0, left 0, right 0, top auto, border-radius 20px 20px 0 0, max-height 90vh, overflow-y auto. A drag handle: 4px × 40px, border-radius 2px, background var(--color-border-strong), centred horizontally, margin 12px auto 0, position relative. The bottom sheet must be dismissable by swiping down or tapping the backdrop.

### Typography scaling

Font sizes do not change between breakpoints — Poppins at the defined scale reads well at all sizes. The one exception is the page title which scales down at small viewports: 26px at lg+, 22px at md, 18px at sm/xs.

### Navigation and interaction rules by breakpoint

**lg and above:** full sidebar navigation always accessible. All interactive modules (modals, filters, forms) fully functional.

**md:** sidebar hidden, accessed via overlay drawer. All data operations remain functional. Complex multi-step forms (role creation, category creation) work normally.

**sm and xs:** hamburger opens full-width bottom sheet navigation. Data tables switch to card list view. Modals become bottom sheets. Filter dropdowns open as bottom sheets rather than inline dropdowns. Date pickers open as bottom sheets. All write operations (create, edit, delete) remain accessible — never hide actions based on viewport.

### Touch target requirements

All interactive elements at md and below must have a minimum touch target of 44px × 44px. This applies to: nav items (already 40px height — increase to 44px at md and below), table row action icon buttons (wrap in a 44px × 44px touch target div at md and below), form checkboxes and radio buttons (minimum 24px visible, 44px touch area), filter trigger icons in table headers (minimum 44px touch area).

### Overflow and scroll rules

**No horizontal scroll permitted at any breakpoint.** If any element causes horizontal overflow, it is a bug and must be fixed.

Allowed scroll patterns:

- Vertical page scroll: always permitted
- Vertical scroll inside a modal or drawer: permitted with a max-height and overflow-y auto
- Horizontal scroll inside a data table: NOT permitted — use responsive column hiding instead
- Horizontal scroll inside a chart: NOT permitted — charts must reflow or simplify at smaller sizes

### Empty states at small viewports

Empty state components must remain legible and accessible at all breakpoints. At sm and xs, reduce the empty state icon from 48px to 32px and adjust text sizes: primary message 14px, secondary message 12px.

### Testing requirements

Before marking any module complete, test and pass all of the following breakpoints in the browser using DevTools device simulation:

1. 1440px — primary design target, full sidebar, all columns
2. 1280px — desktop, verify no overflow
3. 1024px — icon-only sidebar, all features accessible
4. 768px — tablet, overlay drawer sidebar, reduced table columns
5. 480px — mobile, hamburger nav, card list tables
6. 375px — standard iPhone, verify no horizontal scroll, bottom sheet modals
7. 320px — minimum supported width, everything must still be usable

Record failures in the PR description. No module is complete until all 7 breakpoints pass.

## Do's and Don'ts

1. **Do** use CSS variables for all surface-sensitive colours — backgrounds, text, borders. Never hardcode hex or Tailwind tokens for values that differ between the Admin, Partner, and App surfaces.
2. **Do** restrict Teal to interactive elements, active states, and CTAs in the Admin Panel — do not use it as a decorative fill or background.
3. **Do** restrict Coral to social/engagement metrics in the Partner Portal and urgency signals in the mobile app — never use Coral as body text on light backgrounds (contrast failure).
4. **Do** use the mono font (JetBrains Mono) for all commission values, Safepay IDs, numeric identifiers, and any tabular data where digit alignment matters.
5. **Do** use uppercase labels with letter-spacing 0.08em on status chips and table column headers — it creates a polished, data-table feel consistent with the GoMingle Admin brand.
6. **Do** use semantic colour tokens (success, warning, error, info) exclusively for status badges — never use teal or coral for status states.
7. **Do** use generous whitespace — 24px minimum internal padding on all cards. Data-dense interfaces must still breathe.
8. **Do** render only permitted sub-modules for each admin role — never show a disabled or locked navigation item for an unpermitted module.
9. **Don't** use hardcoded colour classes like `text-white`, `bg-gray-50`, or `text-teal-500` outside the CSS variable system.
10. **Don't** use the brand gradient as a general-purpose background — it is reserved for hero strips, primary CTAs, and brand-forward splash contexts.
11. **Don't** implement overlay or modal logic inline in module components — always use the shared `Modal` primitive.
12. **Don't** introduce new fonts — Poppins and JetBrains Mono are the complete type system. No additional typefaces are permitted.
13. **Don't** place complex authoring interactions on tablet or mobile viewports — use the shared `<ScreenSizePrompt />` component instead.
14. **Don't** build status badges, chips, or indicators with custom one-off styling — always use the shared badge primitives with the semantic colour tokens defined above.
15. **Don't** add heavy drop shadows to data table rows — the elevation system is intentionally subtle and must not compete with content.
