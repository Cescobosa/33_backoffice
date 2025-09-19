// app/(dashboard)/actividades/new/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function NewActivity({ searchParams }: { searchParams: { artistId?: string } }) {

  async function createActivity(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const artist_id = String(formData.get('artist_id') || '')
    const type = String(formData.get('type') || 'concert')
    const status = String(formData.get('status') || 'draft')
    const date = String(formData.get('date') || '') || null
    const time = String(formData.get('time') || '') || null
    const municipality = String(formData.get('municipality') || '').trim() || null
    const province = String(formData.get('province') || '').trim() || null
    const country = String(formData.get('country') || 'España').trim()
    const capacity = formData.get('capacity') ? Number(formData.get('capacity')) : null
    const pay_kind = String(formData.get('pay_kind') || 'pay')

    const latStr = String(formData.get('lat') || '').trim()
    const lngStr = String(formData.get('lng') || '').trim()
    const lat = latStr ? Number(latStr) : null
    const lng = lngStr ? Number(lngStr) : null

    if (!artist_id || !date) throw new Error('Artista y fecha son obligatorios')

    const { error } = await s.from('activities').insert({
      artist_id, type, status, date, time, municipality, province, country, capacity, pay_kind, lat, lng,
    })
    if (error) throw new Error(error.message)

    revalidatePath('/actividades')
    const back = searchParams.artistId
      ? `/actividades?artistId=${searchParams.artistId}&saved=1`
      : '/actividades?saved=1'
    redirect(back)
  }

  const defaultArtistId = searchParams.artistId || ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link href="/actividades" className="btn-secondary">Cancelar</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <form action={createActivity} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Artista *</label>
            <input name="artist_id" defaultValue={defaultArtistId} className="w-full border rounded px-3 py-2" placeholder="UUID del artista" />
          </div>
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" className="w-full border rounded px-3 py-2" defaultValue="concert">
              <option value="concert">Concierto</option>
              <option value="festival">Festival</option>
              <option value="promo">Promo</option>
              <option value="otro">Otro</option>
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
            <label className="block text-sm mb-1">Fecha *</label>
            <input type="date" name="date" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input type="time" name="time" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Pago/Gratis</label>
            <select name="pay_kind" className="w-full border rounded px-3 py-2" defaultValue="pay">
              <option value="pay">Pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>

          <div><label className="block text-sm mb-1">Ciudad</label><input name="municipality" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Provincia</label><input name="province" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">País</label><input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" /></div>

          <div><label className="block text-sm mb-1">Aforo</label><input type="number" name="capacity" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Latitud (opcional)</label><input name="lat" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Longitud (opcional)</label><input name="lng" className="w-full border rounded px-3 py-2" /></div>

          <div className="md:col-span-3">
            <button className="btn">Guardar actividad</button>
          </div>
        </form>
      </ModuleCard>
    </div>
  )
}
