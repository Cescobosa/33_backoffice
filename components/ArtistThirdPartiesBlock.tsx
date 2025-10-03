import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import CounterpartyPicker from '@/components/CounterpartyPicker'
import { createSupabaseServer } from '@/lib/supabaseServer'

type IncomeType = { id: string; name: string }
type Props = {
  /** Artista al que se le vinculan terceros */
  artistId: string
  /** Mostrar formularios de edición */
  isEdit?: boolean
  /** Tipos de ingreso disponibles para crear condiciones de tercero */
  incomeTypes?: IncomeType[]
  /** Ruta a revalidar / redirigir tras cada acción */
  pathnameForRevalidate: string
}

export default async function ArtistThirdPartiesBlock({
  artistId,
  isEdit = false,
  incomeTypes = [],
  pathnameForRevalidate,
}: Props) {
  const s = createSupabaseServer()

  // Links (terceros vinculados)
  const { data: links, error: linksErr } = await s
    .from('third_party_links')
    .select(
      'id, status, linked_at, unlinked_at, counterparty_id, counterparties(id, legal_name, nick, logo_url)'
    )
    .eq('artist_id', artistId)
    .order('linked_at', { ascending: false })

  if (linksErr) throw new Error(linksErr.message)

  // Configuraciones por link
  const linkIds = (links || []).map((l) => l.id)
  const cfgsByLinkId: Record<string, any[]> = {}
  if (linkIds.length) {
    const { data: cfgs } = await s
      .from('third_party_income_configs')
      .select(
        'id, third_party_link_id, income_type_id, calc_base, pct_third_party, income_types(id,name)'
      )
      .in('third_party_link_id', linkIds)

    for (const c of cfgs || []) {
      if (!cfgsByLinkId[c.third_party_link_id]) cfgsByLinkId[c.third_party_link_id] = []
      cfgsByLinkId[c.third_party_link_id].push(c)
    }
  }

  // ===== Server actions =====
  async function linkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const counterparty_id = String(formData.get('counterparty_id') || '')
    if (!counterparty_id) throw new Error('Selecciona un tercero')

    const ins = await s
      .from('third_party_links')
      .insert({ artist_id: artistId, counterparty_id })
      .select('id')
      .single()

    // Permitimos idempotencia (si ya existe, ignoramos el error de duplicado)
    if (ins.error && !(ins.error.message || '').includes('duplicate key')) {
      throw new Error(ins.error.message)
    }

    revalidatePath(pathnameForRevalidate)
    redirect(pathnameForRevalidate)
  }

  async function unlinkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const { error } = await s
      .from('third_party_links')
      .update({ status: 'unlinked', unlinked_at: new Date().toISOString() })
      .eq('id', link_id)

    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
    redirect(pathnameForRevalidate)
  }

  async function addThirdConfig(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const income_type_id = String(formData.get('income_type_id') || '')
    const calc_base = String(formData.get('calc_base') || 'gross')
    const pct_third_party = Number(formData.get('pct_third_party') || 0)

    if (!link_id || !income_type_id) throw new Error('Faltan datos')

    const { error } = await s
      .from('third_party_income_configs')
      .insert({ third_party_link_id: link_id, income_type_id, calc_base, pct_third_party })

    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
    redirect(pathnameForRevalidate)
  }

  // ===== Render =====
  return (
    <ModuleCard
      title="Terceros vinculados"
      leftActions={<span className="badge">{isEdit ? 'Editar' : 'Ver'}</span>}
    >
      <div className="space-y-6">
        {isEdit && (
          <form action={linkThird} method="post" className="border border-gray-200 rounded p-3">
            <div className="font-medium mb-2">Añadir tercero</div>

            {/* 👇 CORRECCIÓN: CounterpartyPicker requiere estas dos props */}
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
            const cp = Array.isArray(lnk.counterparties)
              ? lnk.counterparties[0]
              : (lnk as any).counterparties

            const cfgs = cfgsByLinkId[lnk.id] || []

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

                {/* Configuraciones de tercero */}
                <div className="mt-3 border rounded p-3">
                  <div className="font-medium mb-2">Condiciones (tercero)</div>

                  {isEdit && (
                    <form
                      action={addThirdConfig}
                      method="post"
                      className="grid grid-cols-1 md:grid-cols-4 gap-2"
                    >
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
                    {cfgs.map((c: any) => (
                      <div key={c.id} className="py-1">
                        {c?.income_types?.name || 'Tipo'} · {c.pct_third_party}% · {c.calc_base}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {!links?.length && (
            <div className="text-sm text-gray-500">No hay terceros vinculados.</div>
          )}
        </div>
      </div>
    </ModuleCard>
  )
}
