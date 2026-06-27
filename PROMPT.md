# Prompt — build the standalone RouteCalc app

> Paste everything below as your first message to Claude Code (or any
> agentic coding assistant) inside an empty folder.

---

## Context

You will build a brand-new standalone web app called **RouteCalc**.
It computes the cost of a road trip in France and compares it to the
French official mileage allowance (*barème kilométrique*).

The app already exists as a sub-feature of a larger monorepo called
PRP. I have extracted the relevant source files into a kit located at
`~/Desktop/routecalc-extraction-kit/`. **Start by reading every file
under `source/` and `reference/`** in that kit. Specifically:

- `source/frontend/RouteCalc.vue` — main calculator component (Vue 3, ~850 lines)
- `source/frontend/Settings.vue` — vehicle management (Vue 3, ~240 lines)
- `source/frontend/i18n-fr.json` and `i18n-en.json` — UI translations
- `source/backend/route-calc.ts` — Express router with **all** business logic, including the 2025 *barème* tables
- `source/backend/schema-snippet.ts` — Drizzle table definition for `route_calc_vehicles`
- `source/backend/migration.sql` — raw SQL to bootstrap the table
- `source/backend/i18n-fr-snippet.json` / `i18n-en-snippet.json` — backend error messages
- `reference/api-endpoints.md` — REST contract
- `reference/architecture-notes.md` — feature surface, business rules, dependencies

These files reference PRP-specific infrastructure (a shared `requireAuth`
middleware reading a JWT cookie called `authtoken`, a shared
`db`/`schema` import, a shared `t(req.locale, key)` i18n helper, a
shared axios `api` store on the frontend, vue-i18n with global
namespacing, etc.). You will **strip those references** as you port
them — see "Decoupling rules" below.

## Goal

A working monorepo at the current working directory (a fresh empty
folder) that:

1. Builds cleanly (`npm run build`)
2. Runs locally (`npm run dev`) on a single port for both backend and frontend
3. Persists vehicles in SQLite
4. Has a clean README with setup steps and a screenshot placeholder
5. Has a `.env.example`
6. Has a `Dockerfile` for one-click deploy on Fly.io / Render / Railway

## Tech stack

Use **the same stack** as the source to keep porting effort minimal:

- **Backend**: Node 20 + Express + TypeScript + Drizzle ORM + better-sqlite3
- **Frontend**: Vue 3 + Vite + TypeScript + Tailwind 3 + Pinia + Vue Router + vue-i18n + axios + lucide-vue-next
- **Workspaces** in the root `package.json` (`backend/`, `frontend/`)

## Repository layout to produce

```
routecalc/
├── package.json              ← npm workspaces, scripts: dev / build / start
├── README.md                 ← short, with screenshots placeholder + setup
├── .env.example              ← PORT, JWT_SECRET, ORS_API_KEY, DATABASE_PATH
├── .gitignore                ← node_modules, dist, data/, .env
├── Dockerfile                ← multi-stage build, ships backend + frontend dist
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          ← Express app, mounts /api/* and serves dist/
│   │   ├── start.ts          ← runs migrations, then imports index
│   │   ├── i18n/
│   │   │   ├── index.ts      ← simple `t(locale, key)` helper + middleware
│   │   │   ├── fr.json       ← merge backend i18n snippets
│   │   │   └── en.json
│   │   ├── middleware/
│   │   │   └── auth.ts       ← see "Auth" below
│   │   ├── routes/
│   │   │   ├── auth.ts       ← /login (PIN), /verify, /logout, /change-pin
│   │   │   └── route-calc.ts ← copy of source file, slightly adapted
│   │   └── database/
│   │       ├── schema.ts     ← `users` + `route_calc_vehicles`
│   │       └── index.ts      ← migrations runner (users + vehicles)
│   └── dist/                 ← tsc output (gitignored)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts        ← proxy /api → backend, base '/'
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    ├── index.html            ← preconnect Google Fonts (Inter), apple-touch-icon
    ├── public/
    │   ├── icon.png          ← placeholder (use 🚗 emoji or generate one)
    │   └── manifest.webmanifest
    └── src/
        ├── main.ts
        ├── App.vue           ← layout shell (top bar + outlet)
        ├── assets/main.css   ← @tailwind directives + base styles + design tokens
        ├── i18n/
        │   ├── index.ts      ← vue-i18n setup with FR/EN, persisted in localStorage
        │   ├── fr.json       ← merge of UI snippet + a tiny `common` namespace
        │   └── en.json
        ├── router/index.ts   ← /login, /calculator (default), /settings
        ├── stores/
        │   ├── api.ts        ← axios instance with withCredentials, 401 → /login
        │   ├── auth.ts       ← Pinia: user, login, verify, logout, changePin
        │   └── vehicles.ts   ← Pinia: list/create/update/delete vehicles
        ├── components/
        │   ├── TopBar.vue    ← logo + nav links + user menu + lang switcher
        │   └── PinKeypad.vue ← shared 6-digit PIN entry widget
        └── views/
            ├── Login.vue     ← user pick + PIN keypad
            ├── Calculator.vue ← port of source/frontend/RouteCalc.vue
            └── Settings.vue   ← port of source/frontend/Settings.vue
```

## Decoupling rules (when porting source files)

The source files contain references to PRP infrastructure. Replace
them with self-contained equivalents:

### In `RouteCalc.vue` and `Settings.vue`

| Source reference | Replace with |
|---|---|
| `import api from '../../../stores/api'` | `import api from '../stores/api'` |
| Translation calls `$t('routecalc.xxx')` | Keep as `$t('xxx')` after flattening i18n (drop the `routecalc.` prefix) |
| Any reference to a `PRP` brand, hub, sidebar, master gate | Remove |
| `useI18n` calls work as-is | Keep |
| Settings.vue references to a sidebar slot | Render directly inside the layout |

After flattening the namespace, the JSON should look like:
```json
{ "title": "...", "nav": { "calculator": "...", "settings": "..." }, "calculator": { ... }, "settings": { ... }, "print": { ... }, "common": { "save": "Save", "cancel": "Cancel", ... } }
```

### In `route-calc.ts` (backend route)

| Source reference | Replace with |
|---|---|
| `import { db } from '../database/index.js'` | Keep, but `db` will be from your own `database/index.ts` exporting Drizzle on the local schema |
| `import { routeCalcVehicles } from '../database/schema.js'` | Same path, your own schema |
| `req.userId` (set by middleware) | Keep — provide the same shape with your own `requireAuth` |
| `t(req.locale, 'routecalc.xxx')` | Either rename to `t(req.locale, 'xxx')` after flattening, or keep the namespace if you prefer |
| Any unused imports | Remove |

The big *barème kilométrique* tables and the route logic are
self-contained — no external dependency to port.

## Auth

Use a **simple multi-user PIN scheme**, the same model as in PRP:

- `users` table: `id`, `name`, `pin_hash` (bcrypt), `last_login_at`
- `POST /api/auth/register` — create user (name + 6-digit PIN, hashed with bcrypt 12 rounds)
- `GET /api/auth/users` — list users (id + name only) for the login screen
- `POST /api/auth/login` — `{ userId, pin }` → sets HttpOnly cookie `authtoken` (JWT, 7d)
- `POST /api/auth/verify` — reads cookie, returns the user
- `POST /api/auth/logout` — clears the cookie
- `PUT /api/auth/change-pin`
- Middleware `requireAuth` checks `req.cookies.authtoken`, decodes JWT
  with `JWT_SECRET`, sets `req.userId`. Mount it on `/api/route-calc/*`.

If you want a **simpler single-user** mode, gate everything behind a
single `MASTER_PIN` env var and skip user registration. State the
choice in the README and `.env.example`.

## Design system (carry over the look-and-feel)

Inspired by Linear / Vercel / Raycast — **all-Inter typography**, tight
tracking, generous whitespace, warm off-white background, subtle
shadows. Concrete tokens:

```
colors:
  cream-50  #FBFAF7  (page background)
  cream-100 #F5F3ED
  ink-50    #F6F6F5
  ink-100   #E8E7E3  (borders)
  ink-300   #9E9B91  (muted)
  ink-500   #4A4740  (secondary)
  ink-800   #121110  (primary text)
  ink-900   #0A0A08  (headings)
  accent-500 #6D3AAD (primary action)
fonts:
  Inter via Google Fonts (weights 400, 500, 600, 700)
shadows:
  shadow-soft   0 1px 2px rgba(15,15,15,.03), 0 4px 12px rgba(15,15,15,.04)
  shadow-medium 0 2px 4px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.06)
radius:
  sm 6px / DEFAULT 8px / lg 14px
```

Provide `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`,
`.card`, `.card-hover` Tailwind component classes in `main.css`. The
existing `RouteCalc.vue` already uses utility classes; just make sure
it visually matches this palette.

## Frontend i18n setup

Load `fr.json` and `en.json` as flat objects, install vue-i18n with
`legacy: false`. Persist the chosen locale in `localStorage` under the
key `routecalc_locale`. Expose a small lang switcher in the top bar
(FR ↔ EN). Default locale = `fr`.

## Database

Single SQLite file at `./data/routecalc.db` (gitignored). On startup,
run inline migrations:

```js
db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`)
// v1: users
// v2: route_calc_vehicles  (use the SQL in source/backend/migration.sql)
```

Make migrations idempotent — `CREATE TABLE IF NOT EXISTS` + a
`schema_version` row.

In production, allow `DATABASE_PATH` env var to override the path.

## Dockerfile (for deploys)

Multi-stage:
1. `node:20-alpine` builder → install workspaces → build backend (tsc) + frontend (vite build)
2. `node:20-alpine` runner → copy `backend/dist`, `frontend/dist`, `node_modules` → expose `8080` → `CMD ["node", "backend/dist/start.js"]`

The backend should serve `frontend/dist` statically when `NODE_ENV=production`.

## README requirements

Keep it short and useful:

1. One-paragraph pitch ("Compute road-trip costs in France…")
2. Screenshot placeholder
3. Quickstart:
   ```bash
   npm install
   cp .env.example .env
   # optionally: set ORS_API_KEY for address lookup
   npm run dev   # opens http://localhost:5173
   ```
4. Deployment section linking to Fly.io / Render / Railway
5. Stack at the bottom (Vue 3, Express, SQLite, Tailwind)

## Deliverables checklist

Before declaring done, verify:

- [ ] `npm install` at root installs everything
- [ ] `npm run dev` starts both backend (port 3001) and frontend (port 5173) with vite proxy
- [ ] `npm run build` produces `backend/dist/` and `frontend/dist/` with no errors
- [ ] Visiting `/` redirects to `/login`, you can register a user and log in
- [ ] You can add/edit/delete vehicles in `/settings`
- [ ] You can run a calculation in `/calculator` even **without** ORS (manual distance entry works)
- [ ] If `ORS_API_KEY` is set, address search returns suggestions
- [ ] Lang switcher toggles FR/EN throughout the UI
- [ ] `Dockerfile` builds and the resulting image runs (`docker build . -t routecalc && docker run -p 8080:8080 routecalc`)
- [ ] `.env.example` lists every env var with a comment

## Style of work

- **Keep things small.** Don't add features I didn't ask for.
- **Match the source.** When porting a Vue file, preserve the exact
  visual structure and behavior — only strip PRP-specific bits.
- **Commit progressively.** One commit per logical step (skeleton,
  backend, auth, ports, dockerfile, polish).
- **Type everything.** No `any` unless absolutely necessary.
- **No comments explaining what the code does.** The code is the doc.
  Only add comments for non-obvious decisions or external API quirks
  (e.g. ORS payload format).

## When you start

1. Read the kit thoroughly (`source/` + `reference/`).
2. Tell me what you understood in 5-10 bullets, including any
   ambiguity, before writing code.
3. Then scaffold the repo, port the files, and iterate.
4. Finally, run the full checklist and show me `npm run build` output.

Good luck.
