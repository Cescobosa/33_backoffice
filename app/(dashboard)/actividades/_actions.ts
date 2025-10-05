// app/(dashboard)/actividades/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'

/** Alta de actividad (artista principal = first, resto se vinculan en activity_artists si existe) */
export async function createActivityAction(formData: FormData) {
  const s = createSupabaseServer()

  // Campos básicos
  const type = String(formData.get('type') || 'concert')
  const status = String(formData.get('status') || 'draft')
  const date = String(formData.get('date') || '') || null
  const time = String(formData.get('time') || '') || null
  const municipality = String(formData.get('municipality') || '').trim() || null
  const province = String(formData.get('province') || '').trim() || null
  const country = String(formData.get('country') || '').trim() || 'España'
  const company_id = String(formData.get('company_id') || '') || null
  const venue_id = String(formData.get('venue_id') || '') || null
  const capacity = formData.get('capacity') ? Number(formData.get('capacity')) : null
  const pay_kind = String(formData.get('pay_kind') || 'pay')

  const artist_ids = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  if (!artist_ids.length) throw new Error('Debes seleccionar al menos un artista')

  // Insertamos actividad con el primer artista como principal (FK activities.artist_id)
  const { data: created, error } = await s
    .from('activities')
    .insert({
      artist_id: artist_ids[0],
      type,
      status,
      date,
      time,
      municipality,
      province,
      country,
      company_id,
      venue_id,
      capacity,
      pay_kind,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Vinculaciones multi‑artista (si existe la tabla activity_artists)
  const extra = artist_ids.slice(1)
  if (extra.length) {
    try {
      await s.from('activity_artists').insert(
        extra.map((aid) => ({ activity_id: created.id, artist_id: aid })),
      )
    } catch {
      // Si tu instancia aún no tiene activity_artists, simplemente ignoramos
    }
  }

  revalidatePath('/actividades')
  redirect(`/actividades/actividad/${created.id}?saved=1`)
}

/** Actualiza el bloque básico de una actividad */
export async function updateActivityBasicAction(formData: FormData) {
  const s = createSupabaseServer()

  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Falta id de actividad')

  const payload: any = {
    type: String(formData.get('type') || ''),
    status: String(formData.get('status') || ''),
    date: String(formData.get('date') || '') || null,
    time: String(formData.get('time') || '') || null,
    municipality: String(formData.get('municipality') || '').trim() || null,
    province: String(formData.get('province') || '').trim() || null,
    country: String(formData.get('country') || '').trim() || 'España',
    company_id: String(formData.get('company_id') || '') || null,
    venue_id: String(formData.get('venue_id') || '') || null,
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
    pay_kind: String(formData.get('pay_kind') || 'pay'),
  }

  // Limpiamos claves vacías para no sobreescribir con string vacío
  Object.keys(payload).forEach((k) => {
    if (payload[k] === '') delete payload[k]
  })

  const { error } = await s.from('activities').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath(`/actividades/actividad/${id}`)
}

/** (Opcional) Añadir artistas adicionales a una actividad ya creada */
export async function addExtraArtistsAction(formData: FormData) {
  const s = createSupabaseServer()
  const activity_id = String(formData.get('activity_id') || '')
  const artist_ids = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  if (!activity_id || !artist_ids.length) return

  try {
    await s.from('activity_artists').insert(
      artist_ids.map((aid) => ({ activity_id, artist_id: aid })),
    )
  } catch {
    // si no existe la tabla, no hacemos nada
  }

  revalidatePath(`/actividades/actividad/${activity_id}`)
}
