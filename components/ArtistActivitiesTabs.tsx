import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import { SubTabs } from '@/components/Tabs'
import ArtistCalendar from '@/components/ArtistCalendar'

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

export default async function ArtistActivitiesTabs({
  artistId, searchParams
}: { artistId: string, searchParams: { view?: 'list'|'calendar', q?: string, type?: string, from?: string, to?: string, past?: string } }) {
  const view = (searchParams.view as 'list'|'calendar') || 'list'
  const s = createSupabaseServer()

  // Avatar del artista (para pins del mapa)
  const artistInfo = await s.from('artists').select('id, avatar_url').eq('id', artistId).maybeSingle()
  const artistAvatar = (artistInfo.data && 'avatar_url' in artistInfo.data) ? (artistInfo.data as any).avatar_url : null

  if (view === 'calendar') {
    return (
      <>
        <SubTabs current="calendar" items={[
          { key: 'list', label: 'Actividades', href: `/artistas/${artistId}?tab=actividades&view=list` },
          { key: 'calendar', label: 'Calendario', href: `/artistas/${artistId}?tab=actividades&view=calendar` },
        ]} />
        <ArtistCalendar artistId={artistId} searchParams={searchParams} />
      </>
    )
  }

  // Listado
  const q = (searchParams.q || '').trim()
  const type = (searchParams.type || '').trim()
  const past = searchParams.past === '1'
  const from = searchParams.from
  const to = searchParams.to

  let qb = s.from('activities').select('id, type, status, date, municipality, province, country, lat, lng')
    .eq('artist_id', artistId)

  if (type) qb = qb.eq('type', type)
  if (past) qb = qb.lte('date', to || todayISO()).order('date', { ascending: false })
  else {
    qb = qb.gte('date', from || todayISO()).order('date', { ascending: true })
    if (to) qb = qb.lte('date', to)
  }
  if (q) {
    const like = `%${q}%`
    qb = qb.or(['municipality.ilike.'+like,'province.ilike.'+like,'country.ilike.'+like,'type.ilike.'+like,'status.ilike.'+like].join(','))
  }
  const { data, error } = await qb
  if (error) throw new Error(error.message)
  const items = data || []

  const points: ActivityForMap[] = items.map((a:any) => ({
    id: a.id, lat: a.lat ?? undefined, lng: a.lng ?? undefined,
    date: a.date ?? undefined, status: a.status ?? undefined, type: a.type ?? undefined,
    href: `/actividades/actividad/${a.id}`,
    artist_avatar: artistAvatar
  }))
  const { data: typesRaw } = await s.from('activities').select('type').eq('artist_id', artistId).not('type','is',null)
  const types = Array.from(new Set((typesRaw || []).map((r:any) => r.type).filter(Boolean)))

  return (
    <>
      <SubTabs current="list" items={[
        { key: 'list', label: 'Actividades', href: `/artistas/${artistId}?tab=actividades&view=list` },
        { key: 'calendar', label: 'Calendario', href: `/artistas/${artistId}?tab=actividades&view=calendar` },
      ]} />

      <div className="space-y-4">
        <ActivitiesMap points={points} />

        <form className="grid grid-cols-1 md:grid-cols-5 gap-3" method="get">
          <input type="hidden" name="tab" value="actividades" />
          <div className="md:col-span-2">
            <input name="q" defaultValue={q} placeholder="Buscar…" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <select name="type" defaultValue={type} className="w-full border rounded px-3 py-2">
              <option value="">Todos los tipos</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Desde</label><input type="date" name="from" defaultValue={from} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Hasta</label><input type="date" name="to" defaultValue={to} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="md:col-span-5 flex items-center gap-2">
            <button className="btn">Aplicar</button>
            {!past
              ? <Link className="btn-secondary" href={{ pathname: `/artistas/${artistId}`, query: { ...searchParams, tab: 'actividades', view: 'list', past: '1' } }}>Ver pasadas</Link>
              : <Link className="btn-secondary" href={{ pathname: `/artistas/${artistId}`, query: { ...searchParams, tab: 'actividades', view: 'list', past: undefined } }}>Ver futuras</Link>}
          </div>
        </form>

        <div className="divide-y divide-gray-200">
          {items.map((a:any) => (
            <Link key={a.id} href={`/actividades/actividad/${a.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
              <div className="text-sm">
                <div className="font-medium">{a.type} · {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'}</div>
                <div className="text-gray-600">{[a.municipality, a.province, a.country].filter(Boolean).join(', ')}</div>
              </div>
              <span className={`badge ${String(a.status).toLowerCase()==='confirmed' ? 'badge-green' : 'badge-yellow'}`}>{a.status}</span>
            </Link>
          ))}
          {!items.length && <div className="text-sm text-gray-500">Sin actividades.</div>}
        </div>
      </div>
    </>
  )
}
