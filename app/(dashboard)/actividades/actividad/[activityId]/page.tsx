'use client'

/**
 * Página de detalle de actividad (vista + edición básica)
 * - Evita embeds que provocaban "Could not embed because more than one relationship..."
 * - Consultas separadas para artista, compañía y venue
 * - Edición segura con server action `updateBasic`
 * - Sin lat/lng en formularios
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import DateCountdown from '@/components/DateCountdown'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Activity = {
  id: string
  artist_id: string | null
  type: string | null
  status: string | null
  date: string | null
  time: string | null
  municipality: string | null
  province: string | null
  country: string | null
  capacity: number | null
  pay_kind: string | null
  company_id: string | null
  venue_id: string | null
}

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null; nick: string | null; logo_url: string | null }
type VenueLite = { id: string; name: string; photo_url: string | null; address: string | null }

async function getActivity(id: string): Promise<Activity | null> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('activities')
    .select(
      'id, artist_id, type, status, date, time, municipality, province, country, capacity, pay_kind, company_id, venue_id'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Activity) ?? null
}

async function getArtist(id: string | null): Promise<ArtistLite | null> {
  if (!id) return null
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('artists')
    .select('id, stage_name, avatar_url')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ArtistLite) ?? null
}

async function getExtraArtists(activityId: string): Promise<ArtistLite[]> {
  // Si existe una tabla puente activity_artists, intentamos leerla; si no, devolvemos []
  const s = createSupabaseServer()
  try {
    const { data, error } = await s
      .from('activity_artists')
      .select('artist_id')
      .eq('activity_id', activityId)
    if (error) throw error
    const ids = (data || []).map((r: any) => r.artist_id).filter(Boolean)
    if (!ids.length) return []
    const { data: arts } = await s
      .from('artists')
      .select('id, stage_name, avatar_url')
      .in('id', ids)
    return (arts || []) as ArtistLite[]
  } catch (_e) {
    return []
  }
}

async function getCompany(id: string | null): Promise<CompanyLite | null> {
  if (!id) return null
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('group_companies')
    .select('id, name, nick, logo_url')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as CompanyLite) ?? null
}

async function getVenue(id: string | null): Promise<VenueLite | null> {
  if (!id) return null
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('venues')
    .select('id, name, photo_url, address')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as VenueLite) ?? null
}

function fmtDate(d?: string | null) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('es-ES')
  } catch {
    return d
  }
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams: { mode?: string; saved?: string }
}) {
  const a = await getActivity(params.activityId)
  if (!a) notFound()

  const [artist, extraArtists, company, venue] = await Promise.all([
    getArtist(a.artist_id),
    getExtraArtists(a.id),
    getCompany(a.company_id),
    getVenue(a.venue_id),
  ])

  const isEdit = searchParams.mode === 'edit'
  const saved = searchParams.saved === '1'

  // ---------- Server Actions ----------
  async function updateBasic(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const payload: Partial<Activity> = {
      type: String(formData.get('type') || a.type || 'concert'),
      status: String(formData.get('status') || a.status || 'draft'),
      date: String(formData.get('date') || a.date || '') || null,
      time: String(formData.get('time') || a.time || '') || null,
      municipality: String(formData.get('municipality') || a.municipality || '') || null,
      province: String(formData.get('province') || a.province || '') || null,
      country: String(formData.get('country') || a.country || '') || null,
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : (a.capacity ?? null),
      pay_kind: String(formData.get('pay_kind') || a.pay_kind || '') || null,
      company_id: String(formData.get('company_id') || '') || null,
      venue_id: String(formData.get('venue_id') || '') || null,
    }
    const { error } = await s.from('activities').update(payload).eq('id', a.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${a.id}`)
    redirect(`/actividades/actividad/${a.id}?saved=1`)
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {artist?.avatar_url ? (
            <img src={artist.avatar_url} className="w-10 h-10 rounded-full object-cover border" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 border" />
          )}
          <div>
            <div className="text-xl font-semibold">{artist?.stage_name || '(Artista)'}</div>
            <div className="text-sm text-gray-600">
              {a.type || 'concert'} · {a.status || 'draft'} · {fmtDate(a.date)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEdit ? (
            <Link className="btn" href={{ pathname: `/actividades/actividad/${a.id}`, query: { mode: 'edit' } }}>
              Editar
            </Link>
          ) : (
            <Link className="btn-secondary" href={`/actividades/actividad/${a.id}`}>
              Terminar edición
            </Link>
          )}
          <Link className="btn-secondary" href="/actividades">
            Volver
          </Link>
        </div>
      </div>

      {/* Módulo: Información básica */}
      <ModuleCard title="Información básica" leftActions={<span className="badge">{isEdit ? 'Editar' : 'Ver'}</span>}>
        {!isEdit ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Fecha</div>
              <div className="font-medium">{fmtDate(a.date)}</div>
            </div>
            <div>
              <div className="text-gray-500">Hora</div>
              <div className="font-medium">{a.time || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Lugar</div>
              <div className="font-medium">
                {[a.municipality, a.province, a.country].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Tipo</div>
              <div className="font-medium">{a.type || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Estado</div>
              <div className="font-medium">{a.status || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Aforo</div>
              <div className="font-medium">{typeof a.capacity === 'number' ? a.capacity : '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Empresa del grupo</div>
              <div className="flex items-center gap-2">
                {company?.logo_url && <img src={company.logo_url} className="h-6 object-contain" alt="" />}
                <span className="font-medium">{company?.nick || company?.name || '—'}</span>
              </div>
            </div>
            <div>
              <div className="text-gray-500">Recinto</div>
              <div className="font-medium">{venue?.name || '—'}</div>
              {venue?.address && <div className="text-xs text-gray-600">{venue.address}</div>}
            </div>

            {extraArtists.length > 0 && (
              <div className="md:col-span-2">
                <div className="text-gray-500">Artistas vinculados</div>
                <div className="flex flex-wrap gap-3 mt-1">
                  {extraArtists.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-6 h-6 rounded-full object-cover border" alt="" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 border" />
                      )}
                      <span className="text-sm">{p.stage_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form action={updateBasic} method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Fecha</label>
              <input type="date" name="date" defaultValue={a.date ?? undefined} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Hora</label>
              <input name="time" defaultValue={a.time ?? ''} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Municipio</label>
              <input name="municipality" defaultValue={a.municipality ?? ''} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Provincia</label>
              <input name="province" defaultValue={a.province ?? ''} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">País</label>
              <input name="country" defaultValue={a.country ?? 'España'} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Aforo</label>
              <input type="number" name="capacity" defaultValue={a.capacity ?? undefined} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Tipo</label>
              <select name="type" defaultValue={a.type ?? 'concert'} className="w-full border rounded px-3 py-2">
                <option value="concert">Concierto</option>
                <option value="promotional_event">Evento promocional</option>
                <option value="promotion">Promoción</option>
                <option value="record_investment">Inversión discográfica</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Estado</label>
              <select name="status" defaultValue={a.status ?? 'draft'} className="w-full border rounded px-3 py-2">
                <option value="draft">Borrador</option>
                <option value="hold">Reserva</option>
                <option value="confirmed">Confirmado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Pago</label>
              <select name="pay_kind" defaultValue={a.pay_kind ?? 'pay'} className="w-full border rounded px-3 py-2">
                <option value="pay">De pago</option>
                <option value="free">Gratuito</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Empresa del grupo (ID)</label>
              <input name="company_id" defaultValue={a.company_id ?? ''} className="w-full border rounded px-3 py-2" />
              <div className="text-xs text-gray-500 mt-1">* Selección visual se añadirá con un selector enriquecido.</div>
            </div>
            <div>
              <label className="block text-sm mb-1">Recinto (ID)</label>
              <input name="venue_id" defaultValue={a.venue_id ?? ''} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <button className="btn">Guardar</button>
            </div>
          </form>
        )}
      </ModuleCard>

      {/* Acciones rápidas */}
      <ModuleCard title="Acciones">
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/actividades`}>
            Ir al listado
          </Link>
          <Link className="btn-secondary" href={`/actividades/actividad/${a.id}?mode=edit`}>
            Editar todo
          </Link>
          {/* Aquí puedes añadir enlaces a otras pestañas (venta de entradas, bolsa, etc.) */}
        </div>
      </ModuleCard>

      <SavedToast show={saved} />
    </div>
  )
}

/**
 * Notas:
 * - Este archivo no usa embeds (artists(*)) para evitar el error de relaciones múltiples.
 * - La tabla activities y sus columnas existen tal cual en el esquema cargado.  [oai_citation:2‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
 */
