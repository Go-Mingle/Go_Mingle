# MSW v2 Patterns — GoMingle Admin Portal

All MSW patterns for this project in one place. MSW v2 only — `http.*` and `HttpResponse`. Never `rest.*`.

---

## 1. Setup

### Worker asset (Vite / public dir)

```bash
npx msw init public/ --save
```

The `msw.workerDirectory` field in `package.json` is already set to `["public"]`.

### Browser entrypoint (`src/mocks/browser.ts`)

```ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

### Node entrypoint (`src/mocks/server.ts`) — used by Vitest

```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

### Unhandled request policy

```ts
// browser — warn in dev so gaps are visible
worker.start({ onUnhandledRequest: 'warn' })

// node — error so tests fail loudly on missing handlers
server.listen({ onUnhandledRequest: 'error' })
```

---

## 2. Handler patterns

### Basic GET handler

```ts
import { http, HttpResponse } from 'msw'
import type { Restaurant } from '@/types/restaurant'

export const restaurantHandlers = [
  http.get('/api/restaurants', () => {
    return HttpResponse.json<Restaurant[]>(restaurantFixtures)
  }),

  http.get('/api/restaurants/:id', ({ params }) => {
    const found = restaurantFixtures.find((r) => r.id === params.id)
    if (!found) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(found)
  }),
]
```

### POST / PATCH / DELETE

```ts
http.post('/api/restaurants', async ({ request }) => {
  const body = await request.json() as CreateRestaurantDto;
  const created = { id: 'mock-id', ...body };
  return HttpResponse.json(created, { status: 201 });
}),

http.patch('/api/restaurants/:id', async ({ params, request }) => {
  const body = await request.json() as Partial<Restaurant>;
  const updated = { ...restaurantFixtures[0], ...body, id: params.id };
  return HttpResponse.json(updated);
}),

http.delete('/api/restaurants/:id', ({ params }) => {
  return new HttpResponse(null, { status: 204 });
}),
```

### Query param handling

```ts
http.get('/api/restaurants', ({ request }) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const start = (page - 1) * limit;
  return HttpResponse.json({
    data: restaurantFixtures.slice(start, start + limit),
    total: restaurantFixtures.length,
    page,
  });
}),
```

### Error paths — always cover at least one per critical route

```ts
// 401 — use server.use() override in tests that need it
http.get('/api/restaurants', () => {
  return new HttpResponse(null, { status: 401 });
}),

// 500 internal error
http.get('/api/restaurants', () => {
  return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
}),
```

### Per-test override (Vitest)

```ts
server.use(
  http.get('/api/restaurants', () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })),
)
```

---

## 3. Fixtures and factories

All fixture files live in `src/mocks/data/`. One file per domain.

```ts
// src/mocks/data/restaurants.ts
import type { Restaurant } from '@/types/restaurant'

export const restaurantFixtures: Restaurant[] = [
  {
    id: '1',
    name: 'Test Restaurant',
    status: 'active',
    // ... all required fields typed
  },
]
```

### Mock auth token

```ts
// Always obviously fake — never resemble real JWTs
export const MOCK_TOKEN = 'mock-jwt-admin-test'
```

### Handler index

```ts
// src/mocks/handlers/index.ts
import { restaurantHandlers } from './restaurants'
import { userHandlers } from './users'
// ...

export const handlers = [...restaurantHandlers, ...userHandlers]
```

---

## 4. Production bundle gating

MSW must NEVER ship to production. Two layers of protection:

```ts
// src/main.tsx
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'warn' })
  }
  // ... render app
}
```

- `import.meta.env.DEV` is tree-shaken away in `vite build`
- Dynamic `import()` means the MSW bundle is not in the static import graph
- Verify after build: `grep -r 'mockServiceWorker' dist/` should return nothing

---

## 5. Vitest integration

### Global setup (`src/setupTests.ts` / vitest config `setupFiles`)

```ts
import { server } from './mocks/server'
import '@testing-library/jest-dom'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### In a test file

```ts
import { render, screen, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';

it('shows error state on 500', async () => {
  server.use(
    http.get('/api/restaurants', () =>
      HttpResponse.json({ message: 'Server error' }, { status: 500 })
    )
  );

  render(<RestaurantsPage />);
  await waitFor(() => expect(screen.getByText(/error/i)).toBeInTheDocument());
});
```

---

## 6. Current coverage gaps (as of audit)

The following routes have NO handlers yet:

| Method                | Path                          | Missing                             |
| --------------------- | ----------------------------- | ----------------------------------- |
| GET/POST/PATCH/DELETE | `/api/booking-timers/*`       | All                                 |
| GET/POST/PATCH/DELETE | `/api/preference-questions/*` | All                                 |
| GET                   | `/api/notifications`          | All                                 |
| PATCH                 | Any route                     | PATCH method entirely missing       |
| POST                  | `/api/auth/reset-password`    | Password reset flow                 |
| GET                   | Any route                     | Error paths (401, 403, 500)         |
| GET                   | List routes                   | Pagination params (`page`, `limit`) |

These must be added before the MSW contract audit passes.
