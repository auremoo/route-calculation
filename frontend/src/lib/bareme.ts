export interface CalcInput {
  consumption: number
  fiscalPower: number
  fuelPrice: number
  distanceKm: number
  tollAmount?: number
  annualKmAlready?: number
  roundTrip?: boolean
}

export interface CalcResult {
  distanceUsed: number
  fuelCost: number
  tollCost: number
  totalRealCost: number
  baremeTaux: number
  baremeBracket: string
  baremeAllowance: number
  delta: number
  recommendation: 'bareme' | 'reel' | 'equal'
}

// Barème kilométrique 2025 — [rateLow, rateMid, fixedMid, rateHigh] per fiscal power
const BRACKETS: Record<number, [number, number, number, number]> = {
  1: [0.529, 0.316, 1065, 0.370],
  2: [0.529, 0.316, 1065, 0.370],
  3: [0.529, 0.316, 1065, 0.370],
  4: [0.606, 0.340, 1330, 0.407],
  5: [0.636, 0.357, 1395, 0.427],
  6: [0.665, 0.374, 1457, 0.447],
  7: [0.697, 0.394, 1515, 0.470],
}

export function computeBaremeAllowance(
  fiscalPower: number,
  annualKmAlready: number,
  tripKm: number
): { rate: number; allowance: number; bracket: string } {
  const cv = Math.min(Math.max(fiscalPower, 1), 7)
  const totalKm = annualKmAlready + tripKm
  const [rateLow, rateMid, fixedMid, rateHigh] = BRACKETS[cv]

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

export function calculate(input: CalcInput): CalcResult {
  const { consumption, fiscalPower, fuelPrice, distanceKm, tollAmount, annualKmAlready, roundTrip } = input

  const dist = roundTrip ? distanceKm * 2 : distanceKm
  const alreadyDone = annualKmAlready || 0
  const cv = Math.min(Math.max(fiscalPower || 5, 1), 7)

  const fuelCost = (dist * consumption) / 100 * fuelPrice
  const tollCost = tollAmount || 0
  const totalRealCost = fuelCost + tollCost

  const { rate, allowance, bracket } = computeBaremeAllowance(cv, alreadyDone, dist)

  const delta = totalRealCost - allowance
  const recommendation = delta > 0 ? 'bareme' : delta < 0 ? 'reel' : 'equal'

  return {
    distanceUsed: dist,
    fuelCost,
    tollCost,
    totalRealCost,
    baremeTaux: rate,
    baremeBracket: bracket,
    baremeAllowance: allowance,
    delta,
    recommendation,
  }
}
