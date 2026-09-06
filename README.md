# RouteCalc

Compute the cost of a road trip in France and compare it to the official mileage allowance (*barème kilométrique 2025*). Supports convoy mode (several vehicles sharing the same trip), per-person cost splitting, and an adjustable ratio for partial reimbursements.

**Fully static** — no backend, no account. Vehicles and settings are stored in your browser's `localStorage`. Deploys to GitHub Pages.

## Sharing modes

The **Partage** panel decides how much the driver asks the passengers for. All
amounts are then divided by the number of people on board (driver included).

| Mode | What the driver asks for |
| --- | --- |
| **Barème entier** | The full official mileage allowance. |
| **Ratio fixe** | The allowance multiplied by a ratio you pick (÷ 2, 2/3, …). |
| **Plafond auto** | Real costs (fuel + tolls) plus a capped surplus. The ratio is derived automatically. |

In **Plafond auto**, the surplus is counted either:

- **per vehicle** — `surplus × km/1000 × number of vehicles`. The same surplus
  whatever the number of passengers, split between them.
- **per person** — `surplus × km/1000 × number of people`. Each passenger is
  worth that much extra to the driver.

Example — 686 km, 4 people, one 4 CV car, 89,18 € of fuel, 10 €/1000 km:

- per vehicle → surplus 6,86 € → allowance capped at 96,04 € (ratio 23,1 %) → **24,01 €/person**
- per person → surplus 27,44 € → allowance capped at 116,62 € (ratio 28,1 %) → **29,16 €/person**

The chosen mode, the surplus, its basis and the number of people are remembered
in `localStorage` (`routecalc_sharing_prefs`).

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
- `routecalc_sharing_prefs` — sharing mode, ratio, surplus and number of people
- `routecalc_locale` — UI language (FR/EN)

Clearing browser data resets the app.

## Stack

Vue 3 · Vite · TypeScript · Tailwind 3 · Pinia · vue-i18n · lucide-vue-next
