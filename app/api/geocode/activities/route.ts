// app/api/geocode/activities/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Venue = { name?: string | null; address?: string | null }
type Row = {
  id: string
  municipality?: string | null
  province?: string | null
  country?: string | null
  lat?: number | string | null
  lng?: number | string | null
  // Supabase puede devolver el join como objeto o como array
  venues?: Venue | Venue[] | null
}

async function geocodeQuery(q: string): Promise<{ lat: number; lng: number } | null> {
  const email = process.env.GEOCODER_EMAIL || 'geocoder@example.com'
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(
    q,
  )}`
  const res = await fetch(url, {
    headers: { 'User-Agent': `33-Backoffice (${email})` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json: any[] = await res.json()
  if (!json?.length) return null
  const best = json[0]
  const lat = parseFloat(best.lat)
  const lng = parseFloat(best.lon ?? best.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    if (!ids.length) return NextResponse.json([], { status: 200 })

    const s = createSupabaseServer()

    // 1) Leer actividades con datos de ubicación mínimos
    const { data, error } = await s
      .from('activities')
      .select(
        `
        id, municipality, province, country, lat, lng, venue_id,
        venues:venue_id ( name, address )
      `,
      )
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const rows = (data || []) as Row[]
    const output: { id: string; lat: number; lng: number }[] = []

    for (const a of rows) {
      // Si ya tiene coordenadas válidas, saltamos
      const existingLat = typeof a.lat === 'string' ? Number(a.lat) : a.lat
      const existingLng = typeof a.lng === 'string' ? Number(a.lng) : a.lng
      if (Number.isFinite(existingLat) && Number.isFinite(existingLng)) continue

      // Normalizar venue (objeto o array)
      const v: Venue | undefined = Array.isArray(a.venues) ? a.venues[0] : a.venues || undefined

      // Construir consulta humana
      const parts = [
        v?.name,
        v?.address,
        a.municipality,
        a.province,
        a.country || 'España',
      ].filter(Boolean) as string[]
      const q = parts.join(', ').trim()
      if (!q) continue

      // 2) Cache (si existe)
      let latlng: { lat: number; lng: number } | null = null
      try {
        const cached = await s.from('geocoding_cache').select('lat,lng').eq('query', q).maybeSingle()
        if (cached.data?.lat != null && cached.data?.lng != null) {
          const clat = Number(cached.data.lat)
          const clng = Number(cached.data.lng)
          if (Number.isFinite(clat) && Number.isFinite(clng)) {
            latlng = { lat: clat, lng: clng }
          }
        }
      } catch {
        // Si la tabla de cache no existe todavía, seguimos sin bloquear
      }

      // 3) Geocodificar si no hay cache
      if (!latlng) {
        latlng = await geocodeQuery(q)
        // Guardar en cache si procede
        if (latlng) {
          try {
            await s.from('geocoding_cache').upsert({ query: q, lat: latlng.lat, lng: latlng.lng })
          } catch {
            /* no-op si no existe la tabla */
          }
          // Nominatim: pequeña pausa para respetar el servicio
          await new Promise((r) => setTimeout(r, 900))
        }
      }

      // 4) Persistir en activities
      if (latlng) {
        const up = await s.from('activities').update({ lat: latlng.lat, lng: latlng.lng }).eq('id', a.id)
        if (!up.error) output.push({ id: a.id, lat: latlng.lat, lng: latlng.lng })
      }
    }

    return NextResponse.json(output)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'geocode_failed' }, { status: 500 })
  }
}
