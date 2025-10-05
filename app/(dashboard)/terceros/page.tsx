// app/(dashboard)/entradas/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type TicketType = { id: string; name: string; quantity: number; invites_quota: number; price_gross: number }
type TicketSetup = {
  has_ticket_sales: boolean
  sgae_pct: number | null
  vat_pct: number | null
  capacity_on_sale: number | null
  announcement_tbc: boolean
  announcement_at: string | null
  onsale_at: string | null
  ticketing_name: string | null
  ticketing_url: string | null
}
type TicketedActivity = {
  id: string
  date: string | null
  municipality: string | null
  province: string | null
  country: string | null
  status: string | null
  type: string | null
  artist: ArtistLite | null
  setup: TicketSetup | null
  types: TicketType[]
}

function like(v?: string) { return v ? `%${v}%` : undefined }

async function getTicketedActivities(params: { q?: string; phase?: 'all'|'tbc'|'onsale'|'upcoming'|'past' }) {
  const s = createSupabaseServer()

  // SELECT con alias de relación explícita y tablas anidadas:
  // - artist: artistas!activities_artist_id_fkey -> artista principal por FK directa en activities
  // - setup: activity_ticket_setup           -> configuración de tickets
  // - types: activity_ticket_types           -> tipos/entradas
  //
  // Esquema (referencia): activities, activity_ticket_setup, activity_ticket_types, artists.  [oai_citation:2‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
  let qb = s.from('activities').select(`
    id, date, municipality, province, country, status, type,
    artist:artists!activities_artist_id_fkey(id,stage_name,avatar_url),
    setup:activity_ticket_setup(
      has_ticket_sales, sgae_pct, vat_pct, capacity_on_sale,
      announcement_tbc, announcement_at, onsale_at,
      ticketing_name, ticketing_url
    ),
    types:activity_ticket_types(id,name,quantity,price_gross,invites_quota)
  `)
  // Mostrar sólo actividades con venta de entradas habilitada
  qb = qb.eq('activity_ticket_setup.has_ticket_sales', true)

  // Búsqueda libre por varios campos del activity
  if (params.q) {
    const l = like(params.q)!
    qb = qb.or([
      `municipality.ilike.${l}`,
      `province.ilike.${l}`,
      `country.ilike.${l}`,
      `type.ilike.${l}`,
      `status.ilike.${l}`
    ].join(','))
  }

  // Filtros de fase (opcionales en esta primera entrega)
  const nowISO = new Date().toISOString().slice(0,10)
  switch (params.phase) {
    case 'past':
      qb = qb.lte('date', nowISO)
      break
    case 'upcoming':
      qb = qb.gt('date', nowISO)
      break
    case 'tbc':
      qb = qb.eq('activity_ticket_setup.announcement_tbc', true)
      break
    case 'onsale':
      qb = qb.not('activity_ticket_setup.onsale_at', 'is', null)
      break
    default:
      // all: no filter
      break
  }

  const { data, error } = await qb.order('date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as unknown as TicketedActivity[]
}

function fmtDate(d?: string | null) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('es-ES') } catch { return d ?? '' }
}

export default async function TicketsPage({ searchParams }: { searchParams: { q?: string; phase?: string } }) {
  const q = searchParams.q || ''
  const phase = (searchParams.phase as any) || 'all'
  const rows = await getTicketedActivities({ q, phase })

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Venta de entradas</h1>
        <form method="get" className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-[320px]"
            name="q"
            placeholder="Buscar por ciudad, provincia, país, tipo, estado…"
            defaultValue={q}
          />
          <select name="phase" defaultValue={phase} className="border rounded px-3 py-2">
            <option value="all">Todas</option>
            <option value="upcoming">Próximas</option>
            <option value="past">Pasadas</option>
            <option value="tbc">Anuncio TBC</option>
            <option value="onsale">Con fecha de salida</option>
          </select>
          <button className="btn">Aplicar</button>
        </form>
      </div>

      <div className="divide-y divide-gray-200">
        {rows.map((a) => {
          const cap = a.setup?.capacity_on_sale ?? 0
          const totalOnSale = (a.types || []).reduce((acc, t) => acc + (t.quantity || 0), 0)
          const totalInv = (a.types || []).reduce((acc, t) => acc + (t.invites_quota || 0), 0)
          const soldPct = cap > 0 ? Math.min(100, Math.round((totalOnSale / cap) * 100)) : 0
          return (
            <div key={a.id} className="py-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {a.artist && (
                      <img
                        src={a.artist.avatar_url || '/avatar.png'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border"
                      />
                    )}
                    <Link href={`/actividades/actividad/${a.id}`} className="font-medium underline">
                      {a.type || 'actividad'} · {fmtDate(a.date)} · {a.municipality}, {a.province}, {a.country}
                    </Link>
                    {a.status && (
                      <span
                        className={
                          'ml-2 px-2 py-0.5 rounded text-xs ' +
                          (a.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : a.status === 'draft' || a.status === 'hold'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800')
                        }
                      >
                        {a.status === 'confirmed' ? 'Confirmado' : a.status === 'draft' ? 'Borrador' : a.status}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600">
                    {cap ? (
                      <>
                        Aforo a la venta: <b>{cap.toLocaleString('es-ES')}</b> · Tipos creados:{' '}
                        {a.types?.length || 0} · Invitaciones: <b>{totalInv}</b>
                      </>
                    ) : (
                      <>Aforo no configurado</>
                    )}
                  </div>
                </div>

                <div className="w-56">
                  <div className="text-xs mb-1">Progreso de configuración</div>
                  <div className="h-2 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full" style={{ width: `${soldPct}%`, background: '#d42842' }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {!rows.length && <div className="text-sm text-gray-500 py-6">No hay actividades con venta de entradas.</div>}
      </div>
    </div>
  )
}
