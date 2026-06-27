# RouteCalc API endpoints

All endpoints are mounted at `/api/route-calc` and require authentication.

## Vehicles (CRUD)

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`    | `/vehicles`     | — | `Vehicle[]` (sorted by sort_order) |
| `POST`   | `/vehicles`     | `{ name, fuelType, consumption, fiscalPower, defaultFuelPrice?, isDefault?, sortOrder? }` | `Vehicle` |
| `PUT`    | `/vehicles/:id` | same fields, partial | `Vehicle` |
| `DELETE` | `/vehicles/:id` | — | `{ success: true }` |

Setting `isDefault: true` automatically unsets the flag on the user's other vehicles.

## OpenRouteService proxy (requires `ORS_API_KEY` env var)

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/geocode` | `{ query: string }` | `[{ label, coordinates: [lng, lat] }]` |
| `POST` | `/route`   | `{ from: [lng,lat], to: [lng,lat], avoidTolls?: boolean }` | `{ distanceKm, durationMin }` |

If `ORS_API_KEY` is missing both endpoints return `503` with `routecalc.orsNotConfigured`.

## Calculation (pure compute, no ORS)

`POST /calculate`

**Body**:
```ts
{
  consumption: number,       // L/100km or kWh/100km
  fiscalPower: number,       // 1-7 CV
  fuelPrice: number,         // €/L or €/kWh
  distanceKm: number,
  tollAmount?: number,       // €
  annualKmAlready?: number,  // km already driven this year
  roundTrip?: boolean        // doubles the distance
}
```

**Response**:
```ts
{
  distanceUsed: number,      // distanceKm (× 2 if roundTrip)
  fuelCost: number,
  tollCost: number,
  totalRealCost: number,
  baremeTaux: number,        // €/km computed
  baremeBracket: string,     // '≤5000' | '5001-20000' | '>20000'
  baremeAllowance: number,   // €
  delta: number,             // allowance − realCost
  recommendation: 'real' | 'bareme'
}
```

## Vehicle type

```ts
interface Vehicle {
  id: number
  userId: number
  name: string
  fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid'
  consumption: number
  fiscalPower: number      // 1-7
  defaultFuelPrice: number | null
  isDefault: boolean
  sortOrder: number
  createdAt?: string
}
```
