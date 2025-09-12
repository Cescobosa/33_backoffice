import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'

export const dynamic = 'force-dynamic'

async function getPrefill(artistId?: string) {
  const s = createSupabaseServer()
  const { data: artists } = await s.from('artists').select('id, stage_name').order('stage_name')
  const { data: companies } = await s.from('group_companies').select('id, nick, name').order('name')
  const preArtist = artistId ? artists?.find(a => a.id === artistId) : null
  return { artists: artists || [], companies: companies || [], preArtist }
}

export default async function NewActivity({ searchParams }: { searchParams: { artist?: string } }) {
  const { artists, companies, preArtist } = await getPrefill(searchParams.artist)

  async function createActivity(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const artist_id = String(formData.get('artist_id') || '')
    const type = String(formData.get('type') || 'concert') as any
    const status = String(formData.get('status') || 'draft') as any
    const date = String(formData.get('date') || '') || null
    const time = String(formData.get('time') || '') || null
    const municipality = String(formData.get('municipality') || '').trim() || null
    const province = String(formData.get('province') || '').trim() || null
    const country = String(formData.get('country') || 'España').trim()
    const capacity = formData.get('capacity') ? Number(formData.get('capacity')) : null
    const pay_kind = String(formData.get('pay_kind') || 'pay') as any
    const company_id = String(formData.get('company_id') || '') || null

    if (!artist_id) throw new Error('Selecciona un artista')

    const { data, error } = await s
      .from('activities')
      .insert({
        artist_id, type, status, date, time, municipality, province, country, capacity, pay_kind, company_id
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    revalidatePath('/actividades')
    redirect(`/actividades/actividad/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
      </div>

      <ModuleCard title="Datos básicos para crear">
        <form action={createActivity} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Artista *</label>
            <select name="artist_id" defaultValue={preArtist?.id || ''} className="w-full border rounded px-3 py-2" required>
              <option value="">Selecciona artista…</option>
              {artists.map(a => <option key={a.id} value={a.id}>{a.stage_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" defaultValue="concert" className="w-full border rounded px-3 py-2">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_investment">Inversión discográfica</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" defaultValue="draft" className="w-full border rounded px-3 py-2">
              <option value="draft">Borrador</option>
              <option value="hold">Reserva</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input type="time" name="time" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Pago/Gratuito</label>
            <select name="pay_kind" defaultValue="pay" className="w-full border rounded px-3 py-2">
              <option value="pay">Pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>

          <div><label className="block text-sm mb-1">Municipio</label><input name="municipality" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Provincia</label><input name="province" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">País</label><input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" /></div>

          <div><label className="block text-sm mb-1">Aforo</label><input type="number" name="capacity" className="w-full border rounded px-3 py-2" /></div>

          <div>
            <label className="block text-sm mb-1">Empresa del grupo</label>
            <select name="company_id" className="w-full border rounded px-3 py-2" defaultValue="">
              <option value="">(sin empresa)</option>
              {companies.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nick || c.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <button className="btn">Crear actividad</button>
          </div>
        </form>
      </ModuleCard>
    </div>
  )
}
