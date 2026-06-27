import { Router } from 'express'
import { db, sqlite } from '../database/index.js'
import { t } from '../i18n/index.js'

const router = Router()

// ---- BARÈME KILOMÉTRIQUE 2025 ----
// Returns the allowance per km for the TRIP distance given total annual km (including this trip)
function getBaremeRate(fiscalPower: number, totalAnnualKm: number): number {
  // Clamp fiscal power to valid brackets
  const cv = Math.min(Math.max(fiscalPower, 1), 7)

  const brackets: Record<number, [number, number, number, number]> = {
    1: [0.529, 0.316, 1065, 0.370],
    2: [0.529, 0.316, 1065, 0.370],
    3: [0.529, 0.316, 1065, 0.370],
    4: [0.606, 0.340, 1330, 0.407],
    5: [0.636, 0.357, 1395, 0.427],
    6: [0.665, 0.374, 1457, 0.447],
    7: [0.697, 0.394, 1515, 0.470],
  }

  const b = brackets[cv]
  const [rateLow, rateMid, fixedMid, rateHigh] = b

  if (totalAnnualKm <= 5000) {
    return rateLow
  } else if (totalAnnualKm <= 20000) {
    return rateMid  // plus fixed component applied separately
  } else {
    return rateHigh
  }
}

function computeBaremeAllowance(fiscalPower: number, annualKmAlready: number, tripKm: number): { rate: number; allowance: number; bracket: string } {
  const cv = Math.min(Math.max(fiscalPower, 1), 7)
  const totalKm = annualKmAlready + tripKm

  const brackets: Record<number, [number, number, number, number]> = {
    1: [0.529, 0.316, 1065, 0.370],
    2: [0.529, 0.316, 1065, 0.370],
    3: [0.529, 0.316, 1065, 0.370],
    4: [0.606, 0.340, 1330, 0.407],
    5: [0.636, 0.357, 1395, 0.427],
    6: [0.665, 0.374, 1457, 0.447],
    7: [0.697, 0.394, 1515, 0.470],
  }

  const b = brackets[cv]
  const [rateLow, rateMid, fixedMid, rateHigh] = b

  let allowance: number
  let rate: number
  let bracket: string

  if (totalKm <= 5000) {
    // All km at low rate
    allowance = tripKm * rateLow
    rate = rateLow
    bracket = '≤ 5 000 km'
  } else if (totalKm <= 20000) {
    // Use linear formula: d × rateMid + fixedMid for total; compute delta
    // Full allowance = totalKm * rateMid + fixedMid
    // Previous allowance = annualKmAlready * rateMid + fixedMid (if already in this bracket)
    //                   OR annualKmAlready * rateLow (if was in low bracket)
    let fullAllowance: number
    let prevAllowance: number

    fullAllowance = totalKm * rateMid + fixedMid

    if (annualKmAlready <= 5000) {
      // Previously in low bracket: split
      const kmInLow = 5000 - annualKmAlready
      const kmInMid = tripKm - kmInLow
      if (kmInMid <= 0) {
        allowance = tripKm * rateLow
        rate = rateLow
        bracket = '≤ 5 000 km'
      } else {
        prevAllowance = annualKmAlready * rateLow
        allowance = fullAllowance - prevAllowance
        rate = rateMid
        bracket = '5 001 – 20 000 km'
      }
    } else {
      prevAllowance = annualKmAlready * rateMid + fixedMid
      allowance = fullAllowance - prevAllowance
      rate = rateMid
      bracket = '5 001 – 20 000 km'
    }
  } else {
    // High bracket
    let prevAllowance: number
    if (annualKmAlready <= 5000) {
      // Was in low bracket, crossed both thresholds
      const fullLow = totalKm * rateHigh
      prevAllowance = annualKmAlready * rateLow
      allowance = fullLow - prevAllowance
      rate = rateHigh
      bracket = '> 20 000 km'
    } else if (annualKmAlready <= 20000) {
      // Was in mid bracket, crossed to high
      const fullHigh = totalKm * rateHigh
      prevAllowance = annualKmAlready * rateMid + fixedMid
      allowance = fullHigh - prevAllowance
      rate = rateHigh
      bracket = '> 20 000 km'
    } else {
      // All km at high rate
      allowance = tripKm * rateHigh
      rate = rateHigh
      bracket = '> 20 000 km'
    }
  }

  return { rate, allowance: Math.max(0, allowance), bracket }
}

// ---- VEHICLES ----

// GET /vehicles
router.get('/vehicles', async (req: any, res: any) => {
  try {
    const vehicles = sqlite.prepare(
      'SELECT * FROM route_calc_vehicles WHERE user_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(req.userId)
    res.json(vehicles)
  } catch (err) {
    console.error('GET /route-calc/vehicles error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.vehicleFetchError') })
  }
})

// POST /vehicles
router.post('/vehicles', async (req: any, res: any) => {
  try {
    const { name, fuelType, consumption, fiscalPower, defaultFuelPrice, isDefault, sortOrder } = req.body
    if (!name || consumption == null || !fuelType) {
      return res.status(400).json({ error: t(req.locale, 'routecalc.vehicleFieldsRequired') })
    }

    // If this vehicle is set as default, unset others
    if (isDefault) {
      sqlite.prepare('UPDATE route_calc_vehicles SET is_default = 0 WHERE user_id = ?').run(req.userId)
    }

    const result = sqlite.prepare(`
      INSERT INTO route_calc_vehicles (user_id, name, fuel_type, consumption, fiscal_power, default_fuel_price, is_default, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, name, fuelType || 'gasoline', consumption, fiscalPower || 5, defaultFuelPrice ?? null, isDefault ? 1 : 0, sortOrder || 0)

    const vehicle = sqlite.prepare('SELECT * FROM route_calc_vehicles WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(vehicle)
  } catch (err) {
    console.error('POST /route-calc/vehicles error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.vehicleSaveError') })
  }
})

// PUT /vehicles/:id
router.put('/vehicles/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params
    const { name, fuelType, consumption, fiscalPower, defaultFuelPrice, isDefault, sortOrder } = req.body

    const existing = sqlite.prepare('SELECT * FROM route_calc_vehicles WHERE id = ? AND user_id = ?').get(id, req.userId)
    if (!existing) return res.status(404).json({ error: t(req.locale, 'routecalc.vehicleNotFound') })

    if (isDefault) {
      sqlite.prepare('UPDATE route_calc_vehicles SET is_default = 0 WHERE user_id = ?').run(req.userId)
    }

    sqlite.prepare(`
      UPDATE route_calc_vehicles
      SET name = ?, fuel_type = ?, consumption = ?, fiscal_power = ?, default_fuel_price = ?, is_default = ?, sort_order = ?
      WHERE id = ? AND user_id = ?
    `).run(name, fuelType, consumption, fiscalPower, defaultFuelPrice ?? null, isDefault ? 1 : 0, sortOrder ?? 0, id, req.userId)

    const vehicle = sqlite.prepare('SELECT * FROM route_calc_vehicles WHERE id = ?').get(id)
    res.json(vehicle)
  } catch (err) {
    console.error('PUT /route-calc/vehicles/:id error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.vehicleSaveError') })
  }
})

// DELETE /vehicles/:id
router.delete('/vehicles/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params
    const existing = sqlite.prepare('SELECT * FROM route_calc_vehicles WHERE id = ? AND user_id = ?').get(id, req.userId)
    if (!existing) return res.status(404).json({ error: t(req.locale, 'routecalc.vehicleNotFound') })

    sqlite.prepare('DELETE FROM route_calc_vehicles WHERE id = ? AND user_id = ?').run(id, req.userId)
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /route-calc/vehicles/:id error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.vehicleDeleteError') })
  }
})

// ---- ORS PROXY ----

const ORS_BASE = 'https://api.openrouteservice.org'

// POST /geocode — proxy to ORS geocoding
router.post('/geocode', async (req: any, res: any) => {
  try {
    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: t(req.locale, 'routecalc.orsNotConfigured') })
    }

    const { query } = req.body
    if (!query) return res.status(400).json({ error: t(req.locale, 'routecalc.queryRequired') })

    const url = `${ORS_BASE}/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(query)}&size=5`
    const response = await fetch(url)
    if (!response.ok) {
      return res.status(502).json({ error: t(req.locale, 'routecalc.geocodeError') })
    }

    const data = await response.json() as any
    const results = (data.features || []).map((f: any) => ({
      label: f.properties?.label || f.properties?.name,
      coordinates: f.geometry?.coordinates // [lng, lat]
    }))

    res.json(results)
  } catch (err) {
    console.error('POST /route-calc/geocode error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.geocodeError') })
  }
})

// POST /route — proxy to ORS routing
router.post('/route', async (req: any, res: any) => {
  try {
    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: t(req.locale, 'routecalc.orsNotConfigured') })
    }

    const { from, to, avoidTolls } = req.body
    if (!from || !to) return res.status(400).json({ error: t(req.locale, 'routecalc.coordsRequired') })

    const body: any = {
      coordinates: [from, to]
    }
    if (avoidTolls) {
      body.options = { avoid_features: ['tollways'] }
    }

    const response = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('ORS routing error:', errText)
      return res.status(502).json({ error: t(req.locale, 'routecalc.routeError') })
    }

    const data = await response.json() as any
    const summary = data.routes?.[0]?.summary
    if (!summary) return res.status(502).json({ error: t(req.locale, 'routecalc.routeError') })

    const distanceKm = summary.distance / 1000
    const durationMin = summary.duration / 60

    res.json({ distanceKm, durationMin })
  } catch (err) {
    console.error('POST /route-calc/route error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.routeError') })
  }
})

// POST /calculate — pure computation
router.post('/calculate', async (req: any, res: any) => {
  try {
    const {
      consumption,       // L/100km or kWh/100km
      fiscalPower,       // CV fiscaux 1-7
      fuelPrice,         // €/L or €/kWh
      distanceKm,        // one-way or total if roundTrip already accounted
      tollAmount,        // manual toll cost
      annualKmAlready,   // km already done this year before this trip
      roundTrip          // boolean: double the distance
    } = req.body

    if (distanceKm == null || consumption == null || fuelPrice == null) {
      return res.status(400).json({ error: t(req.locale, 'routecalc.calcFieldsRequired') })
    }

    const dist = roundTrip ? distanceKm * 2 : distanceKm
    const alreadyDone = annualKmAlready || 0
    const cv = Math.min(Math.max(fiscalPower || 5, 1), 7)

    // Fuel / energy cost
    const fuelCost = (dist * consumption) / 100 * fuelPrice
    const tollCost = tollAmount || 0
    const totalRealCost = fuelCost + tollCost

    // Barème kilométrique
    const { rate, allowance, bracket } = computeBaremeAllowance(cv, alreadyDone, dist)

    const delta = totalRealCost - allowance
    const recommendation = delta > 0 ? 'bareme' : delta < 0 ? 'reel' : 'equal'

    res.json({
      distanceUsed: dist,
      fuelCost,
      tollCost,
      totalRealCost,
      baremeTaux: rate,
      baremeBracket: bracket,
      baremeAllowance: allowance,
      delta,
      recommendation
    })
  } catch (err) {
    console.error('POST /route-calc/calculate error:', err)
    res.status(500).json({ error: t(req.locale, 'routecalc.calcError') })
  }
})

export default router
