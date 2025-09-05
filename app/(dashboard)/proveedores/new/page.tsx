import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function NewProvider() {
  async function createProvider(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const org = process.env.DEFAULT_ORG_ID!
    const legal_name = String(formData.get('legal_name') || '').trim()
    const nick = String(formData.get('nick') || '').trim() || null
    const kind = (String(formData.get('kind') || 'person') === 'company')
    const tax_id = String(formData.get('tax_id') || '').trim() || null
    if (!legal_name) throw new Error('Nombre requerido')

    const { data: created, error } = await s.from('counterparties')
      .upsert({ organization_id: org, legal_name, is_company: kind, tax_id, as_provider: true }, { onConflict: 'unique_key' })
      .select('id, organization_id').single()
    if (error) throw new Error(error.message)
    await s.from('counterparties').update({ as_provider: true, nick }).eq('id', created.id)

    const logo = formData.get('logo') as File | null
    if (logo && logo.size > 0) {
      await ensurePublicBucket('avatars')
      const path = `${created.organization_id}/counterparties/${created.id}/${crypto.randomUUID()}`
      const up = await s.storage.from('avatars').upload(path, logo, { cacheControl:'3600', upsert:false, contentType: logo.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      const pub = s.storage.from('avatars').getPublicUrl(up.data.path)
      await s.from('counterparties').update({ logo_url: pub.data.publicUrl }).eq('id', created.id)
    }

    redirect(`/proveedores/${created.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nuevo proveedor</h1>
        <Link className="btn-secondary" href="/proveedores">Volver</Link>
      </div>

      <form action={createProvider} className="space-y-4 max-w-xl">
        <div><label className="block text-sm mb-1 module-title">Logo (opcional)</label><input name="logo" type="file" accept="image/*" /></div>
        <div><label className="block text-sm mb-1 module-title">Nombre / Razón social *</label><input name="legal_name" required className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm mb-1">Nick</label><input name="nick" className="w-full border rounded px-3 py-2" /></div>
        <div className="flex items-center gap-6"><label><input type="radio" name="kind" value="person" defaultChecked /> Particular</label><label><input type="radio" name="kind" value="company" /> Empresa</label></div>
        <div><label className="block text-sm mb-1">DNI/CIF</label><input name="tax_id" className="w-full border rounded px-3 py-2" /></div>
        <div className="flex gap-3"><Link href="/proveedores" className="btn-secondary">Cancelar</Link><button className="btn">Crear</button></div>
      </form>
    </div>
  )
}
