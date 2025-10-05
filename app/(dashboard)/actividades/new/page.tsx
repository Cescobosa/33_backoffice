// app/(dashboard)/actividades/new/page.tsx
import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { createActivity } from '@/app/(dashboard)/actividades/actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null }
type VenueLite = { id: string; name: string | null }

async function getSelects() {
  const s = createSupabaseServer()
  const [artistsRes, companiesRes, venuesRes] = await Promise.all([
    s.from('artists').select('id,stage_name,avatar_url').order('stage_name', { ascending: true }),
    s.from('group_companies').select('id,name').order('name', { ascending: true }),
    s.from('venues').select('id,name').order('name', { ascending: true }),
  ])
  return {
    artists: (artistsRes.data || []) as ArtistLite[],
    companies: (companiesRes.data || []) as CompanyLite[],
    venues: (venuesRes.data || []) as VenueLite[],
  }
}

export default async function NewActivityPage() {
  const { artists, companies, venues } = await getSelects()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link className="btn-secondary" href="/actividades">Volver</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <form action={createActivityAction} method="post" className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Artistas (multi‑selección)</label>
            <select name="artist_ids" multiple className="w-full border rounded px-2 py-2 h-44">
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.stage_name}</option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">Pulsa Ctrl/Cmd para seleccionar varios.</div>
          </div>

          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" className="w-full border rounded px-2 py-1" defaultValue="concert">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_investment">Inversión discográfica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" className="w-full border rounded px-2 py-1" defaultValue="draft">
              <option value="draft">Borrador</option>
              <option value="hold">Reserva</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input name="time" className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm mb-1">Municipio</label>
            <input name="municipality" className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm mb-1">Provincia</label>
            <input name="province" className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm mb-1">País</label>
            <input name="country" defaultValue="España" className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm mb-1">Empresa del grupo</label>
            <select name="company_id" className="w-full border rounded px-2 py-1">
              <option value="">(sin empresa)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Recinto</label>
            <select name="venue_id" className="w-full border rounded px-2 py-1">
              <option value="">(sin recinto)</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Aforo</label>
            <input name="capacity" type="number" className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm mb-1">Pago</label>
            <select name="pay_kind" className="w-full border rounded px-2 py-1" defaultValue="pay">
              <option value="pay">De pago</option>
              <option value="free">Gratuito</option>
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
