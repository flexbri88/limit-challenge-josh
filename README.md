# Fleet Maintenance

A REST API (Django + Django REST Framework) and web app (Next.js 16 + React 19 + MUI) for
managing a fleet of vehicles, the offices they belong to, the mechanics who service them and
their maintenance history.

The original brief is in [docs/CHALLENGE.md](docs/CHALLENGE.md).

- [Running the project](#running-the-project)
- [Running the tests](#running-the-tests)
- [API](#api)
- [Frontend](#frontend)
- [Assumptions](#assumptions)
- [Design decisions and tradeoffs](#design-decisions-and-tradeoffs)
- [What I would do next](#what-i-would-do-next)

## Running the project

Requirements: Python 3.10+ and Node.js 20+.

### Backend (http://localhost:8000)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed              # fake data; see below
python manage.py runserver 0.0.0.0:8000
```

The browsable API is at http://localhost:8000/api/.

#### Seed data

`python manage.py seed` fills an empty database with reproducible fake data (8 offices,
25 mechanics, 200 vehicles, ~3,500 maintenance records over three years). It deliberately
includes the edge cases every screen needs:

- active vehicles that were **never serviced** and others **last serviced over a year ago**
- one vehicle with **500+ records** (the command prints its plate) to exercise the detail page
- **inactive** vehicles and mechanics, including a retired vehicle that reuses an active
  vehicle's plate

Options: `--clear` (replace existing data), `--seed N` (different but reproducible data),
`--offices`, `--mechanics`, `--vehicles`, `--records`. Without `--clear` the command refuses to
run on a non-empty database.

It also creates the login **`demo` / `demo1234`**, resetting its password on every run
(`--no-demo-user` skips it). Add your own users with `python manage.py createsuperuser`.

### Frontend (http://localhost:3000)

```bash
cd frontend
npm install
npm run dev
```

The API URL defaults to `http://localhost:8000/api`; override it with
`NEXT_PUBLIC_API_BASE_URL`.

## Running the tests

| Suite | Command | What it covers |
|---|---|---|
| Backend (117 tests) | `cd backend && python manage.py test fleet` | Constraints, validation messages, every report against hand-computed numbers, filters, query counts, error mapping, authentication, seed |
| Frontend unit (70 tests) | `cd frontend && npm test` | Token refresh and retry, safe redirects, error parsing, URL state and pagination, debounced inputs, cache invalidation, formatting |
| End to end (26 tests) | `cd frontend && npm run test:e2e` | Real browser flows against a production build and a real API, including failure modes |

**Backend.** The tests cover what can silently go wrong:
- the partial unique constraint and its validation messages
- every report against hand-computed numbers, including window boundaries and leap days
- filter combinations, and search results without duplicates
- **query counts:** vehicle detail runs 2 queries with 300 records; the reports run 1
- the SQL issued by the office assignment
- 409 versus 500 mapping, form-encoded input, and seed argument validation
- **authentication** (`test_auth.py`): every endpoint rejects anonymous requests, forged and
  expired tokens and deactivated users; refresh rotation, reuse of a rotated refresh token,
  and logout revocation. The other API tests sign in with DRF's `force_authenticate`
  (`tests/base.py`) so they stay about their endpoint.

**Frontend unit.** Besides the helpers, the axios interceptor is tested against a fake
transport: it refreshes once and retries, shares one refresh between concurrent requests,
never loops, ends the session only when the refresh token itself is rejected, and keeps it on
a network error.

**End to end.** `npm run test:e2e` starts its own API on port 8100 with a freshly seeded
database (`backend/e2e.sqlite3`) and a production build of the frontend on port 3100, so your
development database and servers are untouched. It needs the backend virtualenv from
[Running the project](#running-the-project) and a browser: run
`npx playwright install chromium` once, or use an installed Chrome with
`PW_CHANNEL=chrome npm run test:e2e`. Tests create their own data through the API and verify
behaviour through the UI. Each test starts signed in with its own fresh tokens, so one test
signing out or rotating its refresh token cannot affect another. `auth.spec.ts` starts signed
out and covers the redirect to login and back to the same filtered URL, wrong and missing
credentials, sign-out revoking the refresh token, a silently renewed access token and a
session that can no longer be renewed. Besides the main flows, they cover failure modes:
- an unreachable API, with recovery through Retry
- a 500 in one dashboard section, while the others still render
- malformed filters in the URL
- a page past the end of a list
- unknown routes

Static checks: `npm run lint` (ESLint + Prettier), `npx tsc --noEmit` and `npm run build`.

## API

All endpoints live under `/api/` and require a signed-in user, except the token endpoints
below. List endpoints are paginated
(`?page=`, `?page_size=` up to 100) and return `{count, next, previous, results}`. Validation
errors return `400` with messages per field; deleting something that is still referenced
returns `409`.

| Method | Endpoint | Purpose |
|---|---|---|
| CRUD | `/offices/` | Offices (`?city=`, `?ordering=name`) |
| CRUD | `/mechanics/` | Mechanics (`?is_active=`, `?certification_number=`) |
| CRUD | `/vehicles/` | Vehicles, **with search** (below) |
| CRUD | `/maintenance-records/` | Records (`?vehicle=`, `?mechanic=`, `?maintenance_type=`, `?ordering=-date\|cost`) |
| GET | `/offices/summary/` | Every office with active vehicle count, 12-month cost, last maintenance |
| GET | `/vehicles/{id}/` | Vehicle with office, full history and each record's mechanic |
| GET | `/vehicles/{id}/maintenance-history/` | Paginated history, newest first |
| POST | `/vehicles/{id}/assign/` | Move to another office: `{"office": 3}` |
| GET | `/mechanics/workload/` | Current-year job count and cost per mechanic, busiest first |
| GET | `/vehicles/needs-maintenance/` | Active vehicles never serviced or not in over 365 days |
| GET | `/vehicles/check-duplicate/` | `?vin=&license_plate=` → `{"conflicts": ["vin", "license_plate"]}` |

**Authentication** uses JWTs ([Simple JWT](https://django-rest-framework-simplejwt.readthedocs.io/)).
Send `Authorization: Bearer <access>`; without it every endpoint returns `401`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/token/` | `{"username", "password"}` → `{"access", "refresh"}` |
| POST | `/auth/token/refresh/` | `{"refresh"}` → a new pair; the old refresh token stops working |
| POST | `/auth/logout/` | `{"refresh"}` → revokes it |
| GET | `/auth/me/` | `{"id", "username", "full_name"}` |

The access token lasts 15 minutes and the refresh token 1 day. The browsable API also accepts
a normal session: use **Log in** at the top right (`/api-auth/login/`).

Vehicle search: any combination of `office`, `is_active`, `make`, `model` (case-insensitive),
`maintained_from`, `maintained_to`, `mechanic_certification`, plus `search` (substring of VIN,
plate, make or model) and `ordering` (`license_plate`, `make`, `model`, `year`, prefix `-` for
descending).

```bash
curl -X POST http://localhost:8000/api/auth/token/ \
     -H "Content-Type: application/json" -d '{"username": "demo", "password": "demo1234"}'
TOKEN=<the "access" value from the response>

# Active Fords serviced by mechanic ASE-123456 during 2025
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:8000/api/vehicles/?make=ford&is_active=true&mechanic_certification=ASE-123456&maintained_from=2025-01-01&maintained_to=2025-12-31"

curl -X POST http://localhost:8000/api/vehicles/42/assign/ -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" -d '{"office": 3}'
```

`/vehicles/check-duplicate/` also accepts `exclude=<id>` (the vehicle being edited) and
`is_active=false` (a retired vehicle's plate never conflicts).

## Frontend

| Page | What it does |
|---|---|
| **Dashboard** `/` | KPI tiles, office summary, paged "needs maintenance" list, mechanic workload |
| **Vehicles** `/vehicles` | Search with every API filter, sorting and pagination, all in the URL; create/edit/delete |
| **Vehicle** `/vehicles/[id]` | Details, maintenance totals, overdue warning, full history; move office, log maintenance, edit, delete |
| **Maintenance** `/maintenance` | All records with type/vehicle filters and sorting; log/edit/delete |
| **Mechanics**, **Offices** | CRUD, status filter, links into the vehicle search |

UX details worth pointing out:

- **Filters live in the URL.** Any search can be bookmarked, shared or reloaded. Text inputs
  are debounced, changing a filter returns to page 1, active filters appear as removable chips,
  and a stale page link offers a way back to page 1.
- **Every list and panel handles loading, empty and error states separately.** Skeletons on
  first load, a progress bar while refetching (previous results stay visible), "no data" vs
  "no matches" empty states, and errors with a retry button.
- **Forms show the API's validation messages on the fields they belong to** and clear them
  as the user edits. VIN and plate are checked for duplicates when the field loses focus,
  before submitting.
- **Destructive actions explain their consequences** (deleting a vehicle removes its history,
  so the dialog suggests marking it inactive), and 409 responses are shown as readable
  messages.
- **Sessions stay out of the way.** Opening any page signed out leads to the login page and
  back to that exact URL, filters included. An expired access token is renewed silently; only
  when the session can no longer be renewed is the user asked to sign in again. Signing out
  revokes the session on the server and clears all cached data. Signing in or out in one tab
  applies to the others.
- **Writes refresh only affected data.** For example, logging maintenance updates the vehicle,
  the office summary and the workload.

## Assumptions

- **License plates:** unique among *active* vehicles only. A retired vehicle keeps its plate
  and the plate can be issued again. VINs are unique across all vehicles.
- **Normalization:** VINs, plates and certification numbers are stored upper case with
  whitespace collapsed, so `abc 123` and `ABC  123` are the same plate. VINs are validated
  for format (17 characters, no I/O/Q), not for the check digit.
- **"Record only the new office assignment":** the endpoint updates only the vehicle's office
  (`UPDATE … SET office_id`), so a concurrent edit of other fields is never overwritten. No
  assignment history is kept. Assigning to the current office is a `400`.
- **Office summary:** "last 12 months" is today minus one calendar year through today,
  inclusive. Maintenance is attributed to the vehicle's **current** office (there is no
  assignment history). Inactive vehicles still count toward cost and last maintenance; only
  the vehicle count is limited to active vehicles.
- **Vehicle search:** when the date range and mechanic filters are combined, they must match
  **the same** maintenance record ("serviced by this mechanic in this period").
- **Needs maintenance:** "more than 365 days" is strict, so a vehicle serviced exactly 365 days
  ago is not yet due. Never-serviced vehicles are the most overdue and sort first.
- **Mechanic workload:** "current year" is the calendar year. Mechanics with no jobs and
  inactive mechanics are included, since the latter may have worked earlier in the year.
- **Maintenance records:** dates cannot be in the future and costs cannot be negative. New
  work can only be assigned to active mechanics, but a record by a mechanic who has since left
  stays editable. "Today" is the server's date (UTC), with one day of tolerance so a user
  ahead of UTC can log work dated with their local "today".
- **Deletion:** deleting a vehicle deletes its history. Offices with vehicles and mechanics
  with history cannot be deleted (`409`); they should be deactivated or emptied first.
- **Vehicle year:** from 1980 to next year (next year's models are sold early).
- **Money:** stored as `Decimal`, serialized as JSON numbers to match the brief's example.
- **Query parameters are validated, not ignored.** `?is_active=maybe`, an unknown office or
  an invalid date returns `400` rather than an unfiltered list.
- **Authorization:** every signed-in user can do everything. The brief names no roles, so
  there are no per-office or read-only permissions.

## Design decisions and tradeoffs

**Backend**

- **The business rules are enforced in the database, and the serializers restate them.** The
  plate rule is a partial unique index and costs have a check constraint, so the data stays
  valid whatever writes it. The serializers repeat the checks to return field-level messages;
  a race between two requests becomes a `409`, not a `500`. DRF auto-generates a validator
  from the partial constraint, but that validator ignores whether the *submitted* vehicle is
  active, so it is replaced by an explicit one.
- **Query shape over caching.**
  - Vehicle detail uses `select_related` + `Prefetch(select_related('mechanic'))`, so it runs
    exactly 2 queries at any history length. Tests pin this.
  - Search uses a single `EXISTS` subquery, so vehicles with many matching records appear once
    without `DISTINCT`.
  - The reports are single aggregate queries.
  - Indexes follow the access paths: `(vehicle, -date)`, `(mechanic, date)`, `(date)` and
    `(make, model)`.
- **Detail returns the whole history, as the brief asks.** With 500 records it is ~130 KB in
  about 30 ms locally. For clients that need less, the paginated `maintenance-history`
  endpoint exists.
- **Reporting code is separate from views.** The queries live in `fleet/reports.py` and take
  `today` as an argument, so the tests can pin dates.
- **The summary and workload reports are unpaginated** because they grow with offices and
  mechanics, not with records. Needs-maintenance is paginated.
- **The office summary is one aggregate query over joins.** This is correct here because the
  joins form a single chain (office → vehicles → records), so SUM is not inflated. At much
  larger scale I would switch to per-metric subqueries or a materialized summary.
- **SQLite for zero setup.** Nothing depends on SQLite, and the partial index works the same
  on PostgreSQL, which I would use in production.
- **Django's test runner rather than pytest** avoids an extra dependency.
- **JWT with short-lived access tokens and rotating, revocable refresh tokens.** A leaked
  access token is useful for 15 minutes at most. Each refresh issues a new refresh token and
  blacklists the old one, so logout is real. The cost: one extra query per request to load
  the user (so deactivating a user takes effect immediately), on top of the query counts
  above.

**Frontend**

- **Client components with React Query.** The API is a separate service and the screens are
  interactive, so fetching happens in the browser. The URL is the source of truth for list
  state, and React Query caches by that state.
- **Filters use `router.replace`,** so typing does not flood the history stack. The tradeoff:
  Back leaves the page instead of undoing the last filter change.
- **The URL-driven pages render per request** (`connection()`). When statically prerendered,
  a page opened from a shared filter link could no longer navigate on the client. The e2e
  suite, running against a production build, caught this; the dev server does not show it.
- **Edits send only the fields that changed,** so saving a vehicle edit cannot undo an office
  move made in the meantime.
- **Error handling is layered:**
  - Field errors appear on their inputs; anything else goes in a form-level alert.
  - Lists and dashboard sections fail independently, each with Retry, and a page that no
    longer exists offers a way back.
  - Messages distinguish timeouts, unreachable servers and 5xx errors, and never show server
    error pages.
  - A route-level error boundary and a 404 page catch the rest.
- **Office and mechanic dropdowns load up to 100 options,** which is realistic for a fleet.
  The vehicle picker, which can be large, is an async server-side search that never shows
  results for an older query.
- **Tokens are kept in `localStorage`.** This keeps the frontend a plain client of the API
  and survives reloads and new tabs. The tradeoff is that any script running on the page
  could read them; React escapes rendered data, the app loads no third-party scripts, and
  the short access-token lifetime limits the damage. For production I would move the refresh
  token to an `httpOnly` cookie set by the API.
- **One token refresh at a time.** Refresh tokens rotate, so two parallel refreshes would
  race and the loser would sign the user out. The axios interceptor shares a single refresh
  between all requests that got a `401`, then retries each one once.
- **The vehicle detail page uses the detail endpoint** (one request) and pages the history in
  the client.

## What I would do next

- Run the three test suites in CI on every push.
- Roles and per-office permissions on top of the JWT authentication, and the refresh token
  in an `httpOnly` cookie.
- Office assignment history, if the business needs to attribute past costs to the office that
  owned the vehicle at the time.
- CSV export of search results, and a history table with server-side paging and filtering for
  vehicles with very long histories.

## Project structure

```
backend/
  fleet/
    models.py          Office, Vehicle, Mechanic, MaintenanceRecord (+ constraints, indexes)
    serializers.py     validation, normalization, nested read serializers
    filters.py         vehicle search (django-filter + EXISTS subquery)
    reports.py         office summary, mechanic workload, needs maintenance
    views.py           viewsets, custom actions and the current-user endpoint
    urls.py            router + JWT token, refresh and logout endpoints
    exceptions.py      409 for protected deletes / integrity conflicts
    management/commands/seed.py
    tests/             base.py signs API tests in; test_auth.py covers the real token flow
frontend/
  e2e/                 Playwright specs, fixtures (API data builders) and the test API launcher
  app/                 routes: login, dashboard, vehicles, vehicles/[id], maintenance, mechanics, offices
  components/          app shell, auth provider and route gate, dialogs, state components, per-domain forms
  hooks/               React Query hooks, URL state, cache invalidation map
  lib/                 API client (token refresh interceptor), token store, types, error parsing, formatting
```
