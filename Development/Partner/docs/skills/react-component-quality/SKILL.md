---
name: react-component-quality
description: Reviews React component design for size, co-location, memoization, and re-render hygiene. Flags large inline components (>80 lines), missing extractions, unstable references passed as props, and missing React.memo/useCallback/useMemo where warranted. Activate when writing or reviewing component files, or when a user reports sluggish UI or unnecessary re-renders.
---

# React Component Quality

This skill covers component extraction, composition hygiene, and re-render prevention for the GoMingle Admin Portal (React 19, TypeScript strict, Ant Design 6, Tailwind CSS 4).

## Rules (all are Blocking unless noted)

| Rule                                     | Threshold                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component size                           | **≤ 80 lines** per component function body                                                                                                            |
| Inline component definitions             | **Forbidden** — never define a component function inside another component or inside the same file as a page unless it is a trivial (<10 line) helper |
| Prop drilling                            | Max **2 levels** before introducing context or lifting to a shared hook                                                                               |
| Unstable object/array props              | Any `{}` or `[]` literal created inline in JSX is **Blocking** — wrap with `useMemo`                                                                  |
| Inline arrow functions as event handlers | Allowed for simple setters; **Blocking** when the function is non-trivial or passed to a list of children                                             |
| Missing `React.memo`                     | **Warning** on pure display components that receive stable props and are siblings to frequently-updating state                                        |

## When to activate

- User asks to review or write a component
- A page file exceeds ~150 lines
- User reports slow renders or mentions "re-render" / "performance"
- Diff adds a new component function inside an existing page file

## Extraction rule

A component must be extracted to its own file when **any** of the following is true:

1. Its function body exceeds **80 lines**
2. It is used in more than one place
3. It manages its own local state
4. It is a list item renderer (always extract — list parents re-render on data change)

### Extraction target paths

```
src/app/modules/<module>/components/<ComponentName>.tsx
src/shared/components/<ComponentName>.tsx   ← if reused across modules
```

## Re-render hygiene checklist

### Object/array literals as props

```tsx
// Blocking — new object on every render, breaks memo
<Table columns={[{ key: 'name', title: 'Name' }]} />

// Correct — define outside component or memoize
const COLUMNS = [{ key: 'name', title: 'Name' }]
<Table columns={COLUMNS} />

// Or memoize when columns depend on state
const columns = useMemo(() => [...], [dependency])
```

### Inline arrow functions in lists

```tsx
// Warning — new function per item per render
{
  items.map((item) => <Row key={item.id} onClick={() => handleClick(item.id)} />)
}

// Acceptable — React 19 scheduler handles this well for moderate lists
// Blocking only when the list has >50 items or Row is expensive
```

### Event handlers on stable components

```tsx
// Blocking — anonymous function reference changes on every parent render
<ExpensiveTable onSort={() => setSort(prev => !prev)} />

// Correct
const handleSort = useCallback(() => setSort(prev => !prev), [])
<ExpensiveTable onSort={handleSort} />
```

### Avoid re-render from context

```tsx
// Blocking — entire subtree re-renders on any context change
const { user, theme, notifications } = useAppContext()

// Correct — split context or select only what you need
const user = useSelector(selectCurrentUser) // RTK selector
```

## Component size examples

### Too large — extract the card renderer

```tsx
// MinglersPage.tsx — 213 lines — Blocking
function MinglerCardList({ data }) {         // ← extract to components/MinglerCardList.tsx
  return (
    <div>
      {data.map(m => (
        <div key={m.id}>                     // ← extract to components/MinglerCard.tsx
          {/* 50+ lines of inline JSX */}
        </div>
      ))}
    </div>
  )
}

export function MinglersPage() {
  // ...
  return <MinglerCardList ... />             // page stays thin
}
```

### After extraction

```
src/app/modules/minglers/
├── MinglersPage.tsx          (~60 lines — page shell only)
├── components/
│   ├── MinglerCardList.tsx   (~30 lines — maps items → MinglerCard)
│   └── MinglerCard.tsx       (~60 lines — single card layout)
```

## Memoization guide

Use `React.memo` when:

- Component receives stable props (primitives or memoized objects)
- Component is a pure display component (no local state)
- Component appears inside a frequently-updating parent

```tsx
// Correct
export const MinglerCard = React.memo(function MinglerCard({ data, onSuspend }: Props) {
  return <div>...</div>
})
```

Use `useMemo` when:

- Computing a derived value from props/state is expensive (>1ms)
- Passing a derived array/object as a prop to a memoized child

Use `useCallback` when:

- Passing a handler to a `React.memo` child
- The handler is a dependency of another `useCallback` or `useEffect`

**Do NOT memo prematurely** — only add `React.memo` after confirming the re-render is a real problem with React DevTools Profiler.

## Report format

```
BLOCKING — Component too large / not extracted
  MinglersPage.tsx:24   MinglerCardList (213 lines) defined inline in page file
                        → extract to src/app/modules/minglers/components/MinglerCardList.tsx

WARNING — Missing React.memo
  RestaurantCard.tsx:1  Pure display component inside frequently-updating list
                        → wrap with React.memo if profiler confirms unnecessary re-renders

BLOCKING — Unstable prop reference
  FinancesPage.tsx:88   columns={[...]} array literal inline in JSX
                        → const COLUMNS = [...] (define outside component)
```
