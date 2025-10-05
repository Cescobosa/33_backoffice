import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import ActivityListItem, { ActivityListModel } from '@/components/ActivityListItem'
import { MainTabs } from '@/components/Tabs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

export default async function CompanyActivitiesPage({ params, searchParams }: {
  params: { id: string },
  searchParams: { q?: string; from?: string; to?: string; past?: string }
}) {
  const s = createSupabaseServer()

  // Datos de la empresa para cabecera
  const { data: company } = await s.from('group_companies').select('id, nick, name, logo_url').eq('id', params.id).maybeSingle()
  if (!company) return null

  const q = (searchParams.q || '').trim()
  const from = (searchParams.from || todayISO())
  const to = (searchParams.to || '')
  const includePast = !!searchParams.past

  // Query base: actividades de la empresa
  let select = `
    id, type, status, date, municipality, province, country, lat, lng,
    artists:artists ( id, stage_name, avatar_url ),
    group_company:group_companies ( id, name, nick, logo_url )
  `
  let qb = s.from('activities').select(select).eq('company_id', params.id).order('date', { ascending: true })

  if (!includePast) qb = qb.gte('date', from)
  if (to) qb = qb.lte('date', to)
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
        <div className="flex items-center gap-3">
          {company.logo_url
            ? <img src={company.logo_url!} className="h-10 w-auto object-contain" alt="" />
            : <div className="h-10 w-10 bg-gray-200 rounded" />
          }
          <div>
            <h1 className="text-2xl font-semibold">{company.nick || company.name}</h1>
            <div className="text-sm text-gray-600">Actividades</div>
          </div>
        </div>
        <Link href="/empresas" className="btn-secondary">Volver</Link>
      </div>

      <MainTabs
        current="actividades"
        items={[
          { key: 'datos', label: 'Datos', href: `/empresas/${company.id}` },
          { key: 'actividades', label: 'Actividades', href: `/empresas/${company.id}/actividades` },
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
              ? <Link className="btn-secondary" href={{ pathname: `/empresas/${company.id}/actividades`, query: { ...searchParams, past: '1' } }}>Ver pasadas</Link>
              : <Link className="btn-secondary" href={{ pathname: `/empresas/${company.id}/actividades`, query: { ...searchParams, past: undefined } }}>Ver futuras</Link>}
          </div>
        </form>

        <div className="divide-y divide-gray-200">
          {items.map((a:any) => (
            <ActivityListItem
              key={a.id}
              a={a as ActivityListModel}
              href={`/actividades/actividad/${a.id}`}
              showArtist
            />
          ))}
          {!items.length && <div className="text-sm text-gray-500">Sin actividades.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
