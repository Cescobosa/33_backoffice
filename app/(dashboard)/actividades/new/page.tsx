// app/(dashboard)/actividades/new/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ArtistMultiSelect from '@/components/ArtistMultiSelect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null; nick: string | null; logo_url: string | null }

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'concert', label: 'Concierto' },
  { value: 'promotional_event', label: 'Evento promocional' }, // añadido
]

async function getFormData() {
  const s = createSupabaseServer()
  const { data: artists } = await s.from('artists')
    .select('id, stage_name, avatar_url')
    .eq('status', 'active')
    .order('stage_name', { ascending: true })

  const { data: companies } = await s.from('group_companies')
    .select('id, name, nick, logo_url')
    .order('name', { ascending: true })

  return {
    artists: (artists || []) as ArtistLite[],
    companies: (companies || []) as CompanyLite[],
  }
}

export default async function NewActivityPage() {
  const { artists, companies } = await getFormData()

  async function createActivity(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    // Artistas (multi): el primero será el "principal"
    const artistIds = formData.getAll('artist_ids').map(String).filter(Boolean)
    if (artistIds.length === 0) throw new Error('Selecciona al menos un artista')
    const mainArtistId = artistIds[0]

    const type = String(formData.get('type') || 'concert')
    const status = String(formData.get('status') || 'draft')
    const company_id = formData.get('company_id') ? String(formData.get('company_id')) : null
    const date = String(formData.get('date') || '') || null
    const municipality = String(formData.get('municipality') || '').trim() || null
    const province = String(formData.get('province') || '').trim() || null
    const country = String(formData.get('country') || 'España').trim() || 'España'

    // OJO: NO pedimos lat/lng en el formulario (aunque existen en BD).  [oai_citation:3‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
    const ins = await s.from('activities').insert({
      artist_id: mainArtistId,
      type, status, company_id, date, municipality, province, country,
    }).select('id').single()
    if (ins.error) throw new Error(ins.error.message)
    const activityId = ins.data.id as string

    // Si hay co‑artistas, los guardamos en tabla de enlaces (multi‑artista)
    const rest = artistIds.slice(1)
    if (rest.length) {
      await s.from('activity_artists').insert(rest.map(aid => ({ activity_id: activityId, artist_id: aid })))
    }

    revalidatePath('/actividades')
    revalidatePath(`/actividades/actividad/${activityId}`)
    redirect(`/actividades/actividad/${activityId}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link href="/actividades" className="btn-secondary">Volver</Link>
      </div>

      <form action={createActivity} method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Artistas (multi) */}
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Artista(s)</label>
          <ArtistMultiSelect options={artists} name="artist_ids" />
          <div className="text-xs text-gray-500 mt-1">Puedes seleccionar uno o varios artistas.</div>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm mb-1">Tipo de actividad</label>
          <select name="type" className="w-full border rounded px-3 py-2" defaultValue="concert">
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm mb-1">Estado</label>
          <select name="status" className="w-full border rounded px-3 py-2" defaultValue="draft">
            <option value="draft">Borrador</option>
            <option value="reserved">Reserva</option>
            <option value="confirmed">Confirmado</option>
          </select>
        </div>

        {/* Empresa del grupo */}
        <div>
          <label className="block text-sm mb-1">Empresa del grupo</label>
          <select name="company_id" className="w-full border rounded px-3 py-2" defaultValue="">
            <option value="">(sin asignar)</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.nick || c.name}</option>
            ))}
          </select>
        </div>

        {/* Fecha y localización */}
        <div>
          <label className="block text-sm mb-1">Fecha</label>
          <input type="date" name="date" className="w-full border rounded px-3 py-2" />
        </div>
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
          <input name="country" className="w-full border rounded px-3 py-2" defaultValue="España" />
        </div>

        <div className="md:col-span-2">
          <button className="btn">Crear actividad</button>
        </div>
      </form>
    </div>
  )
}
