# RouteCalc — architecture notes (extracted from PRP)

## Purpose

Calculate the cost of a road trip in France, compare it to the
**barème kilométrique** (official French tax mileage allowance), and
recommend whether to declare the real cost or the official allowance.

Supports convoy mode (several vehicles for the same trip with shared
costs) and per-person cost splitting.

## Key business logic

### Barème kilométrique 2025 (in `route-calc.ts`)

- Rate depends on **fiscal horsepower** (CV, 1-7) and **annual km bracket**.
- Brackets: `≤ 5 000 km`, `5 001 - 20 000 km`, `> 20 000 km`.
- The function `computeBaremeAllowance()` walks the brackets when
  `annualKmAlready + distance` straddles a boundary, so the result is
  always exact.
- 2025 reference data is **hardcoded in the route handler**, it does not
  hit any external service.

### Cost model

`totalRealCost = fuelCost + tollCost`

`fuelCost = (consumption / 100) × distanceKm × fuelPrice`
- For electric vehicles, the same formula applies but `consumption` is
  `kWh/100km` and `fuelPrice` is `€/kWh`.

`tollCost` is provided by the user (no toll API).

### Recommendation

If `baremeAllowance > totalRealCost` → recommend `bareme`.
Otherwise → recommend `real`.

### Round-trip

Toggle in UI; on the API side, the calc handler doubles `distanceKm`
when `roundTrip: true`.

### Convoy mode (frontend only)

The frontend lets you add multiple vehicles to a trip; costs are
summed and divided per person. The backend `/calculate` endpoint is
called once per vehicle.

## Frontend feature surface

- Address autocomplete (debounced calls to `/geocode`)
- Route lookup with toll-avoidance option (`/route`)
- Vehicle picker (loaded from `/vehicles`)
- Real-time computation form (sends to `/calculate` on input changes)
- Print/PDF report (uses `window.print()` with print-only CSS)
- Settings view to manage vehicles (CRUD)

## External services

| Service | Purpose | Required? | Env var |
|---|---|---|---|
| OpenRouteService | Geocoding + routing | Optional (manual entry works) | `ORS_API_KEY` |

Sign up: <https://openrouteservice.org/dev/#/signup>
Free tier covers ~2 000 requests/day.

## Dependencies summary

### Backend
- `express` (router)
- `better-sqlite3` + `drizzle-orm` (DB)
- `node-fetch` (built into Node 20+) for ORS calls
- No specialized routing/maps library

### Frontend
- `vue` 3 + `vue-router` + `pinia` + `vue-i18n`
- `tailwindcss` (styling)
- `lucide-vue-next` (icons)
- `axios` (HTTP client)
- No maps library — addresses are displayed as text only

## Data model

Single table: `route_calc_vehicles` (see `source/backend/migration.sql`).
No journal/history table — each trip calculation is ephemeral and not
persisted; only vehicles are stored.

## Auth model in PRP (for reference)

PRP uses a JWT cookie called `authtoken` set on `/`. Vehicles are
filtered by `req.userId` from the JWT.

In the new standalone app you can replicate this auth model, or
simplify (single-user app, no auth at all, single PIN, etc.).
