import ModuleCard from '@/components/ModuleCard'
import { ensurePublicBucket } from '@/lib/storage'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function CompanyDetail({ params }: { params: { id: string } }) {
  const s = createSupabaseServer()
  const { data: c, error } = await s
    .from('group_companies')
    .select('id, nick, name, logo_url, cif, cif_pdf_url, fiscal_address, iban, iban_cert_url')
    .eq('id', params.id).single()
  if (error) throw new Error(error.message)

  const { data: admins } = await s.from('group_company_admins').select('id, full_name, dni').eq('company_id', c.id).order('created_at')

  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const nick = String(formData.get('nick')||'').trim() || null
    const name = String(formData.get('name')||'').trim()
    if (!name) throw new Error('Nombre requerido')

    let logo_url: string | null = null
    const logo = formData.get('logo') as File | null
    if (logo && logo.size>0) {
      await ensurePublicBucket('avatars')
      const path = `companies/${params.id}/${crypto.randomUUID()}`
      const up = await s.storage.from('avatars').upload(path, logo, { cacheControl: '3600', upsert: false, contentType: logo.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      logo_url = s.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    }
    const { error } = await s.from('group_companies').update({ nick, name, ...(logo_url ? {logo_url} : {}) }).eq('id', params.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/empresas/${params.id}`)
  }

  async function saveBilling(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const cif = String(formData.get('cif')||'').trim() || null
    const fiscal_address = String(formData.get('fiscal_address')||'').trim() || null
    const iban = String(formData.get('iban')||'').trim() || null

    let cif_pdf_url: string | null = null
    const cif_pdf = formData.get('cif_pdf') as File | null
    if (cif_pdf && cif_pdf.size>0) {
      await ensurePublicBucket('contracts')
      const up = await s.storage.from('contracts').upload(`companies/${params.id}/cif_${crypto.randomUUID()}.pdf`, cif_pdf, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
      if (up.error) throw new Error(up.error.message)
      cif_pdf_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl
    }

    let iban_cert_url: string | null = null
    const iban_pdf = formData.get('iban_pdf') as File | null
    if (iban_pdf && iban_pdf.size>0) {
      await ensurePublicBucket('contracts')
      const up = await s.storage.from('contracts').upload(`companies/${params.id}/iban_${crypto.randomUUID()}.pdf`, iban_pdf, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
      if (up.error) throw new Error(up.error.message)
      iban_cert_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl
    }

    const { error } = await s.from('group_companies')
      .update({ cif, fiscal_address, iban, ...(cif_pdf_url ? { cif_pdf_url } : {}), ...(iban_cert_url ? { iban_cert_url } : {}) })
      .eq('id', params.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/empresas/${params.id}`)
  }

  async function addAdmin(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const full_name = String(formData.get('full_name')||'').trim()
    const dni = String(formData.get('dni')||'').trim()
    if (!full_name || !dni) throw new Error('Datos requeridos')
    const { error } = await s.from('group_company_admins').insert({ company_id: params.id, full_name, dni })
    if (error) throw new Error(error.message)
    revalidatePath(`/empresas/${params.id}`)
  }

  async function delAdmin(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const id = String(formData.get('id')||'')
    const { error } = await s.from('group_company_admins').delete().eq('id', id).eq('company_id', params.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/empresas/${params.id}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{c.nick || c.name}</h1>

      <ModuleCard title="Datos de la empresa" leftActions={<span className="badge">Editar</span>}>
        <form action={saveBasics} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Logo</label>
            <input type="file" name="logo" accept="image/*" />
            {c.logo_url && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logo_url} className="w-16 h-16 rounded-full border object-cover" alt="" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">Nick</label>
            <input name="nick" defaultValue={c.nick || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Nombre</label>
            <input name="name" defaultValue={c.name} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-3"><button className="btn">Guardar</button></div>
        </form>
      </ModuleCard>

      <ModuleCard title="Datos de facturación" leftActions={<span className="badge">Editar</span>}>
        <form action={saveBilling} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">CIF</label>
            <input name="cif" defaultValue={c.cif || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">CIF (PDF)</label>
            <input type="file" name="cif_pdf" accept="application/pdf" />
            {c.cif_pdf_url && <div className="text-xs mt-1"><a href={c.cif_pdf_url} className="underline" target="_blank">Descargar CIF</a></div>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Dirección fiscal</label>
            <input name="fiscal_address" defaultValue={c.fiscal_address || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">IBAN</label>
            <input name="iban" defaultValue={c.iban || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Certificado de titularidad (PDF)</label>
            <input type="file" name="iban_pdf" accept="application/pdf" />
            {c.iban_cert_url && <div className="text-xs mt-1"><a href={c.iban_cert_url} className="underline" target="_blank">Descargar certificado</a></div>}
          </div>
          <div className="md:col-span-2"><button className="btn">Guardar</button></div>
        </form>
      </ModuleCard>

      <ModuleCard title="Administradores" leftActions={<span className="badge">Editar</span>}>
        <form action={addAdmin} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="block text-sm mb-1">Nombre completo</label><input name="full_name" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">DNI</label><input name="dni" className="w-full border rounded px-3 py-2" /></div>
          <div className="md:col-span-3"><button className="btn">+ Añadir administrador</button></div>
        </form>

        <div className="divide-y divide-gray-200 mt-3">
          {(admins || []).map(a => (
            <div key={a.id} className="py-2 flex items-center justify-between">
              <div className="font-medium">{a.full_name} · {a.dni}</div>
              <form action={delAdmin}><input type="hidden" name="id" value={a.id} /><button className="btn-secondary">Eliminar</button></form>
            </div>
          ))}
          {!admins?.length && <div className="text-sm text-gray-500">Sin administradores.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
