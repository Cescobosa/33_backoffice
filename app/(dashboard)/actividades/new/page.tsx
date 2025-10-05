'use client'

/**
 * Alta de actividad
 * - Pide artista principal (obligatorio) con foto y nombre artístico en el selector
 * - Permite seleccionar artistas adicionales (multi) → se intenta crear en activity_artists si existe
 * - Incluye "Evento promocional" en tipos
 * - No pide latitud/longitud
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
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
  const { data, error } = await s.from('group_companies').select('id, name, nick, logo_url').order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as CompanyLite[]
}

export default async function NewActivityPage({ searchParams }: { searchParams: { saved?: string } }) {
  const [artists, companies] = await Promise.all([getArtists(), getCompanies()])
  const saved = searchParams.saved === '1'

  // ---------- Server Action ----------
  async function createActivity(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const artist_ids = (formData.getAll('artist_ids') as string[]).filter(Boolean)
    if (!artist_ids.length) throw new Error('Debes seleccionar al menos un artista')
    const artist_id = artist_ids[0] // principal

    const type = String(formData.get('type') || 'concert')
    const status = String(formData.get('status') || 'draft')
    const date = String(formData.get('date') || '') || null
    const time = String(formData.get('time') || '') || null
    const municipality = String(formData.get('municipality') || '') || null
    const province = String(formData.get('province') || '') || null
    const country = String(formData.get('country') || 'España')
    const capacity = formData.get('capacity') ? Number(formData.get('capacity')) : null
    const pay_kind = String(formData.get('pay_kind') || 'pay')
    const company_id = String(formData.get('company_id') || '') || null
    const venue_id = String(formData.get('venue_id') || '') || null

    // Inserta actividad (usa columnas reales de la tabla).  [oai_citation:4‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
    const ins = await s
      .from('activities')
      .insert({
        artist_id,
        type,
        status,
        date,
        time,
        municipality,
        province,
        country,
        capacity,
        pay_kind,
        company_id,
        venue_id,
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(ins.error.message)

    const activityId = ins.data.id as string

    // Vincula artistas adicionales si hay tabla activity_artists
    const extra = artist_ids.slice(1)
    if (extra.length) {
      try {
        await s.from('activity_artists').insert(extra.map((aid) => ({ activity_id: activityId, artist_id: aid })))
      } catch (_e) {
        // Si la tabla no existe en esta instancia, ignoramos silenciosamente
      }
    }

    revalidatePath('/actividades')
    redirect(`/actividades/actividad/${activityId}?saved=1`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nueva actividad</h1>
        <Link href="/actividades" className="btn-secondary">
          Cancelar
        </Link>
      </div>

      <ModuleCard title="Datos básicos">
        <form action={createActivity} method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ARTISTAS */}
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Artistas (selecciona uno o varios)</label>
            <div className="border rounded p-2">
              <div className="text-xs text-gray-500 mb-2">El primero será el artista principal.</div>
              <div className="max-h-64 overflow-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {artists.map((ar) => (
                  <label key={ar.id} className="flex items-center gap-2 border rounded px-2 py-1">
                    {ar.avatar_url ? (
                      <img src={ar.avatar_url} className="w-6 h-6 rounded-full object-cover border" alt="" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-gray-200 border" />
                    )}
                    <input type="checkbox" name="artist_ids" value={ar.id} className="mr-1" />
                    <span className="text-sm">{ar.stage_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* TIPO / ESTADO */}
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="type" defaultValue="concert" className="w-full border rounded px-3 py-2">
              <option value="concert">Concierto</option>
              <option value="promotional_event">Evento promocional</option>
              <option value="promotion">Promoción</option>
              <option value="record_investment">Inversión discográfica</option>
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

          {/* FECHA / HORA */}
          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input name="time" className="w-full border rounded px-3 py-2" />
          </div>

          {/* LUGAR */}
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
            <label className="block text-sm mb-1">Aforo</label>
            <input type="number" name="capacity" className="w-full border rounded px-3 py-2" />
          </div>

          {/* PAGO */}
          <div>
            <label className="block text-sm mb-1">Pago</label>
            <select name="pay_kind" defaultValue="pay" className="w-full border rounded px-3 py-2">
              <option value="pay">De pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>

          {/* EMPRESA / VENUE */}
          <div>
            <label className="block text-sm mb-1">Empresa del grupo</label>
            <select name="company_id" className="w-full border rounded px-3 py-2">
              <option value="">(sin empresa)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nick || c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Recinto (ID opcional)</label>
            <input name="venue_id" className="w-full border rounded px-3 py-2" />
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

/**
 * Notas:
 * - No se piden lat/lng en el alta, como acordamos.
 * - Almacena un artista principal en `activities.artist_id` y enlaza adicionales (si existen) en `activity_artists`.
 * - La tabla `activities` y columnas usadas están definidas en el esquema adjunto.  [oai_citation:5‡Esquema_relacional_base_de_datos.pdf](file-service://file-JrcwqeeMLaaKQeptLpU6me)
 * - La inclusión de "Evento promocional" responde a tu solicitud.  [oai_citation:6‡Hitorico de peticiones.pdf](file-service://file-L4RW6tcCtjj6KKhJk8yL5L)
 */
