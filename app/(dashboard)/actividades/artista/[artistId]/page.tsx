import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import ActivityMap from '@/components/ActivityMap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}
const todayISO = () => new Date().toISOString().slice(0,10)

export default async function ActivitiesByArtist({
  params,
  searchParams,
}: {
  params: { artistId: string },
  searchParams: { show?: 'upcoming'|'past', type?: string, from?: string, to?: string }
}) {
  const s = createSupabaseServer()
  const show = (searchParams.show === 'past') ? 'past' : 'upcoming'
  const type = searchParams.type || 'all'
  const from = searchParams.from
  const to = searchParams.to

  // Artista (nombre)
  const { data: artist } = await s.from('artists').select('id, stage_name').eq('id', params.artistId).single()

  // Consulta actividades con los mismos filtros que en la ficha
  let q = s.from('activities').select(`
    id, type, status, date, municipality, province, country,
    venues ( id, name, lat, lng ),
    group_companies ( id, nick, name, logo_url )
  `).eq('artist_id', params.artistId)

  if (type && type !== 'all') q = q.eq('type', type)

  const today = todayISO()
  if (show === 'past') {
    const now = new Date()
    const curr = now.getFullYear()
    const defFrom = `${curr-1}-01-01`
    const defTo   = `${curr}-12-31`
    q = q.gte('date', from || defFrom).lte('date', to || defTo)
  } else {
    q = q.gte('date', from || today)
    if (to) q = q.lte('date', to)
  }

  const { data: activities } = await q.order('date', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades · {artist?.stage_name}</h1>
        <Link className="btn-secondary" href={`/artistas/${params.artistId}?tab=actividades`}>Volver</Link>
      </div>

      <ModuleCard title="Mapa">
        <ActivityMap
          items={(activities || []).map((a: any) => ({
            id: a.id, date: a.date, status: a.status, type: a.type,
            lat: one(a.venues as any)?.lat ?? null,
            lng: one(a.venues as any)?.lng ?? null,
          }))}
          height={420}
        />
      </ModuleCard>

      <ModuleCard title="Listado">
        {/* Filtros GET */}
        <form method="get" className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="block text-sm mb-1">Mostrar</label>
            <select name="show" defaultValue={show} className="w-full border rounded px-2 py-1">
              <option value="upcoming">Próximas</option>
              <option value="past">Pasadas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" defaultValue={type} className="w-full border rounded px-2 py-1">
              <option value="all">(todos)</option>
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_investment">Inversión discográfica</option>
              <option value="custom">Otro</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Desde</label><input type="date" name="from" defaultValue={from || ''} className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Hasta</label><input type="date" name="to" defaultValue={to || ''} className="w-full border rounded px-2 py-1" /></div>
          <div className="flex items-end"><button className="btn w-full">Aplicar</button></div>
        </form>

        <div className="divide-y divide-gray-200">
          {(activities || []).map((ac: any) => {
            const gc = one(ac.group_companies as any)
            return (
              <Link
                key={ac.id}
                href={`/actividades/actividad/${ac.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div>
                  <div className="font-medium">{ac.type === 'concert' ? 'Concierto' : ac.type}</div>
                  <div className="text-sm text-gray-600">
                    {ac.status} · {ac.date ? new Date(ac.date).toLocaleDateString() : 'Sin fecha'} · {[ac.municipality, ac.province, ac.country].filter(Boolean).join(', ')}
                  </div>
                </div>
                {gc?.logo_url
                  ? <img src={gc.logo_url} alt="" className="h-8 w-auto object-contain" />
                  : (gc?.nick || gc?.name) ? <span className="text-xs text-gray-600">{gc.nick || gc.name}</span> : null}
              </Link>
            )
          })}
          {(!activities || !activities.length) && <div className="text-sm text-gray-500 py-3">No hay actividades con esos filtros.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
