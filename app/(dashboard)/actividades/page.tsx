import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import ActivityListItem, { ActivityListModel } from '@/components/ActivityListItem'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

export default async function ActivitiesPage({ searchParams }: {
  searchParams: { q?: string, type?: string, from?: string, to?: string, past?: string }
}) {
  const s = createSupabaseServer()
  const q = (searchParams.q || '').trim()
  const type = (searchParams.type || '').trim()
  const from = searchParams.from || todayISO()
  const to = searchParams.to || ''
  const showPast = searchParams.past === '1'

  let qb = s.from('activities').select(`
    id, type, status, date, municipality, province, country, lat, lng,
    artist_id,
    artists:artist_id ( id, stage_name, avatar_url ),
    venues:venue_id ( name, address )
  `).order('date', { ascending: true })

  if (q) {
    const like = `%${q}%`
    qb = qb.or([
      `municipality.ilike.${like}`,
      `province.ilike.${like}`,
      `country.ilike.${like}`,
      `venues.name.ilike.${like}`,
      `venues.address.ilike.${like}`
    ].join(','))
  }
  if (type) qb = qb.eq('type', type)
  if (!showPast) qb = qb.gte('date', from)
  if (to) qb = qb.lte('date', to)

  const { data, error } = await qb
  if (error) throw new Error(error.message)
  const items = (data || []) as any[]

  const points: ActivityForMap[] = items.map((a: any) => ({
    id: a.id,
    lat: a.lat != null ? Number(a.lat) : null,
    lng: a.lng != null ? Number(a.lng) : null,
    date: a.date ?? undefined,
    status: a.status ?? undefined,
    type: a.type ?? undefined,
    href: `/actividades/actividad/${a.id}`,
    artist_avatar: a.artists?.avatar_url || null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades</h1>
        <Link href="/actividades/new" className="btn">+ Nueva actividad</Link>
      </div>

      <ModuleCard title="Mapa">
        <ActivitiesMap points={points} />
      </ModuleCard>

      <ModuleCard title="Filtrar">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input name="q" defaultValue={q} placeholder="Buscar…" className="border rounded px-3 py-2" />
          <input type="date" name="from" defaultValue={from} className="border rounded px-3 py-2" />
          <input type="date" name="to" defaultValue={to} className="border rounded px-3 py-2" />
          <select name="type" defaultValue={type} className="border rounded px-3 py-2">
            <option value="">(todos los tipos)</option>
            <option value="concert">Conciertos</option>
            <option value="promo_event">Eventos promocionales</option>
            <option value="promotion">Promoción</option>
            <option value="record_invest">Inversión discográfica</option>
          </select>
          <label className="flex items-center gap-2 md:col-span-4">
            <input type="checkbox" name="past" value="1" defaultChecked={showPast} /> Incluir pasadas
          </label>
          <div className="md:col-span-4"><button className="btn">Aplicar</button></div>
        </form>
      </ModuleCard>

      <ModuleCard title="Listado">
        <div className="divide-y">
          {items.map((a: any) => (
            <ActivityListItem key={a.id} a={{
              id: a.id, type: a.type, status: a.status, date: a.date,
              municipality: a.municipality, province: a.province, country: a.country,
              artist: a.artists
            } as ActivityListModel} href={`/actividades/actividad/${a.id}`} />
          ))}
          {!items.length && <div className="text-sm text-gray-500 px-2 py-3">No hay actividades.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
