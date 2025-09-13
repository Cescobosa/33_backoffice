import Link from 'next/link'
import { redirect } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Normaliza arrays de joins (por si a futuro añadimos joins aquí)
function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}

function companyLabel(c: any) { return c?.nick || c?.name }

export default async function NewActivity() {
  const s = createSupabaseServer()

  const { data: artists } = await s
    .from('artists')
    .select('id, stage_name')
    .order('stage_name', { ascending: true })

  const { data: companies } = await s
    .from('group_companies')
    .select('id, nick, name, logo_url')
    .order('nick', { ascending: true })

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
    const company_id = String(formData.get('company_id') || '') || null
    const capacity = formData.get('capacity') ? Number(formData.get('capacity')) : null
    const pay_kind = String(formData.get('pay_kind') || 'pay') as any

    if (!artist_id) throw new Error('Debes seleccionar un artista')

    const ins = await s.from('activities')
      .insert({ artist_id, type, status, date, time, municipality, province, country, company_id, capacity, pay_kind })
      .select('id')
      .single()

    if (ins.error) throw new Error(ins.error.message)
    redirect(`/actividades/actividad/${ins.data.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link className="btn-secondary" href="/actividades">Volver</Link>
      </div>

      <ModuleCard title="Datos iniciales">
        <form action={createActivity} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Artista *</label>
            <select name="artist_id" required className="w-full border rounded px-3 py-2" defaultValue="">
              <option value="" disabled>Selecciona artista…</option>
              {(artists || []).map((a: any) => <option key={a.id} value={a.id}>{a.stage_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" className="w-full border rounded px-3 py-2" defaultValue="concert">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_investment">Inversión discográfica</option>
              <option value="custom">Otro</option>
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
          <div><label className="block text-sm mb-1">Fecha</label><input type="date" name="date" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Hora</label><input type="time" name="time" className="w-full border rounded px-3 py-2" /></div>

          <div><label className="block text-sm mb-1">Municipio</label><input name="municipality" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Provincia</label><input name="province" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">País</label><input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" /></div>

          <div>
            <label className="block text-sm mb-1">Empresa del grupo</label>
            <select name="company_id" className="w-full border rounded px-3 py-2" defaultValue="">
              <option value="">(sin empresa)</option>
              {(companies || []).map((c: any) => (
                <option value={c.id} key={c.id}>{companyLabel(c)}</option>
              ))}
            </select>
          </div>
          <div><label className="block text-sm mb-1">Aforo</label><input type="number" name="capacity" className="w-full border rounded px-3 py-2" /></div>
          <div>
            <label className="block text-sm mb-1">Pago/Gratuito</label>
            <select name="pay_kind" className="w-full border rounded px-3 py-2" defaultValue="pay">
              <option value="pay">Pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>

          <div className="md:col-span-3"><button className="btn">Crear actividad</button></div>
        </form>
      </ModuleCard>
    </div>
  )
}
