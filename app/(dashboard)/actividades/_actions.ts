'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'

/** Alta de actividad */
export async function createActivityAction(formData: FormData) {
  const s = createSupabaseServer()

  // Múltiples artistas permitidos (primer artista = principal en activities.artist_id)
  const artist_ids = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  const main_artist_id =
    artist_ids[0] || String(formData.get('artist_id') || '')

  if (!main_artist_id) {
    throw new Error('Debes seleccionar al menos un artista')
  }

  const payload: any = {
    artist_id: main_artist_id,
    type: String(formData.get('type') || 'concert'),
    status: String(formData.get('status') || 'draft'),
    date: String(formData.get('date') || '') || null,
    time: String(formData.get('time') || '').trim() || null,
    municipality: String(formData.get('municipality') || '').trim() || null,
    province: String(formData.get('province') || '').trim() || null,
    country: String(formData.get('country') || '') || 'España',
    company_id: String(formData.get('company_id') || '') || null,
    venue_id: String(formData.get('venue_id') || '') || null,
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
    pay_kind: String(formData.get('pay_kind') || '') || null, // 'pay' | 'free'
    // Importante: NO lat / lng (se eliminaron del alta)
  }
  Object.keys(payload).forEach((k) => {
    if (payload[k] === '') payload[k] = null
  })

  const ins = await s
    .from('activities')
    .insert(payload)
    .select('id')
    .single()

  if (ins.error) throw new Error(ins.error.message)
  const activityId = ins.data.id

  // Pivot N-N (si existe)
  try {
    const toInsert = Array.from(new Set([main_artist_id, ...artist_ids])).map(
      (aid) => ({ activity_id: activityId, artist_id: aid }),
    )
    await s.from('activity_artists').insert(toInsert)
  } catch {
    // Silencioso si la tabla no existe en este entorno
  }

  revalidatePath('/actividades')
  revalidatePath(`/actividades/actividad/${activityId}`)
  redirect(`/actividades/actividad/${activityId}?saved=1`)
}

/** Update módulo básico de actividad */
export async function updateActivityBasicAction(
  activityId: string,
  formData: FormData,
) {
  const s = createSupabaseServer()

  const payload: any = {
    type: String(formData.get('type') || ''),
    status: String(formData.get('status') || ''),
    date: String(formData.get('date') || '') || null,
    time: String(formData.get('time') || '').trim() || null,
    municipality: String(formData.get('municipality') || '').trim() || null,
    province: String(formData.get('province') || '').trim() || null,
    country: String(formData.get('country') || '') || 'España',
    company_id: String(formData.get('company_id') || '') || null,
    venue_id: String(formData.get('venue_id') || '') || null,
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
    pay_kind: String(formData.get('pay_kind') || '') || null,
  }
  Object.keys(payload).forEach((k) => {
    if (payload[k] === '') payload[k] = null
  })

  const { error } = await s.from('activities').update(payload).eq('id', activityId)
  if (error) throw new Error(error.message)

  // Reemplazar vínculos N-N si llegan
  const artist_ids = (formData.getAll('artist_ids') as string[]).filter(Boolean)
  if (artist_ids.length) {
    try {
      await s.from('activity_artists').delete().eq('activity_id', activityId)
      const rows = Array.from(new Set(artist_ids)).map((aid) => ({
        activity_id: activityId,
        artist_id: aid,
      }))
      await s.from('activity_artists').insert(rows)
    } catch {
      // Silencioso si no existe pivot
    }
  }

  revalidatePath('/actividades')
  revalidatePath(`/actividades/actividad/${activityId}`)
}
