# RouteCalc

Compute the cost of a road trip in France and compare it to the official mileage allowance (*barème kilométrique 2025*). Supports convoy mode (several vehicles sharing the same trip), per-person cost splitting, and an adjustable ratio for partial reimbursements.

**Fully static** — no backend, no account. Vehicles and settings are stored in your browser's `localStorage`. Deploys to GitHub Pages.

## Screenshot

> _(screenshot placeholder)_

## Quickstart

```bash
npm install
npm run dev   # http://localhost:5173
```

Build the static site:

```bash
npm run build   # outputs frontend/dist
npm run preview # serve the build locally
```

## Address autocomplete (optional)

Distance can always be entered manually. To enable address search and automatic route distance, open **Véhicules → Recherche d'adresses** and paste a free [OpenRouteService](https://openrouteservice.org/dev/#/signup) API key (~2 000 requests/day). The key is stored only in your browser and used to call ORS directly.

## Deploy (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the frontend and publishes it to GitHub Pages. Enable Pages once under **Settings → Pages → Source: GitHub Actions**.

## Data

Everything lives in `localStorage`:

- `routecalc_vehicles` — your saved vehicles
- `routecalc_ors_key` — your OpenRouteService key (if set)
- `routecalc_locale` — UI language (FR/EN)

Clearing browser data resets the app.

## Stack

Vue 3 · Vite · TypeScript · Tailwind 3 · Pinia · vue-i18n · lucide-vue-next
