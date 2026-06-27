const ORS_BASE = 'https://api.openrouteservice.org'
const KEY_STORAGE = 'routecalc_ors_key'

export function getOrsKey(): string {
  return localStorage.getItem(KEY_STORAGE) || ''
}
export function setOrsKey(key: string): void {
  if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
  else localStorage.removeItem(KEY_STORAGE)
}
export function hasOrsKey(): boolean {
  return !!getOrsKey()
}

export interface GeocodeResult {
  label: string
  coordinates: [number, number]
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const apiKey = getOrsKey()
  if (!apiKey) throw new Error('ORS key not configured')

  const url = `${ORS_BASE}/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(query)}&size=5`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Geocode error')

  const data = await response.json()
  return (data.features || []).map((f: any) => ({
    label: f.properties?.label || f.properties?.name,
    coordinates: f.geometry?.coordinates,
  }))
}

export async function route(
  from: [number, number],
  to: [number, number],
  avoidTolls = false
): Promise<{ distanceKm: number; durationMin: number }> {
  const apiKey = getOrsKey()
  if (!apiKey) throw new Error('ORS key not configured')

  const body: any = { coordinates: [from, to] }
  if (avoidTolls) body.options = { avoid_features: ['tollways'] }

  const response = await fetch(`${ORS_BASE}/v2/directions/driving-car`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Route error')

  const data = await response.json()
  const summary = data.routes?.[0]?.summary
  if (!summary) throw new Error('Route error')

  return { distanceKm: summary.distance / 1000, durationMin: summary.duration / 60 }
}
