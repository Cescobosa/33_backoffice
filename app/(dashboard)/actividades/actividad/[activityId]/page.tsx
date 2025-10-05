import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { updateActivityBasicAction } from '../../_actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string; nick: string | null }
type VenueLite = { id: string; name: string }
type ActivityRow = {
  id: string
  type: string | null
  status: string | null
  date: string | null
  time: string | null
  municipality: string | null
  province: string | null
  country: string | null
  company_id: string | null
  venue_id: string | null
  capacity: number | null
  pay_kind: string | null
  artists?: ArtistLite | null
}

async function getActivityFull(id: string) {
  const s = createSupabaseServer()

  // Join explícito al FK activities.artist_id → artists.id
  const { data: a, error } = await s
    .from('activities')
    .select(`
      id, type, status, date, time, municipality, province, country,
      company_id, venue_id, capacity, pay_kind,
      artists:artists!activities_artist_id_fkey ( id, stage_name, avatar_url )
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return a as ActivityRow
}

async function getSelects() {
  const s = createSupabaseServer()
  const [{ data: companies }, { data: venues }, { data: artists }] = await Promise.all([
    s.from('group_companies').select('id, name, nick').order('name', { ascending: true }),
    s.from('venues').select('id, name').order('name', { ascending: true }),
    s.from('artists').select('id, stage_name, avatar_url').order('stage_name', { ascending: true }),
  ])

  return {
    companies: (companies || []) as CompanyLite[],
    venues: (venues || []) as VenueLite[],
    artists: (artists || []) as ArtistLite[],
  }
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams: { mode?: string; saved?: string }
}) {
  const id = params.activityId
  const isEdit = searchParams.mode === 'edit'

  const [a, selects] = await Promise.all([getActivityFull(id), getSelects()])
  if (!a) notFound()

  const updateAction = updateActivityBasicAction.bind(null, id)

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {a.type || 'actividad'} · {a.date ? new Date(a.date).toLocaleDateString() : '(sin fecha)'}
          </h1>
          <div className="text-sm text-gray-600">
            {a.municipality || ''}{a.municipality && (a.province || a.country) ? ' · ' : ''}
            {a.province || ''}{a.province && a.country ? ' · ' : ''}{a.country || ''}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEdit ? (
            <Link className="btn" href={{ pathname: `/actividades/actividad/${id}`, query: { mode: 'edit' } }}>
              Editar
            </Link>
          ) : (
            <Link className="btn-secondary" href={{ pathname: `/actividades/actividad/${id}` }}>
              Terminar edición
            </Link>
          )}
          <Link className="btn-secondary" href="/actividades">Volver</Link>
        </div>
      </div>

      {/* Módulo: Básicos */}
      <div className="border rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-[#008aa4]">Datos básicos</div>
          <span className="badge">{isEdit ? 'Editar' : 'Ver'}</span>
        </div>

        {!isEdit ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Artista</div>
              <div className="flex items-center gap-2 mt-1">
                <img src={a.artists?.avatar_url || '/avatar.png'} className="w-8 h-8 rounded-full object-cover border" alt="" />
                <span className="font-medium">{a.artists?.stage_name}</span>
              </div>
            </div>
            <div>
              <div className="text-gray-500">Tipo</div>
              <div className="font-medium">{a.type}</div>
            </div>
            <div>
              <div className="text-gray-500">Estado</div>
              <div className="font-medium">{a.status}</div>
            </div>

            <div>
              <div className="text-gray-500">Fecha</div>
              <div className="font-medium">{a.date ? new Date(a.date).toLocaleDateString() : ''}</div>
            </div>
            <div>
              <div className="text-gray-500">Hora</div>
              <div className="font-medium">{a.time || ''}</div>
            </div>
            <div>
              <div className="text-gray-500">Ubicación</div>
              <div className="font-medium">
                {[a.municipality, a.province, a.country].filter(Boolean).join(' · ')}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Empresa del grupo</div>
              <CompanyName companyId={a.company_id} />
            </div>
            <div>
              <div className="text-gray-500">Recinto</div>
              <VenueName venueId={a.venue_id} />
            </div>
            <div>
              <div className="text-gray-500">Aforo</div>
              <div className="font-medium">{a.capacity ?? ''}</div>
            </div>
            <div>
              <div className="text-gray-500">Tipo de evento</div>
              <div className="font-medium">{a.pay_kind === 'free' ? 'Gratuito' : 'De pago'}</div>
            </div>
          </div>
        ) : (
          <form action={updateAction} method="post" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* artistas (N-N) */}
            <div className="md:col-span-3">
              <div className="text-sm mb-1">Artistas (opcional – vínculo N‑N)</div>
              <div className="border rounded p-3 max-h-56 overflow-auto">
                {selects.artists.map(art => (
                  <label key={art.id} className="flex items-center gap-3 py-1">
                    <input type="checkbox" name="artist_ids" value={art.id} />
                    <img src={art.avatar_url || '/avatar.png'} className="w-7 h-7 rounded-full object-cover border" alt="" />
                    <span>{art.stage_name}</span>
                  </label>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">Esto no cambia el artista principal de la cabecera (guardado en la propia actividad).</div>
            </div>

            <div>
              <label className="block text-sm mb-1">Tipo</label>
              <select name="type" defaultValue={a.type || 'concert'} className="w-full border rounded px-2 py-1">
                <option value="concert">Concierto</option>
                <option value="promo_event">Evento promocional</option>
                <option value="promotion">Promoción</option>
                <option value="record_invest">Inversión discográfica</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Estado</label>
              <select name="status" defaultValue={a.status || 'draft'} className="w-full border rounded px-2 py-1">
                <option value="draft">Borrador</option>
                <option value="holding">Reserva</option>
                <option value="confirmed">Confirmado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Fecha</label>
              <input type="date" name="date" defaultValue={a.date ?? ''} className="w-full border rounded px-2 py-1" />
            </div>

            <div>
              <label className="block text-sm mb-1">Hora</label>
              <input name="time" defaultValue={a.time ?? ''} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm mb-1">Municipio</label>
              <input name="municipality" defaultValue={a.municipality ?? ''} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm mb-1">Provincia</label>
              <input name="province" defaultValue={a.province ?? ''} className="w-full border rounded px-2 py-1" />
            </div>

            <div>
              <label className="block text-sm mb-1">País</label>
              <input name="country" defaultValue={a.country ?? 'España'} className="w-full border rounded px-2 py-1" />
            </div>

            <div>
              <label className="block text-sm mb-1">Empresa del grupo</label>
              <select name="company_id" defaultValue={a.company_id || ''} className="w-full border rounded px-2 py-1">
                <option value="">(sin empresa)</option>
                {selects.companies.map(c => (
                  <option key={c.id} value={c.id}>{c.nick || c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Recinto</label>
              <select name="venue_id" defaultValue={a.venue_id || ''} className="w-full border rounded px-2 py-1">
                <option value="">(sin recinto)</option>
                {selects.venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Aforo</label>
              <input type="number" name="capacity" defaultValue={a.capacity ?? ''} className="w-full border rounded px-2 py-1" />
            </div>

            <div>
              <label className="block text-sm mb-1">Tipo de evento</label>
              <select name="pay_kind" defaultValue={a.pay_kind || 'pay'} className="w-full border rounded px-2 py-1">
                <option value="pay">De pago</option>
                <option value="free">Gratuito</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <button className="btn">Guardar cambios</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/** Helpers para mostrar nombres (evitamos overfetch en el select principal) */
async function CompanyName({ companyId }: { companyId: string | null }) {
  if (!companyId) return <div className="font-medium">(sin empresa)</div>
  const s = createSupabaseServer()
  const { data } = await s.from('group_companies').select('name, nick').eq('id', companyId).maybeSingle()
  if (!data) return <div className="font-medium">(sin empresa)</div>
  return <div className="font-medium">{data.nick || data.name}</div>
}

async function VenueName({ venueId }: { venueId: string | null }) {
  if (!venueId) return <div className="font-medium">(sin recinto)</div>
  const s = createSupabaseServer()
  const { data } = await s.from('venues').select('name').eq('id', venueId).maybeSingle()
  if (!data) return <div className="font-medium">(sin recinto)</div>
  return <div className="font-medium">{data.name}</div>
}
