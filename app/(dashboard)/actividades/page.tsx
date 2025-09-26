import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import ActivityListItem, { ActivityListModel } from '@/components/ActivityListItem'
import AutoSubmitForm from '@/components/AutoSubmitForm'
import SearchSuggest from '@/components/SearchSuggest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

export default async function ActivitiesPage({ searchParams }: {
  searchParams: {
    q?: string; place?: string;
    artists?: string | string[];
    types?: string | string[];
    statuses?: string | string[];
    companies?: string | string[];
    cp?: string | string[]; // terceros (promotor)
    from?: string; to?: string; past?: string
  }
}) {
  const s = createSupabaseServer()

  // ----- leer opciones para filtros -----
  const [artistsOpt, companiesOpt] = await Promise.all([
    s.from('artists').select('id, stage_name, avatar_url, status').order('stage_name', { ascending: true }),
    s.from('group_companies').select('id, nick, name, logo_url').order('name', { ascending: true }),
  ])
  if (artistsOpt.error) throw new Error(artistsOpt.error.message)
  if (companiesOpt.error) throw new Error(companiesOpt.error.message)

  // ----- deserializar filtros de la query -----
  const q = (searchParams.q || '').trim()
  const place = (searchParams.place || '').trim()

  const artistsFilter = ([] as string[]).concat(searchParams.artists || []).flatMap(v => typeof v === 'string' ? [v] : v)
  const typesFilter = ([] as string[]).concat(searchParams.types || []).flatMap(v => typeof v === 'string' ? [v] : v)
  const statusesFilter = ([] as string[]).concat(searchParams.statuses || []).flatMap(v => typeof v === 'string' ? [v] : v)
  const companiesFilter = ([] as string[]).concat(searchParams.companies || []).flatMap(v => typeof v === 'string' ? [v] : v)
  const cpsFilter = ([] as string[]).concat(searchParams.cp || []).flatMap(v => typeof v === 'string' ? [v] : v)

  const from = searchParams.from || todayISO()
  const to = searchParams.to || ''
  const includePast = searchParams.past === '1'

  // Si hay texto de búsqueda, además de sugerencias queremos que
  // filtre por artistas cuyo contenido coincida (search_text)
  let artistIdsByQ: string[] = []
  if (q) {
    const like = `%${q}%`
    const arts = await s.from('artists')
      .select('id')
      .or(`stage_name.ilike.${like},search_text.ilike.${like}`)
    if (!arts.error) artistIdsByQ = (arts.data || []).map(a => a.id)
  }
  const artistIdsFinal = Array.from(new Set([...artistsFilter, ...artistIdsByQ]))

  // ----- consulta principal de actividades -----
  let select = `
    id, type, status, date, municipality, province, country, lat, lng,
    artist_id, company_id,
    artists:artist_id (id, stage_name, avatar_url),
    venues:venue_id (name, address)
  `
  if (cpsFilter.length) {
    // join a activity_promoters sólo si se filtra por tercero
    select += `, activity_promoters!inner(counterparty_id)`
  }

  let qb = s.from('activities').select(select).order('date', { ascending: true })

  if (artistIdsFinal.length) qb = qb.in('artist_id', artistIdsFinal)
  if (typesFilter.length) qb = qb.in('type', typesFilter)
  if (!includePast) qb = qb.gte('date', from)
  if (to) qb = qb.lte('date', to)
  if (place) {
    const like = `%${place}%`
    qb = qb.or([
      `municipality.ilike.${like}`,
      `province.ilike.${like}`,
      `country.ilike.${like}`,
      `venues.name.ilike.${like}`,
      `venues.address.ilike.${like}`,
    ].join(','))
  }
  if (statusesFilter.length) qb = qb.in('status', statusesFilter)
  if (companiesFilter.length) qb = qb.in('company_id', companiesFilter)
  if (cpsFilter.length) qb = qb.in('activity_promoters.counterparty_id', cpsFilter)

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

  const artistList = (artistsOpt.data || []).filter(a => a.status !== 'archived')

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
        {/* Filtros con submit automático */}
        <AutoSubmitForm className="grid grid-cols-1 gap-4">
          {/* Buscador con sugerencias (artistas + terceros) */}
          <div>
            <SearchSuggest initial={q} />
            <div className="text-xs text-gray-500 mt-1">
              La búsqueda también encuentra artistas por cualquier contenido de su ficha. Si hay coincidencias de terceros aparecerán para seleccionarlos.
            </div>
          </div>

          {/* Artistas (multi) */}
          <div>
            <div className="text-sm font-medium mb-1">Artistas</div>
            <div className="grid md:grid-cols-3 gap-2 max-h-48 overflow-auto border rounded p-2">
              {artistList.map((a: any) => (
                <label key={a.id} className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar_url || '/avatar.png'} className="h-6 w-6 rounded-full object-cover border" alt="" />
                  <input type="checkbox" name="artists" value={a.id} defaultChecked={artistsFilter.includes(a.id)} />
                  <span>{a.stage_name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tipos (multi) */}
          <div>
            <div className="text-sm font-medium mb-1">Tipos de evento</div>
            <div className="flex flex-wrap gap-4">
              {[
                { v: 'concert', l: 'Conciertos' },
                { v: 'promo_event', l: 'Eventos promocionales' },
                { v: 'promotion', l: 'Promoción' },
                { v: 'record_invest', l: 'Inversión discográfica' },
              ].map(t => (
                <label key={t.v} className="flex items-center gap-2">
                  <input type="checkbox" name="types" value={t.v} defaultChecked={typesFilter.includes(t.v)} />
                  <span>{t.l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pasadas */}
          <div className="flex items-center gap-2">
            <input type="checkbox" name="past" value="1" defaultChecked={includePast} />
            <span>Incluir pasadas</span>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm mb-1">Desde</div>
              <input type="date" name="from" defaultValue={from} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Hasta</div>
              <input type="date" name="to" defaultValue={to} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Lugar</div>
              <input type="search" name="place" defaultValue={place} placeholder="Municipio, provincia, país o recinto…" className="border rounded px-3 py-2 w-full" />
            </div>
          </div>

          {/* Estado + Empresa (multis) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium mb-1">Estado</div>
              <div className="flex flex-wrap gap-4">
                {[
                  { v: 'draft', l: 'Borrador' },
                  { v: 'hold', l: 'Reserva' },
                  { v: 'confirmed', l: 'Confirmado' },
                  { v: 'cancelled', l: 'Cancelado' },
                ].map(s0 => (
                  <label key={s0.v} className="flex items-center gap-2">
                    <input type="checkbox" name="statuses" value={s0.v} defaultChecked={statusesFilter.includes(s0.v)} />
                    <span>{s0.l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Empresas del grupo</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
                {(companiesOpt.data || []).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.logo_url || '/avatar.png'} className="h-6 w-10 object-contain bg-white border rounded" alt="" />
                    <input type="checkbox" name="companies" value={c.id} defaultChecked={companiesFilter.includes(c.id)} />
                    <span>{c.nick || c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Nota: sin botón Aplicar; auto-submit */}
          <div className="text-xs text-gray-500">Los filtros se aplican automáticamente al cambiar cualquier opción.</div>
        </AutoSubmitForm>
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
          {!items.length && (
            <div className="text-sm text-gray-500 px-2 py-3">
              No se han encontrado resultados.
            </div>
          )}
        </div>
      </ModuleCard>
    </div>
  )
}
