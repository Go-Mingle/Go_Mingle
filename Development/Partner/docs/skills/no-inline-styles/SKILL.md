---
name: no-inline-styles
description: Enforces Tailwind-only styling in React components. Detects style={{}}, CSSProperties objects, onMouseEnter/onMouseLeave style mutations, and hardcoded hex/px values. Produces a Blocking list with file/line and a Tailwind replacement for each violation. Activate when reviewing or writing any JSX in this codebase.
---

# No Inline Styles

This project uses **Tailwind CSS 4 exclusively**. All visual styling must be expressed as Tailwind utility classes. Inline styles introduce inconsistency, break the design token system, and cannot be toggled by the theme layer.

## Rule

> **Never** use `style={{}}`, `React.CSSProperties` constant objects, or `onMouseEnter`/`onMouseLeave` style mutations. Use Tailwind classes instead. This is a **AGENTS.md hard rule**.

## When to activate

- Writing any new JSX
- Reviewing a diff that touches `.tsx` or `.jsx` files
- The user asks "is this styled correctly?" or "fix the styles"

## Detection checklist

When reading a file, flag every occurrence of:

| Pattern                                                  | Example (wrong)                                                 | Severity                                    |
| -------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `style={{` on a JSX element                              | `<div style={{ color: 'red' }}>`                                | Blocking                                    |
| `React.CSSProperties` or `: React.CSSProperties`         | `const LABEL_STYLE: React.CSSProperties = { ... }`              | Blocking                                    |
| `e.currentTarget.style.X =`                              | `onMouseEnter={(e) => e.currentTarget.style.background = '...'` | Blocking                                    |
| Hardcoded hex in JSX                                     | `color: '#1A8A5A'`                                              | Blocking                                    |
| `fontFamily: 'Poppins, sans-serif'` repeated per element | repeated inline                                                 | Warning — move to Tailwind `font-[Poppins]` |
| `display: 'flex'` / `alignItems` / `gap` inline          | `style={{ display: 'flex', gap: 12 }}`                          | Blocking                                    |

## Correct replacement patterns

### Layout

```tsx
// Wrong
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

// Correct
<div className="flex items-center gap-3">
```

### Typography

```tsx
// Wrong
<span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>

// Correct
<span className="text-[13px] font-semibold font-[Poppins]">
```

### Colors with design tokens

```tsx
// Wrong
<div style={{ color: 'var(--color-text-muted)', background: 'var(--color-card)' }}>

// Correct — CSS variables map directly to Tailwind arbitrary values
<div className="text-[var(--color-text-muted)] bg-[var(--color-card)]">
```

### Status badges (dynamic color)

```tsx
// Wrong
<span style={{ background: isActive ? '#1A8A5A' : '#C0392B', color: '#fff' }}>

// Correct — use conditional Tailwind classes
<span className={isActive ? 'bg-[#1A8A5A] text-white' : 'bg-[#C0392B] text-white'}>

// Better — use design token variables already defined in index.css
<span className={isActive
  ? 'bg-[var(--color-success)] text-white'
  : 'bg-[var(--color-error)] text-white'
}>
```

### Hover states (replace onMouseEnter/onMouseLeave)

```tsx
// Wrong
<button
  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
  style={{ background: 'var(--color-accent)' }}
>

// Correct
<button className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)]">
```

### Borders and radius

```tsx
// Wrong
<div style={{ borderRadius: 12, border: '1.5px solid var(--color-border)' }}>

// Correct
<div className="rounded-xl border border-[1.5px] border-[var(--color-border)]">
```

### Shared style constant objects

```tsx
// Wrong — CSSProperties constant reused across elements
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--color-card)',
  borderRadius: 12,
  padding: 16,
}

// Correct — extract to a className constant or a shared component
const CARD_CLASS = 'bg-[var(--color-card)] rounded-xl p-4'

// Even better — a <Card> wrapper component
```

## Common pitfalls

- `style={{ marginBottom: 24 }}` → `className="mb-6"`
- `style={{ paddingTop: 8 }}` → `className="pt-2"`
- `style={{ minWidth: 0 }}` → `className="min-w-0"`
- `style={{ flexShrink: 0 }}` → `className="shrink-0"`
- `style={{ whiteSpace: 'nowrap' }}` → `className="whitespace-nowrap"`
- `style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}` → `className="overflow-hidden text-ellipsis"`
- `style={{ width: '100%' }}` → `className="w-full"`

## Tailwind spacing reference (px → Tailwind)

| px  | Tailwind  |
| --- | --------- |
| 2   | `gap-0.5` |
| 4   | `p-1`     |
| 6   | `gap-1.5` |
| 8   | `p-2`     |
| 10  | `p-2.5`   |
| 12  | `p-3`     |
| 16  | `p-4`     |
| 20  | `p-5`     |
| 24  | `p-6`     |

## Report format

```
BLOCKING — Inline styles found
  UsersPage.tsx:78   style={{ background: 'var(--color-card)', borderRadius: 12 }}
                     → className="bg-[var(--color-card)] rounded-xl"
  UsersPage.tsx:107  style={{ flexShrink: 0, background: ... }}
                     → className="shrink-0 bg-[#1A8A5A] text-white"
  UsersPage.tsx:339  onMouseEnter style mutation
                     → use hover:bg-[var(--color-accent-dark)] Tailwind class
```
