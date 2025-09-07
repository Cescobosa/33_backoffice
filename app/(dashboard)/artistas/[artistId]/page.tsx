import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import DateCountdown from '@/components/DateCountdown'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'
import { isValidIBAN } from '@/lib/iban'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lee el nombre del income type tanto si viene como objeto como si viene como array */
function incomeTypeNameFromRow(row: any): string | undefined {
  const it = row?.income_types
  if (Array.isArray(it)) return it[0]?.name
  return it?.name
}

async function getArtistFull(id: string) {
  const s = createSupabaseServer()
  const { data: artist, error } = await s
    .from('artists')
    .select('id, organization_id, stage_name, avatar_url, is_group, artist_contract_type, status')
    .eq('id', id).single()
  if (error) throw new Error(error.message)
  return artist
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

  // Pre-carga de condiciones por vínculo de terceros (evitar map async en el render)
  const linkConfigsArr = await Promise.all(links.map(l => getLinkConfigs(l.id)))

  // ========== SERVER ACTIONS ==========

  async function updateBasic(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
    const stage_name = String(formData.get('stage_name') || '').trim()
    const is_group = formData.get('is_group') === 'on'
    const artist_contract_type = (formData.get('artist_contract_type') === 'booking') ? 'booking' : 'general'
    let avatar_url: string | null = null
    const file = formData.get('avatar') as File | null
    if (file && file.size > 0) {
      await ensurePublicBucket('avatars')
      const path = `${artist.organization_id}/artists/${artist.id}/${crypto.randomUUID()}`
      const up = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      const pub = supabase.storage.from('avatars').getPublicUrl(up.data.path)
      avatar_url = pub.data.publicUrl
    }
    const { error } = await supabase.from('artists').update({ stage_name: stage_name || artist.stage_name, is_group, artist_contract_type, ...(avatar_url ? { avatar_url } : {}) }).eq('id', artist.id)
    if (error) throw new Error(error.message)
  }

  async function addPerson(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
    const role = String(formData.get('role') || 'holder') as 'holder'|'member'
    const full_name = String(formData.get('full_name') || '').trim()
    const dni = String(formData.get('dni') || '').trim() || null
    const birth_date = String(formData.get('birth_date') || '') || null
    const phone = String(formData.get('phone') || '').trim() || null
    const address = String(formData.get('address') || '').trim() || null
    if (!full_name) throw new Error('Nombre completo requerido')
    const { error } = await supabase.from('artist_people').insert({ artist_id: artist.id, role, full_name, dni, birth_date, phone, address })
    if (error) throw new Error(error.message)
  }

  async function delPerson(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
    const pid = String(formData.get('person_id') || '')
    const { error } = await supabase.from('artist_people').delete().eq('id', pid).eq('artist_id', artist.id)
    if (error) throw new Error(error.message)
  }

  async function addContract(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
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
    const path = `${artist.organization_id}/artists/${artist.id}/contracts/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('contracts').upload(path, pdf, { cacheControl: '3600', upsert: false, contentType: pdf.type || 'application/pdf' })
    if (up.error) throw new Error(up.error.message)
    const pub = supabase.storage.from('contracts').getPublicUrl(up.data.path)

    const { error } = await supabase.from('contracts').insert({ entity_type: 'artist', entity_id: artist.id, name, signed_at, expires_at, renew_at, is_active, pdf_url: pub.data.publicUrl })
    if (error) throw new Error(error.message)
  }

  async function addConfig(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
    const mode = String(formData.get('mode') || 'commission')
    const base = String(formData.get('base') || 'gross')
    const pct_office = Number(formData.get('pct_office') || 0)
    const pct_artist = Number(formData.get('pct_artist') || 0)
    const income_type_id = String(formData.get('income_type_id') || '')
    if (!income_type_id) throw new Error('Tipo de ingreso requerido')
    const effectiveMode = artist.artist_contract_type === 'booking' ? 'commission' : mode
    const { error } = await supabase.from('artist_income_configs').insert({ artist_id: artist.id, income_type_id, mode: effectiveMode as any, base, pct_office: pct_office || null, pct_artist: effectiveMode === 'split' ? pct_artist : null })
    if (error) throw new Error(error.message)
  }

  async function addShare(formData: FormData) {
    'use server'
    const supabase = createSupabaseServer()
    const income_type_id = String(formData.get('income_type_id') || '')
    if (!income_type_id) throw new Error('Tipo requerido')
    const entries: { pid: string, pct: number }[] = []
    formData.forEach((v, k) => {
      if (k.startsWith('share_')) {
        entries.push({ pid: k.replace('share_', ''), pct: Number(v) || 0 })
      }
    })
    const { error: delErr } = await supabase.from('artist_group_shares').delete().eq('artist_id', artist.id).eq('income_type_id', income_type_id)
    if (delErr) throw new Error(delErr.message)
    const rows = entries.filter(e => e.pct > 0).map(e => ({ artist_id: artist.id, income_type_id, artist_person_id: e.pid, percentage: e.pct }))
    if (rows.length) {
      const { error } = await supabase.from('artist_group_shares').insert(rows)
      if (error) throw new Error(error.message)
    }
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
    const { error } = await s.from('min_exempt_rules').insert({ artist_id: artist.id, income_type_id, rule_kind, base, until_amount_total, until_op_count, until_date, until_artist_generated_amount })
    if (error) throw new Error(error.message)
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
      const path = `${artist.organization_id}/artists/${artist.id}/iban/${crypto.randomUUID()}`
      const up = await s.storage.from('contracts').upload(path, cert, { cacheControl: '3600', upsert: false, contentType: cert.type || 'application/pdf' })
      if (up.error) throw new Error(up.error.message)
      const pub = s.storage.from('contracts').getPublicUrl(up.data.path)
      iban_certificate_url = pub.data.publicUrl
    }
    const existing = await s.from('fiscal_identities').select('id').eq('owner_type', 'artist').eq('owner_id', artist.id).maybeSingle()
    if (existing.error && existing.error.code !== 'PGRST116') throw new Error(existing.error.message)
    if (existing.data) {
      const { error } = await s.from('fiscal_identities').update({
        invoice_as, fiscal_name, tax_id, fiscal_address, iban, settlement_email, agent_name, agent_phone, agent_email, ...(iban_certificate_url ? { iban_certificate_url } : {})
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
  }

  async function linkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const mode = String(formData.get('mode') || 'existing') // existing | create
    let counterparty_id: string | null = null

    if (mode === 'existing') {
      counterparty_id = String(formData.get('counterparty_id') || '')
      if (!counterparty_id) throw new Error('Selecciona un tercero')
    } else {
      const legal_name = String(formData.get('legal_name') || '').trim()
      const kind = String(formData.get('kind') || 'person') === 'company'
      const tax_id = String(formData.get('tax_id') || '').trim() || null
      if (!legal_name) throw new Error('Nombre requerido')

      const { data: created, error } = await s.from('counterparties')
        .upsert({ organization_id: artist.organization_id, legal_name, is_company: kind, tax_id, as_third_party: true }, { onConflict: 'unique_key' })
        .select('id').single()
      if (error) throw new Error(error.message)

      await s.from('counterparties').update({ as_third_party: true }).eq('id', created.id)
      counterparty_id = created.id
    }

    const { error: linkErr } = await s.from('third_party_links').insert({ counterparty_id, artist_id: artist.id }).select('id').single()
    if (linkErr && !(linkErr.message || '').includes('duplicate key value violates unique constraint')) {
      throw new Error(linkErr.message)
    }
  }

  async function unlinkThird(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const { error } = await s.from('third_party_links').update({ status: 'unlinked', unlinked_at: new Date().toISOString() }).eq('id', link_id)
    if (error) throw new Error(error.message)
  }

  async function addThirdConfig(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const link_id = String(formData.get('link_id') || '')
    const income_type_id = String(formData.get('income_type_id') || '')
    const calc_base = String(formData.get('calc_base') || 'gross')
    const pct_third_party = Number(formData.get('pct_third_party') || 0)
    const { error } = await s.from('third_party_income_configs').insert({ third_party_link_id: link_id, income_type_id, calc_base, pct_third_party })
    if (error) throw new Error(error.message)
  }

  async function archiveArtist() { 'use server'
    const s = createSupabaseServer()
    const { error } = await s.from('artists').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', artist.id)
    if (error) throw new Error(error.message)
  }
  async function recoverArtist() { 'use server'
    const s = createSupabaseServer()
    const { error } = await s.from('artists').update({ status: 'active', archived_at: null }).eq('id', artist.id)
    if (error) throw new Error(error.message)
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

      {/* BASICOS */}
      {tab === 'basicos' && (
        <ModuleCard title="Datos básicos" leftActions={<span className="badge">Editar</span>}>
          <form action={updateBasic} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 module-title">Fotografía</label>
              <input type="file" name="avatar" accept="image/*" />
              {artist.avatar_url && (<div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artist.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border" />
              </div>)}
            </div>
            <div>
              <label className="block text-sm mb-1 module-title">Nombre artístico</label>
              <input name="stage_name" defaultValue={artist.stage_name} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex items-center gap-2">
              <input id="is_group" name="is_group" type="checkbox" defaultChecked={artist.is_group} />
              <label htmlFor="is_group" className="text-sm">¿Es grupo?</label>
            </div>
            <div>
              <div className="block text-sm mb-1 module-title">Tipo de contrato</div>
              <label className="mr-4"><input type="radio" name="artist_contract_type" value="general" defaultChecked={artist.artist_contract_type !== 'booking'} /> General</label>
              <label className="ml-4"><input type="radio" name="artist_contract_type" value="booking" defaultChecked={artist.artist_contract_type === 'booking'} /> Booking</label>
            </div>
            <div className="md:col-span-2"><button className="btn">Guardar cambios</button></div>
          </form>
        </ModuleCard>
      )}

      {/* PERSONALES */}
      {tab === 'personales' && (
        <ModuleCard title="Datos personales" leftActions={<span className="badge">Editar</span>}>
          <div className="space-y-4">
            <form action={addPerson} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1 module-title">Rol</label>
                <select name="role" className="w-full border rounded px-3 py-2" defaultValue={artist.is_group ? 'member' : 'holder'}>
                  <option value="holder">Titular</option>
                  <option value="member">Miembro</option>
                </select>
              </div>
              <div><label className="block text-sm mb-1 module-title">Nombre completo</label><input name="full_name" className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">DNI</label><input name="dni" className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Fecha de nacimiento</label><input type="date" name="birth_date" className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Teléfono</label><input name="phone" className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Domicilio</label><input name="address" className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-3"><button className="btn">+ Añadir persona</button></div>
            </form>

            <div className="divide-y divide-gray-200">
              {people.map(p => (
                <div key={p.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-gray-600">{p.role} · {p.dni || ''}</div>
                  </div>
                  <form action={delPerson}><input type="hidden" name="person_id" value={p.id} /><button className="btn-secondary">Eliminar</button></form>
                </div>
              ))}
              {!people.length && <div className="text-sm text-gray-500">No hay personas registradas.</div>}
            </div>
          </div>
        </ModuleCard>
      )}

      {/* CONTRATOS */}
      {tab === 'contratos' && (
        <ModuleCard title="Contratos" leftActions={<span className="badge">Editar</span>}>
          <form action={addContract} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm mb-1 module-title">Nombre *</label><input name="name" required className="w-full border rounded px-3 py-2" /></div>
            <div><label className="block text-sm mb-1">Fecha firma *</label><input type="date" name="signed_at" required className="w-full border rounded px-3 py-2" /></div>
            <div><label className="block text-sm mb-1">Vencimiento</label><input type="date" name="expires_at" className="w-full border rounded px-3 py-2" /></div>
            <div><label className="block text-sm mb-1">Renovación</label><input type="date" name="renew_at" className="w-full border rounded px-3 py-2" /></div>
            <div className="flex items-center gap-2 mt-6"><input type="checkbox" id="is_active" name="is_active" defaultChecked /><label htmlFor="is_active" className="text-sm">Vigente</label></div>
            <div className="md:col-span-2"><label className="block text-sm mb-1 module-title">PDF *</label><input type="file" name="pdf" required accept="application/pdf" /></div>
            <div className="md:col-span-2"><button className="btn">+ Añadir contrato</button></div>
          </form>

          <div className="divide-y divide-gray-200 mt-4">
            {contracts.map(c => (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{c.name}</span>
                  {c.is_active ? <span className="badge badge-green">Vigente</span> : <span className="badge badge-red">No vigente</span>}
                  <DateCountdown to={c.renew_at || c.expires_at} />
                </div>
                <div className="text-xs text-gray-600 mt-1">{c.signed_at ? `Fecha firma: ${new Date(c.signed_at).toLocaleDateString()}` : ''}</div>
                <div className="mt-2"><a href={c.pdf_url} target="_blank" className="underline text-blue-700">Ver PDF</a></div>
              </div>
            ))}
            {!contracts.length && <div className="text-sm text-gray-500">Sin contratos.</div>}
          </div>
        </ModuleCard>
      )}

      {/* CONDICIONES */}
      {tab === 'condiciones' && (
        <ModuleCard title="Condiciones económicas" leftActions={<span className="badge">Editar</span>}>
          <form action={addConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1 module-title">Tipo de ingreso</label>
              <select name="income_type_id" className="w-full border rounded px-3 py-2">
                {incomeTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.is_booking_only ? ' (Booking)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 module-title">Modo</label>
              <select name="mode" className="w-full border rounded px-3 py-2" defaultValue={artist.artist_contract_type === 'booking' ? 'commission' : 'commission'}>
                <option value="commission">Comisión oficina</option>
                {artist.artist_contract_type !== 'booking' && <option value="split">Reparto (artista/oficina)</option>}
              </select>
              <label className="block text-sm mb-1 mt-3 module-title">Base</label>
              <select name="base" className="w-full border rounded px-3 py-2" defaultValue="gross">
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 module-title">% Oficina / % Artista</label>
              <div className="flex items-center gap-2">
                <input name="pct_office" type="number" step="0.01" className="w-28 border rounded px-3 py-2" placeholder="% oficina" />
                {artist.artist_contract_type !== 'booking' && (
                  <input name="pct_artist" type="number" step="0.01" className="w-28 border rounded px-3 py-2" placeholder="% artista" />
                )}
              </div>
              <div className="mt-3"><button className="btn">+ Añadir condición</button></div>
            </div>
          </form>

          <div className="divide-y divide-gray-200 mt-6">
            {configs.map(c => (
              <div key={c.id} className="py-3">
                <div className="font-medium">{incomeTypeNameFromRow(c)}</div>
                <div className="text-sm text-gray-600">
                  {c.mode === 'commission'
                    ? `Comisión oficina: ${c.pct_office ?? 0}% · Base: ${c.base}`
                    : `Reparto → Artista: ${c.pct_artist ?? 0}% · Oficina: ${c.pct_office ?? 0}% · Base: ${c.base}`}
                </div>
              </div>
            ))}
            {!configs.length && <div className="text-sm text-gray-500">Sin condiciones.</div>}
          </div>
        </ModuleCard>
      )}

      {/* REPARTO (grupo) */}
      {tab === 'reparto' && artist.is_group && (
        <ModuleCard title="Reparto Artista (suma 100%)" leftActions={<span className="badge">Editar</span>}>
          {configs.map(cfg => (
            <form key={cfg.id} action={addShare} className="border border-gray-200 rounded p-3 mb-4">
              <input type="hidden" name="income_type_id" value={cfg.income_type_id} />
              <div className="font-medium mb-2">{incomeTypeNameFromRow(cfg)}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {people.filter(p => p.role !== 'holder').map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-sm">{p.full_name}</span>
                    <input type="number" step="0.01" name={`share_${p.id}`} placeholder="%" className="w-24 border rounded px-2 py-1" />
                  </div>
                ))}
              </div>
              <div className="mt-3"><button className="btn">Guardar reparto</button></div>
            </form>
          ))}
          {!configs.length && <div className="text-sm text-gray-500">Primero define condiciones económicas.</div>}
        </ModuleCard>
      )}

      {/* MÍNIMOS EXENTOS */}
      {tab === 'minimos' && (
        <ModuleCard title="Mínimos exentos" leftActions={<span className="badge">Editar</span>}>
          <form action={addMinRule} className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm mb-1 module-title">Tipo ingreso</label>
              <select name="income_type_id" className="w-full border rounded px-2 py-1">
                {incomeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 module-title">Regla</label>
              <select name="rule_kind" className="w-full border rounded px-2 py-1" defaultValue="per_operation">
                <option value="per_operation">Por operación</option>
                <option value="until_threshold">Hasta cubrir umbral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 module-title">Base</label>
              <select name="base" className="w-full border rounded px-2 py-1" defaultValue="gross">
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-2">
              <input name="until_amount_total" type="number" step="0.01" placeholder="Importe total (opcional)" className="border rounded px-2 py-1" />
              <input name="until_op_count" type="number" placeholder="Nº operaciones (opcional)" className="border rounded px-2 py-1" />
              <input name="until_date" type="date" className="border rounded px-2 py-1" />
              <input name="until_artist_generated_amount" type="number" step="0.01" placeholder="Generado por artista (opcional)" className="border rounded px-2 py-1" />
            </div>
            <div className="lg:col-span-4"><button className="btn">+ Añadir regla</button></div>
          </form>

          <div className="divide-y divide-gray-200 mt-4">
            {minRules.map(r => (
              <div key={r.id} className="py-2">
                <div className="font-medium">{incomeTypeNameFromRow(r)}</div>
                <div className="text-sm text-gray-600">
                  {r.rule_kind === 'per_operation' ? 'Por operación' : 'Hasta cubrir umbral'} · Base: {r.base}
                </div>
              </div>
            ))}
            {!minRules.length && <div className="text-sm text-gray-500">Aún no hay reglas.</div>}
          </div>
        </ModuleCard>
      )}

      {/* ADELANTOS */}
      {tab === 'adelantos' && (
        <ModuleCard title="Adelantos" leftActions={<span className="badge">Editar</span>}>
          <form action={addAdvance} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm mb-1 module-title">Tipo ingreso</label>
              <select name="income_type_id" className="w-full border rounded px-2 py-1">
                {incomeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm mb-1 module-title">Importe</label><input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1 module-title">Fecha</label><input name="advance_date" type="date" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">Nota</label><input name="note" className="w-full border rounded px-2 py-1" /></div>
            <div className="md:col-span-4"><button className="btn">+ Añadir adelanto</button></div>
          </form>

          <div className="divide-y divide-gray-200 mt-4">
            {advances.map(a => (
              <div key={a.id} className="py-2">
                <div className="font-medium">{incomeTypeNameFromRow(a)}</div>
                <div className="text-sm text-gray-600">
                  {new Date(a.advance_date).toLocaleDateString()} · {Number(a.amount).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}
                </div>
              </div>
            ))}
            {!advances.length && <div className="text-sm text-gray-500">Sin adelantos.</div>}
          </div>
        </ModuleCard>
      )}

      {/* FISCALES */}
      {tab === 'fiscales' && (
        <ModuleCard title="Datos fiscales" leftActions={<span className="badge">Editar</span>}>
          <form action={saveFiscal} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 module-title">Factura como</label>
              <select name="invoice_as" className="w-full border rounded px-2 py-1">
                <option value="person">Particular</option>
                <option value="company">Empresa</option>
              </select>
            </div>
            <div><label className="block text-sm mb-1 module-title">Nombre fiscal</label><input name="fiscal_name" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">DNI / CIF</label><input name="tax_id" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">Domicilio fiscal</label><input name="fiscal_address" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1 module-title">IBAN</label><input name="iban" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">Certificado titularidad (opcional)</label><input type="file" name="iban_cert" /></div>
            <div><label className="block text-sm mb-1">Email liquidaciones</label><input name="settlement_email" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">Gestor (nombre)</label><input name="agent_name" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">Gestor (tel)</label><input name="agent_phone" className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-sm mb-1">Gestor (email)</label><input name="agent_email" className="w-full border rounded px-2 py-1" /></div>
            <div className="md:col-span-2"><button className="btn">Guardar fiscales</button></div>
          </form>
        </ModuleCard>
      )}

      {/* TERCEROS VINCULADOS */}
      {tab === 'terceros' && (
        <ModuleCard title="Terceros vinculados" leftActions={<span className="badge">Editar</span>}>
          <div className="space-y-6">
            <form action={linkThird} className="border border-gray-200 rounded p-3">
              <div className="font-medium mb-2">Añadir tercero</div>
              <div className="flex items-center gap-3">
                <select name="mode" className="border rounded px-2 py-1">
                  <option value="existing">Seleccionar existente (ID)</option>
                  <option value="create">Crear nuevo</option>
                </select>
                <input name="counterparty_id" placeholder="ID tercero (si existente)" className="border rounded px-2 py-1 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <input name="legal_name" placeholder="Nombre/razón social (para crear)" className="border rounded px-2 py-1" />
                <select name="kind" className="border rounded px-2 py-1"><option value="person">Particular</option><option value="company">Empresa</option></select>
                <input name="tax_id" placeholder="DNI/CIF (opcional)" className="border rounded px-2 py-1" />
              </div>
              <div className="mt-3"><button className="btn">Vincular</button></div>
            </form>

            <div className="divide-y divide-gray-200">
              {links.map((lnk, i) => {
                const cfgs = linkConfigsArr[i] || []
                return (
                  <div key={lnk.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lnk.counterparties?.logo_url || '/avatar.png'} className="w-8 h-8 rounded-full object-cover border" alt="" />
                        <div>
                          <div className="font-medium">{lnk.counterparties?.nick || lnk.counterparties?.legal_name}</div>
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
