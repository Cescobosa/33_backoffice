// lib/geocoding.ts
export type GeoResult = { lat: number | null; lng: number | null }

export async function geocodeAddress(address?: string | null): Promise<GeoResult> {
  const q = String(address || '').trim()
  if (!q) return { lat: null, lng: null }

  // Nominatim (OpenStreetMap) - uso simple sin API key
  // Importante: cumplir con política de uso y poner un user-agent identificable
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': '33-backoffice/venues (contact: admin@33.local)',
        'Accept': 'application/json',
      },
      // Recomendable deshabilitar cache en server actions si tu hosting cachea
      cache: 'no-store',
    })
    if (!res.ok) return { lat: null, lng: null }
    const arr = await res.json()
    if (!Array.isArray(arr) || arr.length === 0) return { lat: null, lng: null }
    const top = arr[0]
    const lat = top?.lat ? Number(top.lat) : null
    const lng = top?.lon ? Number(top.lon) : null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null }
    return { lat, lng }
  } catch {
    return { lat: null, lng: null }
  }
}
