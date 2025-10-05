// app/(dashboard)/actividades/actividad/[activityId]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { updateActivityBasic } from '@/app/(dashboard)/actividades/actions'
import ViewEditModule from '@/components/ViewEditModule'
import CompanySelect from '@/components/CompanySelect'
import ActivityTicketsBlock from '@/components/ActivityTicketsBlock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string | null; avatar_url: string | null }
type CompanyLite = { id: string; nick: string | null; name: string | null; logo_url: string | null }
type VenueLite = { id: string; name: string | null; address: string | null }

type ActivityFull = {
  id: string
  type: string | null
  status: string | null
  date: string | null
  time: string | null
  municipality: string | null
  province: string | null
  country: string | null
  capacity: number | null
  pay_kind: string | null
  artist: ArtistLite | null
  extra_artists: ArtistLite[]
  company: CompanyLite | null
  venue: VenueLite | null
  lat?: number | null
  lng?: number | null
}

async function getActivity(activityId: string): Promise<ActivityFull | null> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('activities')
    .select(`
      id, type, status, date, time, municipality, province, country,
      capacity, pay_kind, artist_id, company_id, venue_id, lat, lng,
      artist:artists!activities_artist_id_fkey ( id, stage_name, avatar_url ),
      company:group_companies ( id, nick, name, logo_url ),
      venue:venues ( id, name, address )
    `)
    .eq('id', activityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  // artistas adicionales si existe la tabla puente (no siempre está)
  let extra: ArtistLite[] = []
  try {
    const extraRes = await s
      .from('activity_artists')
      .select('artist:artists ( id, stage_name, avatar_url )')
      .eq('activity_id', activityId)
    extra = (extraRes.data || []).map((r: any) => r.artist as ArtistLite).filter(Boolean)
  } catch {
    extra = []
  }

  return {
    id: (data as any).id,
    type: (data as any).type,
    status: (data as any).status,
    date: (data as any).date,
    time: (data as any).time,
    municipality: (data as any).municipality,
    province: (data as any).province,
    country: (data as any).country,
    capacity: (data as any).capacity,
    pay_kind: (data as any).pay_kind,
    artist: (data as any).artist,
    company: (data as any).company,
    venue: (data as any).venue,
    extra_artists: extra,
    lat: (data as any).lat ?? null,
    lng: (data as any).lng ?? null,
  }
}

async function getCompanies(): Promise<CompanyLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('group_companies')
    .select('id, nick, name, logo_url')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as CompanyLite[]
}

async function getVenues(): Promise<VenueLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('venues')
    .select('id, name, address')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as VenueLite[]
}

export default async function ActivityDetailPage({
  params, searchParams,
}: { params: { activityId: string }, searchParams: { saved?: string } }) {
  const [a, companies, venues] = await Promise.all([
    getActivity(params.activityId),
    getCompanies(),
    getVenues(),
  ])
  if (!a) notFound()
  const saved = !!searchParams?.saved

  const titleArtist = a.artist?.stage_name || 'Actividad'
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.artist?.avatar_url
            ? <img src={a.artist.avatar_url!} className="w-10 h-10 rounded-full object-cover border" alt="" />
            : <div className="w-10 h-10 rounded-full bg-gray-200" />
          }
          <div>
            <h1 className="text-2xl font-semibold">{titleArtist}</h1>
            <div className="text-sm text-gray-600">
              {(a.type || 'Actividad')}{a.date ? ` · ${new Date(a.date).toLocaleDateString('es-ES')}` : ''}
            </div>
          </div>
        </div>
        <Link href="/actividades" className="btn-secondary">Volver</Link>
      </div>

      {/* Datos básicos (vista/edición por módulo) */}
      <ModuleCard title="Datos básicos">
        <ViewEditModule
          title="Datos básicos"
          action={updateActivityBasic}
          isEmpty={false}
          childrenView={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <div><span className="text-gray-500">Tipo:</span> {a.type || '—'}</div>
                <div><span className="text-gray-500">Estado:</span> {a.status || '—'}</div>
                <div><span className="text-gray-500">Fecha:</span> {a.date ? new Date(a.date).toLocaleDateString('es-ES') : '—'}</div>
                {a.time && <div><span className="text-gray-500">Hora:</span> {a.time}</div>}
              </div>
              <div>
                <div><span className="text-gray-500">Lugar:</span> {[a.municipality, a.province, a.country].filter(Boolean).join(', ') || '—'}</div>
                {a.venue?.name && <div><span className="text-gray-500">Recinto:</span> {a.venue.name}</div>}
                {a.capacity != null && <div><span className="text-gray-500">Aforo:</span> {a.capacity}</div>}
                {a.pay_kind && <div><span className="text-gray-500">Pago:</span> {a.pay_kind === 'free' ? 'Gratuito' : 'De pago'}</div>}
              </div>
              <div>
                {a.company && (
                  <div className="flex items-center gap-2">
                    {a.company.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.company.logo_url} alt="" className="h-6 w-auto object-contain" />
                    )}
                    <div><span className="text-gray-500">Empresa:</span> {a.company.nick || a.company.name}</div>
                  </div>
                )}
                {!!a.extra_artists.length && (
                  <div className="mt-2">
                    <div className="text-gray-500">Artistas adicionales</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {a.extra_artists.map(ar => (
                        <Link key={ar.id} href={`/artistas/${ar.id}`} className="inline-flex items-center gap-2 text-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ar.avatar_url || '/avatar.png'} className="w-6 h-6 rounded-full object-cover border" alt="" />
                          {ar.stage_name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
          childrenEdit={
            <form action={updateActivityBasic} className="space-y-3">
              <input type="hidden" name="activity_id" value={a.id} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Tipo</label>
                  <select name="type" defaultValue={a.type || 'concert'} className="w-full border rounded px-2 py-1">
                    <option value="concert">Concierto</option>
                    <option value="promo_event">Evento promocional</option>
                    <option value="promo">Promoción</option>
                    <option value="record_invest">Inversión discográfica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Estado</label>
                  <select name="status" defaultValue={a.status || 'draft'} className="w-full border rounded px-2 py-1">
                    <option value="draft">Borrador</option>
                    <option value="reserved">Reserva</option>
                    <option value="confirmed">Confirmado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Fecha</label>
                  <input type="date" name="date" defaultValue={a.date || ''} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Hora</label>
                  <input name="time" defaultValue={a.time || ''} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Municipio</label>
                  <input name="municipality" defaultValue={a.municipality || ''} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Provincia</label>
                  <input name="province" defaultValue={a.province || ''} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm mb-1">País</label>
                  <input name="country" defaultValue={a.country || 'España'} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Empresa del grupo</label>
                  <CompanySelect name="company_id" companies={companies} defaultValue={a.company?.id || null} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Recinto</label>
                  <select name="venue_id" defaultValue={a.venue?.id || ''} className="w-full border rounded px-2 py-1">
                    <option value="">(sin recinto)</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Aforo</label>
                  <input name="capacity" type="number" defaultValue={String(a.capacity ?? '')} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pago</label>
                  <select name="pay_kind" defaultValue={a.pay_kind || 'pay'} className="w-full border rounded px-2 py-1">
                    <option value="pay">De pago</option>
                    <option value="free">Gratuito</option>
                  </select>
                </div>
              </div>
              <div className="sr-only"><button>Guardar</button></div>
            </form>
          }
        />
      </ModuleCard>

      {/* Venta de entradas */}
      <ModuleCard title="Venta de entradas">
        <ActivityTicketsBlock activityId={a.id} pathnameForRevalidate={`/actividades/actividad/${a.id}`} />
      </ModuleCard>

      <SavedToast show={saved} />
    </div>
  )
}
