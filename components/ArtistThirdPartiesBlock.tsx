// components/ArtistThirdPartiesBlock.tsx
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import CounterpartyPicker from '@/components/CounterpartyPicker'

type IncomeTypeLite = { id: string; name: string }
type Props = {
  artistId: string
  isEdit?: boolean
  incomeTypes?: IncomeTypeLite[]
  /** Ruta que hay que revalidar tras guardar (ej. `/artistas/ID?tab=datos&sub=condiciones&mode=edit`) */
  pathnameForRevalidate: string
}

function incomeTypeNameFromRow(row: any): string | undefined {
  const it = row?.income_types
  if (Array.isArray(it)) return it[0]?.name
  return it?.name
}

export default async function ArtistThirdPartiesBlock({
  artistId,
  isEdit = false,
  incomeTypes = [],
  pathnameForRevalidate,
}: Props) {
  const s = createSupabaseServer()

  // Links del artista con su tercero
  const { data: links, error } = await s
    .from('third_party_links')
    .select(
      'id, status, linked_at, unlinked_at, counterparty_id, counterparties(id, nick, legal_name, logo_url)'
    )
    .eq('artist_id', artistId)
    .order('linked_at', { ascending: false })

  if (error) {
    return <div className="text-sm text-red-600">Error cargando terceros: {error.message}</div>
  }

  const linkIds = (links || []).map((l) => l.id)
  let cfgByLink: Record<string, any[]> = {}
  if (linkIds.length) {
    const cfg = await s
      .from('third_party_income_configs')
      .select('id, third_party_link_id, income_type_id, calc_base, pct_third_party, income_types(id,name)')
      .in('third_party_link_id', linkIds)

    if (!cfg.error) {
      cfgByLink = (cfg.data || []).reduce((acc: Record<string, any[]>, row: any) => {
        const k = row.third_party_link_id
        acc[k] ||= []
        acc[k].push(row)
        return acc
      }, {})
    }
  }

  // ===== Server actions =====
  async function linkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const mode = String(formData.get('mode') || 'existing')
    let counterparty_id: string | null = null

    if (mode === 'existing') {
      counterparty_id = String(formData.get('counterparty_id') || '')
      if (!counterparty_id) throw new Error('Selecciona un tercero')
    } else {
      const legal_name = String(formData.get('legal_name') || '').trim()
      const kind = String(formData.get('kind') || 'person') === 'company'
      const tax_id = String(formData.get('tax_id') || '').trim() || null
      if (!legal_name) throw new Error('Nombre requerido')

      const created = await s
        .from('counterparties')
        .insert({
          organization_id: (await s.auth.getUser()).data.user?.user_metadata?.organization_id ?? null,
          legal_name,
          is_company: kind,
          tax_id,
          as_third_party: true,
        })
        .select('id')
        .single()

      if (created.error) throw new Error(created.error.message)
      counterparty_id = created.data.id
    }

    const ins = await s
      .from('third_party_links')
      .insert({ artist_id: artistId, counterparty_id })
      .select('id')
      .single()

    // permitir duplicados silenciosamente
    if (ins.error && !(ins.error.message || '').toLowerCase().includes('duplicate')) {
      throw new Error(ins.error.message)
    }

    revalidatePath(pathnameForRevalidate)
  }

  async function unlinkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const up = await s
      .from('third_party_links')
      .update({ status: 'unlinked', unlinked_at: new Date().toISOString() })
      .eq('id', link_id)
    if (up.error) throw new Error(up.error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function addThirdConfig(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const income_type_id = String(formData.get('income_type_id') || '')
    const calc_base = String(formData.get('calc_base') || 'gross')
    const pct_third_party = Number(formData.get('pct_third_party') || 0)

    const ins = await s
      .from('third_party_income_configs')
      .insert({ third_party_link_id: link_id, income_type_id, calc_base, pct_third_party })

    if (ins.error) throw new Error(ins.error.message)
    revalidatePath(pathnameForRevalidate)
  }

  // ===== UI =====
  return (
    <div className="space-y-6">
      {isEdit && (
        <form action={linkThird} method="post" className="border border-gray-200 rounded p-3">
          <div className="font-medium mb-2">Añadir tercero</div>

          {/* ⬇️ Corrección crítica: el picker exige estas dos props */}
          <CounterpartyPicker
            nameCounterpartyId="counterparty_id"
            nameFiscalIdentityId="fiscal_identity_id"
          />

          <div className="mt-3">
            <button className="btn">Vincular</button>
          </div>
        </form>
      )}

      <div className="divide-y divide-gray-200">
        {(links || []).map((lnk) => {
          const cp = Array.isArray(lnk.counterparties) ? lnk.counterparties[0] : lnk.counterparties
          const cfgs = cfgByLink[lnk.id] || []

          return (
            <div key={lnk.id} className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={cp?.logo_url || '/avatar.png'}
                    className="w-8 h-8 rounded-full object-cover border"
                    alt=""
                  />
                  <div>
                    <Link href={`/terceros/${cp?.id}`} className="font-medium underline">
                      {cp?.nick || cp?.legal_name}
                    </Link>
                    {lnk.status === 'unlinked' && (
                      <span className="ml-2 badge badge-red">Desvinculado</span>
                    )}
                  </div>
                </div>

                {isEdit && lnk.status === 'linked' && (
                  <form action={unlinkThird} method="post">
                    <input type="hidden" name="link_id" value={lnk.id} />
                    <button className="btn-secondary">Desvincular</button>
                  </form>
                )}
              </div>

              <div className="mt-3 border rounded p-3">
                <div className="font-medium mb-2">Condiciones (tercero)</div>

                {isEdit && (
                  <form action={addThirdConfig} method="post" className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input type="hidden" name="link_id" value={lnk.id} />
                    <select name="income_type_id" className="border rounded px-2 py-1">
                      {incomeTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <select name="calc_base" className="border rounded px-2 py-1" defaultValue="gross">
                      <option value="gross">Sobre bruto</option>
                      <option value="net">Sobre neto</option>
                    </select>
                    <input
                      name="pct_third_party"
                      type="number"
                      step="0.01"
                      placeholder="% tercero"
                      className="border rounded px-2 py-1"
                    />
                    <button className="btn">Añadir</button>
                  </form>
                )}

                <div className="mt-3 text-sm">
                  {cfgs.length === 0 && <div className="text-gray-500">Sin condiciones de tercero.</div>}
                  {cfgs.map((c) => (
                    <div key={c.id} className="py-1">
                      {incomeTypeNameFromRow(c)} · {c.pct_third_party}% · {c.calc_base}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {(!links || links.length === 0) && (
          <div className="text-sm text-gray-500">No hay terceros vinculados.</div>
        )}
      </div>
    </div>
  )
}
