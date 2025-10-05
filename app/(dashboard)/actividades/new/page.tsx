// app/(dashboard)/actividades/new/page.tsx
import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { createActivity } from '@/app/(dashboard)/actividades/actions'
import CompanySelect from '@/components/CompanySelect'
import GroupRequired from '@/components/GroupRequired'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ==== Tipos ligeros para selects ====
type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null; logo_url: string | null }
type VenueLite = { id: string; name: string | null; address: string | null }

// ==== Cargas para los selects ====
async function getArtists(): Promise<ArtistLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('artists')
    .select('id, stage_name, avatar_url, status')
    .order('stage_name', { ascending: true })
  if (error) throw new Error(error.message)
  // Sólo activos al crear una actividad
  return (data || []).filter((a: any) => a.status !== 'archived').map((a: any) => ({
    id: a.id, stage_name: a.stage_name, avatar_url: a.avatar_url,
  }))
}

async function getCompanies(): Promise<CompanyLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('group_companies')
    .select('id, name, logo_url')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as CompanyLite[]
}

async function getVenues(): Promise<VenueLite[]> {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('venues')
    .select('id, name, address')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as VenueLite[]
}

export default async function NewActivityPage() {
  const [artists, companies, venues] = await Promise.all([getArtists(), getCompanies(), getVenues()])

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">+ Nueva actividad</h1>
          <p className="text-sm text-gray-600">
            Rellena los datos básicos y selecciona el/los artista(s).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/actividades" className="btn-secondary">Cancelar</Link>
        </div>
      </div>

      <ModuleCard title="Datos básicos" leftActions={<span className="badge">Crear</span>}>
        <form action={createActivity} method="post" className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Artistas (multi selección) */}
          <div className="md:col-span-3">
            <label className="block text-sm mb-2">Artistas</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {artists.map((a, idx) => (
                <label key={a.id} className="flex items-center gap-2 border rounded px-3 py-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    name="artist_ids"
                    value={a.id}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.avatar_url || '/avatar.png'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border"
                  />
                  <span className="truncate">{a.stage_name}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Puedes vincular varios artistas a la actividad.
            </p>
            {/* Validación: al menos un artista */}
            <GroupRequired groupName="artist_ids" />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" defaultValue="concert" className="w-full border rounded px-2 py-1">
              <option value="concert">Concierto</option>
              <option value="promo_event">Evento promocional</option>
              <option value="promo">Promoción</option>
              <option value="record_invest">Inversión discográfica</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" defaultValue="draft" className="w-full border rounded px-2 py-1">
              <option value="draft">Borrador</option>
              <option value="reserved">Reserva</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" className="w-full border rounded px-2 py-1" />
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input name="time" className="w-full border rounded px-2 py-1" placeholder="20:00" />
          </div>

          {/* Municipio */}
          <div>
            <label className="block text-sm mb-1">Municipio</label>
            <input name="municipality" className="w-full border rounded px-2 py-1" />
          </div>

          {/* Provincia */}
          <div>
            <label className="block text-sm mb-1">Provincia</label>
            <input name="province" className="w-full border rounded px-2 py-1" />
          </div>

          {/* País */}
          <div>
            <label className="block text-sm mb-1">País</label>
            <input name="country" defaultValue="España" className="w-full border rounded px-2 py-1" />
          </div>

          {/* Empresa del grupo */}
          <div>
            <label className="block text-sm mb-1">Empresa del grupo</label>
            <CompanySelect name="company_id" companies={companies} defaultValue={null} />
          </div>

          {/* Recinto */}
          <div>
            <label className="block text-sm mb-1">Recinto</label>
            <select name="venue_id" defaultValue="" className="w-full border rounded px-2 py-1">
              <option value="">(sin recinto)</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Aforo */}
          <div>
            <label className="block text-sm mb-1">Aforo</label>
            <input type="number" name="capacity" className="w-full border rounded px-2 py-1" />
          </div>

          {/* Pago */}
          <div>
            <label className="block text-sm mb-1">Pago</label>
            <select name="pay_kind" defaultValue="pay" className="w-full border rounded px-2 py-1">
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
