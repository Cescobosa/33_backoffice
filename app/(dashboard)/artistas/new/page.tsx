import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getOrgId() {
  return process.env.DEFAULT_ORG_ID!
}

export default function NewArtistPage() {
  async function createArtist(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
    const orgId = await getOrgId()

    const stage_name = String(formData.get('stage_name') || '').trim()
    const is_group = formData.get('is_group') === 'on'
    const artist_contract_type =
      String(formData.get('artist_contract_type')) === 'booking' ? 'booking' : 'general'

    if (!stage_name) throw new Error('El nombre artístico es obligatorio')

    const { data: created, error } = await supabase
      .from('artists')
      .insert({ organization_id: orgId, stage_name, is_group, artist_contract_type })
      .select('id, organization_id')
      .single()
    if (error) throw new Error(error.message)

    const avatar = formData.get('avatar') as File | null
    if (avatar && avatar.size > 0) {
      await ensurePublicBucket('avatars')
      const path = `${created.organization_id}/artists/${created.id}/${crypto.randomUUID()}`
      const up = await supabase.storage.from('avatars').upload(path, avatar, {
        cacheControl: '3600', upsert: false, contentType: avatar.type || 'image/*',
      })
      if (up.error) throw new Error(up.error.message)
      const pub = supabase.storage.from('avatars').getPublicUrl(up.data.path)
      await supabase.from('artists').update({ avatar_url: pub.data.publicUrl }).eq('id', created.id)
    }

    redirect(`/artistas/${created.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nuevo artista</h1>
        <Link className="btn-secondary" href="/artistas">Volver</Link>
      </div>

      <form action={createArtist} className="space-y-5 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-1 module-title">Fotografía (opcional)</label>
          <input type="file" name="avatar" accept="image/*" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 module-title">Nombre artístico *</label>
          <input name="stage_name" required className="w-full border rounded px-3 py-2" />
        </div>

        <div className="flex items-center gap-3">
          <input id="is_group" name="is_group" type="checkbox" className="h-4 w-4" />
          <label htmlFor="is_group" className="text-sm">¿Es grupo?</label>
        </div>

        <div>
          <div className="block text-sm font-medium mb-1 module-title">Tipo de contrato</div>
          <label className="mr-4"><input type="radio" name="artist_contract_type" value="general" defaultChecked /> General</label>
          <label><input type="radio" name="artist_contract_type" value="booking" /> Booking</label>
        </div>

        <div className="flex gap-3">
          <Link href="/artistas" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn">Crear</button>
        </div>
      </form>
    </div>
  )
}
