# RouteCalc

Compute the cost of a road trip in France and compare it to the official mileage allowance (*barème kilométrique 2025*). Supports convoy mode (several vehicles sharing the same trip), per-person cost splitting, and an adjustable ratio for partial reimbursements.

## Screenshot

> _(screenshot placeholder)_

## Quickstart

```bash
npm install
cp .env.example .env
# Optionally: set ORS_API_KEY for address autocomplete
npm run dev
# Frontend → http://localhost:5173
# Backend  → http://localhost:3001
```

On first launch, visit `/login`, click **Créer un compte**, and set your name + 6-digit PIN.

## Deploy

The app ships as a single Docker image (backend + frontend static files):

```bash
docker build . -t routecalc
docker run -p 8080:8080 \
  -e JWT_SECRET=your-secret \
  -e ORS_API_KEY=your-ors-key \
  -v $(pwd)/data:/app/data \
  routecalc
```

One-click platforms: **Fly.io**, **Render**, **Railway** — point them at this repo and set the env vars above.

## Stack

- **Frontend** — Vue 3, Vite, TypeScript, Tailwind 3, Pinia, vue-i18n, axios, lucide-vue-next
- **Backend** — Node 20, Express, TypeScript, Drizzle ORM, better-sqlite3
- **Database** — SQLite (single file, persisted in `./data/`)
