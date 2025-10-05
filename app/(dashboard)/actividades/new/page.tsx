import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null; nick: string | null; logo_url: string | null }

async function getArtists(): Promise<ArtistLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('artists')
    .select('id, stage_name, avatar_url')
    .order('stage_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as ArtistLite[]
}

async function getCompanies(): Promise<CompanyLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s.from('group_companies').select('id, name, nick, logo_url').order('name')
  if (error) throw new Error(error.message)
  return (data || []) as CompanyLite[]
}

async function createActivity(formData: FormData) {
  'use server'
  const s = createSupabaseServer()

  // Artistas (múltiple)
  const artistIds = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  if (!artistIds.length) throw new Error('Debes seleccionar al menos un artista')

  // Por esquema, activities.artist_id es NOT NULL → usamos el primero como "principal"
  const primaryArtistId = artistIds[0] //  [oai_citation:3‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)

  const payload: any = {
    artist_id: primaryArtistId,
    type: String(formData.get('type') || 'concert'),
    status: String(formData.get('status') || 'draft'),
    date: String(formData.get('date') || '') || null,
    time: String(formData.get('time') || '') || null,
    municipality: String(formData.get('municipality') || '').trim() || null,
    province: String(formData.get('province') || '').trim() || null,
    country: String(formData.get('country') || '').trim() || 'España',
    company_id: String(formData.get('company_id') || '') || null,
    venue_id: String(formData.get('venue_id') || '') || null,
    // lat/lng NO se piden ya → no se envían (son opcionales en el esquema)  [oai_citation:4‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
  }

  const ins = await s.from('activities').insert(payload).select('id').single()
  if (ins.error) throw new Error(ins.error.message)
  const activityId = ins.data.id as string

  // Si hay artistas adicionales, los insertamos en la tabla N:N (si existe)
  const extra = artistIds.slice(1)
  if (extra.length) {
    try {
      const rows = extra.map(aid => ({ activity_id: activityId, artist_id: aid }))
      const { error: relErr } = await s.from('activity_artists').insert(rows)
      if (relErr) {
        // Si la tabla no existe o hay conflicto, no bloqueamos la creación.
        console.warn('activity_artists insert warning:', relErr.message)
      }
    } catch { /* noop */ }
  }

  revalidatePath('/actividades')
  redirect(`/actividades/actividad/${activityId}?saved=1`)
}

export default async function NewActivityPage({ searchParams }: { searchParams: { saved?: string } }) {
  const saved = searchParams?.saved === '1'
  const [artists, companies] = await Promise.all([getArtists(), getCompanies()])

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link className="btn-secondary" href="/actividades">Cancelar</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <form action={createActivity} method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Artistas (multi) */}
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Artista(s)</label>
            <select name="artist_ids" multiple className="w-full border rounded px-3 py-2 min-h-[120px]">
              {artists.map(a => (
                <option key={a.id} value={a.id}>
                  {a.stage_name}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">
              Selecciona uno o varios artistas (el primero será el principal).
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" className="w-full border rounded px-3 py-2" defaultValue="concert">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_invest">Inversión discográfica</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" className="w-full border rounded px-3 py-2" defaultValue="draft">
              <option value="draft">Borrador</option>
              <option value="hold">Reserva</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>

          {/* Fecha y hora */}
          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input name="time" placeholder="20:30" className="w-full border rounded px-3 py-2" />
          </div>

          {/* Localización */}
          <div>
            <label className="block text-sm mb-1">Municipio</label>
            <input name="municipality" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Provincia</label>
            <input name="province" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">País</label>
            <input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" />
          </div>

          {/* Empresa del grupo */}
          <div>
            <label className="block text-sm mb-1">Empresa del grupo</label>
            <select name="company_id" className="w-full border rounded px-3 py-2">
              <option value="">(sin empresa)</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nick || c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recinto opcional (si ya lo tenéis) */}
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Recinto (opcional)</label>
            <input name="venue_id" placeholder="ID del recinto existente" className="w-full border rounded px-3 py-2" />
          </div>

          <div className="md:col-span-2">
            <button className="btn">Crear actividad</button>
          </div>
        </form>
      </ModuleCard>

      <SavedToast show={saved} />
    </div>
  )
}
