import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

export default async function ActivitiesPage({ searchParams }: {
  searchParams: { q?: string, type?: string, from?: string, to?: string, past?: string, artistId?: string }
}) {
  const s = createSupabaseServer()
  const q = (searchParams.q || '').trim()
  const type = (searchParams.type || '').trim()
  const past = searchParams.past === '1'
  const from = searchParams.from
  const to = searchParams.to
  const artistId = searchParams.artistId

  let qb = s.from('activities').select(`
    id, type, status, date, municipality, province, country, artist_id, company_id,
    lat, lng,
    artists(id, stage_name, avatar_url),
    group_companies(id, nick, name, logo_url)
  `)

  if (artistId) qb = qb.eq('artist_id', artistId)
  if (type) qb = qb.eq('type', type)
  if (past) {
    qb = qb.lte('date', to || todayISO()).order('date', { ascending: false })
  } else {
    qb = qb.gte('date', from || todayISO()).order('date', { ascending: true })
    if (to) qb = qb.lte('date', to)
  }
  if (q) {
    const like = `%${q}%`
    qb = qb.or([
      `municipality.ilike.${like}`,
      `province.ilike.${like}`,
      `country.ilike.${like}`,
      `type.ilike.${like}`,
      `status.ilike.${like}`
    ].join(','))
  }

  const { data, error } = await qb
  if (error) throw new Error(error.message)
  const items = data || []

  const points: ActivityForMap[] = items.map((a: any) => ({
    id: a.id,
    lat: typeof a.lat === 'number' ? a.lat : undefined,
    lng: typeof a.lng === 'number' ? a.lng : undefined,
    date: a.date ?? undefined,
    status: a.status ?? undefined,
    type: a.type ?? undefined,
    href: `/actividades/actividad/${a.id}`,
  }))

  const { data: typesRaw } = await s.from('activities').select('type').not('type','is',null).order('type')
  const types = Array.from(new Set((typesRaw || []).map((r: any) => r.type).filter(Boolean)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades</h1>
        <Link href="/actividades/new" className="btn">+ Nueva actividad</Link>
      </div>

      <ModuleCard title="Mapa">
        <ActivitiesMap points={points} />
      </ModuleCard>

      <ModuleCard title="Listado">
        <form className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4" method="get">
          <div className="md:col-span-2">
            <input name="q" defaultValue={q} placeholder="Buscar…" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <select name="type" defaultValue={type} className="w-full border rounded px-3 py-2">
              <option value="">Todos los tipos</option>
              {types.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Desde</label>
            <input type="date" name="from" defaultValue={from} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Hasta</label>
            <input type="date" name="to" defaultValue={to} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="md:col-span-5 flex items-center gap-2">
            <button className="btn">Aplicar</button>
            {past
              ? <Link className="btn-secondary" href={{ pathname: '/actividades', query: { ...searchParams, past: undefined } }}>Ver futuras</Link>
              : <Link className="btn-secondary" href={{ pathname: '/actividades', query: { ...searchParams, past: '1' } }}>Ver pasadas</Link>}
          </div>
        </form>

        <div className="divide-y divide-gray-200">
          {items.map((a: any) => {
            const art = Array.isArray(a.artists) ? a.artists[0] : a.artists
            const comp = Array.isArray(a.group_companies) ? a.group_companies[0] : a.group_companies
            return (
              <Link key={a.id} href={`/actividades/actividad/${a.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                <div className="flex items-center gap-3">
                  {!artistId && (art?.avatar_url
                    ? <img src={art.avatar_url} className="h-8 w-8 rounded-full object-cover border" alt="" />
                    : <div className="h-8 w-8 rounded-full bg-gray-200" />)}
                  <div className="text-sm">
                    <div className="font-medium">{a.type} · {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'}</div>
                    <div className="text-gray-600">{[a.municipality, a.province, a.country].filter(Boolean).join(', ')}</div>
                    {comp?.id && <div className="text-xs text-gray-500 mt-1">Empresa: {comp.nick || comp.name}</div>}
                  </div>
                </div>
                <span className={`badge ${String(a.status).toLowerCase()==='confirmed' ? 'badge-green' : 'badge-yellow'}`}>{a.status}</span>
              </Link>
            )
          })}
          {!items.length && <div className="text-sm text-gray-500 py-3">Sin actividades.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
