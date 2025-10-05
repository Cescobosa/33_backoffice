// app/(dashboard)/actividades/new/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { createActivity } from './actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function NewActivityPage() {
  const s = createSupabaseServer()

  // Artistas activos para poder seleccionar varios
  const { data: artists } = await s
    .from('artists')
    .select('id, stage_name, avatar_url, status')
    .order('stage_name', { ascending: true })

  // Empresas del grupo (selector simple)
  const { data: companies } = await s
    .from('group_companies')
    .select('id, nick, name, logo_url')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link href="/actividades" className="btn-secondary">Volver</Link>
      </div>

      <form action={createActivity} className="space-y-6">
        {/* ARTISTAS (multi-selección) */}
        <div className="border rounded p-4">
          <div className="text-[#008aa4] font-semibold mb-3">Artista(s)</div>
          <p className="text-sm text-gray-600 mb-2">
            Selecciona al menos uno. El primero marcado será el principal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(artists || []).map((a) => (
              <label key={a.id} className="border rounded p-2 flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="artist_ids" value={a.id} className="mt-0.5" />
                <img
                  src={a.avatar_url || '/avatar.png'}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border"
                />
                <span>{a.stage_name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* DATOS BÁSICOS */}
        <div className="border rounded p-4">
          <div className="text-[#008aa4] font-semibold mb-3">Datos básicos</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Tipo de actividad</label>
              <select name="type" className="w-full border rounded px-3 py-2">
                <option value="concert">Concierto</option>
                {/* Si tu enum activity_type ya incluye esta opción, podrás usarla directamente */}
                <option value="promo_event">Evento promocional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Fecha</label>
              <input name="date" type="date" className="w-full border rounded px-3 py-2" />
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
              <input name="country" defaultValue="España" className="w-full border rounded px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm mb-1">Empresa del grupo (opcional)</label>
              <select name="company_id" className="w-full border rounded px-3 py-2">
                <option value="">(Sin empresa)</option>
                {(companies || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nick || c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                El logo se mostrará en la ficha. Se usará para facturación más adelante.
              </p>
            </div>
          </div>
        </div>

        {/* GUARDAR */}
        <div className="flex items-center gap-2">
          <button className="btn">Crear actividad</button>
          <Link href="/actividades" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
