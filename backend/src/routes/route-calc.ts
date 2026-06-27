import { Router } from 'express'
import { sqlite } from '../database/index.js'
import { t } from '../i18n/index.js'

const router = Router()

// ---- BARÈME KILOMÉTRIQUE 2025 ----

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
    allowance = tripKm * rateLow
    rate = rateLow
    bracket = '≤ 5 000 km'
  } else if (totalKm <= 20000) {
    const fullAllowance = totalKm * rateMid + fixedMid

    if (annualKmAlready <= 5000) {
      const kmInLow = 5000 - annualKmAlready
      const kmInMid = tripKm - kmInLow
      if (kmInMid <= 0) {
        allowance = tripKm * rateLow
        rate = rateLow
        bracket = '≤ 5 000 km'
      } else {
        const prevAllowance = annualKmAlready * rateLow
        allowance = fullAllowance - prevAllowance
        rate = rateMid
        bracket = '5 001 – 20 000 km'
      }
    } else {
      const prevAllowance = annualKmAlready * rateMid + fixedMid
      allowance = fullAllowance - prevAllowance
      rate = rateMid
      bracket = '5 001 – 20 000 km'
    }
  } else {
    if (annualKmAlready <= 5000) {
      const fullHigh = totalKm * rateHigh
      const prevAllowance = annualKmAlready * rateLow
      allowance = fullHigh - prevAllowance
      rate = rateHigh
      bracket = '> 20 000 km'
    } else if (annualKmAlready <= 20000) {
      const fullHigh = totalKm * rateHigh
      const prevAllowance = annualKmAlready * rateMid + fixedMid
      allowance = fullHigh - prevAllowance
      rate = rateHigh
      bracket = '> 20 000 km'
    } else {
      allowance = tripKm * rateHigh
      rate = rateHigh
      bracket = '> 20 000 km'
    }
  }

  return { rate, allowance: Math.max(0, allowance), bracket }
}

// ---- VEHICLES ----

router.get('/vehicles', (req: any, res: any) => {
  try {
    const vehicles = sqlite.prepare(
      'SELECT * FROM route_calc_vehicles WHERE user_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(req.userId)
    res.json(vehicles)
  } catch (err) {
    console.error('GET /route-calc/vehicles error:', err)
    res.status(500).json({ error: t(req.locale, 'vehicleFetchError') })
  }
})

router.post('/vehicles', (req: any, res: any) => {
  try {
    const { name, fuelType, consumption, fiscalPower, defaultFuelPrice, isDefault, sortOrder } = req.body
    if (!name || consumption == null || !fuelType) {
      return res.status(400).json({ error: t(req.locale, 'vehicleFieldsRequired') })
    }

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
    res.status(500).json({ error: t(req.locale, 'vehicleSaveError') })
  }
})

router.put('/vehicles/:id', (req: any, res: any) => {
  try {
    const { id } = req.params
    const { name, fuelType, consumption, fiscalPower, defaultFuelPrice, isDefault, sortOrder } = req.body

    const existing = sqlite.prepare('SELECT * FROM route_calc_vehicles WHERE id = ? AND user_id = ?').get(id, req.userId)
    if (!existing) return res.status(404).json({ error: t(req.locale, 'vehicleNotFound') })

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
    res.status(500).json({ error: t(req.locale, 'vehicleSaveError') })
  }
})

router.delete('/vehicles/:id', (req: any, res: any) => {
  try {
    const { id } = req.params
    const existing = sqlite.prepare('SELECT * FROM route_calc_vehicles WHERE id = ? AND user_id = ?').get(id, req.userId)
    if (!existing) return res.status(404).json({ error: t(req.locale, 'vehicleNotFound') })

    sqlite.prepare('DELETE FROM route_calc_vehicles WHERE id = ? AND user_id = ?').run(id, req.userId)
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /route-calc/vehicles/:id error:', err)
    res.status(500).json({ error: t(req.locale, 'vehicleDeleteError') })
  }
})

// ---- ORS PROXY ----

const ORS_BASE = 'https://api.openrouteservice.org'

router.post('/geocode', async (req: any, res: any) => {
  try {
    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: t(req.locale, 'orsNotConfigured') })
    }

    const { query } = req.body
    if (!query) return res.status(400).json({ error: t(req.locale, 'queryRequired') })

    const url = `${ORS_BASE}/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(query)}&size=5`
    const response = await fetch(url)
    if (!response.ok) {
      return res.status(502).json({ error: t(req.locale, 'geocodeError') })
    }

    const data = await response.json() as any
    const results = (data.features || []).map((f: any) => ({
      label: f.properties?.label || f.properties?.name,
      coordinates: f.geometry?.coordinates
    }))

    res.json(results)
  } catch (err) {
    console.error('POST /route-calc/geocode error:', err)
    res.status(500).json({ error: t(req.locale, 'geocodeError') })
  }
})

router.post('/route', async (req: any, res: any) => {
  try {
    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: t(req.locale, 'orsNotConfigured') })
    }

    const { from, to, avoidTolls } = req.body
    if (!from || !to) return res.status(400).json({ error: t(req.locale, 'coordsRequired') })

    const body: any = { coordinates: [from, to] }
    if (avoidTolls) {
      body.options = { avoid_features: ['tollways'] }
    }

    const response = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('ORS routing error:', errText)
      return res.status(502).json({ error: t(req.locale, 'routeError') })
    }

    const data = await response.json() as any
    const summary = data.routes?.[0]?.summary
    if (!summary) return res.status(502).json({ error: t(req.locale, 'routeError') })

    res.json({
      distanceKm: summary.distance / 1000,
      durationMin: summary.duration / 60,
    })
  } catch (err) {
    console.error('POST /route-calc/route error:', err)
    res.status(500).json({ error: t(req.locale, 'routeError') })
  }
})

// ---- CALCULATE ----

router.post('/calculate', (req: any, res: any) => {
  try {
    const {
      consumption,
      fiscalPower,
      fuelPrice,
      distanceKm,
      tollAmount,
      annualKmAlready,
      roundTrip,
    } = req.body

    if (distanceKm == null || consumption == null || fuelPrice == null) {
      return res.status(400).json({ error: t(req.locale, 'calcFieldsRequired') })
    }

    const dist = roundTrip ? distanceKm * 2 : distanceKm
    const alreadyDone = annualKmAlready || 0
    const cv = Math.min(Math.max(fiscalPower || 5, 1), 7)

    const fuelCost = (dist * consumption) / 100 * fuelPrice
    const tollCost = tollAmount || 0
    const totalRealCost = fuelCost + tollCost

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
      recommendation,
    })
  } catch (err) {
    console.error('POST /route-calc/calculate error:', err)
    res.status(500).json({ error: t(req.locale, 'calcError') })
  }
})

export default router
