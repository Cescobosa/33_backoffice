// app/(dashboard)/actividades/new/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'

/**
 * Crea una actividad básica.
 * - artist_ids: array (el primero será el “principal” para activities.artist_id)
 * - type: 'concert' | 'promo_event' (u otro permitido por tu enum)
 * - date, municipality, province, country, company_id: opcionales
 *
 * NOTA: No se piden lat/lng. Se podrán geocodificar con tu API después.
 */
export async function createActivity(formData: FormData) {
  const s = createSupabaseServer()

  const artistIds = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  if (!artistIds.length) {
    throw new Error('Debes seleccionar al menos un artista')
  }
  const mainArtistId = artistIds[0]

  const rawType = String(formData.get('type') || '').trim()
  // Si tu enum aún no tiene 'promo_event', usa 'concert' por defecto
  const type = rawType || 'concert'

  const date = String(formData.get('date') || '') || null
  const municipality = String(formData.get('municipality') || '').trim() || null
  const province = String(formData.get('province') || '').trim() || null
  const country = String(formData.get('country') || '').trim() || 'España'
  const companyId = String(formData.get('company_id') || '') || null

  // Inserta la actividad básica (status por defecto = 'draft' en el schema)
  const ins = await s
    .from('activities')
    .insert({
      artist_id: mainArtistId,
      type,
      date,
      municipality,
      province,
      country,
      company_id: companyId || null,
    })
    .select('id')
    .single()

  if (ins.error) throw new Error(ins.error.message)
  const activityId = ins.data.id as string

  // Si existe la tabla de relación activity_artists, enlaza artistas adicionales.
  if (artistIds.length > 1) {
    const extra = artistIds.slice(1).map((aid) => ({ activity_id: activityId, artist_id: aid }))
    const { error: linkErr } = await s.from('activity_artists').insert(extra)
    // Si tu base no tiene activity_artists aún, ignoramos el error de relación inexistente.
    if (linkErr && !/relation .* does not exist/i.test(linkErr.message || '')) {
      // Para cualquier otro error, lo lanzamos para enterarnos.
      throw new Error(linkErr.message)
    }
  }

  // Revalida listados y redirige a la ficha recién creada
  revalidatePath('/actividades')
  revalidatePath(`/actividades/actividad/${activityId}`)
  redirect(`/actividades/actividad/${activityId}`)
}
