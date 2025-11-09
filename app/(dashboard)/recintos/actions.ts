// app/(dashboard)/recintos/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export async function createVenue(formData: FormData) {
  const s = createSupabaseServer()
  const name = String(formData.get('name') || '').trim()
  if (!name) throw new Error('El nombre es obligatorio')

  const res = await s.from('venues').insert({
    name,
    address: String(formData.get('address') || '') || null,
    indoor: formData.get('indoor') === 'on' ? true : (formData.get('indoor') === 'true' ? true : null),
    photo_url: String(formData.get('photo_url') || '') || null,
    website: String(formData.get('website') || '') || null,
    lat: formData.get('lat') ? Number(formData.get('lat')) : null,
    lng: formData.get('lng') ? Number(formData.get('lng')) : null,
  }).select('id').single()

  if (res.error) throw new Error(res.error.message)

  revalidatePath('/recintos')
  return res.data.id as string
}

export async function updateVenueBasic(venueId: string, formData: FormData) {
  const s = createSupabaseServer()
  const patch: any = {
    name: String(formData.get('name') || ''),
    address: String(formData.get('address') || '') || null,
    website: String(formData.get('website') || '') || null,
    indoor: formData.get('indoor') === 'on' || formData.get('indoor') === 'true' ? true : (formData.get('indoor') === 'false' ? false : null),
    lat: formData.get('lat') ? Number(formData.get('lat')) : null,
    lng: formData.get('lng') ? Number(formData.get('lng')) : null,
    photo_url: String(formData.get('photo_url') || '') || null,
  }

  const up = await s.from('venues').update(patch).eq('id', venueId)
  if (up.error) throw new Error(up.error.message)
  revalidatePath(`/recintos/${venueId}`)
  revalidatePath('/recintos')
}

export async function addVenueCapacity(venueId: string, formData: FormData) {
  const s = createSupabaseServer()
  const name = String(formData.get('cap_name') || '').trim()
  const capacity = Number(formData.get('cap_value') || 0)
  if (!name || !Number.isFinite(capacity)) throw new Error('Rellena nombre y aforo')
  const ins = await s.from('venue_capacities').insert({ venue_id: venueId, name, capacity })
  if (ins.error) throw new Error(ins.error.message)
  revalidatePath(`/recintos/${venueId}`)
}

export async function deleteVenueCapacity(venueId: string, id: string) {
  const s = createSupabaseServer()
  await s.from('venue_capacities').delete().eq('id', id)
  revalidatePath(`/recintos/${venueId}`)
}

export async function addVenueContact(venueId: string, formData: FormData) {
  const s = createSupabaseServer()
  const ins = await s.from('venue_contacts').insert({
    venue_id: venueId,
    company_name: String(formData.get('company_name') || '') || null,
    contact_name: String(formData.get('contact_name') || '') || null,
    phone: String(formData.get('phone') || '') || null,
    email: String(formData.get('email') || '') || null,
    role: String(formData.get('role') || '') || null,
  })
  if (ins.error) throw new Error(ins.error.message)
  revalidatePath(`/recintos/${venueId}`)
}

export async function deleteVenueContact(venueId: string, id: string) {
  const s = createSupabaseServer()
  await s.from('venue_contacts').delete().eq('id', id)
  revalidatePath(`/recintos/${venueId}`)
}

export async function addVenueComment(venueId: string, formData: FormData) {
  const s = createSupabaseServer()
  const content = String(formData.get('content') || '').trim()
  if (!content) throw new Error('Escribe un comentario')
  const ins = await s.from('venue_comments').insert({ venue_id: venueId, content })
  if (ins.error) throw new Error(ins.error.message)
  revalidatePath(`/recintos/${venueId}`)
}

export async function deleteVenueComment(venueId: string, id: string) {
  const s = createSupabaseServer()
  await s.from('venue_comments').delete().eq('id', id)
  revalidatePath(`/recintos/${venueId}`)
}

export async function addVenueFile(venueId: string, formData: FormData) {
  const s = createSupabaseServer()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('Archivo requerido')

  await ensurePublicBucket('venues')

  const safeName = (file.name || 'documento.pdf').replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${venueId}/${Date.now()}_${safeName}`

  const up = await s.storage.from('venues').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (up.error) throw new Error(up.error.message)

  const pub = s.storage.from('venues').getPublicUrl(up.data.path)
  const file_url = pub.data.publicUrl

  const ins = await s.from('venue_files').insert({
    venue_id: venueId,
    title: String(formData.get('title') || file.name || 'Documento'),
    file_url,
  })
  if (ins.error) throw new Error(ins.error.message)
  revalidatePath(`/recintos/${venueId}`)
}

export async function deleteVenueFile(venueId: string, id: string) {
  const s = createSupabaseServer()
  await s.from('venue_files').delete().eq('id', id)
  revalidatePath(`/recintos/${venueId}`)
}
