# GoMingle: Admin Panel, Partner Portal and API

NUCES MS Practicum: GoMingle social dining and restaurant booking platform (Karachi).

```
GoMingle/
├── Backend/      Backend: Node.js + Express, JWT auth, ~245 REST routes
├── Admin/         Admin Panel: React 19 + TypeScript + Ant Design
├── Partner/       Partner Portal: React 19 + TypeScript + Ant Design
├── Mingler/   Mingler app: Flutter (scaffold, rebranded)
├── run-gomingle.bat   Windows: install and start everything
└── run-gomingle.sh    macOS / Linux: install and start everything
```

## Start the demo

1. Install **Node.js 20 or newer** (LTS from https://nodejs.org).
2. Windows: double-click **`run-gomingle.bat`**. macOS/Linux: run `./run-gomingle.sh`.
3. The first run installs dependencies, which takes a few minutes. Three server windows then open, and the browser opens both portals.

| What | URL | Sign in |
|---|---|---|
| Admin Panel | http://localhost:5173 | admin@gomingle.com / Admin@123 |
| Partner Portal | http://localhost:5174 | partner@gomingle.com / Partner@123 |
| API | http://localhost:4000 | `GET /health` |

Both sign-in screens show the demo account. To stop everything, close the three server windows.

**Demo script (about 5 minutes):**
1. **Partner Portal:** click *Create an account*, enter any e-mail and the 6-digit code from the **GoMingle API** window (`123456` also works), then set a password.
2. Fill in the Overview (name, cuisine, address, owner, phones), upload a cover photo under *Photos & Videos* and a trade licence under *Documents*, then click *Add payout account* and enter a bank and IBAN (for example `PK72 HABB 0012 3456 7890 1234`).
3. Click **Send for Approval**. The profile turns read-only, *Under review*.
4. **Admin Panel → Approval Queue:** the restaurant is listed and the bell shows a new notification. Open it to see the profile and documents.
5. **Decline** with a reason. The partner sees it on their profile, fixes it and resubmits.
6. **Approve** with a category. The restaurant appears under **Restaurants**, and the partner gets the full portal and an "approved" notification.
7. **Escrow (Safepay):** in the Admin Panel open **Finances → Escrow & payouts**. Click *Sandbox booking*, pick the new restaurant and place a card hold. Then **Capture** it into escrow and **Release** it: the restaurant is paid its share minus the 10% GoMingle fee. The partner gets a notification for each step and sees the balance on **Finances**.

Everything is saved in `Backend/data/gomingle-db.json`, so it survives restarts. Delete that file to start the demo fresh.

## Running pieces by hand

```bash
cd Backend && npm install && npm start

cd Admin && npm ci --ignore-scripts
VITE_MSW_ENABLED=false VITE_API_BASE_URL=http://localhost:4000/admin VITE_AUTH_MODE=api npm run dev

cd Partner && npm ci --ignore-scripts
VITE_ENABLE_MOCKS=false VITE_API_BASE_URL=http://localhost:4000/partner VITE_AUTH_MODE=api npm run dev -- --port 5174
```

Running `npm run dev` in a portal with no variables gives a frontend-only demo. Every API call is answered in the browser by Mock Service Worker, with the same demo accounts.

Each portal's `.env.example` documents every variable (backend URL, auth mode, Cognito, mocks).

## Quality checks

```bash
cd Admin   && npm run typecheck && npm run lint && npm run test:run
cd Partner && npm run typecheck && npm run lint && npm run test:run
cd Backend && npm test
```

## Notes

- Backend details, configuration and current limits are in `Backend/README.md`. The main limits: no real e-mail, SMS or payments (codes print in the API window; Safepay runs in simulator mode until you add sandbox keys, see the API README), and booking/finance figures are sample data until the Mingler app is connected.
- Production sign-in is still AWS Cognito. Set `VITE_AUTH_MODE=cognito` and the pool variables.
- The mobile app's bundle id is now `com.gomingle.customer`. Register that id in Firebase before building release apps.
- The Flutter app still pulls the Ethr UI SDK from its original Bitbucket repository. That URL in `pubspec.yaml` is the only place the old company name remains, because the package can only be fetched from where it is hosted.
