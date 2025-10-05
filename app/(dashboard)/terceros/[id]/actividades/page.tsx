import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import ActivityListItem, { ActivityListModel } from '@/components/ActivityListItem'
import { MainTabs } from '@/components/Tabs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

export default async function CounterpartyActivitiesPage({ params, searchParams }: {
  params: { id: string },
  searchParams: { q?: string; from?: string; to?: string; past?: string }
}) {
  const s = createSupabaseServer()

  const { data: cp } = await s.from('counterparties').select('id, legal_name, nick, logo_url').eq('id', params.id).maybeSingle()
  if (!cp) return null

  const q = (searchParams.q || '').trim()
  const from = (searchParams.from || todayISO())
  const to = (searchParams.to || '')
  const includePast = !!searchParams.past

  // Helper para unir actividades evitando duplicados por id
  async function safeQuery(qb: any) {
    try {
      const { data, error } = await qb
      if (error) return []
      return data || []
    } catch {
      return []
    }
  }

  const selects = `
    activities!inner (
      id, type, status, date, municipality, province, country, lat, lng,
      artists:artists ( id, stage_name, avatar_url )
    )
  `
  // Por rol: promotor
  const viaPromoter = await safeQuery(
    s.from('activity_promoters').select(selects).eq('counterparty_id', params.id)
  )
  // Otros posibles vínculos (si existen tablas)
  const viaZone = await safeQuery(
    s.from('activity_zone_agents').select(selects).eq('counterparty_id', params.id)
  )
  const viaPartners = await safeQuery(
    s.from('activity_partners').select(selects).eq('counterparty_id', params.id)
  )
  const viaLocal = await safeQuery(
    s.from('activity_local_productions').select(selects).eq('counterparty_id', params.id)
  )

  // Aplanar a lista de actividades
  const allActs = ([] as any[]).concat(viaPromoter, viaZone, viaPartners, viaLocal)
    .map((r:any) => r.activities)
    .filter(Boolean)

  // Filtros por fecha/búsqueda
  const filtered = (allActs as any[]).filter((a:any) => {
    const okDate = includePast ? true : (!a.date || a.date >= from)
    const okTo = to ? (!a.date || a.date <= to) : true
    const okQ = q
      ? [a.municipality, a.province, a.country, a.type, a.status].join(' ').toLowerCase().includes(q.toLowerCase())
      : true
    return okDate && okTo && okQ
  })

  // Unicos por id
  const uniqMap = new Map<string, any>()
  for (const a of filtered) uniqMap.set(a.id, a)
  const items = Array.from(uniqMap.values())

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
        <div className="flex items-center gap-3">
          {cp.logo_url
            ? <img src={cp.logo_url!} className="h-10 w-auto object-contain" alt="" />
            : <div className="h-10 w-10 bg-gray-200 rounded" />
          }
          <div>
            <h1 className="text-2xl font-semibold">{cp.nick || cp.legal_name}</h1>
            <div className="text-sm text-gray-600">Actividades vinculadas</div>
          </div>
        </div>
        <Link href="/terceros" className="btn-secondary">Volver</Link>
      </div>

      <MainTabs
        current="actividades"
        items={[
          { key: 'datos', label: 'Datos', href: `/terceros/${cp.id}` },
          { key: 'actividades', label: 'Actividades', href: `/terceros/${cp.id}/actividades` },
        ]}
      />

      <ModuleCard title="Mapa">
        <ActivitiesMap points={points} />
      </ModuleCard>

      <ModuleCard title="Actividades">
        <form className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <input type="hidden" name="tab" value="actividades" />
          <div className="md:col-span-2">
            <input name="q" defaultValue={q} placeholder="Buscar…" className="w-full border rounded px-3 py-2" />
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
            {!includePast
              ? <Link className="btn-secondary" href={{ pathname: `/terceros/${cp.id}/actividades`, query: { ...searchParams, past: '1' } }}>Ver pasadas</Link>
              : <Link className="btn-secondary" href={{ pathname: `/terceros/${cp.id}/actividades`, query: { ...searchParams, past: undefined } }}>Ver futuras</Link>}
          </div>
        </form>

        <div className="divide-y divide-gray-200">
          {items.map((a:any) => (
            <ActivityListItem key={a.id} a={a as ActivityListModel} url={`/actividades/actividad/${a.id}`} showArtist />
          ))}
          {!items.length && <div className="text-sm text-gray-500">Sin actividades.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
