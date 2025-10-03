// app/(dashboard)/actividades/actividad/[activityId]/page.tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import ActivityTicketsBlock from '@/components/ActivityTicketsBlock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; nick: string | null; name: string | null; logo_url: string | null }

type ActivityRow = {
  id: string
  type: string | null
  status: 'draft'|'reserved'|'confirmed'|string | null
  date: string | null
  time: string | null
  municipality: string | null
  province: string | null
  country: string | null
  capacity: number | null
  artist_id: string
  company_id: string | null
  artists?: ArtistLite[] | ArtistLite | null
  group_companies?: CompanyLite[] | CompanyLite | null
}

function one<T>(x: T | T[] | null | undefined): T | null { return Array.isArray(x) ? (x[0] ?? null) : (x ?? null) }
function badgeByStatus(s?: string | null) {
  if (!s) return null
  if (s === 'confirmed') return <span className="badge badge-green">Confirmado</span>
  if (s === 'reserved') return <span className="badge badge-yellow">Reserva</span>
  if (s === 'draft') return <span className="badge badge-yellow">Borrador</span>
  return <span className="badge">{s}</span>
}

async function getActivityFull(id: string): Promise<{ a: ActivityRow; artist: ArtistLite | null; company: CompanyLite | null }> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('activities')
    .select(`
      id, type, status, date, time, municipality, province, country, capacity,
      artist_id, company_id,
      artists ( id, stage_name, avatar_url ),
      group_companies ( id, nick, name, logo_url )
    `)
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  const a = data as unknown as ActivityRow
  const artist = one<ArtistLite>(a.artists ?? null)
  const company = one<CompanyLite>(a.group_companies ?? null)
  return { a, artist, company }
}

async function getCompanies(): Promise<CompanyLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s.from('group_companies').select('id, name, nick, logo_url').order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as CompanyLite[]
}

export default async function ActivityDetail({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams: { tab?: string; mode?: string; saved?: string }
}) {
  const id = params.activityId
  const tab = searchParams.tab || 'datos'
  const isEdit = searchParams.mode === 'edit'
  const saved = searchParams.saved === '1'

  const { a, artist, company } = await getActivityFull(id)
  if (!a) notFound()

  // ===== Actions (server) =====
  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const patch = {
      type: String(formData.get('type') || a.type || 'concert'),
      status: String(formData.get('status') || a.status || 'draft') as any,
      date: String(formData.get('date') || a.date || '') || null,
      time: String(formData.get('time') || a.time || '') || null,
      municipality: String(formData.get('municipality') || a.municipality || '').trim() || null,
      province: String(formData.get('province') || a.province || '').trim() || null,
      country: String(formData.get('country') || a.country || 'España').trim() || 'España',
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      company_id: formData.get('company_id') ? String(formData.get('company_id')) : null,
    }
    const { error } = await s.from('activities').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${id}`)
    redirect(`/actividades/actividad/${id}?tab=datos&saved=1`)
  }

  const companies = await getCompanies()

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {artist?.avatar_url
            ? <img src={artist.avatar_url} className="w-10 h-10 rounded-full object-cover border" alt="" />
            : <div className="w-10 h-10 rounded-full bg-gray-200" />}
          <div>
            <div className="text-2xl font-semibold">{artist?.stage_name || 'Actividad'}</div>
            <div className="text-sm text-gray-600">
              {a.type || 'Actividad'} · {a.municipality || ''}{a.province ? `, ${a.province}` : ''}{a.country ? `, ${a.country}` : ''}
              {a.date ? ` · ${new Date(a.date).toLocaleDateString('es-ES')}` : ''}
              {badgeByStatus(a.status)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEdit ? (
            <Link className="btn" href={{ pathname: `/actividades/actividad/${a.id}`, query: { tab, mode: 'edit' } }}>Editar ficha</Link>
          ) : (
            <Link className="btn-secondary" href={{ pathname: `/actividades/actividad/${a.id}`, query: { tab } }}>Terminar edición</Link>
          )}
          <Link className="btn-secondary" href="/actividades">Volver</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Link
          href={{ pathname: `/actividades/actividad/${a.id}`, query: { tab: 'datos', mode: isEdit ? 'edit' : undefined } }}
          className={`px-3 py-2 rounded-md ${tab === 'datos' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
          Datos básicos
        </Link>
        <Link
          href={{ pathname: `/actividades/actividad/${a.id}`, query: { tab: 'entradas', mode: isEdit ? 'edit' : undefined } }}
          className={`px-3 py-2 rounded-md ${tab === 'entradas' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
          Entradas
        </Link>
      </div>

      {/* Contenido por pestaña */}
      {tab === 'datos' && (
        <ModuleCard title="Datos básicos" leftActions={<span className="badge">{isEdit ? 'Editar' : 'Ver'}</span>}>
          {!isEdit ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Artista</div>
                <div className="font-medium">{artist?.stage_name}</div>
              </div>
              <div>
                <div className="text-gray-500">Empresa del grupo</div>
                <div className="flex items-center gap-2">
                  {company?.logo_url && <img src={company.logo_url} className="h-6 object-contain" alt="" />}
                  <div>{company?.nick || company?.name || '(sin asignar)'}</div>
                </div>
              </div>
              <div>
                <div className="text-gray-500">Tipo</div>
                <div className="font-medium">{a.type}</div>
              </div>
              <div>
                <div className="text-gray-500">Estado</div>
                <div className="font-medium">{badgeByStatus(a.status)}</div>
              </div>
              <div><div className="text-gray-500">Fecha</div><div>{a.date ? new Date(a.date).toLocaleDateString('es-ES') : '-'}</div></div>
              <div><div className="text-gray-500">Hora</div><div>{a.time || '-'}</div></div>
              <div><div className="text-gray-500">Municipio</div><div>{a.municipality || '-'}</div></div>
              <div><div className="text-gray-500">Provincia</div><div>{a.province || '-'}</div></div>
              <div><div className="text-gray-500">País</div><div>{a.country || '-'}</div></div>
              <div><div className="text-gray-500">Aforo</div><div>{a.capacity ?? '-'}</div></div>
            </div>
          ) : (
            <form action={saveBasics} method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Tipo</label>
                <select name="type" defaultValue={a.type || 'concert'} className="w-full border rounded px-3 py-2">
                  <option value="concert">Concierto</option>
                  <option value="promotional_event">Evento promocional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Estado</label>
                <select name="status" defaultValue={a.status || 'draft'} className="w-full border rounded px-3 py-2">
                  <option value="draft">Borrador</option>
                  <option value="reserved">Reserva</option>
                  <option value="confirmed">Confirmado</option>
                </select>
              </div>
              <div><label className="block text-sm mb-1">Fecha</label><input type="date" name="date" defaultValue={a.date ?? ''} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Hora</label><input name="time" defaultValue={a.time ?? ''} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Municipio</label><input name="municipality" defaultValue={a.municipality ?? ''} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Provincia</label><input name="province" defaultValue={a.province ?? ''} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">País</label><input name="country" defaultValue={a.country ?? 'España'} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Aforo</label><input name="capacity" type="number" defaultValue={a.capacity ?? ''} className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Empresa del grupo</label>
                <select name="company_id" defaultValue={a.company_id ?? ''} className="w-full border rounded px-3 py-2">
                  <option value="">(sin asignar)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.nick || c.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><button className="btn">Guardar cambios</button></div>
            </form>
          )}
        </ModuleCard>
      )}

      {tab === 'entradas' && (
        <ModuleCard title="Venta de entradas">
          <ActivityTicketsBlock activityId={a.id} pathnameForRevalidate={`/actividades/actividad/${a.id}?tab=entradas`} />
        </ModuleCard>
      )}

      <SavedToast show={saved} />
    </div>
  )
}
