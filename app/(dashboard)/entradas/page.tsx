import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function TicketingPage({ searchParams }: {
  searchParams: { q?: string, state?: 'all'|'upcoming'|'onsale'|'past' }
}) {
  const s = createSupabaseServer()
  const state = searchParams.state || 'all'
  const q = (searchParams.q || '').trim()

  let qb = s.from('activities').select(`
    id, artist_id, type, status, date, municipality, province, country, capacity, lat, lng,
    artists(id, stage_name, avatar_url),
    venues(id, name),
    activity_ticket_setup(*)
  `).order('date', { ascending: true })

  qb = qb.eq('activity_ticket_setup.has_ticket_sales', true)
  if (state === 'onsale') qb = qb.gte('activity_ticket_setup.onsale_at', null) // placeholder simple
  if (state === 'upcoming') qb = qb.is('activity_ticket_setup.onsale_at', null)
  if (state === 'past') qb = qb.lte('date', new Date().toISOString().slice(0,10))

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

  // Trae últimos reportes para cada actividad
  const ids = items.map((i:any) => i.id)
  const reports = ids.length
    ? await s.from('activity_ticket_reports')
        .select('activity_id, report_date, totals_sold, totals_net_revenue')
        .in('activity_id', ids)
        .order('report_date', { ascending: false })
  : { data: [] as any[] }
  const lastByActivity = new Map<string, any>()
  for (const r of (reports.data || [])) if (!lastByActivity.has(r.activity_id)) lastByActivity.set(r.activity_id, r)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Venta de entradas</h1>
        <Link href="/venta-entradas?state=onsale" className="btn">Añadir datos de venta</Link>
      </div>

      <ModuleCard title="Filtro">
        <form className="flex items-center gap-2" method="get">
          <input name="q" defaultValue={q} placeholder="Buscar…" className="border rounded px-3 py-2" />
          <select name="state" defaultValue={state as string} className="border rounded px-3 py-2">
            <option value="all">Todas</option>
            <option value="upcoming">Próx. a la venta</option>
            <option value="onsale">En venta</option>
            <option value="past">Pasadas</option>
          </select>
          <button className="btn">Aplicar</button>
        </form>
      </ModuleCard>

      <ModuleCard title="Actividades con venta">
        <div className="divide-y divide-gray-200">
          {items.map((a:any) => {
            const art = Array.isArray(a.artists) ? a.artists[0] : a.artists
            const ven = Array.isArray(a.venues) ? a.venues[0] : a.venues
            const setup = a.activity_ticket_setup?.[0] || a.activity_ticket_setup
            const last = lastByActivity.get(a.id)
            const capacity = setup?.capacity_on_sale ?? a.capacity ?? 0
            const sold = last?.totals_sold ?? 0
            const pct = capacity>0 ? Math.min(100, Math.round(sold/capacity*100)) : 0
            const soldOut = capacity>0 && sold>=capacity

            return (
              <Link key={a.id} href={`/actividades/actividad/${a.id}`} className="block py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                <div className="flex items-center gap-3">
                  {art?.avatar_url
                    ? <img src={art.avatar_url} className="h-8 w-8 rounded-full object-cover border" alt="" />
                    : <div className="h-8 w-8 rounded-full bg-gray-200" />}
                  <div className="flex-1">
                    <div className="font-medium">{art?.stage_name} · {a.type} · {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'}</div>
                    <div className="text-sm text-gray-600">{ven?.name ? `${ven.name} · ` : ''}{[a.municipality, a.province, a.country].filter(Boolean).join(', ')}</div>

                    {/* Barra de progreso */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded bg-red-100 relative overflow-hidden">
                        <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs whitespace-nowrap">{sold}/{capacity}</div>
                    </div>

                    <div className="mt-1 text-xs flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 border rounded">Aforo venta: {capacity}</span>
                      <span className="px-2 py-0.5 border rounded">Vendidas: {sold}</span>
                      {last
                        ? <span className="px-2 py-0.5 border rounded">Últ. act.: {new Date(last.report_date).toLocaleDateString()}</span>
                        : <span className="px-2 py-0.5 border rounded bg-red-50 text-red-700 border-red-200">Sin datos</span>}
                      <span className="px-2 py-0.5 border rounded">Neto: {(last?.totals_net_revenue ?? 0).toFixed(2)}€</span>
                      <span className="px-2 py-0.5 border rounded">
                        {a.date ? `${Math.max(0, Math.ceil((+new Date(a.date) - Date.now())/86400000))} días` : '—'}
                      </span>
                      {soldOut && <span className="px-2 py-0.5 bg-red-600 text-white rounded">SOLD OUT</span>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          {!items.length && <div className="text-sm text-gray-500">Sin actividades en esta vista.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
