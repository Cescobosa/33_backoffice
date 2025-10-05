// app/(dashboard)/actividades/actividad/[activityId]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { updateActivityBasic } from '@/app/(dashboard)/actividades/actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function one<T>(x: T | T[] | null | undefined): T | null {
  return (Array.isArray(x) ? (x[0] ?? null) : (x ?? null)) as T | null;
}

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null; logo_url: string | null }
type VenueLite = { id: string; name: string | null; address: string | null; photo_url?: string | null }

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
  company: CompanyLite | null
  venue: VenueLite | null
  artist: ArtistLite | null            // artista principal (FK activities.artist_id)
  extra_artists: ArtistLite[]          // artistas adicionales (tabla intermedia)
}

async function getActivity(activityId: string): Promise<ActivityFull | null> {
  const s = createSupabaseServer()

  // Desambiguamos la relación con alias explícita hacia la FK activities.artist_id
  // y traemos empresa/recinto por conveniencia. (artist_id está en el esquema).  [oai_citation:1‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
  const { data, error } = await s
    .from('activities')
    .select(`
      id, type, status, date, time, municipality, province, country,
      capacity, pay_kind, artist_id, company_id, venue_id,
      artist:artists ( id, stage_name, avatar_url ),
      company:group_companies ( id, name, nick, logo_url ),
      venue:venues ( id, name, photo_url, address, indoor )
    `)
    .eq('id', params.activityId)
    .single()

  if (error) throw new Error(error.message)
  if (!data) return null

  // Artistas adicionales (si existe activity_artists)
  let extra: ArtistLite[] = []
  try {
    const { data: rows } = await s
      .from('activity_artists')
      .select(`
        artists ( id, stage_name, avatar_url )
      `)
      .eq('activity_id', activityId)
    extra = (rows || [])
      .map((r: any) => r.artists)
      .filter(Boolean) as ArtistLite[]
  } catch {
    extra = []
  }

  return {
    id: data.id,
    type: data.type,
    status: data.status,
    date: data.date,
    time: data.time,
    municipality: data.municipality,
    province: data.province,
    country: data.country,
    capacity: data.capacity,
    pay_kind: data.pay_kind,
    company: one<CompanyLite>((data as any).company),
    venue: one<VenueLite>((data as any).venue),
    artist: one<ArtistLite>((data as any).artist),
    extra_artists: extra,
  }
}

async function getSelects() {
  const s = createSupabaseServer()
  const [{ data: companies }, { data: venues }] = await Promise.all([
    s.from('group_companies').select('id,name,logo_url').order('name'),
    s.from('venues').select('id,name,address').order('name'),
  ])
  return {
    companies: (companies || []) as CompanyLite[],
    venues: (venues || []) as VenueLite[],
  }
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams: { saved?: string }
}) {
  const a = await getActivity(params.activityId)
  if (!a) notFound()
  const { companies, venues } = await getSelects()
  const saved = searchParams.saved === '1'

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {a.type || 'Actividad'} · {a.date ? new Date(a.date).toLocaleDateString() : '(sin fecha)'}
          </h1>
          <div className="text-sm text-gray-600">
            {a.artist && (
              <span className="inline-flex items-center gap-2">
                <img
                  src={a.artist.avatar_url || '/avatar.png'}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border"
                />
                <Link href={`/artistas/${a.artist.id}`} className="underline">{a.artist.stage_name}</Link>
              </span>
            )}
            {a.municipality && <> · {a.municipality}</>}
            {a.province && <> ({a.province})</>}
            {a.country && <> · {a.country}</>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href="/actividades">Volver</Link>
        </div>
      </div>

      {/* Datos básicos (vista + edición por formulario) */}
      <ModuleCard title="Datos básicos" leftActions={<span className="badge">Editar</span>}>
        <form action={updateActivityBasicAction} method="post" className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="hidden" name="id" value={a.id} />
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" defaultValue={a.type || 'concert'} className="w-full border rounded px-2 py-1">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_investment">Inversión discográfica</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" defaultValue={a.status || 'draft'} className="w-full border rounded px-2 py-1">
              <option value="draft">Borrador</option>
              <option value="hold">Reserva</option>
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
            <select name="company_id" defaultValue={a.company?.id || ''} className="w-full border rounded px-2 py-1">
              <option value="">(sin empresa)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Recinto</label>
            <select name="venue_id" defaultValue={a.venue?.id || ''} className="w-full border rounded px-2 py-1">
              <option value="">(sin recinto)</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Aforo</label>
            <input name="capacity" type="number" defaultValue={a.capacity ?? ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Pago</label>
            <select name="pay_kind" defaultValue={a.pay_kind || 'pay'} className="w-full border rounded px-2 py-1">
              <option value="pay">De pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button className="btn">Guardar cambios</button>
          </div>
        </form>
        {/* Artistas adicionales (sólo vista) */}
        {a.extra_artists.length > 0 && (
          <div className="mt-4 text-sm text-gray-700">
            <div className="font-medium mb-1">Artistas adicionales</div>
            <div className="flex flex-wrap gap-3">
              {a.extra_artists.map((ar) => (
                <Link key={ar.id} href={`/artistas/${ar.id}`} className="inline-flex items-center gap-2 underline">
                  <img src={ar.avatar_url || '/avatar.png'} className="w-6 h-6 rounded-full object-cover border" alt="" />
                  {ar.stage_name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </ModuleCard>

      <SavedToast show={saved} />
    </div>
  )
}
