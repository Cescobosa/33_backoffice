import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import ActivityListItem from '@/components/ActivityListItem'

export const dynamic = 'force-dynamic'

// ===== Tipos auxiliares =====
type ActivityRow = {
  id: string
  type: string | null
  status: string | null
  date: string | null
  municipality: string | null
  province: string | null
  country: string | null
  artist_id: string | null
  company_id: string | null
}

type ArtistLite = {
  id: string
  stage_name: string | null
  avatar_url: string | null
}

type CompanyLite = {
  id: string
  name: string | null
  nick: string | null
  logo_url: string | null
}

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ===== Datos =====
async function getActivitiesAll({
  artistId,
  q,
  type,
  from,
  to,
  past,
}: {
  artistId?: string
  q?: string
  type?: string
  from?: string
  to?: string
  past?: boolean
}): Promise<(ActivityRow & { artist: ArtistLite | null; group_company: CompanyLite | null })[]> {
  const s = createSupabaseServer()

  let qb = s
    .from('activities')
    .select('id, type, status, date, municipality, province, country, artist_id, company_id')
    .order('date', { ascending: !past })
    .order('created_at', { ascending: false })

  if (artistId) qb = qb.eq('artist_id', artistId)
  if (type) qb = qb.eq('type', type)

  if (past) {
    const now = new Date()
    const fromDef = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10)
    qb = qb.lte('date', to || todayISO()).gte('date', from || fromDef)
  } else {
    qb = qb.gte('date', from || todayISO())
    if (to) qb = qb.lte('date', to)
  }

  if (q) {
    const like = `%${q}%`
    qb = qb.or(
      [
        `municipality.ilike.${like}`,
        `province.ilike.${like}`,
        `country.ilike.${like}`,
        `type.ilike.${like}`,
        `status.ilike.${like}`,
      ].join(',')
    )
  }

  const { data: actsRaw, error } = await qb
  if (error) throw new Error(error.message)
  const acts: ActivityRow[] = (actsRaw || []) as ActivityRow[]

  const artistIds = Array.from(new Set(acts.map(a => a.artist_id).filter((x): x is string => !!x)))
  const companyIds = Array.from(new Set(acts.map(a => a.company_id).filter((x): x is string => !!x)))

  const artistsRes =
    artistIds.length
      ? await s.from('artists').select('id, stage_name, avatar_url').in('id', artistIds)
      : ({ data: [] } as { data: ArtistLite[] })

  const companiesRes =
    companyIds.length
      ? await s.from('group_companies').select('id, name, nick, logo_url').in('id', companyIds)
      : ({ data: [] } as { data: CompanyLite[] })

  const byArtist: Record<string, ArtistLite> = Object.fromEntries(
    ((artistsRes.data || []) as ArtistLite[]).map((a: ArtistLite) => [a.id, a] as const)
  )

  const byCompany: Record<string, CompanyLite> = Object.fromEntries(
    ((companiesRes.data || []) as CompanyLite[]).map((c: CompanyLite) => [c.id, c] as const)
  )

  const full = acts.map(a => ({
    ...a,
    artist: a.artist_id ? byArtist[a.artist_id] ?? null : null,
    group_company: a.company_id ? byCompany[a.company_id] ?? null : null,
  }))

  return full
}

async function getTypes(): Promise<string[]> {
  const s = createSupabaseServer()
  const { data } = await s
    .from('activities')
    .select('type')
    .not('type', 'is', null)
    .order('type', { ascending: true })

  const list = Array.from(new Set((data || []).map((x: any) => x.type).filter(Boolean)))
  return list as string[]
}

// ===== Página =====
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: { artistId?: string; q?: string; type?: string; from?: string; to?: string; past?: string }
}) {
  const artistId = searchParams.artistId
  const q = searchParams.q || ''
  const type = searchParams.type || ''
  const past = searchParams.past === '1'
  const from = searchParams.from
  const to = searchParams.to

  const [items, types] = await Promise.all([getActivitiesAll({ artistId, q, type, from, to, past }), getTypes()])

  const mapData: ActivityForMap[] = items.map(a => ({
    id: a.id,
    type: a.type || undefined,
    status: a.status || undefined,
    date: a.date || undefined,
    municipality: a.municipality || undefined,
    province: a.province || undefined,
    country: a.country || undefined,
  }))

  return (
    <div className="space-y-6">
      <ModuleCard
        title={artistId ? 'Actividades del artista' : 'Todas las actividades'}
        leftActions={
          <div className="flex gap-2">
            <Link className="btn" href={artistId ? `/actividades/new?artistId=${artistId}` : '/actividades/new'}>
              + Nueva actividad
            </Link>
            {!artistId && (
              <Link className="btn-secondary" href="/artistas">
                Ver artistas
              </Link>
            )}
          </div>
        }
      >
        {/* Filtros */}
        <form className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4" method="get">
          {artistId && <input type="hidden" name="artistId" value={artistId} />}
          <div className="md:col-span-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por ciudad, tipo, estado…"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <select name="type" defaultValue={type} className="w-full border rounded px-3 py-2">
              <option value="">Todos los tipos</option>
              {types.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
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
            {!past ? (
              <Link className="btn-secondary" href={{ pathname: '/actividades', query: { ...searchParams, past: '1' } }}>
                Ver pasadas
              </Link>
            ) : (
              <Link className="btn-secondary" href={{ pathname: '/actividades', query: { ...searchParams, past: undefined } }}>
                Ver futuras
              </Link>
            )}
            {!past && <span className="text-xs text-gray-500">Mostrando solo futuras por defecto</span>}
          </div>
        </form>

        {/* Mapa */}
        <ActivitiesMap activities={mapData} />

        {/* Listado */}
        <div className="divide-y divide-gray-200 mt-4">
          {items.map(a => (
            <ActivityListItem key={a.id} a={a} showArtist={!artistId} />
          ))}
          {!items.length && <div className="text-sm text-gray-500 py-3">No hay actividades con estos filtros.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
