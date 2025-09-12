import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import DateCountdown from '@/components/DateCountdown'
import { ensurePublicBucket } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}

export default async function ThirdDetail({
  params,
  searchParams,
}: { params: { id: string }, searchParams: { tab?: string, sub?: string } }) {
  const s = createSupabaseServer()
  const parentTab = searchParams.tab || 'datos'
  const sub = searchParams.sub || 'basicos'

  // Básicos del tercero
  const { data: third } = await s
    .from('counterparties')
    .select('id, organization_id, is_company, legal_name, nick, tax_id, logo_url, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!third) {
    // Vista mínima si no existe (sin 404)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Tercero</h1>
        <div className="text-sm text-gray-600">No se encontró el tercero solicitado.</div>
        <Link href="/terceros" className="btn-secondary">Volver</Link>
      </div>
    )
  }

  // Vinculaciones con artistas
  const { data: links } = await s
    .from('third_party_links')
    .select('id, artist_id, status, linked_at, unlinked_at, artists(id,stage_name,avatar_url)')
    .eq('counterparty_id', third.id)
    .order('linked_at', { ascending: false })

  // Contratos del tercero
  const { data: contracts } = await s
    .from('contracts')
    .select('id, name, signed_at, expires_at, renew_at, is_active, pdf_url')
    .eq('entity_type', 'counterparty')
    .eq('entity_id', third.id)
    .order('is_active', { ascending: false })
    .order('signed_at', { ascending: false })

  // ===== Actions =====
  async function updateBasic(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const legal_name = String(formData.get('legal_name') || '').trim()
    const nick = String(formData.get('nick') || '').trim() || null
    const is_company = String(formData.get('kind') || 'person') === 'company'
    const tax_id = String(formData.get('tax_id') || '').trim() || null
    let logo_url: string | null = null
    const logo = formData.get('logo') as File | null
    if (logo && logo.size > 0) {
      await ensurePublicBucket('avatars')
      const up = await s.storage.from('avatars').upload(
        `counterparties/${params.id}/${crypto.randomUUID()}`,
        logo,
        { cacheControl: '3600', upsert: false, contentType: logo.type || 'image/*' }
      )
      if (up.error) throw new Error(up.error.message)
      logo_url = s.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    }
    const { error } = await s.from('counterparties').update({
      legal_name, nick, is_company, tax_id, ...(logo_url ? { logo_url } : {}),
    }).eq('id', params.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/terceros/${params.id}`)
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
    if (!name) throw new Error('Nombre requerido')
    if (!pdf || pdf.size === 0) throw new Error('PDF requerido')

    await ensurePublicBucket('contracts')
    const ext = (pdf.name ?? '').split('.').pop() || 'pdf'
    const path = `counterparties/${params.id}/contracts/${crypto.randomUUID()}.${ext}`
    const up = await s.storage.from('contracts').upload(path, pdf, { cacheControl: '3600', upsert: false, contentType: pdf.type || 'application/pdf' })
    if (up.error) throw new Error(up.error.message)
    const pub = s.storage.from('contracts').getPublicUrl(up.data.path)
    const { error } = await s.from('contracts').insert({
      entity_type: 'counterparty', entity_id: params.id, name, signed_at, expires_at, renew_at, is_active, pdf_url: pub.data.publicUrl,
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/terceros/${params.id}?tab=datos&sub=contratos`)
  }

  const topTabs = [
    { key: 'datos', label: 'Datos básicos' },
  ]
  const subTabs = [
    { key: 'basicos', label: 'Datos básicos' },
    { key: 'contratos', label: 'Contratos' },
    { key: 'vinculos', label: 'Vinculaciones con artistas' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{third.nick || third.legal_name}</h1>
          <div className="text-sm text-gray-600">
            {third.is_company ? 'Empresa' : 'Particular'}
          </div>
        </div>
        <Link href="/terceros" className="btn-secondary">Volver</Link>
      </div>

      <div className="flex gap-2">
        {topTabs.map(t => (
          <Link key={t.key}
            href={{ pathname: `/terceros/${third.id}`, query: { tab: t.key, sub } }}
            className={`px-3 py-2 rounded-md ${parentTab === t.key ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {parentTab === 'datos' && (
        <>
          <div className="flex gap-2">
            {subTabs.map(t => (
              <Link key={t.key}
                href={{ pathname: `/terceros/${third.id}`, query: { tab: 'datos', sub: t.key } }}
                className={`px-3 py-2 rounded-md ${sub === t.key ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                {t.label}
              </Link>
            ))}
          </div>

          {/* BASICOS */}
          {sub === 'basicos' && (
            <ModuleCard title="Datos básicos" leftActions={<span className="badge">Editar</span>}>
              <form action={updateBasic} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Logo / foto</label>
                  <input type="file" name="logo" accept="image/*" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {third.logo_url && <img src={third.logo_url} className="mt-2 w-20 h-20 rounded-full object-cover border" alt="" />}
                </div>
                <div>
                  <label className="block text-sm mb-1">Nick</label>
                  <input name="nick" defaultValue={third.nick || ''} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Tipo</label>
                  <select name="kind" defaultValue={third.is_company ? 'company' : 'person'} className="w-full border rounded px-3 py-2">
                    <option value="person">Particular</option>
                    <option value="company">Empresa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Nombre completo / razón social</label>
                  <input name="legal_name" defaultValue={third.legal_name} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm mb-1">DNI / CIF</label>
                  <input name="tax_id" defaultValue={third.tax_id || ''} className="w-full border rounded px-3 py-2" />
                </div>
                <div className="md:col-span-2"><button className="btn">Guardar</button></div>
              </form>
            </ModuleCard>
          )}

          {/* CONTRATOS */}
          {sub === 'contratos' && (
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
                {(contracts || []).map(c => (
                  <div key={c.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{c.name}</span>
                      {c.is_active ? <span className="badge badge-green">Vigente</span> : <span className="badge badge-red">No vigente</span>}
                      <DateCountdown to={c.renew_at || c.expires_at} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{c.signed_at ? `Firma: ${new Date(c.signed_at).toLocaleDateString()}` : ''}</div>
                    <div className="mt-2"><a href={c.pdf_url} target="_blank" className="underline text-blue-700">Ver PDF</a></div>
                  </div>
                ))}
                {!contracts?.length && <div className="text-sm text-gray-500">Sin contratos.</div>}
              </div>
            </ModuleCard>
          )}

          {/* Vínculos */}
          {sub === 'vinculos' && (
            <ModuleCard title="Vinculaciones con artistas" leftActions={<span className="badge">Ver</span>}>
              <div className="divide-y divide-gray-200">
                {(links || []).map(l => {
                  const art = one(l?.artists)
                  return (
                    <div key={l.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={art?.avatar_url || '/avatar.png'} className="w-8 h-8 rounded-full border object-cover" alt="" />
                        <div>
                          <Link href={`/artistas/${art?.id}`} className="font-medium underline">{art?.stage_name}</Link>
                          <span className="ml-2 text-xs text-gray-600">{l.status === 'linked' ? 'Vinculado' : 'Desvinculado'}</span>
                        </div>
                      </div>
                      {l.unlinked_at && <div className="text-xs text-gray-500">Desvinculado: {new Date(l.unlinked_at).toLocaleDateString()}</div>}
                    </div>
                  )
                })}
                {!links?.length && <div className="text-sm text-gray-500">Este tercero aún no está vinculado a ningún artista.</div>}
              </div>
            </ModuleCard>
          )}
        </>
      )}
    </div>
  )
}
