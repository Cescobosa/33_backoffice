import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export default function NewThirdPage() {
  async function createThird(formData: FormData) {
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
      await ensurePublicBucket('files')
      const ext = (logo.name.split('.').pop() || 'png').toLowerCase()
      const path = `counterparties/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await s.storage.from('files').upload(path, logo, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = s.storage.from('files').getPublicUrl(path)
      logo_url = pub?.publicUrl || null
    }

    // Usamos la primera organización existente
    const org = await s.from('organizations').select('id').limit(1).single()
    if (org.error) throw new Error(org.error.message)

    const ins = await s.from('counterparties')
      .insert({
        organization_id: org.data.id,
        as_third_party: true, as_provider: true,
        is_company, nick, legal_name, tax_id, logo_url,
        status: 'active'
      }).select('id').single()

    let id = ins.data?.id
    if (ins.error) {
      // Si existe por unique_key/tax_id -> lo marcamos como tercero/proveedor
      const guess = await s.from('counterparties')
        .select('id').or(tax_id ? `tax_id.eq.${tax_id}` : `and(legal_name.ilike.${legal_name},is_company.eq.${is_company})`)
        .maybeSingle()
      if (guess.data?.id) {
        id = guess.data.id
        await s.from('counterparties').update({ as_third_party: true, as_provider: true, ...(logo_url ? { logo_url } : {}) }).eq('id', id)
      } else {
        throw new Error(ins.error.message)
      }
    }

    redirect(`/terceros/${id}`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo tercero</h1>
      <form action={createThird} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm mb-1">Logo</label><input type="file" name="logo" accept="image/*" /></div>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_company" /> ¿Empresa?</label>
        <div className="md:col-span-2"><label className="block text-sm mb-1">Alias (nick)</label><input name="nick" className="w-full border rounded px-3 py-2" /></div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">Nombre legal</label><input name="legal_name" required className="w-full border rounded px-3 py-2" /></div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">DNI/CIF</label><input name="tax_id" className="w-full border rounded px-3 py-2" /></div>
        <div className="md:col-span-2"><button className="btn">Crear tercero</button></div>
      </form>
    </div>
  )
}
