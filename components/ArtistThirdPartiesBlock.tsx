// components/ArtistThirdPartiesBlock.tsx
import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import CounterpartyPicker from '@/components/CounterpartyPicker'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'

export default async function ArtistThirdPartiesBlock({
  artistId,
  isEdit,
  incomeTypes,
  pathnameForRevalidate,
}: {
  artistId: string
  isEdit: boolean
  incomeTypes: { id: string; name: string }[]
  pathnameForRevalidate: string
}) {
  const s = createSupabaseServer()
  const { data: links, error } = await s.from('third_party_links')
    .select('id, status, linked_at, unlinked_at, counterparty_id, counterparties(id,legal_name,nick,logo_url)')
    .eq('artist_id', artistId)
    .order('linked_at', { ascending: false })
  if (error) throw new Error(error.message)

  async function linkThird(formData: FormData) {
    'use server'
    const s2 = createSupabaseServer()
    const mode = String(formData.get('mode') || 'existing')
    let counterparty_id: string | null = null

    if (mode === 'existing') {
      counterparty_id = String(formData.get('counterparty_id') || '')
      if (!counterparty_id) throw new Error('Selecciona un tercero')
    } else {
      // Alta rápida si no existe (básico)
      const legal_name = String(formData.get('legal_name') || '').trim()
      const is_company = String(formData.get('kind') || 'person') === 'company'
      const tax_id = String(formData.get('tax_id') || '').trim() || null
      if (!legal_name) throw new Error('Nombre requerido')
      const ins = await s2.from('counterparties').insert({
        organization_id: (await s2.from('artists').select('organization_id').eq('id', artistId).single()).data!.organization_id,
        legal_name, is_company, tax_id, as_third_party: true,
      }).select('id').single()
      if (ins.error) throw new Error(ins.error.message)
      counterparty_id = ins.data!.id
    }

    const link = await s2.from('third_party_links').insert({ artist_id: artistId, counterparty_id }).select('id').single()
    if (link.error && !(link.error.message || '').includes('duplicate')) throw new Error(link.error.message)

    revalidatePath(pathnameForRevalidate)
  }

  async function unlinkThird(formData: FormData) {
    'use server'
    const s2 = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const { error } = await s2.from('third_party_links').update({ status: 'unlinked', unlinked_at: new Date().toISOString() }).eq('id', link_id)
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function addThirdConfig(formData: FormData) {
    'use server'
    const s2 = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const income_type_id = String(formData.get('income_type_id') || '')
    const calc_base = String(formData.get('calc_base') || 'gross')
    const pct_third_party = Number(formData.get('pct_third_party') || 0)
    const { error } = await s2.from('third_party_income_configs').insert({ third_party_link_id: link_id, income_type_id, calc_base, pct_third_party })
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  return (
    <ModuleCard title="Terceros vinculados" leftActions={<span className="badge">{isEdit ? 'Editar' : 'Ver'}</span>}>
      <div className="space-y-6">
        {isEdit && (
          <form action={linkThird} method="post" className="border border-gray-200 rounded p-3">
            <div className="font-medium mb-2">Añadir tercero</div>
            <CounterpartyPicker />
            <div className="mt-3"><button className="btn">Vincular</button></div>
          </form>
        )}

        <div className="divide-y divide-gray-200">
          {(links || []).map(lnk => {
            const cp = Array.isArray((lnk as any).counterparties) ? (lnk as any).counterparties[0] : (lnk as any).counterparties
            return (
              <div key={lnk.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={cp?.logo_url || '/avatar.png'} className="w-8 h-8 rounded object-cover border" alt="" />
                    <div>
                      <Link href={`/terceros/${cp?.id}`} className="font-medium underline">
                        {cp?.nick || cp?.legal_name}
                      </Link>
                      {lnk.status === 'unlinked' && <span className="ml-2 badge badge-red">Desvinculado</span>}
                    </div>
                  </div>
                  {isEdit && lnk.status === 'linked' && (
                    <form action={unlinkThird} method="post">
                      <input type="hidden" name="link_id" value={lnk.id} />
                      <button className="btn-secondary">Desvincular</button>
                    </form>
                  )}
                </div>

                {/* Condiciones del tercero */}
                <div className="mt-3 border rounded p-3">
                  <div className="font-medium mb-2">Condiciones (tercero)</div>
                  {isEdit && (
                    <form action={addThirdConfig} method="post" className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input type="hidden" name="link_id" value={lnk.id} />
                      <select name="income_type_id" className="border rounded px-2 py-1">
                        {incomeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select name="calc_base" className="border rounded px-2 py-1">
                        <option value="gross">Sobre bruto</option>
                        <option value="net">Sobre neto</option>
                      </select>
                      <input name="pct_third_party" type="number" step="0.01" placeholder="% tercero" className="border rounded px-2 py-1" />
                      <button className="btn">Añadir</button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
          {(!links || links.length === 0) && <div className="text-sm text-gray-500">No hay terceros vinculados.</div>}
        </div>
      </div>
    </ModuleCard>
  )
}
