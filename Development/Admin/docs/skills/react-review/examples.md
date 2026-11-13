# React Frontend — Code Review Examples

Use these as templates for structured findings. Adapt paths and line numbers to the real diff.

---

## Example 1: `any`, raw `fetch`, and missing i18n

**Input diff** (simplified):

```tsx
// UserCard.tsx
export function UserCard({ user }: { user: any }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(`/api/users/${user.id}`)
      .then((r) => r.json())
      .then(setData)
  }, [user.id])
  return <div style={{ padding: 16 }}>Welcome {user.name}</div>
}
```

**Review output:**

```
## Code Review Summary (Frontend)

**Tests**: Not run
**Lint**: Likely issues (`any`, inline style)

### Blocking
- [ ] `UserCard.tsx:2` — [TypeScript] Props use `any`. Replace with a typed `User` interface or shared type from the API layer.
- [ ] `UserCard.tsx:5-7` — [API client] Uses raw `fetch` instead of the centralized API util. Route all calls through the shared client for headers, errors, and auth.
- [ ] `UserCard.tsx:10` — [Styling] Inline `style` object. Use Tailwind classes (e.g. `p-4`) per team standards.

### Warnings
- [ ] `UserCard.tsx:10` — [i18n] Visible string "Welcome" is not wrapped in `t()`.

### Suggestions
- [ ] `UserCard.tsx` — [Testing] Add a unit test for loading/success/error states when wiring the shared client.

### What looks good
- `useEffect` dependency includes `user.id`.
```

---

## Example 2: MSW and server-side table params

**Input diff** (simplified):

```tsx
// useOrders.ts — new hook, no MSW update
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => apiClient.get('/orders'),
  })
}

// OrdersPage.tsx — sorts full list in memory
const sorted = useMemo(() => [...orders].sort((a, b) => a.date.localeCompare(b.date)), [orders])
```

**Review output:**

```
## Code Review Summary (Frontend)

### Blocking
- [ ] `handlers/` or `mocks/` — [MSW] New `/orders` usage requires a matching MSW handler so tests and local dev stay unblocked.

### Warnings
- [ ] `OrdersPage.tsx` — [Architecture] Client-side sort of full `orders` list conflicts with server-side pagination/sorting/filtering rule. Prefer query params and API-supported sort for large lists.

### Suggestions
- [ ] `useOrders.ts` — [API client] Consider query key including filter/sort params when server-driven lists are added.

### What looks good
- Uses shared `apiClient` for the request.
```

---

## Example 3: Clean pattern — positive review

**Input diff** (simplified):

```tsx
// useProfile.ts
export function useProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => apiClient.get<ProfileResponse>(`/users/${userId}`),
    enabled: Boolean(userId),
  })
}

// ProfileHeader.tsx
export function ProfileHeader({ userId }: { userId: string }) {
  const { data, isPending, isError } = useProfile(userId)
  if (isPending) return <AppLoader />
  if (isError) return <AppNotice type="error" message={t('profile.loadError')} />
  if (!data) return <AppNotice type="info" message={t('profile.empty')} />
  return <h1 className="text-xl font-semibold">{t('profile.welcome', { name: data.name })}</h1>
}
```

**Review output:**

```
## Code Review Summary (Frontend)

**Tests**: PASS (assumed)
**Lint**: Clean

### Blocking
(none)

### Warnings
(none)

### Suggestions
(none)

### What looks good
- Typed API response; `apiClient` used consistently.
- `enabled` guards the query when `userId` is missing.
- Loading, error, and empty states handled; centralized loader/notice components.
- Copy uses `t()` with interpolation.
- Tailwind used instead of inline styles.
- Hook lives in dedicated `hooks/` file — not inline in page.
```

---

## Example 4: Secrets and storage

**Input diff** (simplified):

```tsx
const API_KEY = 'sk-live-xxxxx'
localStorage.setItem('token', accessToken)
```

**Review output:**

```
## Code Review Summary (Frontend)

### Blocking
- [ ] `…` — [Security] API key hardcoded. Move to env (e.g. `import.meta.env.VITE_API_KEY`) and never commit secrets.
- [ ] `…` — [Security] Token in plain `localStorage`. Must follow project encryption rules for non-dev environments; use the team's secure storage helper.

### Warnings
(none)

### Suggestions
(none)
```

---

## Example 5: RTK initialState with mock data

**Input diff** (simplified):

```ts
// notificationSlice.ts
const initialState: NotificationState = {
  notifications: [
    { id: '1', title: 'Test notification', read: false },
    { id: '2', title: 'Another test', read: true },
  ],
}
```

**Review output:**

```
## Code Review Summary (Frontend)

### Blocking
- [ ] `notificationSlice.ts` — [RTK] Hardcoded mock objects in production `initialState`. Initial state must be empty (`notifications: []`). Mock data belongs in `src/mocks/data/` for tests only.

### Warnings
(none)

### Suggestions
(none)
```
