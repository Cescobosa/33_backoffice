import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ModuleCard from '@/components/ModuleCard'
import DateCountdown from '@/components/DateCountdown'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export const dynamic = 'force-dynamic'

async function getCounterparty(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('counterparties')
    .select('id, organization_id, is_company, nick, legal_name, tax_id, logo_url, status, as_third_party, as_provider')
    .eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
}
async function getContracts(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('contracts')
    .select('id, name, signed_at, expires_at, renew_at, is_active, pdf_url')
    .eq('entity_type', 'counterparty').eq('entity_id', id)
    .order('is_active', { ascending: false }).order('signed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
async function getLinks(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('third_party_links')
    .select('id, status, linked_at, unlinked_at, artists(id,stage_name,avatar_url)')
    .eq('counterparty_id', id).order('linked_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export default async function ThirdDetail({ params }: { params: { id: string } }) {
  const id = params.id
  const c = await getCounterparty(id)
  if (!c) notFound()
  const [contracts, links] = await Promise.all([getContracts(id), getLinks(id)])

  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const is_company = formData.get('is_company') === 'on'
    const nick = String(formData.get('nick') || '').trim() || null
    const legal_name = String(formData.get('legal_name') || '').trim()
    const tax_id = String(formData.get('tax_id') || '').trim() || null
    let logo_url: string | null = null
    const logo = formData.get('logo') as File | null
    if (logo && logo.size > 0) {
      await ensurePublicBucket('avatars')
      const up = await s.storage.from('avatars').upload(`counterparties/${id}`, logo, { cacheControl: '3600', upsert: true, contentType: logo.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      logo_url = s.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    }
    const { error } = await s.from('counterparties').update({ is_company, nick, legal_name, tax_id, ...(logo_url ? { logo_url } : {}) }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath(`/terceros/${id}`)
  }
  async function addContract(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const name = String(formData.get('name') || '').trim()
    const signed_at = String(formData.get('signed_at') || '') || null
    const expires_at = String(formData.get('expires_at') || '') || null
    const renew_at = String(formData.get('renew_at') || '') || null
    const is_active = formData.get('is_active') === 'on'
    const pdf = formData.get('pdf') as File | null
    if (!name || !pdf) throw new Error('Nombre y PDF requeridos')

    await ensurePublicBucket('contracts')
    const up = await s.storage.from('contracts').upload(`${c.organization_id}/counterparties/${id}/contracts/${crypto.randomUUID()}.pdf`, pdf, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
    if (up.error) throw new Error(up.error.message)
    const pdf_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl

    const { error } = await s.from('contracts').insert({ entity_type: 'counterparty', entity_id: id, name, signed_at, expires_at, renew_at, is_active, pdf_url })
    if (error) throw new Error(error.message)
    revalidatePath(`/terceros/${id}?tab=contratos`)
  }
  async function archive() { 'use server'
    const s = createSupabaseServer()
    const { error } = await s.from('counterparties').update({ status: 'archived' }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath(`/terceros/${id}`)
  }
  async function recover() { 'use server'
    const s = createSupabaseServer()
    const { error } = await s.from('counterparties').update({ status: 'active' }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath(`/terceros/${id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{c.nick || c.legal_name}</h1>
          <div className="text-sm text-gray-500">{c.is_company ? 'Empresa' : 'Particular'} {c.status === 'archived' && <span className="ml-2 badge badge-red">Archivado</span>}</div>
        </div>
        <div className="flex gap-2">
          {c.status === 'active'
            ? <form action={archive}><button className="btn-secondary">Archivar</button></form>
            : <form action={recover}><button className="btn-secondary">Recuperar</button></form>}
          <Link className="btn-secondary" href="/terceros">Volver</Link>
        </div>
      </div>

      <ModuleCard title="Datos básicos" leftActions={<span className="badge">Editar</span>}>
        <form action={saveBasics} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">Logo</label><input type="file" name="logo" accept="image/*" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" name="is_company" id="is_company" defaultChecked={c.is_company} /><label htmlFor="is_company">¿Empresa?</label></div>
          <div className="md:col-span-2"><label className="block text-sm mb-1">Nick</label><input name="nick" defaultValue={c.nick || ''} className="w-full border rounded px-3 py-2" /></div>
          <div className="md:col-span-2"><label className="block text-sm mb-1">Nombre / Razón social</label><input name="legal_name" defaultValue={c.legal_name} className="w-full border rounded px-3 py-2" /></div>
          <div className="md:col-span-2"><label className="block text-sm mb-1">DNI / CIF</label><input name="tax_id" defaultValue={c.tax_id || ''} className="w-full border rounded px-3 py-2" /></div>
          <div className="md:col-span-2"><button className="btn">Guardar</button></div>
        </form>
      </ModuleCard>

      <ModuleCard title="Contratos" leftActions={<span className="badge">Editar</span>}>
        <form action={addContract} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm mb-1">Nombre *</label><input name="name" required className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Firma *</label><input type="date" name="signed_at" required className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Vencimiento</label><input type="date" name="expires_at" className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Renovación</label><input type="date" name="renew_at" className="w-full border rounded px-3 py-2" /></div>
          <div className="flex items-center gap-2 mt-6"><input type="checkbox" id="is_active" name="is_active" defaultChecked /><label htmlFor="is_active" className="text-sm">Vigente</label></div>
          <div className="md:col-span-2"><label className="block text-sm mb-1">PDF *</label><input type="file" name="pdf" required accept="application/pdf" /></div>
          <div className="md:col-span-2"><button className="btn">+ Añadir contrato</button></div>
        </form>

        <div className="divide-y divide-gray-200 mt-4">
          {contracts.map(cn => (
            <div key={cn.id} className="py-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">{cn.name}</span>
                {cn.is_active ? <span className="badge badge-green">Vigente</span> : <span className="badge badge-red">No vigente</span>}
                <DateCountdown to={cn.renew_at || cn.expires_at} />
              </div>
              <div className="text-xs text-gray-600 mt-1">{cn.signed_at ? `Fecha firma: ${new Date(cn.signed_at).toLocaleDateString()}` : ''}</div>
              <div className="mt-2"><a href={cn.pdf_url} target="_blank" className="underline text-blue-700">Ver PDF</a></div>
            </div>
          ))}
          {!contracts.length && <div className="text-sm text-gray-500">Sin contratos.</div>}
        </div>
      </ModuleCard>

      <ModuleCard title="Vinculaciones con artistas">
        <div className="divide-y divide-gray-200">
          {links.map(l => (
            <Link key={l.id} href={`/artistas/${l.artists?.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.artists?.avatar_url || '/avatar.png'} className="w-8 h-8 rounded-full border object-cover" alt="" />
              <div className="font-medium">{l.artists?.stage_name}</div>
              {l.status === 'unlinked' && <span className="badge badge-red ml-2">Desvinculado</span>}
            </Link>
          ))}
          {!links.length && <div className="text-sm text-gray-500 px-2 py-3">Aún no tiene vinculaciones.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
