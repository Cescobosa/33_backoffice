import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export default function NewProviderPage() {
  async function createProvider(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const is_company = formData.get('is_company') === 'on'
    const nick = String(formData.get('nick') || '').trim() || null
    const legal_name = String(formData.get('legal_name') || '').trim()
    const tax_id = String(formData.get('tax_id') || '').trim() || null
    if (!legal_name) throw new Error('Nombre/razón social requerido')

    let logo_url: string | null = null
    const logo = formData.get('logo') as File | null
    if (logo && logo.size > 0) {
      await ensurePublicBucket('avatars')
      const path = `counterparties/${crypto.randomUUID()}`
      const up = await s.storage.from('avatars').upload(path, logo, { cacheControl: '3600', upsert: false, contentType: logo.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      const pub = s.storage.from('avatars').getPublicUrl(up.data.path)
      logo_url = pub.data.publicUrl
    }

    const { data, error } = await s.from('counterparties')
      .insert({ organization_id: (await s.from('organizations').select('id').limit(1).single()).data!.id,
                as_provider: true, as_third_party: false, is_company, nick, legal_name, tax_id, logo_url })
      .select('id').single()

    let id = data?.id
    if (error) {
      const guess = await s.from('counterparties')
        .select('id').or(tax_id
          ? `tax_id.eq.${tax_id}`
          : `and(legal_name.ilike.${legal_name},is_company.eq.${is_company})`).maybeSingle()
      if (guess.data?.id) {
        id = guess.data.id
        await s.from('counterparties').update({ as_provider: true, ...(logo_url ? { logo_url } : {}) }).eq('id', id)
      } else {
        throw new Error(error.message)
      }
    }

    redirect(`/proveedores/${id}`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo proveedor</h1>
      <form action={createProvider} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm mb-1">Logo</label><input type="file" name="logo" accept="image/*" /></div>
        <div className="flex items-center gap-2"><input type="checkbox" name="is_company" id="is_company" /><label htmlFor="is_company">¿Empresa?</label></div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">Nick (opcional)</label><input name="nick" className="w-full border rounded px-3 py-2" /></div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">Nombre / Razón social *</label><input name="legal_name" required className="w-full border rounded px-3 py-2" /></div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">DNI / CIF</label><input name="tax_id" className="w-full border rounded px-3 py-2" /></div>
        <div className="md:col-span-2"><button className="btn">Crear proveedor</button></div>
      </form>
    </div>
  )
}
