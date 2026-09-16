# Maintenance Monitor — Web

Web frontend for **Maintenance Monitor**, a machine-fleet maintenance platform: live machine status board,
maintenance logs, machine history, analytics, technician management and audit trail. It consumes the
Maintenance Monitor API (`../bn`) over REST and Socket.IO.

Built with Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS 4, TanStack Query 5, React Hook Form +
Zod 4, Zustand, Framer Motion, Recharts, Radix UI primitives, Sonner and socket.io-client.

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [API configuration](#api-configuration)
- [Authentication architecture](#authentication-architecture)
- [Roles and permissions](#roles-and-permissions)
- [Real-time architecture](#real-time-architecture)
- [Data, URL state and caching](#data-url-state-and-caching)
- [Project structure](#project-structure)
- [Design system and accessibility](#design-system-and-accessibility)
- [Testing](#testing)
- [Deployment](#deployment)
- [Backend contract notes](#backend-contract-notes)

## Quick start

Prerequisites: Node.js ≥ 20.9 (22 recommended) and a running Maintenance Monitor API.

```bash
npm ci
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL at the API
npm run dev                    # http://localhost:5173
```

The dev server uses port **5173** because the API's defaults (`CORS_ORIGIN`, `PASSWORD_RESET_URL`,
`APP_LOGIN_URL`) point there. Sign in with the administrator created by the API's `npm run seed`.

## Environment variables

| Variable              | Example                        | Purpose                                                        |
| --------------------- | ------------------------------ | -------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api/v1` | REST base URL, including the version prefix                    |
| `NEXT_PUBLIC_WS_URL`  | `http://localhost:3000`        | Origin of the Socket.IO server (the `/status-board` namespace) |

Both are validated at start-up (`src/config/env.ts`); the app refuses to start with a missing or malformed value.
`NEXT_PUBLIC_*` values are compiled into the browser bundle, so they must never contain secrets — the frontend
has none. They are read at **build time**: rebuild after changing them.

## Scripts

| Script                         | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `npm run dev`                  | Development server with Turbopack on port 5173      |
| `npm run build` / `npm start`  | Production build / serve it on port 5173           |
| `npm run typecheck`            | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm run lint`                 | ESLint (Next, type-aware TypeScript, TanStack Query) |
| `npm test`                     | Unit and component tests (Vitest + Testing Library) |
| `npm run test:e2e`             | End-to-end tests (Playwright) — see [Testing](#testing) |
| `npm run check`                | Typecheck, lint and unit tests                      |

## API configuration

The API must allow this app's origin and serve the pages its emails link to:

| API variable         | Value for this app                        |
| -------------------- | ----------------------------------------- |
| `CORS_ORIGIN`        | The app origin, e.g. `https://app.example.com` (never `*` in production) |
| `PASSWORD_RESET_URL` | `https://app.example.com/reset-password`  |
| `APP_LOGIN_URL`      | `https://app.example.com/login`           |
| `COOKIE_SECURE`      | `true` in production (HTTPS)              |

All HTTP calls go through one Axios instance (`src/lib/api/client.ts`) and typed modules per resource
(`auth`, `users`, `machines`, `machine-logs`, `analytics`, `audit`). The client unwraps the API envelope, attaches the
access token and an `X-Request-Id`, drops empty query parameters (the API rejects unknown or empty ones) and turns
every failure — API error, network failure, timeout — into an `ApiError` with `status`, `code`, `details` and
`requestId`. Human-readable messages per error code live in `src/lib/api/error-messages.ts`; error panels show the
request id so users can quote it to support.

## Authentication architecture

| Token         | Where it lives                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Access token  | In memory only (`src/lib/auth/session-store.ts`). Never written to storage or cookies.             |
| Refresh token | The API's `httpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. The client ignores the copy in the response body. |
| Session hint  | `mm_session=1` — a non-sensitive cookie meaning "a session probably exists". No credential.         |

**Flow**

1. **Sign in** — `POST /auth/login` returns the user and an access token; the API sets the refresh cookie.
2. **Page load** — if the session hint exists, the app calls `POST /auth/refresh` (the cookie authenticates it)
   to get a fresh access token and the current user. Without the hint the visitor is treated as signed out, with no
   request.
3. **Requests** — tokens expiring within 60 s are refreshed first. A `401 TOKEN_EXPIRED` triggers one refresh and a
   single retry; other `401`s end the session and send the user to `/login?next=…&reason=expired`.
4. **Refresh safety** — the API rotates refresh tokens and treats a replayed token as theft. Refreshes are therefore
   de-duplicated within a tab and serialised across tabs with the Web Locks API, so two tabs never send the same
   cookie concurrently.
5. **Sign out** — `POST /auth/logout`, then local state, cached server data and the hint are cleared. Other tabs are
   told over `BroadcastChannel` and sign out too.
6. **Forced password change** — when `mustChangePassword` is true (first sign-in with an emailed temporary
   password, or a `403 PASSWORD_CHANGE_REQUIRED` from the API) every protected route redirects to `/change-password`
   until it succeeds. The API returns a new session on success.

**Route protection** — `src/proxy.ts` (Next.js 16's renamed middleware) redirects requests for `/dashboard/*` and
`/change-password` without the hint to `/login` before any JavaScript runs. This is an optimistic check only:
`RequireSession` confirms the session with the API before rendering protected data, and the API authorises every
request. Redirect targets from `?next=` are restricted to same-application paths.

Reset links arrive as `/reset-password?token=…`; the page validates the token's shape, never logs it, and sets
`Referrer-Policy: no-referrer`.

## Roles and permissions

Two roles, `ADMIN` and `TECHNICIAN`, map to permissions in one place (`src/lib/permissions/permissions.ts`), mirroring
the API's authorization matrix:

| Permission                                    | ADMIN | TECHNICIAN |
| --------------------------------------------- | :---: | :--------: |
| View dashboard, machines, logs, analytics     |  ✅   |     ✅     |
| Create and update logs                        |  ✅   |     ✅     |
| Delete logs                                   |  ✅   |     ❌     |
| Create, edit, deactivate and delete machines  |  ✅   |     ❌     |
| View and manage users, reissue credentials    |  ✅   |     ❌     |
| View audit logs                               |  ✅   |     ❌     |
| Manage own profile and password               |  ✅   |     ✅     |

Everything role-related derives from that map:

- **Navigation** — `src/config/navigation.ts` filters items by permission; active items are matched by path segment.
- **Routes** — `src/lib/permissions/route-access.ts` assigns a permission to each route pattern (most specific wins);
  `RouteAccessGuard` renders a 403 state for pages the role can't open.
- **Actions** — components use `usePermissions().can(...)` or `<PermissionGuard>`; no component compares role
  strings.

This is user-experience protection only. **The API is the security boundary** and rejects anything the UI hides.

## Real-time architecture

`RealtimeProvider` opens one Socket.IO connection to `NEXT_PUBLIC_WS_URL/status-board` for the signed-in shell
(`src/lib/realtime/status-board.ts`). The access token is read on every (re)connection.

When `machine.status.updated` arrives, after its payload is validated (`src/lib/realtime/cache-sync.ts`):

1. The machine is patched in the detail cache and in every cached machine list, with no refetch. Lists filtered by
   status are refetched, because the machine may join or leave them.
2. Dashboard fleet counts move one machine between states, unless the cached overview is already newer than the
   event. Events older than cached data are ignored.
3. Log lists, that machine's history and analytics are refetched in one batch shortly afterwards, so a burst of events
   causes one round of requests.
4. The changed row flashes briefly, the status badge cross-fades, and the change is added to the header's
   notification list. The user's own changes are not counted as unread.

On `session.expired` or `connect_error: TOKEN_EXPIRED` the client refreshes the token and reconnects. It stops, with a
"Not live" indicator, when authentication is refused for another reason. After a reconnect, fleet data is refetched
once to cover missed events. The header's live indicator always shows the connection state.

## Data, URL state and caching

- **Server state** lives only in TanStack Query: 30 s default freshness, 60 s for analytics, 30 min for the
  transition policy. 4xx errors are never retried; list pages keep previous data at reduced opacity while the next
  page loads.
- **Client state** in Zustand is limited to the in-memory session, live connection and notifications, and persisted UI
  preferences (sidebar collapsed, table or card view).
- **URL state** — search, filters, sorting and pagination are URL parameters (e.g.
  `/dashboard/machines?status=DOWNTIME&sort=updatedAt:desc&page=2`), parsed defensively so shared or tampered links fall
  back to safe defaults. Search input is debounced.
- **Mutations** update or invalidate exactly the affected queries. A new or edited log also sets the machine's cached
  status from the committed resulting state.

## Project structure

```
src/
  app/                    routes (App Router)
    (auth)/               login, forgot-password, reset-password
    change-password/      forced and voluntary password change
    dashboard/            signed-in shell: dashboard, machines, logs, analytics, technicians, audit-logs, profile
  proxy.ts                optimistic route protection
  components/
    ui/                   design-system primitives (button, input, select, dialog, sheet, table, pagination, …)
    forms/                React Hook Form fields (FormInput, FormSelect, FormTextarea, FormDatePicker, …)
    feedback/             empty, error, forbidden, not-found, offline and loading states
    layout/               app shell, sidebar, header search, notifications, user menu, page header
    status/               machine-state, log-status, transition and user badges; live indicator
    data/                 stat tile, detail list, filter field, refresh button
    auth/                 permission, role and route guards
  features/<domain>/      api (query/mutation hooks), components, lib (pure logic) per domain:
                          auth, dashboard, machines, machine-logs, analytics, technicians, audit, profile
  lib/
    api/                  HTTP client, errors, resource modules
    auth/                 session store, manager, hint cookie, cross-tab channel
    permissions/          permission map, route access, hook
    realtime/             Socket.IO connection and cache synchronisation
    validation/           Zod schemas and request builders
    machine-state/        transition policy helpers
    query/ utils/         query client; dates, numbers, paths, URL parameters
  constants/              routes, query keys, error codes, machine/log/audit presentation, tones, chart colours
  types/                  API entities and enums (Role, MachineState, LogStatus, AuditAction, …)
  providers/ stores/ hooks/ config/
e2e/                      Playwright suites and helpers (including a local SMTP sink)
```

## Design system and accessibility

- **Tokens** are defined once in `src/app/globals.css` (Tailwind `@theme`): an industrial palette of ink, steel and
  amber, hairline borders, square geometry (2–6 px radii) and IBM Plex Sans/Mono. Every text colour meets WCAG AA
  against its background.
- **Status presentation** is centralised. `src/constants/machine-state.ts` gives each state a label, description,
  tone and icon; `src/constants/tones.ts` maps tones to classes. Status is never shown by colour alone.
- **Charts** use colours validated for colour-vision deficiency (`src/constants/chart-colors.ts`). Every chart has a
  table view with every value, and chart code is lazy-loaded.
- **Motion** is short and subtle (page fade, dialog entry/exit, sidebar width, status cross-fade, row flash) and is
  disabled under `prefers-reduced-motion`.
- **Accessibility** — semantic landmarks and a skip link; Radix dialogs and menus with focus management;
  labelled fields with `aria-invalid`/`aria-describedby`; radio-group semantics for toggles; visible focus rings;
  destructive confirmations focus Cancel first.
- **Responsive** — tables become cards below their breakpoint. Only the wide logs table scrolls horizontally, inside
  its own container. The e2e suite asserts no page-level horizontal overflow at 1440, 820 and 412 px wide.

## Testing

### Unit and component tests

```bash
npm test
```

These cover permissions and navigation, route access, the transition policy, all form schemas and request builders,
the HTTP client's refresh/retry and error handling, session restore/sign-in/sign-out, realtime cache updates and the
socket lifecycle, URL/date utilities, analytics timeframes, and components (pagination, badges, guards, confirmation
dialog, login flow, the log form's state-transition UX, chart card, timeframe filter).

### End-to-end tests

These run against a real API with its own database and an SMTP sink that captures onboarding emails, so no real
email is sent and no existing data is touched.

```bash
# 1. API database (once)
createdb maintenance_monitor_e2e
cd ../bn
DATABASE_URL=postgres://…/maintenance_monitor_e2e npm run migration:run
DATABASE_URL=postgres://…/maintenance_monitor_e2e ADMIN_EMAIL=admin@e2e.test ADMIN_PASSWORD=E2eAdminPassw0rd \
  ADMIN_NAME="Amina Uwase" ADMIN_PHONE=0780000001 npm run seed

# 2. SMTP sink (captures temporary passwords)
node e2e/support/smtp-sink.mjs

# 3. API on port 3100 using the sink
DATABASE_URL=postgres://…/maintenance_monitor_e2e PORT=3100 CORS_ORIGIN=http://localhost:5173 \
  MAIL_HOST=127.0.0.1 MAIL_PORT=1025 MAIL_SECURE=false MAIL_USERNAME= MAIL_PASSWORD= \
  AUTH_RATE_LIMIT_MAX=1000 RATE_LIMIT_MAX=5000 npx tsx src/main.ts

# 4. This app pointed at that API
NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 NEXT_PUBLIC_WS_URL=http://localhost:3100 npm run dev

# 5. Run
npx playwright install chromium   # once
npm run test:e2e
```

Overrides: `E2E_BASE_URL`, `E2E_API_URL`, `E2E_MAIL_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. Global setup
adds a small demo fleet if it is missing. Screenshots for each viewport are written to `e2e/.artifacts/screens/`.

## Deployment

1. Build with the production API URLs: `NEXT_PUBLIC_API_URL=… NEXT_PUBLIC_WS_URL=… npm run build`.
2. Run `npm start` (or `next start -p $PORT`) behind HTTPS. The app is a standard Next.js Node server with no other
   runtime dependencies.
3. **Same-site requirement:** the refresh cookie is `SameSite=Strict`, so the app and API must be on the same site
   (e.g. `app.example.com` and `api.example.com`), or served from one origin through a reverse proxy.
4. Configure the API as in [API configuration](#api-configuration). If a proxy sits in front of the Socket.IO server,
   allow WebSocket upgrades on `/socket.io`.
5. Security headers are set in `next.config.ts`: a Content-Security-Policy whose `connect-src` is limited to the
   configured API and WebSocket origins, `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a permissions
   policy.

## Backend contract notes

The frontend uses only documented endpoints. Where the API offers no direct support for a requirement, the UI does
the following instead of inventing endpoints:

| Requirement                            | Behaviour                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Free-text search of audit logs         | The API has no `search` for audit logs. The page offers exact **record ID** search plus action, entity, user and date filters.             |
| Per-machine statistics                 | There is no per-machine stats endpoint. Machine pages read 12-month downtime and event counts from the analytics breakdowns (capped at 100 machines) and show "—" when a machine is outside that cap. |
| "Sign out of all sessions"             | No endpoint. Changing the password revokes every session, and the profile page says so.                                                    |
| Unlock an account                      | No endpoint. Locks expire automatically; the account page explains this.                                                                   |
| Creating administrators                | `POST /users` creates technicians only. The role is shown read-only; administrators come from the API seed.                                |
| Technician filter on logs for technicians | `GET /users` is admin-only, so technicians get an "Only logs I recorded" filter instead of a technician picker.                          |
