import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function NewActivityPage({ searchParams }: { searchParams: { artistId?: string } }) {
  const s = createSupabaseServer()
  const { data: artists } = await s.from('artists').select('id, stage_name').eq('status','active').order('stage_name')
  const { data: companies } = await s.from('group_companies').select('id, nick, name').order('name')

  async function createActivity(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const artist_id = String(formData.get('artist_id') || '')
    const type = String(formData.get('type') || 'concert') as any
    const company_id = String(formData.get('company_id') || '') || null
    const status = String(formData.get('status') || 'draft') as any
    const date = String(formData.get('date') || '') || null
    const municipality = String(formData.get('municipality') || '').trim() || null
    const country = String(formData.get('country') || 'España').trim()
    const { data, error } = await s.from('activities').insert({ artist_id, type, company_id, status, date, municipality, country }).select('id').single()
    if (error) throw new Error(error.message)
    redirect(`/actividades/${data.id}`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nueva actividad</h1>

      <form action={createActivity} className="border rounded p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Artista</label>
          <select name="artist_id" defaultValue={searchParams.artistId || ''} className="w-full border rounded px-3 py-2" required>
            <option value="" disabled>Selecciona artista</option>
            {(artists || []).map(a => <option key={a.id} value={a.id}>{a.stage_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Tipo</label>
          <select name="type" className="w-full border rounded px-3 py-2" defaultValue="concert">
            <option value="concert">Concierto</option>
            <option value="promo_event">Evento promocional</option>
            <option value="promotion">Promoción</option>
            <option value="record_investment">Inversión discográfica</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Empresa del grupo</label>
          <select name="company_id" className="w-full border rounded px-3 py-2">
            <option value="">(sin empresa)</option>
            {(companies || []).map(c => <option key={c.id} value={c.id}>{c.nick || c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Estado</label>
          <select name="status" className="w-full border rounded px-3 py-2" defaultValue="draft">
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
          <label className="block text-sm mb-1">Municipio</label>
          <input name="municipality" className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">País</label>
          <input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" />
        </div>
        <div className="md:col-span-2"><button className="btn">Crear</button></div>
      </form>
    </div>
  )
}
