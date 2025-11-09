// app/(dashboard)/recintos/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'
import { geocodeAddress } from '@/lib/geocoding'

async function uploadVenuePhoto(s: ReturnType<typeof createSupabaseServer>, venueId: string, file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null
  const okTypes = ['image/png', 'image/jpeg', 'image/jpg']
  const mime = file.type?.toLowerCase() || ''
  if (!okTypes.includes(mime)) throw new Error('La foto debe ser PNG o JPG')

  await ensurePublicBucket('venues-photos')

  const safeName = (file.name || 'foto.jpg').replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${venueId}/${Date.now()}_${safeName}`

  const up = await s.storage.from('venues-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime,
  })
  if (up.error) throw new Error(up.error.message)

  const pub = s.storage.from('venues-photos').getPublicUrl(up.data.path)
  return pub.data.publicUrl || null
}

export async function createVenue(formData: FormData) {
  const s = createSupabaseServer()
  const name = String(formData.get('name') || '').trim()
  if (!name) throw new Error('El nombre es obligatorio')

  const address = String(formData.get('address') || '') || null
  const website = String(formData.get('website') || '') || null
  const indoor = formData.get('indoor') === 'on' || formData.get('indoor') === 'true' ? true : null

  const geo = await geocodeAddress(address)

  const ins = await s.from('venues')
    .insert({
      name,
      address,
      website,
      indoor,
      lat: geo.lat,
      lng: geo.lng,
      photo_url: null, // se actualiza tras subir la foto
    })
    .select('id')
    .single()

  if (ins.error) throw new Error(ins.error.message)
  const venueId = ins.data.id as string

  // Foto (opcional)
  const photo = (formData.get('photo') as File) || null
  if (photo && photo.size > 0) {
    const url = await uploadVenuePhoto(s, venueId, photo)
    if (url) {
      await s.from('venues').update({ photo_url: url }).eq('id', venueId)
    }
  }

  revalidatePath('/recintos')
  return venueId
}

export async function updateVenueBasic(venueId: string, formData: FormData) {
  const s = createSupabaseServer()
  const nextAddress = String(formData.get('address') || '') || null

  // Necesitamos saber si la dirección cambió para re-geocodificar.
  const curr = await s.from('venues').select('address').eq('id', venueId).single()
  if (curr.error) throw new Error(curr.error.message)
  const addressChanged = (curr.data?.address || null) !== (nextAddress || null)

  let lat: number | null | undefined = undefined
  let lng: number | null | undefined = undefined
  if (addressChanged) {
    const geo = await geocodeAddress(nextAddress)
    lat = geo.lat
    lng = geo.lng
  }

  const patch: any = {
    name: String(formData.get('name') || ''),
    address: nextAddress,
    website: String(formData.get('website') || '') || null,
    indoor: formData.get('indoor') === 'on' || formData.get('indoor') === 'true' ? true : false,
  }
  if (addressChanged) {
    patch.lat = lat ?? null
    patch.lng = lng ?? null
  }

  // ¿Foto nueva?
  const photo = (formData.get('photo') as File) || null
  if (photo && photo.size > 0) {
    const url = await uploadVenuePhoto(s, venueId, photo)
    if (url) patch.photo_url = url
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

  await ensurePublicBucket('venues') // bucket de documentos

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
