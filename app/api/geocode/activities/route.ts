// app/api/geocode/activities/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type GeoItem = { id: string }

async function geocodeQuery(q: string): Promise<{ lat: number, lng: number } | null> {
  const email = process.env.GEOCODER_EMAIL || 'geocoder@example.com'
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': `33-Backoffice (${email})`,
    },
    // Vercel: asegura que haga la request saliente
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

    // 1) Leemos datos necesarios de cada actividad (join con venue)
    const { data: rows, error } = await s
      .from('activities')
      .select(`
        id, municipality, province, country, lat, lng,
        venue_id,
        venues:venue_id (name, address)
      `)
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const output: { id: string, lat: number, lng: number }[] = []

    // 2) Para cada actividad sin coordenadas: cache -> geocode -> update
    for (const a of rows || []) {
      if (typeof a.lat === 'number' && typeof a.lng === 'number') continue

      const parts = [
        a.venues?.name, a.venues?.address,
        a.municipality, a.province,
        a.country || 'España',
      ].filter(Boolean)

      const q = parts.join(', ').trim()
      if (!q) continue

      // Consulta la cache
      const cached = await s.from('geocoding_cache').select('lat,lng').eq('query', q).maybeSingle()
      let latlng: { lat: number, lng: number } | null = null

      if (cached.data?.lat != null && cached.data?.lng != null) {
        latlng = { lat: Number(cached.data.lat), lng: Number(cached.data.lng) }
      } else {
        // Llamada a Nominatim
        latlng = await geocodeQuery(q)
        // Graba cache (aunque sea null, no grabamos para evitar ensuciar)
        if (latlng) {
          await s.from('geocoding_cache').upsert({ query: q, lat: latlng.lat, lng: latlng.lng })
        }
        // Pequeña espera para no saturar el servicio (política Nominatim)
        await new Promise(r => setTimeout(r, 900))
      }

      if (latlng) {
        const up = await s.from('activities').update({ lat: latlng.lat, lng: latlng.lng }).eq('id', a.id)
        if (!up.error) {
          output.push({ id: a.id, lat: latlng.lat, lng: latlng.lng })
        }
      }
    }

    return NextResponse.json(output)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'geocode_failed' }, { status: 500 })
  }
}
