# HomeFix — home maintenance services website

A complete web application for running a home maintenance service:

1. **Customers** register and submit maintenance requests (category, description, address, urgency, preferred date).
2. An **admin** schedules an on-site **inspection visit**, then records the findings and scope of work.
3. Approved **technicians** see inspected requests and send **offers** (price, estimated duration, note).
4. The customer **accepts an offer**, the technician does the work and marks it **completed**, and the customer **confirms and rates** it. The order is then closed.

Every step is written to an activity log on the request, so all three parties always see what happened and what comes next.

The interface is available in **English and Arabic** (right-to-left), switchable from the header.

Built with Node.js only (no npm dependencies): `node:http` for the server, the built-in `node:sqlite` module for storage, scrypt password hashing, server-rendered HTML with a small stylesheet, and the built-in test runner.

## Quick start

Requires **Node.js 22.13 or newer** (for the built-in SQLite module; `package.json` pins `22.x` for Vercel).

```bash
npm start            # http://localhost:3000 — creates data/homefix.db and the admin account on first run
npm run seed         # optional: demo customers, technicians and requests in every state
npm test             # end-to-end workflow, auth and security tests
```

The first start prints the admin credentials it created (defaults below). Change them with environment variables before exposing the site.

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@homefix.test | admin123 |
| Customer | nadia@example.com | customer123 |
| Customer | youssef@example.com | customer123 |
| Technician (Plumbing) | omar@homefix.test | tech1234 |
| Technician (Electrical) | lina@homefix.test | tech1234 |
| Technician (General) | karim@homefix.test | tech1234 |
| Technician awaiting approval | sam@homefix.test | tech1234 |

## Deploy to Vercel (share the prototype)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTamoura%2FHomeFix&project-name=homefix&repository-name=homefix)

Click the button (or run `npx vercel` in the project folder, then `npx vercel --prod`). No build step and no configuration are needed:

- `api/index.js` runs the whole app as a single serverless function; `vercel.json` routes every path to it and Vercel's CDN serves the files in `public/`.
- On Vercel the SQLite database lives in `/tmp` and **demo data is seeded on every cold start** (`SEED_DEMO` defaults to `1` there). The login page shows the demo accounts and a "prototype" banner, so a customer can try every role immediately.
- Because functions have no persistent disk, **data is ephemeral**: requests created during a demo disappear when the function restarts (typically after a period of inactivity) and each new instance starts from the same demo data. That is fine for a walkthrough; for a real deployment run the app on a host with a persistent disk (Fly.io, Railway, Render or any VPS, with `npm start`) or move the data layer to a hosted database.
- Recommended environment variables in the Vercel project: `ADMIN_PASSWORD` (the default `admin123` is public in demo mode), optionally `APP_NAME`, `CURRENCY`, `DEFAULT_LOCALE`, and `SEED_DEMO=0` to turn demo mode off.

## The workflow

```
submitted ─▶ visit_scheduled ─▶ open_for_offers ─▶ in_progress ─▶ completed ─▶ closed
    │              │                  │                 │             │
    └──────────────┴──────────────────┴─────────────────┴─── cancelled ┘
```

| Status | Who acts | Action |
| --- | --- | --- |
| Submitted | Admin | Schedule (or reschedule) the inspection visit |
| Visit scheduled | Admin | Record the findings and scope of work → opens the request for offers |
| Open for offers | Technicians / Customer | Technicians submit, update or withdraw offers; the customer accepts one |
| In progress | Technician | Do the work, then mark it as completed |
| Awaiting confirmation | Customer | Confirm and rate (closes the order) or send it back with comments |
| Closed / Cancelled | — | Final. Customers can cancel before an offer is accepted; admins can cancel any open request. |

Technician accounts created through the public registration form are **pending** until an admin approves them on the Users page (admins can also create approved technician accounts directly and deactivate accounts later). Technicians see the customer's contact details only after their offer has been accepted.

## Pages

| Role | URL | Purpose |
| --- | --- | --- |
| Everyone | `/`, `/technicians`, `/login`, `/register` | Customer landing page (benefits, services, FAQ, live track record), technician recruitment page, sign in, create an account |
| Customer | `/requests`, `/requests/new`, `/requests/:id` | List, submit and follow requests; accept offers; confirm completion |
| Admin | `/admin`, `/admin/requests/:id`, `/admin/users` | Dashboard with status filters and search; schedule visits and record findings; approve/manage technicians |
| Technician | `/tech`, `/tech/requests/:id` | Open requests, own offers and jobs; send offers; mark work completed |

## Languages

The whole interface, including validation messages, notifications and the activity log, is available in English and Arabic. Arabic pages render right-to-left with locale-aware dates and prices.

- The header shows a link to the other language. It sets a one-year `hf_lang` cookie, so the choice sticks across visits.
- `?lang=ar` or `?lang=en` on any URL switches the language (and is then removed from the URL).
- Without a cookie, the browser's `Accept-Language` header decides; otherwise `DEFAULT_LOCALE` applies.
- Activity-log entries are stored as structured data and rendered in the reader's language, so a request submitted in English reads naturally in Arabic and vice versa.

Translations live in `src/i18n/en.js` and `src/i18n/ar.js`, which share one key structure (a test fails if a key is missing in either file). Adding a language means adding a dictionary and registering it in `src/i18n/index.js`.

## Configuration

All settings are environment variables with sensible defaults.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Where the server listens |
| `DATABASE_FILE` | `data/homefix.db` (`/tmp/homefix.db` on Vercel) | SQLite file (`:memory:` for a throwaway database) |
| `APP_NAME` | `HomeFix` | Site name shown in the header and titles |
| `CURRENCY` | `USD` | ISO currency code used to format offer prices |
| `DEFAULT_LOCALE` | `en` | Language used when neither a cookie nor the browser asks for one (`en` or `ar`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | `admin@homefix.test`, `admin123`, `Site Admin` | Initial admin account, created only when no admin exists yet |
| `COOKIE_SECURE` | unset (`1` on Vercel) | Set to `1` when serving over HTTPS so session cookies get the `Secure` flag |
| `SEED_DEMO` | unset (`1` on Vercel) | `1` seeds the demo accounts and requests on startup and shows them on the login page; `0` disables |
| `LOG_REQUESTS` | `1` | Set to `0` to silence the per-request log line |

## Project layout

```
src/
  server.js          entry point (listen, graceful shutdown)
  app.js             config, router wiring, error pages
  db.js              SQLite schema and transactions
  auth.js            password hashing, sessions, CSRF, role guards
  workflow.js        statuses, transitions, categories, urgency levels
  i18n/              translation engine, English and Arabic dictionaries, activity-log rendering
  lib/               http toolkit (router, cookies, body parsing, static files), html templating, formatting
  services/          business logic: users, requests (state transitions), offers
  routes/            HTTP handlers per role: auth, customer, admin, tech
  views/             server-rendered pages and shared components
  demo.js            demo accounts shared by the seed script and the login page
public/              stylesheet, progressive-enhancement script, favicon (served by the app locally, by the CDN on Vercel)
api/index.js         Vercel serverless entry point
vercel.json          routes every request to the function
scripts/seed.js      demo data (also used by demo mode)
test/                node:test suites (run with npm test)
```

## Security notes

- Passwords are hashed with scrypt and a per-user salt; comparisons are constant-time.
- Sessions are random 256-bit tokens stored server-side in `HttpOnly`, `SameSite=Lax` cookies; every state-changing form carries a per-session CSRF token that is verified on POST.
- All HTML output is escaped by default by the template helper; SQL uses parameterised statements only.
- Authorisation is enforced per route: customers only see their own requests, technicians only see inspected requests or their own jobs, admin pages require the admin role. Deactivating a user revokes their sessions.
- Static files are served from `src/public` only (path traversal is rejected), and request bodies are capped at 1 MB.
