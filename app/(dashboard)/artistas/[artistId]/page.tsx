import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ModuleCard from '@/components/ModuleCard'
import DateCountdown from '@/components/DateCountdown'
import CounterpartyPicker from '@/components/CounterpartyPicker'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'
import { isValidIBAN } from '@/lib/iban'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// helpers objeto/array (ya usados antes)
function incomeTypeNameFromRow(row: any): string | undefined {
  const it = row?.income_types
  if (Array.isArray(it)) return it[0]?.name
  return it?.name
}
function counterpartyFromLink(lnk: any): any | undefined {
  const c = lnk?.counterparties
  if (Array.isArray(c)) return c[0]
  return c
}

// ---------- fetchers ----------
async function getArtistFull(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('artists')
    .select('id, organization_id, stage_name, avatar_url, is_group, artist_contract_type, status')
    .eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
}
async function getPeople(artistId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('artist_people')
    .select('id, role, full_name, dni, birth_date, phone, address, photo_url')
    .eq('artist_id', artistId).order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}
async function getIncomeTypes(orgId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('income_types')
    .select('id, name, slug, is_booking_only, scope, artist_id')
    .eq('organization_id', orgId).eq('is_active', true).order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}
async function getArtistConfigs(artistId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('artist_income_configs')
    .select('id, income_type_id, mode, base, pct_office, pct_artist, income_types(id,name,slug)')
    .eq('artist_id', artistId).order('id')
  if (error) throw new Error(error.message)
  return data || []
}
async function getContracts(entityType: 'artist'|'counterparty', entityId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('contracts')
    .select('id, name, signed_at, expires_at, renew_at, is_active, pdf_url')
    .eq('entity_type', entityType).eq('entity_id', entityId)
    .order('is_active', { ascending: false }).order('signed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
async function getMinRules(artistId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('min_exempt_rules')
    .select('id, income_type_id, rule_kind, until_amount_total, until_op_count, until_date, until_artist_generated_amount, base, active, income_types(id,name)')
    .eq('artist_id', artistId).order('created_at')
  if (error) throw new Error(error.message)
  return data || []
}
async function getAdvances(artistId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('artist_advances')
    .select('id, income_type_id, amount, advance_date, amortized, note, income_types(id,name)')
    .eq('artist_id', artistId).order('advance_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
async function getLinks(artistId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('third_party_links')
    .select('id, status, linked_at, unlinked_at, counterparty_id, counterparties(id,legal_name,nick,logo_url)')
    .eq('artist_id', artistId).order('linked_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}
async function getLinkConfigs(linkId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('third_party_income_configs')
    .select('id, income_type_id, calc_base, pct_third_party, income_types(id,name)')
    .eq('third_party_link_id', linkId)
  if (error) throw new Error(error.message)
  return data || []
}

// ---------- page ----------
export default async function ArtistDetail({ params, searchParams }: { params: { artistId: string }, searchParams: { tab?: string } }) {
  const id = params.artistId
  const tab = searchParams.tab || 'basicos'

  const artist = await getArtistFull(id)
  if (!artist) notFound()

  const [people, incomeTypes, configs, contracts, minRules, advances, links] = await Promise.all([
    getPeople(id),
    getIncomeTypes(artist.organization_id),
    getArtistConfigs(id),
    getContracts('artist', id),
    getMinRules(id),
    getAdvances(id),
    getLinks(id)
  ])
  const linkConfigsArr = await Promise.all(links.map(l => getLinkConfigs(l.id)))

  // ---------- server actions ----------
  async function updateBasic(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const stage_name = String(formData.get('stage_name') || '').trim()
    const is_group = formData.get('is_group') === 'on'
    const artist_contract_type = (formData.get('artist_contract_type') === 'booking') ? 'booking' : 'general'
    let avatar_url: string | null = null
    const file = formData.get('avatar') as File | null
    if (file && file.size > 0) {
      await ensurePublicBucket('avatars')
      const path = `${artist.organization_id}/artists/${artist.id}/${crypto.randomUUID()}`
      const up = await s.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      avatar_url = s.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    }
    const { error } = await s.from('artists').update({
      stage_name: stage_name || artist.stage_name,
      is_group,
      artist_contract_type,
      ...(avatar_url ? { avatar_url } : {})
    }).eq('id', artist.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}`)
  }

  async function addPerson(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const role = String(formData.get('role') || 'holder') as 'holder'|'member'
    const full_name = String(formData.get('full_name') || '').trim()
    const dni = String(formData.get('dni') || '').trim() || null
    const birth_date = String(formData.get('birth_date') || '') || null
    const phone = String(formData.get('phone') || '').trim() || null
    const address = String(formData.get('address') || '').trim() || null
    if (!full_name) throw new Error('Nombre completo requerido')
    const { error } = await s.from('artist_people').insert({ artist_id: artist.id, role, full_name, dni, birth_date, phone, address })
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}`)
  }

  async function delPerson(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const pid = String(formData.get('person_id') || '')
    const { error } = await s.from('artist_people').delete().eq('id', pid).eq('artist_id', artist.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}`)
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
    const path = `${artist.organization_id}/artists/${artist.id}/contracts/${crypto.randomUUID()}.pdf`
    const up = await s.storage.from('contracts').upload(path, pdf, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
    if (up.error) throw new Error(up.error.message)
    const pdf_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl

    const { error } = await s.from('contracts').insert({ entity_type: 'artist', entity_id: artist.id, name, signed_at, expires_at, renew_at, is_active, pdf_url })
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}`)
  }

  async function addConfig(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const mode = String(formData.get('mode') || 'commission')
    const base = String(formData.get('base') || 'gross')
    const pct_office = Number(formData.get('pct_office') || 0)
    const pct_artist = Number(formData.get('pct_artist') || 0)
    const income_type_id = String(formData.get('income_type_id') || '')
    if (!income_type_id) throw new Error('Tipo de ingreso requerido')
    const effectiveMode = artist.artist_contract_type === 'booking' ? 'commission' : mode
    const { error } = await s.from('artist_income_configs').insert({
      artist_id: artist.id, income_type_id, mode: effectiveMode as any, base,
      pct_office: pct_office || null, pct_artist: effectiveMode === 'split' ? pct_artist : null
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}?tab=condiciones`)
  }

  async function addShare(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const income_type_id = String(formData.get('income_type_id') || '')
    const entries: { pid: string, pct: number }[] = []
    formData.forEach((v, k) => { if (k.startsWith('share_')) entries.push({ pid: k.replace('share_', ''), pct: Number(v) || 0 }) })
    const { error: delErr } = await s.from('artist_group_shares').delete().eq('artist_id', artist.id).eq('income_type_id', income_type_id)
    if (delErr) throw new Error(delErr.message)
    const rows = entries.filter(e => e.pct > 0).map(e => ({ artist_id: artist.id, income_type_id, artist_person_id: e.pid, percentage: e.pct }))
    if (rows.length) {
      const { error } = await s.from('artist_group_shares').insert(rows)
      if (error) throw new Error(error.message)
    }
    revalidatePath(`/artistas/${artist.id}?tab=reparto`)
  }

  async function addMinRule(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const income_type_id = String(formData.get('income_type_id') || '')
    const rule_kind = String(formData.get('rule_kind') || 'per_operation')
    const base = String(formData.get('base') || 'gross')
    const until_amount_total = formData.get('until_amount_total') ? Number(formData.get('until_amount_total')) : null
    const until_op_count = formData.get('until_op_count') ? Number(formData.get('until_op_count')) : null
    const until_date = String(formData.get('until_date') || '') || null
    const until_artist_generated_amount = formData.get('until_artist_generated_amount') ? Number(formData.get('until_artist_generated_amount')) : null
    const { error } = await s.from('min_exempt_rules').insert({
      artist_id: artist.id, income_type_id, rule_kind, base,
      until_amount_total, until_op_count, until_date, until_artist_generated_amount
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}?tab=minimos`)
  }

  async function addAdvance(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const income_type_id = String(formData.get('income_type_id') || '')
    const amount = Number(formData.get('amount') || 0)
    const advance_date = String(formData.get('advance_date') || '') || null
    const note = String(formData.get('note') || '').trim() || null
    if (!income_type_id || !amount || !advance_date) throw new Error('Campos requeridos')
    const { error } = await s.from('artist_advances').insert({ artist_id: artist.id, income_type_id, amount, advance_date, note })
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}?tab=adelantos`)
  }

  async function saveFiscal(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const invoice_as = (String(formData.get('invoice_as') || 'person') === 'company') ? 'company' : 'person'
    const fiscal_name = String(formData.get('fiscal_name') || '').trim()
    const tax_id = String(formData.get('tax_id') || '').trim()
    const fiscal_address = String(formData.get('fiscal_address') || '').trim()
    const iban = String(formData.get('iban') || '').trim()
    const settlement_email = String(formData.get('settlement_email') || '').trim() || null
    const agent_name = String(formData.get('agent_name') || '').trim() || null
    const agent_phone = String(formData.get('agent_phone') || '').trim() || null
    const agent_email = String(formData.get('agent_email') || '').trim() || null
    let iban_certificate_url: string | null = null
    const cert = formData.get('iban_cert') as File | null
    if (iban && !isValidIBAN(iban)) throw new Error('IBAN no válido (dejar vacío si no aplica)')
    if (cert && cert.size > 0) {
      await ensurePublicBucket('contracts')
      const path = `${artist.organization_id}/artists/${artist.id}/iban/${crypto.randomUUID()}.pdf`
      const up = await s.storage.from('contracts').upload(path, cert, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
      if (up.error) throw new Error(up.error.message)
      iban_certificate_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl
    }
    const existing = await s.from('fiscal_identities').select('id').eq('owner_type', 'artist').eq('owner_id', artist.id).maybeSingle()
    if (existing.data) {
      const { error } = await s.from('fiscal_identities').update({
        invoice_as, fiscal_name, tax_id, fiscal_address, iban, settlement_email, agent_name, agent_phone, agent_email,
        ...(iban_certificate_url ? { iban_certificate_url } : {})
      }).eq('id', existing.data.id)
      if (error) throw new Error(error.message)
    } else {
      if (!fiscal_name || !tax_id || !fiscal_address || !iban) { return }
      const { error } = await s.from('fiscal_identities').insert({
        owner_type: 'artist', owner_id: artist.id,
        invoice_as, fiscal_name, tax_id, fiscal_address, iban, settlement_email, agent_name, agent_phone, agent_email, iban_certificate_url
      })
      if (error) throw new Error(error.message)
    }
    revalidatePath(`/artistas/${artist.id}?tab=fiscales`)
  }

  // ---- FIX VINCULAR TERCERO (robusto) ----
  async function linkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    // Derivamos el modo por contenido: si hay counterparty_id -> existing; si hay legal_name -> create.
    const counterparty_id = String(formData.get('counterparty_id') || '')
    const legal_name = String(formData.get('legal_name') || '').trim()
    const kindIsCompany = String(formData.get('kind') || '') === 'company'
    const tax_id = String(formData.get('tax_id') || '').trim() || null

    let id = counterparty_id || ''

    // Crear si no viene ID y tenemos datos de alta
    if (!id && legal_name) {
      const { data: org } = await s.from('organizations').select('id').limit(1).single()
      // upsert por unique_key (ya creado en tu SQL)
      const up = await s.from('counterparties')
        .upsert({
          organization_id: org!.id,
          is_company: kindIsCompany,
          legal_name,
          tax_id,
          as_third_party: true
        }, { onConflict: 'unique_key' })
        .select('id').single()
      if (up.error) throw new Error(up.error.message)
      id = up.data.id
      // nos aseguramos de activar el flag de tercero si existía como proveedor
      await s.from('counterparties').update({ as_third_party: true }).eq('id', id)
    }

    if (!id) throw new Error('Selecciona un tercero o introduce los datos para crearlo')

    // Insertar vínculo (si ya existe "linked" lo ignoramos)
    const ins = await s.from('third_party_links').insert({ counterparty_id: id, artist_id: artist.id }).select('id').single()
    if (ins.error && !(ins.error.message || '').includes('duplicate key')) throw new Error(ins.error.message)

    revalidatePath(`/artistas/${artist.id}?tab=terceros`)
  }

  async function unlinkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const { error } = await s.from('third_party_links').update({ status: 'unlinked', unlinked_at: new Date().toISOString() }).eq('id', link_id)
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}?tab=terceros`)
  }

  async function addThirdConfig(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const income_type_id = String(formData.get('income_type_id') || '')
    const calc_base = String(formData.get('calc_base') || 'gross')
    const pct_third_party = Number(formData.get('pct_third_party') || 0)
    const { error } = await s.from('third_party_income_configs')
      .insert({ third_party_link_id: link_id, income_type_id, calc_base, pct_third_party })
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}?tab=terceros`)
  }

  // ---- Archivado / Recuperación (con refresco) ----
  async function archiveArtist() { 'use server'
    const s = createSupabaseServer()
    const { error } = await s.from('artists').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', artist.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}`)
  }
  async function recoverArtist() { 'use server'
    const s = createSupabaseServer()
    const { error } = await s.from('artists').update({ status: 'active', archived_at: null }).eq('id', artist.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/artistas/${artist.id}`)
  }
  async function deleteArtist(formData: FormData) {
    'use server'
    const word = String(formData.get('confirm') || '')
    if (word !== 'ELIMINAR') throw new Error('Debes escribir ELIMINAR')
    const s = createSupabaseServer()
    await s.from('artist_group_shares').delete().eq('artist_id', artist.id)
    await s.from('artist_advances').delete().eq('artist_id', artist.id)
    await s.from('min_exempt_rules').delete().eq('artist_id', artist.id)
    await s.from('artist_income_configs').delete().eq('artist_id', artist.id)
    await s.from('artist_people').delete().eq('artist_id', artist.id)
    await s.from('third_party_links').delete().eq('artist_id', artist.id)
    await s.from('contracts').delete().eq('entity_type', 'artist').eq('entity_id', artist.id)
    await s.from('fiscal_identities').delete().eq('owner_type','artist').eq('owner_id', artist.id)
    const { error } = await s.from('artists').delete().eq('id', artist.id)
    if (error) throw new Error(error.message)
    redirect('/artistas')
  }

  // ---------- UI ----------
  const tabs = [
    { key: 'basicos', label: 'Datos básicos' },
    { key: 'personales', label: 'Datos personales' },
    { key: 'contratos', label: 'Contratos' },
    { key: 'condiciones', label: 'Condiciones económicas' },
    ...(artist.is_group ? [{ key: 'reparto', label: 'Reparto artista' }] : []),
    { key: 'minimos', label: 'Mínimos exentos' },
    { key: 'adelantos', label: 'Adelantos' },
    { key: 'fiscales', label: 'Datos fiscales' },
    { key: 'terceros', label: 'Terceros vinculados' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{artist.stage_name}</h1>
          <div className="text-sm text-gray-500">
            {artist.is_group ? 'Grupo' : 'Solista'} · {artist.artist_contract_type === 'booking' ? 'Booking' : 'General'}
            {artist.status === 'archived' && <span className="ml-2 badge badge-red">Archivado</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {artist.status === 'active'
            ? <form action={archiveArtist}><button className="btn-secondary">Archivar</button></form>
            : (
              <>
                <form action={recoverArtist}><button className="btn-secondary">Recuperar</button></form>
                <form action={deleteArtist} className="flex gap-2">
                  <input name="confirm" placeholder="Escribe ELIMINAR" className="border rounded px-2 py-1" />
                  <button className="btn">Eliminar</button>
                </form>
              </>
            )
          }
          <Link className="btn-secondary" href="/artistas">Volver</Link>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map(t => (
          <Link key={t.key} href={{ pathname: `/artistas/${artist.id}`, query: { tab: t.key } }} className={`px-3 py-2 rounded-md ${tab === t.key ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>{t.label}</Link>
        ))}
      </div>

      {/* ... (resto de módulos iguales a la versión anterior) ... */}

      {/* TERCEROS VINCULADOS */}
      {tab === 'terceros' && (
        <ModuleCard title="Terceros vinculados" leftActions={<span className="badge">Editar</span>}>
          <div className="space-y-6">
            <form action={linkThird} className="border border-gray-200 rounded p-3">
              <div className="font-medium mb-2">Añadir tercero</div>
              {/* Buscador con autocompletado + creación inline */}
              {/* @ts-expect-error Client Component */}
              <CounterpartyPicker />
              <div className="mt-3"><button className="btn">Vincular</button></div>
            </form>

            <div className="divide-y divide-gray-200">
              {links.map((lnk, i) => {
                const cfgs = linkConfigsArr[i] || []
                const cp = counterpartyFromLink(lnk)
                return (
                  <div key={lnk.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cp?.logo_url || '/avatar.png'} className="w-8 h-8 rounded-full object-cover border" alt="" />
                        <div>
                          <div className="font-medium">{cp?.nick || cp?.legal_name}</div>
                          {lnk.status === 'unlinked' && <span className="badge badge-red">Desvinculado</span>}
                        </div>
                      </div>
                      {lnk.status === 'linked' && (
                        <form action={unlinkThird}><input type="hidden" name="link_id" value={lnk.id} /><button className="btn-secondary">Desvincular</button></form>
                      )}
                    </div>

                    {/* Condiciones del vínculo */}
                    <div className="mt-3 border rounded p-3">
                      <div className="font-medium mb-2 module-title">Condiciones (tercero)</div>
                      <form action={addThirdConfig} className="grid grid-cols-1 md:grid-cols-4 gap-2">
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

                      <div className="mt-3 text-sm">
                        {cfgs.length === 0 && <div className="text-gray-500">Sin condiciones de tercero.</div>}
                        {cfgs.map((c: any) => (<div key={c.id} className="py-1">{incomeTypeNameFromRow(c)} · {c.pct_third_party}% · {c.calc_base}</div>))}
                      </div>
                    </div>
                  </div>
                )
              })}
              {!links.length && <div className="text-sm text-gray-500">No hay terceros vinculados.</div>}
            </div>
          </div>
        </ModuleCard>
      )}
    </div>
  )
}
