// app/(dashboard)/venta-de-entradas/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function TicketsIndex({
  searchParams,
}: {
  searchParams: { q?: string; scope?: 'all' | 'upcoming' | 'onsale' | 'notyet' | 'past' }
}) {
  const s = createSupabaseServer()

  const scope = (searchParams.scope || 'upcoming') as 'all' | 'upcoming' | 'onsale' | 'notyet' | 'past'
  const q = (searchParams.q || '').trim()

  // Tomamos como base activity_ticket_setup (has_ticket_sales = true) y unimos activity/artist/venue
  const res = await s
    .from('activity_ticket_setup')
    .select(`
      activity_id, has_ticket_sales, capacity_on_sale, announcement_tbc, announcement_at, onsale_at, ticketing_name, ticketing_url,
      activities (
        id, date, type, status, municipality, province, country,
        artists ( id, stage_name, avatar_url ),
        venues ( id, name )
      )
    `)
    .eq('has_ticket_sales', true)

  if (res.error) {
    return <div className="p-6 text-sm text-red-600">Error: {res.error.message}</div>
  }

  let rows =
    (res.data || []).filter((r: any) => r.activities?.id).map((r: any) => ({ setup: r, act: r.activities }))

  // Búsqueda básica por varios campos
  if (q) {
    const like = q.toLowerCase()
    rows = rows.filter(({ act }) => {
      const hay =
        `${act?.artists?.stage_name || ''} ${act?.venues?.name || ''} ${act?.municipality || ''} ${act?.province || ''} ${act?.country || ''}`
          .toLowerCase()
          .includes(like)
      return hay
    })
  }

  // Filtros de scope
  const now = new Date()
  rows = rows.filter(({ setup, act }) => {
    const d = act?.date ? new Date(act.date) : null
    if (!d) return scope === 'all'

    switch (scope) {
      case 'upcoming':
        return d >= startOfDay(now)
      case 'past':
        return d < startOfDay(now)
      case 'onsale':
        return setup?.onsale_at && new Date(setup.onsale_at) <= now
      case 'notyet':
        return setup?.onsale_at && new Date(setup.onsale_at) > now
      default:
        return true
    }
  })

  // Orden por fecha ascendente
  rows.sort((a, b) => {
    const da = a.act?.date ? new Date(a.act.date).getTime() : 0
    const db = b.act?.date ? new Date(b.act.date).getTime() : 0
    return da - db
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Venta de entradas</h1>
        <div className="flex gap-2">
          <Link
            href={{ pathname: '/venta-de-entradas', query: { scope: 'upcoming', q } }}
            className={`btn-secondary ${scope === 'upcoming' ? '!bg-gray-200' : ''}`}
          >
            Próximos
          </Link>
          <Link
            href={{ pathname: '/venta-de-entradas', query: { scope: 'onsale', q } }}
            className={`btn-secondary ${scope === 'onsale' ? '!bg-gray-200' : ''}`}
          >
            Ya a la venta
          </Link>
          <Link
            href={{ pathname: '/venta-de-entradas', query: { scope: 'notyet', q } }}
            className={`btn-secondary ${scope === 'notyet' ? '!bg-gray-200' : ''}`}
          >
            Próximamente
          </Link>
          <Link
            href={{ pathname: '/venta-de-entradas', query: { scope: 'past', q } }}
            className={`btn-secondary ${scope === 'past' ? '!bg-gray-200' : ''}`}
          >
            Pasados
          </Link>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="scope" value={scope} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por artista, recinto o ciudad…"
          className="border rounded px-3 py-2 w-full md:w-96"
        />
        <button className="btn">Buscar</button>
      </form>

      <div className="divide-y divide-gray-200">
        {rows.map(({ setup, act }) => (
          <Link
            key={act.id}
            href={`/actividades/actividad/${act.id}`}
            className="block py-3 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <img
                src={act.artists?.avatar_url || '/avatar.png'}
                className="w-8 h-8 rounded-full object-cover border"
                alt=""
              />
              <div className="font-medium">{act.artists?.stage_name}</div>
              <div className="text-sm text-gray-600">
                {new Date(act.date).toLocaleDateString()} · {act.venues?.name || ''}{' '}
                {act.municipality ? `· ${act.municipality}` : ''}{' '}
                {act.province ? `· ${act.province}` : ''}{' '}
                {act.country ? `· ${act.country}` : ''}
              </div>
            </div>

            <div className="mt-1 text-xs text-gray-600 flex gap-3">
              <span>Aforo a la venta: {Number(setup.capacity_on_sale ?? 0).toLocaleString('es-ES')}</span>
              {setup.onsale_at ? (
                <span>Salida a la venta: {new Date(setup.onsale_at).toLocaleString()}</span>
              ) : (
                <span className="text-red-600">Sin fecha de salida</span>
              )}
              {setup.ticketing_name && <span>Ticketera: {setup.ticketing_name}</span>}
            </div>
          </Link>
        ))}
        {!rows.length && <div className="py-6 text-sm text-gray-500">No hay eventos para este filtro.</div>}
      </div>
    </div>
  )
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
