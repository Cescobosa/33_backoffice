import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { createActivityAction } from '../_actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string; nick: string | null; logo_url: string | null }
type VenueLite = { id: string; name: string }

async function loadFormData() {
  const s = createSupabaseServer()

  const [{ data: artists }, { data: companies }, { data: venues }] = await Promise.all([
    s.from('artists').select('id, stage_name, avatar_url').order('stage_name', { ascending: true }),
    s.from('group_companies').select('id, name, nick, logo_url').order('name', { ascending: true }),
    s.from('venues').select('id, name').order('name', { ascending: true }),
  ])

  return {
    artists: (artists || []) as ArtistLite[],
    companies: (companies || []) as CompanyLite[],
    venues: (venues || []) as VenueLite[],
  }
}

export default async function NewActivityPage() {
  const { artists, companies, venues } = await loadFormData()

  if (!artists) notFound()

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link className="btn-secondary" href="/actividades">Volver</Link>
      </div>

      <form action={createActivityAction} method="post" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1 */}
        <div className="space-y-4">
          <div>
            <div className="font-medium mb-2 text-[#008aa4]">Artistas</div>
            <div className="border rounded p-3 max-h-72 overflow-auto">
              {artists.map(a => (
                <label key={a.id} className="flex items-center gap-3 py-1">
                  <input type="checkbox" name="artist_ids" value={a.id} />
                  <img src={a.avatar_url || '/avatar.png'} className="w-8 h-8 rounded-full object-cover border" alt="" />
                  <span>{a.stage_name}</span>
                </label>
              ))}
              {!artists.length && <div className="text-sm text-gray-500">No hay artistas.</div>}
            </div>
            <div className="text-xs text-gray-500 mt-1">Puedes marcar varios; el primero será el principal.</div>
          </div>

          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" className="w-full border rounded px-3 py-2" defaultValue="concert">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_invest">Inversión discográfica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" className="w-full border rounded px-3 py-2" defaultValue="draft">
              <option value="draft">Borrador</option>
              <option value="holding">Reserva</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>
        </div>

        {/* Columna 2 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input name="time" placeholder="hh:mm" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Municipio</label>
              <input name="municipality" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Provincia</label>
              <input name="province" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">País</label>
            <input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        {/* Columna 3 */}
        <div className="space-y-4">
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

          <div>
            <label className="block text-sm mb-1">Recinto</label>
            <select name="venue_id" className="w-full border rounded px-3 py-2">
              <option value="">(sin recinto)</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Aforo</label>
            <input type="number" name="capacity" className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm mb-1">Tipo de evento</label>
            <select name="pay_kind" className="w-full border rounded px-3 py-2" defaultValue="pay">
              <option value="pay">De pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-3">
          <button className="btn">Crear actividad</button>
        </div>
      </form>
    </div>
  )
}
