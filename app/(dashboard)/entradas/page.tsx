// app/(dashboard)/venta-de-entradas/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type TicketedActivity = {
  id: string
  date: string | null
  municipality: string | null
  province: string | null
  country: string | null
  status: string | null
  type: string | null
  artists: { id: string; stage_name: string | null; avatar_url: string | null } | null
  activity_ticket_setup: {
    has_ticket_sales: boolean
    capacity_on_sale: number | null
    announcement_tbc: boolean
    announcement_at: string | null
    onsale_at: string | null
    ticketing_name: string | null
    ticketing_url: string | null
  } | null
}

async function getTicketedActivities(q?: string) {
  const s = createSupabaseServer()

  // ¡OJO!: desambiguamos artists con !activities_artist_id_fkey
  let qb = s
    .from('activities')
    .select(`
      id, date, municipality, province, country, status, type,
      artists:artists!activities_artist_id_fkey ( id, stage_name, avatar_url ),
      activity_ticket_setup!inner (
        has_ticket_sales, capacity_on_sale, announcement_tbc, announcement_at, onsale_at, ticketing_name, ticketing_url
      )
    `)
    // nos aseguramos de traer solo actividades con venta de entradas
    .eq('activity_ticket_setup.has_ticket_sales', true)
    .order('date', { ascending: true })

  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    qb = qb.or(
      [
        `municipality.ilike.${like}`,
        `province.ilike.${like}`,
        `country.ilike.${like}`,
        `type.ilike.${like}`,
        `status.ilike.${like}`,
        // búsqueda rápida por nombre artístico en el embed (no filtra “server‑side”,
        // pero evita romper la query ambigua)
      ].join(',')
    )
  }

  const { data, error } = await qb
  if (error) throw new Error(error.message)
  return (data || []) as TicketedActivity[]
}

export default async function TicketsPage({ searchParams }: { searchParams: { q?: string } }) {
  const items = await getTicketedActivities(searchParams.q)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Venta de entradas</h1>
        <Link href="/actividades" className="btn-secondary">Volver</Link>
      </div>

      {/* Filtros */}
      <form className="grid grid-cols-1 md:grid-cols-4 gap-2" method="get">
        <input
          name="q"
          defaultValue={searchParams.q || ''}
          placeholder="Buscar por ciudad, provincia, país, tipo, estado…"
          className="md:col-span-3 w-full border rounded px-3 py-2"
        />
        <button className="btn">Aplicar</button>
      </form>

      {/* Listado */}
      <div className="divide-y divide-gray-200">
        {items.map(a => (
          <Link key={a.id} href={`/actividades/actividad/${a.id}`} className="block py-3 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              {/* Foto artista */}
              <img
                src={a.artists?.avatar_url || '/avatar.png'}
                alt=""
                className="w-8 h-8 rounded-full object-cover border"
              />
              <div className="flex-1">
                <div className="font-medium">
                  {a.artists?.stage_name ?? '(sin artista)'}
                </div>
                <div className="text-sm text-gray-600">
                  {a.type} · {a.date ? new Date(a.date).toLocaleDateString() : 'sin fecha'} · {a.municipality}, {a.province}, {a.country}
                </div>
                {a.activity_ticket_setup && (
                  <div className="text-xs mt-1 flex flex-wrap gap-2">
                    {a.activity_ticket_setup.capacity_on_sale != null && (
                      <span className="badge">A la venta: {a.activity_ticket_setup.capacity_on_sale}</span>
                    )}
                    {a.activity_ticket_setup.announcement_tbc
                      ? <span className="badge badge-yellow">Anuncio TBC</span>
                      : (a.activity_ticket_setup.announcement_at
                          ? <span className="badge badge-green">Anuncio {new Date(a.activity_ticket_setup.announcement_at).toLocaleDateString()}</span>
                          : null)}
                    {a.activity_ticket_setup.onsale_at
                      ? <span className="badge badge-green">On sale {new Date(a.activity_ticket_setup.onsale_at).toLocaleString()}</span>
                      : null}
                    {a.activity_ticket_setup.ticketing_name && (
                      <span className="badge">{a.activity_ticket_setup.ticketing_name}</span>
                    )}
                  </div>
                )}
              </div>
              {/* Estado */}
              {a.status === 'confirmed'
                ? <span className="badge badge-green">Confirmado</span>
                : a.status === 'hold'
                  ? <span className="badge badge-yellow">Reserva</span>
                  : <span className="badge badge-yellow">Borrador</span>}
            </div>
          </Link>
        ))}
        {!items.length && (
          <div className="py-6 text-sm text-gray-500">No hay actividades con venta de entradas.</div>
        )}
      </div>
    </div>
  )
}
