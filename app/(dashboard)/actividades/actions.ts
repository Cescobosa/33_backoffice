'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'

/**
 * Crea una actividad.
 * IMPORTANTE: en la tabla `activities` el campo artist_id es NOT NULL,
 * por eso tomamos el primer artista seleccionado como "principal".
 * (Luego vinculamos el resto -si hay- en activity_artists si existe).
 */
export async function createActivity(formData: FormData) {
  const s = createSupabaseServer()

  // artistas (permite múltiple selección en el formulario)
  const artistIds = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  const artist_id = artistIds[0]
  if (!artist_id) throw new Error('Debes seleccionar al menos un artista')

  // payload básico
  const payload: any = {
    artist_id,
    type: (formData.get('type') as string) || 'concert',
    status: (formData.get('status') as string) || 'draft',
    date: (formData.get('date') as string) || null,
    time: (formData.get('time') as string) || null,
    municipality: (formData.get('municipality') as string) || null,
    province: (formData.get('province') as string) || null,
    country: (formData.get('country') as string) || 'España',
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
    pay_kind: (formData.get('pay_kind') as string) || null,
    company_id: (formData.get('company_id') as string) || null,
    venue_id: (formData.get('venue_id') as string) || null,
    // los guardamos sólo si llegan números (no forces lat/lng en el form)
    lat: formData.get('lat') ? Number(formData.get('lat')) : null,
    lng: formData.get('lng') ? Number(formData.get('lng')) : null,
  }

  // inserción
  const ins = await s.from('activities').insert(payload).select('id').single()
  if (ins.error) throw new Error(ins.error.message)
  const activityId = ins.data.id as string

  // vincular artistas adicionales en tabla puente (si existe en tu BD)
  const extras = artistIds.slice(1)
  if (extras.length) {
    try {
      await s
        .from('activity_artists')
        .insert(extras.map((aid) => ({ activity_id: activityId, artist_id: aid })))
    } catch {
      // si no existe la tabla o no hay RLS para insert, lo ignoramos silenciosamente
    }
  }

  // refrescar listados y redirigir a la ficha
  revalidatePath('/actividades')
  redirect(`/actividades/actividad/${activityId}?saved=1`)
}

/**
 * Actualiza datos básicos de una actividad.
 * El formulario debe incluir un input hidden `activity_id`.
 * También acepta `artist_ids` para refrescar la tabla puente si la utilizas.
 */
export async function updateActivityBasic(formData: FormData) {
  const s = createSupabaseServer()
  const id = String(formData.get('activity_id') || '')
  if (!id) throw new Error('Falta activity_id')

  // construimos payload sin pisar campos con undefined
  const payload: any = {
    type: (formData.get('type') as string) || undefined,
    status: (formData.get('status') as string) || undefined,
    date: (formData.get('date') as string) || undefined,
    time: (formData.get('time') as string) || undefined,
    municipality: (formData.get('municipality') as string) || undefined,
    province: (formData.get('province') as string) || undefined,
    country: (formData.get('country') as string) || undefined,
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : undefined,
    company_id: (formData.get('company_id') as string) || undefined,
    venue_id: (formData.get('venue_id') as string) || undefined,
    // si llegan vacíos explícitos, ponemos null
    lat: formData.get('lat') ? Number(formData.get('lat')) : null,
    lng: formData.get('lng') ? Number(formData.get('lng')) : null,
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])

  const { error } = await s.from('activities').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  // actualizar vínculos múltiples si llegan artist_ids
  const artistIds = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  if (artistIds.length) {
    try {
      // refrescamos tabla puente completa
      await s.from('activity_artists').delete().eq('activity_id', id)
      await s
        .from('activity_artists')
        .insert(artistIds.map((aid) => ({ activity_id: id, artist_id: aid })))
      // y dejamos artist_id principal como el primero (por restricción NOT NULL)
      await s.from('activities').update({ artist_id: artistIds[0] }).eq('id', id)
    } catch {
      // si no existe la tabla puente, lo ignoramos
    }
  }

  revalidatePath(`/actividades/actividad/${id}`)
  revalidatePath('/actividades')
  redirect(`/actividades/actividad/${id}?saved=1`)
}
