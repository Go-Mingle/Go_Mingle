# Partner Portal J1 — Signup (frontend)

**Spec:** `J1-Signup-v1.0` as revised by **CR-51** · **Builds on:** F1 session integration

> **Revision note (MET-1279).** This document previously described the pre-CR-51 flow: a
> client-side Cognito `SignUp`, a `confirmationProof` artifact returned by `verify`, and a
> `signup/complete` that ran outside the session policy. None of that is how the portal works.
> Signup is fully backend-orchestrated, `verify` issues the session, and `complete` is an
> ordinary Bearer-authenticated call. The old wording is what produced test cases expecting a
> _"verification-required"_ error on `complete` — a code the API does not define. Section 4.1
> states the real contract for that case.

---

## 1. The flow as built

The client calls **four owned endpoints and makes no Cognito SDK calls during signup**. Every
Cognito operation — `SignUp`, `ConfirmSignUp`, `ResendConfirmationCode`, the password set —
happens server-side, so the pool's app-client id is not needed in the browser for this journey.

| #   | Step             | Call                                                                       |
| --- | ---------------- | -------------------------------------------------------------------------- |
| 1   | Send code        | `POST /api/v1/partner/signup/start` → `{ email }` → `{ codeSent }`         |
| 2   | Resend           | `POST /api/v1/partner/signup/resend` → `{ email }` → `{ codeSent }`        |
| 3   | Verify code      | `POST /api/v1/partner/signup/verify` → `{ email, code }` → account + **session** |
| 4   | Set the password | `POST /api/v1/partner/signup/complete` → `{ password }` → `{ passwordSet }` |
| 5   | Land             | Route on `route` from step 3 — no `/partner/session` round-trip needed     |

**The partner is logged in at step 3, not at step 4.** Possession of the emailed code is the
caller-bound gate, so `verify` provisions the partner user plus an empty `DRAFT` restaurant and
returns real tokens; `complete` is then an authenticated call that only sets the password. That
ordering is what closes the takeover hole — there is no confirmed-but-unclaimed account for
anyone else to finish (CR-51 AC-6).

A consequence worth knowing: **the password screen is a post-login screen.** A partner who
abandons it already has a working account and recovers through Forgot Password.

## 2. Where the code lives

| Concern           | File                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| Endpoints         | `src/app/modules/auth/constants.ts` → `SIGNUP_ENDPOINTS`                 |
| DTOs              | `src/app/modules/auth/types.ts`                                          |
| Service           | `src/app/modules/auth/signupService.ts`                                  |
| Mutation hooks    | `src/app/modules/auth/hooks/useSignUpMutations.ts`                       |
| Flow state machine| `src/app/modules/auth/hooks/useSignUpFlow.ts`                            |
| Session teardown  | `src/app/SessionWatcher.tsx`, `src/shared/api/httpClient.ts`             |
| Password rule     | `src/shared/utils/passwordStrength.ts` → `meetsPasswordPolicy`           |
| Mocks             | `src/mocks/data/partnerSignup.ts`, `src/mocks/handlers/partnerSignup.ts` |

---

## 3. Three things worth knowing

### 3.1 The two clients, and why `complete` uses the ordinary one

`src/shared/api/httpClient.ts` exports **`publicHttpClient`** alongside `httpClient`. Same
envelope unwrapping, error parsing and Sentry reporting — but no session policy.

- `start`, `resend`, `verify` run **before any session exists** → `publicHttpClient`. A 401
  there cannot mean "your session ended": there is nothing to clear and a refresh cannot help,
  so routing it through the policy would show the wrong message and drop the partner somewhere
  useless.
- `complete` runs **after `verify` logged the partner in** → `httpClient`. It needs the Bearer
  token, and a 401 there really does mean the session is bad. See 4.1.

`sessionPolicy.test.ts` pins the `publicHttpClient` half (no refresh, no session event, tokens
untouched); `signupService.test.ts` pins the `complete` half.

### 3.2 The password rule is an OR, and the old gate had a real bug

BR-06 is **≥8 characters plus at least one of** {uppercase, number, symbol}. So `aurelia1`
and `aurelia!` are both valid.

The save button was gated on `getStrength(pw) >= 2`. That score adds a point per satisfied
class, so `Ab1!` scored **3** and enabled the button — despite being 4 characters, which the
backend rejects with 422. The gate now calls `meetsPasswordPolicy()`; the meter stayed
exactly as it was, but it is no longer the accept/reject decision.

### 3.3 There is no client-held proof artifact

Nothing is carried between `verify` and `complete` except the session `verify` issued, which
lives in `tokenStore` like any other session. `adoptSession` returns false when the payload
arrives without usable tokens, and the flow then routes to `/login` — carrying the reason, per
4.2 — rather than sending `Bearer undefined` and drawing a 401 that reads like an expired
session.

The completion payload is exactly `{ password }`. The email comes from the token, and the
backend runs `forbidNonWhitelisted`, so sending `email` or `confirmPassword` is **rejected with
a 422 rather than ignored** — the confirm-password match stays client-side. A test asserts the
outgoing key set.

`complete` is safe to retry: it just re-sets the password, and the session stays valid either
way.

---

## 4. Error handling

Every case is wired. Inline errors appear under the step's input; the cases that end the flow
use toasts.

| Step     | HTTP | Code                       | Behaviour                                                                       |
| -------- | ---- | -------------------------- | ------------------------------------------------------------------------------- |
| start    | 409  | `ERR_ALREADY_REGISTERED`   | Route to `/login` **carrying the backend's sentence**, shown in the login banner — see 4.2 |
| start    | 503  | `ERR_SERVICE_UNAVAILABLE`  | Inline retry copy                                                               |
| resend   | 429  | `ERR_RESET_CODE_COOLDOWN`  | Restart the visible countdown + inline copy                                     |
| verify   | 422  | `ERR_VALIDATION`           | Inline, using the backend's own wording — it distinguishes "incorrect" from "expired" |
| verify   | 422  | `ERR_VALIDATION`           | _"This signup session has expired"_ → restart from email entry (the code was never consumed) |
| verify   | 409  | `ERR_ALREADY_REGISTERED`   | Route to `/login` carrying the backend's sentence — see 4.2                     |
| complete | 401  | `ERR_TOKEN_INVALID` / `ERR_TOKEN_EXPIRED` | **Session policy** — see 4.1                                     |
| complete | 403  | `ERR_ACCOUNT_SUSPENDED`    | Session policy: clear, toast "account suspended", route to `/login`. No refresh, no retry |
| complete | 422  | `ERR_VALIDATION`           | Inline, using the backend's rule text                                           |
| complete | 409  | `ERR_ALREADY_REGISTERED`   | Inline, in place, **no redirect** — the backend's own sentence                   |
| complete | 503  | `ERR_SERVICE_UNAVAILABLE`  | Inline retry copy                                                               |
| complete | 500  | `ERR_INTERNAL`             | Inline; stays on the password step so a retry re-sets the same password         |

`getApiErrorMessage` reads `data.message` as well as `error.message`, since the backend
described the 422 wording as arriving under `data`.

### 4.1 A 401 from `complete` — the real contract (MET-1279)

The API defines **no** `VERIFICATION_REQUIRED` / _"verification-required"_ code, on this
endpoint or anywhere else. `partner-signup.controller.ts` documents `POST /signup/complete` as
Bearer-guarded with exactly:

```
401 — ERR_TOKEN_INVALID / ERR_TOKEN_EXPIRED
      no valid partner token; the caller never completed /signup/verify
403 — ERR_ACCOUNT_SUSPENDED
422 — ERR_VALIDATION (password fails BR-06)
```

So **calling `complete` without having verified is a 401 token error, not a domain error.** The
client routes it through the shared session handler:

`httpClient` sees the 401 → `tokenStore.clear()` → `emitSessionLost('TOKEN_INVALID')` → the
request is **discarded rather than rejected** (F1 BR-07, so the call site raises no second
toast) → `SessionWatcher` shows _"Your session has expired. Please sign in again."_ and
replaces the route with `/login`. No password is set.

That is coherent behaviour, not a swallowed message, and it is deliberate: 401 is the one
status the flow does **not** render in place. The contrast is the 409 row above — the same
endpoint, rendered inline with the backend's own sentence and no redirect. Specific errors are
surfaced; 401 is special because the session, not the input, is what failed.

**Test cases asserting a "verification-required" error on this endpoint are stale** and should
be reworded to the 401 contract above. Same class as BUG-PTR-015 (Category removed from the
profile): the build is right and the case is out of date. A mock that returns an invented
`VERIFICATION_REQUIRED` code makes the redirect look like the client discarding the message —
`src/mocks/data/partnerSignup.ts` deliberately carries only codes the API defines.

Pinned by:

- `signupService.test.ts` — _"is rejected without that token — the takeover path"_ (401
  `ERR_TOKEN_INVALID`) and _"treats a 401 here as a genuine session loss"_ (tokens cleared,
  `TOKEN_INVALID` emitted, request discarded).
- `useSignUpFlow.test.ts` — _"shows a 409 in place without redirecting"_, the counter-evidence
  that specific errors are not swallowed.
- `SessionWatcher.test.tsx` — `TOKEN_INVALID` → that exact sentence, once.

### 4.2 A redirect has to carry its reason (MET-1283)

The two rows that leave the signup screen — 409 on `start` and on `verify`, plus a `verify` that
returns no usable session — used to raise a toast and navigate in the same tick. **Nothing was
ever shown.** `message.useMessage()` renders through a `contextHolder` that lives in
`SignUpPage`'s tree; `navigate('/login', { replace: true })` unmounts that tree, and the notice
dies with it before it paints. Measured after the redirect: `toasts: []`, inline errors `[]`.
The backend's own "This account already exists. Please sign in." reached the client and was
discarded one line later, so a partner who mistyped their existing address was thrown onto a
login screen mid-signup with nothing connecting the two events.

The reason now travels in **router state** (`authRedirectNotice.ts`), which survives the
unmount, and `useLoginForm` seeds it into `loginError` — the banner `LoginStep` already renders
above the form. That puts the explanation on the screen the partner has to act on, and it stays
there instead of expiring in three seconds.

The notice is consumed once: `useLoginForm` clears it from router state on arrival, so a reload
or a later return to `/login` does not replay a stale "This account already exists" at a partner
who is doing nothing of the kind.

Pinned by:

- `useSignUpFlow.test.ts` — the three redirects assert the state they navigate with, including
  that the sentence is the **backend's**, not local copy.
- `useLoginForm.test.ts` — the notice is seeded into `loginError` and cleared from history.
- `LoginForm.test.tsx` — _"renders a redirect notice from the signup flow"_: the banner is in
  the DOM on first paint.

---

## 5. Empty restaurant name — no change needed

After signup the restaurant has `name: ""` (the column is NOT NULL and the backend doesn't own
that table). The portal already handles this correctly: `RestaurantProfileHeader` renders
`name || <Add your restaurant name>`, and the submit-for-approval gate uses
`!String(restaurant[k] ?? '').trim()`, so `""` counts as missing. The codebase uses
truthiness and `trim()` throughout rather than null checks, so empty already reads as unset.
Verified rather than changed.

---

## 6. Environment variables

**No new variables, and signup needs none of them.** With Cognito behind the backend, the
signup journey runs against `/api/v1/partner/signup/*` alone. The F1 pool variables remain for
**sign-in** and silent renewal:

```
VITE_COGNITO_PARTNERS_POOL_ID=      # InitiateAuth (sign-in) and refresh
VITE_COGNITO_PARTNERS_CLIENT_ID=
VITE_COGNITO_REGION=me-central-1
```

Leave both ids blank to run against the mock provider; MSW serves the signup endpoints either
way. The `AdminSetUserPassword` credentials are server-side only (Secrets Manager) and never
reach the frontend.

**DevOps:** the app client must be a **public client with no client secret** —
`amazon-cognito-identity-js` runs in the browser and cannot hold one. Self-registration is now
a backend concern, since the browser no longer calls `SignUp`. (Still outstanding from F1:
`USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` on the app client.)

---

## 7. Testing

Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run test:coverage`.

Covered by `useSignUpFlow.test.ts` (every step and every error branch), `signupService.test.ts`
(all four endpoints, including the takeover path and the 401 session loss),
`sessionPolicy.test.ts` (the `publicHttpClient` bypass), `passwordStrength.test.ts` (including
the short-but-complex regression) and `SessionWatcher.test.tsx` (the session-lost copy).

### Manual

1. `npm run dev` → `/signup`. Enter any email except `partner@gomingle.com`.
2. Enter `123456` (the mock's accepted code). Any other code exercises the 422 path with the
   backend's wording.
3. Try `Ab1!` — the save button stays disabled. Try `aurelia1` — it enables.
4. Save → lands on `/overview` in setup mode with "Add your restaurant name" showing.
5. Enter `partner@gomingle.com` at step 1 to see the already-registered path.
6. For the 4.1 contract: at the password step, clear the stored tokens and save. The mock's
   `complete` handler answers 401 `ERR_TOKEN_INVALID`, and the portal toasts "Your session has
   expired. Please sign in again." and returns to `/login` with no password set.

---

_Company: GoMingle . Portal brand shown to partners: GoMingle._
