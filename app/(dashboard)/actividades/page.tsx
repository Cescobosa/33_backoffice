import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ActivitiesMap from '@/components/ActivitiesMap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ActivitiesHome({
  searchParams,
}: {
  searchParams?: { view?: 'all' | 'artists'; artistId?: string; q?: string; type?: string; past?: string }
}) {
  const s = createSupabaseServer()
  const view = (searchParams?.view as any) || 'artists'
  const artistId = searchParams?.artistId || ''
  const q = (searchParams?.q || '').trim()
  const type = (searchParams?.type || '').trim()
  const past = searchParams?.past === '1'
  const today = new Date().toISOString().slice(0, 10)

  // ===== artistas para selector =====
  const { data: artists } = await s
    .from('artists')
    .select('id, stage_name, avatar_url')
    .order('stage_name')

  // ===== actividades =====
  let query = s
    .from('activities')
    .select(`
      id, type, status, date, municipality, province, country, lat, lng,
      artists(id,stage_name,avatar_url),
      group_companies(id,logo_url,nick,name)
    `)
    .order('date', { ascending: true })

  if (view === 'artists' && artistId) query = query.eq('artist_id', artistId)
  if (!past) query = query.gte('date', today)
  if (type) query = query.eq('type', type)
  if (q && q.length >= 2) {
    // Filtro seguro (campos de la propia tabla)
    query = query.or(
      `municipality.ilike.%${q}%,province.ilike.%${q}%,country.ilike.%${q}%,type.ilike.%${q}%`
    )
  }
  const { data: acts } = await query

  const points =
    (acts || [])
      .filter((a: any) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
      .map((a: any) => ({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        date: a.date,
        status: a.status,
        type: a.type,
        href: `/actividades/actividad/${a.id}`,
      })) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades</h1>
        <Link href="/actividades/new" className="btn">+ Nueva actividad</Link>
      </div>

      {/* Filtros superiores */}
      <form className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Vista</label>
          <select name="view" defaultValue={view} className="border rounded px-3 py-2">
            <option value="artists">Por artista</option>
            <option value="all">Todas</option>
          </select>
        </div>

        {view === 'artists' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Artista</label>
            <select name="artistId" defaultValue={artistId} className="border rounded px-3 py-2">
              <option value="">(Selecciona artista)</option>
              {(artists || []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.stage_name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-600 mb-1">Buscar</label>
          <input name="q" defaultValue={q} placeholder="Ciudad, provincia, país, tipo…"
                 className="border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Tipo</label>
          <select name="type" defaultValue={type} className="border rounded px-3 py-2">
            <option value="">Todos</option>
            <option value="concert">Concierto</option>
            <option value="festival">Festival</option>
            <option value="promo">Promo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Rango</label>
          <select name="past" defaultValue={past ? '1' : ''} className="border rounded px-3 py-2">
            <option value="">Futuras</option>
            <option value="1">Pasadas</option>
          </select>
        </div>

        <button className="btn">Aplicar</button>
      </form>

      {/* Mapa sobre el listado */}
      <ActivitiesMap points={points} height={360} />

      {/* Listado */}
      <div className="divide-y divide-gray-200 mt-4">
        {(acts || []).map((ac: any) => (
          <Link key={ac.id} href={`/actividades/actividad/${ac.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
            <div>
              <div className="font-medium">{ac.type === 'concert' ? 'Concierto' : ac.type}</div>
              <div className="text-sm text-gray-600">
                {statusBadge(ac.status)} · {ac.date ? new Date(ac.date).toLocaleDateString() : 'Sin fecha'} ·
                {' '}{[ac.municipality, ac.province, ac.country].filter(Boolean).join(', ')}
              </div>
            </div>
            {view === 'all' && ac.artists?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ac.artists.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border" />
            ) : null}
          </Link>
        ))}
        {!acts?.length && <div className="text-sm text-gray-500 py-3">No hay actividades con estos filtros.</div>}
      </div>
    </div>
  )
}

function statusBadge(s?: string | null) {
  if (s === 'confirmed') return 'Confirmado'
  if (s === 'hold') return 'Reserva'
  return 'Borrador'
}
