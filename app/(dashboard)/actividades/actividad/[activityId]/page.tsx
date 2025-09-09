import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import CounterpartyPicker from '@/components/CounterpartyPicker'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'
import { ensurePublicBucket } from '@/lib/storage'

// ========================= Helpers & tipos =========================

// Si el join viene como array, devolvemos el primero; si viene como objeto/null, lo normalizamos.
function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}

type Counterparty = { id: string; legal_name?: string; nick?: string; logo_url?: string }
type GroupCompany = { id: string; nick?: string; name?: string; logo_url?: string }

// Fila mínima que vamos a usar de "activities"
type ActivityRow = {
  id: string
  artist_id: string
  type: string
  status: 'draft' | 'hold' | 'confirmed' | null
  date: string | null
  time: string | null
  municipality: string | null
  province: string | null
  country: string | null
  capacity: number | null
  pay_kind: 'pay' | 'free' | null
  tags: string[] | null
  venues?: any
  group_companies?: GroupCompany | GroupCompany[] | null
}

export const dynamic = 'force-dynamic'

function companyLabel(c: Pick<GroupCompany, 'nick' | 'name'> | undefined) {
  return c?.nick || c?.name || ''
}

// ========================= Página =========================

export default async function ActivityDetail({ params }: { params: { activityId: string } }) {
  const s = createSupabaseServer()

  // Datos de la actividad (comprobando error explícitamente y tipando la fila)
  const { data: aData, error: aErr } = await s
    .from('activities')
    .select(
      [
        'id',
        'artist_id',
        'type',
        'status',
        'date',
        'time',
        'municipality',
        'province',
        'country',
        'capacity',
        'pay_kind',
        'tags',
        'venues(id,name,photo_url,address)',
        'group_companies(id,nick,name,logo_url)',
      ].join(',')
    )
    .eq('id', params.activityId)
    .single()

  if (aErr || !aData) throw new Error(aErr?.message || 'Actividad no encontrada')
  const a = aData as ActivityRow
  const gc = one<GroupCompany>(a.group_companies as any) // empresa normalizada

  // Artista
  const { data: artist } = await s.from('artists').select('id, stage_name').eq('id', a.artist_id).single()

  // Empresas del grupo (para el selector)
  const { data: companies } = await s
    .from('group_companies')
    .select('id, nick, name, logo_url')
    .order('name', { ascending: true })

  // Promotor vinculado
  const { data: promoterLink } = await s
    .from('activity_promoters')
    .select('id, counterparty_id, counterparties(id,legal_name,nick,logo_url)')
    .eq('activity_id', a.id)
    .maybeSingle()
  const promoterCP = one<Counterparty>(promoterLink?.counterparties as any)

  // Módulos
  const { data: incomes } = await s.from('activity_incomes').select('*').eq('activity_id', a.id).order('created_at')
  const { data: agents } = await s
    .from('activity_zone_agents')
    .select('id, counterparty_id, commission_type, commission_pct, commission_base, commission_amount, counterparties(id,legal_name,nick,logo_url)')
    .eq('activity_id', a.id)

  const { data: equip } = await s.from('activity_equipment').select('*').eq('activity_id', a.id).maybeSingle()
  const { data: descr } = await s.from('activity_description').select('*').eq('activity_id', a.id).maybeSingle()
  const { data: costs } = await s.from('activity_promoter_costs').select('*').eq('activity_id', a.id)
  const { data: bills } = await s.from('activity_billing_requests').select('*').eq('activity_id', a.id).order('created_at')
  const { data: locals } = await s.from('activity_local_productions').select('*').eq('activity_id', a.id)
  const { data: tech } = await s.from('activity_tech').select('*').eq('activity_id', a.id).maybeSingle()
  const { data: partners } = await s
    .from('activity_partners')
    .select('id, counterparty_id, pct, base_on, counterparties(id,legal_name,nick,logo_url)')
    .eq('activity_id', a.id)

  // ========================= Server Actions =========================

  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const status = String(formData.get('status') || 'draft') as any
    const date = String(formData.get('date') || '') || null
    const time = String(formData.get('time') || '') || null
    const municipality = String(formData.get('municipality') || '').trim() || null
    const province = String(formData.get('province') || '').trim() || null
    const country = String(formData.get('country') || 'España').trim()
    const capacityRaw = formData.get('capacity')
    const capacity = capacityRaw ? Number(capacityRaw) : null
    const pay_kind = String(formData.get('pay_kind') || 'pay') as any

    const { error } = await s
      .from('activities')
      .update({ status, date, time, municipality, province, country, capacity, pay_kind })
      .eq('id', params.activityId)
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function setCompany(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const value = String(formData.get('company_id') || '')
    const company_id = value || null
    const { error } = await s.from('activities').update({ company_id }).eq('id', params.activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function attachPromoter(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const mode = String(formData.get('mode') || 'existing')
    let counterparty_id = String(formData.get('counterparty_id') || '')

    if (mode !== 'existing' && !counterparty_id) {
      const legal_name = String(formData.get('legal_name') || '').trim()
      const is_company = String(formData.get('kind') || '') === 'company'
      const tax_id = String(formData.get('tax_id') || '').trim() || null
      if (!legal_name) throw new Error('Nombre requerido')

      const org = await s.from('organizations').select('id').limit(1).single()
      if (org.error) throw new Error(org.error.message)

      const ins = await s
        .from('counterparties')
        .insert({ organization_id: org.data.id, legal_name, is_company, tax_id, as_third_party: true })
        .select('id')
        .single()
      if (ins.error) throw new Error(ins.error.message)
      counterparty_id = ins.data.id
    }

    const del = await s.from('activity_promoters').delete().eq('activity_id', params.activityId)
    if (del.error) throw new Error(del.error.message)

    const { error } = await s.from('activity_promoters').insert({ activity_id: params.activityId, counterparty_id })
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addIncome(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const kind = String(formData.get('kind') || 'fixed') as any
    const label = String(formData.get('label') || '').trim() || null
    const amount = formData.get('amount') ? Number(formData.get('amount')) : null
    const percent = formData.get('percent') ? Number(formData.get('percent')) : null
    const base = String(formData.get('base') || 'gross') as any
    const rule_from_tickets = formData.get('from_tickets') ? Number(formData.get('from_tickets')) : null

    const { error } = await s
      .from('activity_incomes')
      .insert({ activity_id: params.activityId, kind, label, amount, percent, base, rule_from_tickets })
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addAgent(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const mode = String(formData.get('mode') || 'existing')
    let counterparty_id = String(formData.get('counterparty_id') || '')

    if (mode !== 'existing' && !counterparty_id) {
      const legal_name = String(formData.get('legal_name') || '').trim()
      const is_company = String(formData.get('kind') || '') === 'company'
      if (!legal_name) throw new Error('Nombre requerido')

      const org = await s.from('organizations').select('id').limit(1).single()
      if (org.error) throw new Error(org.error.message)

      const ins = await s
        .from('counterparties')
        .insert({ organization_id: org.data.id, legal_name, is_company, as_third_party: true })
        .select('id')
        .single()
      if (ins.error) throw new Error(ins.error.message)

      counterparty_id = ins.data.id
    }

    const commission_type = String(formData.get('commission_type') || 'percent') as any
    const commission_pct = formData.get('commission_pct') ? Number(formData.get('commission_pct')) : null
    const commission_base = String(formData.get('commission_base') || 'gross') as any
    const commission_amount = formData.get('commission_amount') ? Number(formData.get('commission_amount')) : null

    const { error } = await s
      .from('activity_zone_agents')
      .insert({ activity_id: params.activityId, counterparty_id, commission_type, commission_pct, commission_base, commission_amount })
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function saveEquipment(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const mode = String(formData.get('mode') || 'included') as any
    const extra_party = String(formData.get('extra_party') || '') || null
    let rider_pdf_url: string | null = null

    const rider = formData.get('rider_pdf') as File | null
    if (rider && rider.size > 0) {
      await ensurePublicBucket('contracts')
      const up = await s.storage
        .from('contracts')
        .upload(`activities/${params.activityId}/rider_${crypto.randomUUID()}.pdf`, rider, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        })
      if (up.error) throw new Error(up.error.message)
      rider_pdf_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl
    }

    const exists = await s.from('activity_equipment').select('id').eq('activity_id', params.activityId).maybeSingle()
    if (exists.data) {
      const { error } = await s
        .from('activity_equipment')
        .update({ mode, extra_party, ...(rider_pdf_url ? { rider_pdf_url } : {}) })
        .eq('activity_id', params.activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s
        .from('activity_equipment')
        .insert({ activity_id: params.activityId, mode, extra_party, rider_pdf_url })
      if (error) throw new Error(error.message)
    }

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function saveDescr(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const formation = String(formData.get('formation') || 'full') as any
    const reduced_notes = String(formData.get('reduced_notes') || '').trim() || null
    const show_duration = formData.get('show_duration') ? Number(formData.get('show_duration')) : null

    const exists = await s.from('activity_description').select('id').eq('activity_id', params.activityId).maybeSingle()
    if (exists.data) {
      const { error } = await s
        .from('activity_description')
        .update({ formation, reduced_notes, show_duration })
        .eq('activity_id', params.activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s
        .from('activity_description')
        .insert({ activity_id: params.activityId, formation, reduced_notes, show_duration })
      if (error) throw new Error(error.message)
    }

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addPromoterCost(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const category = String(formData.get('category') || 'lodging') as any
    const details = String(formData.get('details') || '').trim() || null
    const coverage = String(formData.get('coverage') || 'all') as any
    const amount = formData.get('amount') ? Number(formData.get('amount')) : null
    const promoter_handles = formData.get('promoter_handles') === 'on'
    const refacturable = formData.get('refacturable') === 'on'

    const { error } = await s
      .from('activity_promoter_costs')
      .insert({ activity_id: params.activityId, category, details, coverage, amount, promoter_handles, refacturable })
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addBilling(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const direction = String(formData.get('direction') || 'issued') as any
    const concept = String(formData.get('concept') || 'other') as any
    const amount = formData.get('amount') ? Number(formData.get('amount')) : null
    const due_rule = String(formData.get('due_rule') || 'date') as any
    const due_date = String(formData.get('due_date') || '') || null
    let counterparty_id = String(formData.get('counterparty_id') || '') || null

    if (!counterparty_id && promoterCP?.id) counterparty_id = promoterCP.id

    const { error } = await s
      .from('activity_billing_requests')
      .insert({ activity_id: params.activityId, direction, concept, amount, due_rule, due_date, counterparty_id })
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addLocalProduction(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const provider_id = String(formData.get('provider_id') || '')
    const amount = formData.get('amount') ? Number(formData.get('amount')) : null
    const details = String(formData.get('details') || '').trim() || null
    const resp_name = String(formData.get('resp_name') || '').trim() || null
    const resp_phone = String(formData.get('resp_phone') || '').trim() || null
    const resp_email = String(formData.get('resp_email') || '').trim() || null

    const { error } = await s
      .from('activity_local_productions')
      .insert({ activity_id: params.activityId, provider_id, amount, details, resp_name, resp_phone, resp_email })
    if (error) throw new Error(error.message)

    // También generamos la solicitud de factura (recibida) asociada
    await s
      .from('activity_billing_requests')
      .insert({ activity_id: params.activityId, direction: 'received', concept: 'local_production', amount, due_rule: 'date', counterparty_id: provider_id })

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function saveTech(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const tech_resp_name = String(formData.get('tech_resp_name') || '').trim() || null
    const tech_resp_phone = String(formData.get('tech_resp_phone') || '').trim() || null
    const tech_resp_email = String(formData.get('tech_resp_email') || '').trim() || null
    const sound_company = String(formData.get('sound_company') || '').trim() || null
    const sound_contact = String(formData.get('sound_contact') || '').trim() || null
    const sound_phone = String(formData.get('sound_phone') || '').trim() || null
    const sound_email = String(formData.get('sound_email') || '').trim() || null

    const exists = await s.from('activity_tech').select('id').eq('activity_id', params.activityId).maybeSingle()
    if (exists.data) {
      const { error } = await s
        .from('activity_tech')
        .update({ tech_resp_name, tech_resp_phone, tech_resp_email, sound_company, sound_contact, sound_phone, sound_email })
        .eq('activity_id', params.activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s
        .from('activity_tech')
        .insert({ activity_id: params.activityId, tech_resp_name, tech_resp_phone, tech_resp_email, sound_company, sound_contact, sound_phone, sound_email })
      if (error) throw new Error(error.message)
    }

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addPartner(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const counterparty_id = String(formData.get('counterparty_id') || '')
    const pct = formData.get('pct') ? Number(formData.get('pct')) : null
    const base_on = String(formData.get('base_on') || 'gross') as any

    const { error } = await s.from('activity_partners').insert({ activity_id: params.activityId, counterparty_id, pct, base_on })
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  // ========================= Render =========================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Actividad · {artist?.stage_name} ({a.type === 'concert' ? 'Concierto' : a.type})
          </h1>
          <div className="text-sm text-gray-600">
            <Link href={`/artistas/${artist?.id}`} className="underline">Ir a la ficha del artista</Link>
          </div>
        </div>
        <Link href={`/actividades/artista/${a.artist_id}`} className="btn-secondary">Volver</Link>
      </div>

      {/* DATOS BÁSICOS */}
      <ModuleCard title="Datos básicos" leftActions={<span className="badge">Editar</span>}>
        {/* Form 1: básicos */}
        <form action={saveBasics} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select name="status" defaultValue={a.status || 'draft'} className="w-full border rounded px-3 py-2">
              <option value="draft">Borrador</option>
              <option value="hold">Reserva</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input type="date" name="date" defaultValue={a.date || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Hora</label>
            <input type="time" name="time" defaultValue={a.time || ''} className="w-full border rounded px-3 py-2" />
          </div>

          <div><label className="block text-sm mb-1">Municipio</label><input name="municipality" defaultValue={a.municipality || ''} className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">Provincia</label><input name="province" defaultValue={a.province || ''} className="w-full border rounded px-3 py-2" /></div>
          <div><label className="block text-sm mb-1">País</label><input name="country" defaultValue={a.country || 'España'} className="w-full border rounded px-3 py-2" /></div>

          <div><label className="block text-sm mb-1">Aforo</label><input name="capacity" type="number" defaultValue={a.capacity || ''} className="w-full border rounded px-3 py-2" /></div>
          <div>
            <label className="block text-sm mb-1">Pago/Gratuito</label>
            <select name="pay_kind" defaultValue={a.pay_kind || 'pay'} className="w-full border rounded px-3 py-2">
              <option value="pay">Pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button className="btn">Guardar básicos</button>
          </div>
        </form>

        {/* Form 2: empresa del grupo (NO anidar dentro del form anterior) */}
        <div className="mt-4 border-t pt-4">
          <form action={setCompany} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Empresa del grupo</label>
              <select
                name="company_id"
                defaultValue={gc?.id ?? ''}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">(sin empresa)</option>
                {(companies || []).map(c => (
                  <option key={c.id} value={c.id}>
                    {companyLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <button className="btn">Guardar empresa</button>
            </div>
          </form>
        </div>
      </ModuleCard>

      {/* PROMOTOR */}
      <ModuleCard title="Promotor" leftActions={<span className="badge">Editar</span>}>
        <form action={attachPromoter} className="border rounded p-3">
          {/* Picker con búsqueda/alta */}
          <CounterpartyPicker />
          <div className="mt-2"><button className="btn">Vincular promotor</button></div>
        </form>

        {promoterCP?.id && (
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={promoterCP.logo_url || '/avatar.png'} className="w-8 h-8 rounded-full border object-cover" alt="" />
            <Link href={`/terceros/${promoterCP.id}`} className="underline font-medium">
              {promoterCP.nick || promoterCP.legal_name}
            </Link>
          </div>
        )}
      </ModuleCard>

      {/* INGRESOS */}
      <ModuleCard title="Ingresos" leftActions={<span className="badge">Editar</span>}>
        <form action={addIncome} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="kind" className="w-full border rounded px-2 py-1" defaultValue="fixed">
              <option value="fixed">Caché fijo</option>
              <option value="percent">Variable %</option>
              <option value="per_ticket">Importe por entrada</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Etiqueta (opcional)</label><input name="label" className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Importe</label><input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
          <div>
            <label className="block text-sm mb-1">% / tickets desde</label>
            <input name="percent" type="number" step="0.01" className="w-full border rounded px-2 py-1" placeholder="%" />
            <input name="from_tickets" type="number" className="w-full border rounded px-2 py-1 mt-1" placeholder="desde entradas" />
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm mb-1">Base</label>
            <select name="base" className="w-full border rounded px-2 py-1" defaultValue="gross">
              <option value="gross">Bruto</option>
              <option value="net">Neto</option>
            </select>
          </div>
          <div className="md:col-span-4"><button className="btn">+ Añadir</button></div>
        </form>

        <div className="divide-y divide-gray-200 mt-3">
          {(incomes || []).map(i => (
            <div key={i.id} className="py-2 text-sm">
              <span className="font-medium">{i.kind}</span> · {i.amount ? `${Number(i.amount).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}` : ''} {i.percent ? `· ${i.percent}%` : ''} {i.base ? `· ${i.base}` : ''} {i.rule_from_tickets ? `· desde ${i.rule_from_tickets} entradas` : ''}
            </div>
          ))}
          {!incomes?.length && <div className="text-sm text-gray-500">Sin ingresos configurados.</div>}
        </div>
      </ModuleCard>

      {/* AGENTE DE ZONA */}
      <ModuleCard title="Agente de zona" leftActions={<span className="badge">Editar</span>}>
        <form action={addAgent} className="border rounded p-3">
          <CounterpartyPicker />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <div>
              <label className="block text-sm mb-1">Tipo comisión</label>
              <select name="commission_type" className="w-full border rounded px-2 py-1" defaultValue="percent">
                <option value="percent">% sobre base</option>
                <option value="fixed">Importe fijo</option>
              </select>
            </div>
            <div><label className="block text-sm mb-1">% comisión</label><input name="commission_pct" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
            <div>
              <label className="block text-sm mb-1">Base</label>
              <select name="commission_base" className="w-full border rounded px-2 py-1" defaultValue="gross">
                <option value="gross">Caché fijo bruto</option>
                <option value="gross_plus_var">Fijo + variable</option>
              </select>
            </div>
            <div><label className="block text-sm mb-1">Importe (si fijo)</label><input name="commission_amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
          </div>
          <div className="mt-2"><button className="btn">Guardar agente</button></div>
        </form>

        <div className="mt-3 text-sm">
          {(agents || []).map(ag => {
            const c = one<Counterparty>(ag.counterparties as any)
            return (
              <div key={ag.id} className="py-1">
                {c?.nick || c?.legal_name} · {ag.commission_type === 'fixed'
                  ? `${ag.commission_amount?.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}`
                  : `${ag.commission_pct}% (${ag.commission_base})`}
              </div>
            )
          })}
          {!agents?.length && <div className="text-gray-500">Sin agente configurado.</div>}
        </div>
      </ModuleCard>

      {/* EQUIPAMIENTO */}
      <ModuleCard title="Equipamiento" leftActions={<span className="badge">Editar</span>}>
        <form action={saveEquipment} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Modo</label>
            <select name="mode" defaultValue={equip?.mode || 'included'} className="w-full border rounded px-2 py-1">
              <option value="included">Equipos incluidos en caché</option>
              <option value="none">Sin equipos incluidos</option>
              <option value="festival_rider">Rider de festival (PDF)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Rider (PDF)</label>
            <input type="file" name="rider_pdf" accept="application/pdf" />
            {equip?.rider_pdf_url && <div className="text-xs mt-1"><a href={equip.rider_pdf_url} target="_blank" className="underline">Ver rider</a></div>}
          </div>
          <div>
            <label className="block text-sm mb-1">Extra de equipos lo cubre</label>
            <select name="extra_party" defaultValue={equip?.extra_party || ''} className="w-full border rounded px-2 py-1">
              <option value="">(no aplica)</option>
              <option value="artist">Artista</option>
              <option value="promoter">Promotor</option>
            </select>
          </div>
          <div className="md:col-span-3"><button className="btn">Guardar</button></div>
        </form>
      </ModuleCard>

      {/* DESCRIPCIÓN */}
      <ModuleCard title="Descripción del evento" leftActions={<span className="badge">Editar</span>}>
        <form action={saveDescr} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Formación</label>
            <select name="formation" defaultValue={descr?.formation || 'full'} className="w-full border rounded px-2 py-1">
              <option value="full">Banda completa</option>
              <option value="reduced">Formato reducido</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Duración show (min)</label>
            <input name="show_duration" type="number" defaultValue={descr?.show_duration || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Notas (si formato reducido)</label>
            <input name="reduced_notes" defaultValue={descr?.reduced_notes || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3"><button className="btn">Guardar</button></div>
        </form>
      </ModuleCard>

      {/* PARTIDAS CUBIERTAS POR EL PROMOTOR */}
      <ModuleCard title="Partidas cubiertas por el promotor" leftActions={<span className="badge">Editar</span>}>
        <form action={addPromoterCost} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">Categoría</label>
            <select name="category" className="w-full border rounded px-2 py-1" defaultValue="lodging">
              <option value="lodging">Alojamiento</option>
              <option value="transport">Transporte</option>
              <option value="internal_transfers">Traslados internos</option>
              <option value="salaries">Sueldos</option>
              <option value="per_diem">Viáticos</option>
              <option value="extra_equipment">Extra de equipos</option>
              <option value="other">Otros</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Cobertura</label>
            <select name="coverage" className="w-full border rounded px-2 py-1" defaultValue="all">
              <option value="all">Todos los gastos</option>
              <option value="up_to">Hasta importe</option>
              <option value="text">Texto</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Importe (si aplica)</label><input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
          <div className="flex items-center gap-2">
            <label className="text-sm"><input type="checkbox" name="promoter_handles" /> Se encarga promotor</label>
            <label className="text-sm"><input type="checkbox" name="refacturable" /> Se refactura</label>
          </div>
          <div className="md:col-span-4"><label className="block text-sm mb-1">Detalle</label><input name="details" className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-4"><button className="btn">+ Añadir</button></div>
        </form>

        <div className="mt-3 text-sm divide-y divide-gray-200">
          {(costs || []).map(c => (
            <div key={c.id} className="py-1">
              {c.category} · {c.coverage} {c.amount ? `(${Number(c.amount).toLocaleString('es-ES',{style:'currency',currency:'EUR'})})` : ''} · {c.promoter_handles ? 'Promotor' : ''} {c.refacturable ? '· Refacturable' : ''}
              {c.details ? ` — ${c.details}` : ''}
            </div>
          ))}
          {!costs?.length && <div className="text-gray-500">Sin partidas registradas.</div>}
        </div>
      </ModuleCard>

      {/* FACTURACIÓN */}
      <ModuleCard title="Facturación" leftActions={<span className="badge">Editar</span>}>
        <form action={addBilling} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm mb-1">Dirección</label>
            <select name="direction" className="w-full border rounded px-2 py-1" defaultValue="issued">
              <option value="issued">Emitida (cobrar)</option>
              <option value="received">Recibida (pagar)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Concepto</label>
            <select name="concept" className="w-full border rounded px-2 py-1" defaultValue="other">
              <option value="advance">Anticipo caché</option>
              <option value="rest">Resto caché</option>
              <option value="full_cache">Caché completo</option>
              <option value="local_production">Producción local</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Importe</label><input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
          <div>
            <label className="block text-sm mb-1">Vencimiento</label>
            <select name="due_rule" className="w-full border rounded px-2 py-1" defaultValue="date">
              <option value="date">Fecha concreta</option>
              <option value="before_event">Antes del concierto</option>
              <option value="after_30">30 días después</option>
              <option value="after_60">60 días después</option>
            </select>
          </div>
          <div><label className="block text-sm mb-1">Fecha (si concreta)</label><input type="date" name="due_date" className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-5"><label className="block text-sm mb-1">Destinatario (si distinto al promotor)</label><input name="counterparty_id" placeholder="UUID del tercero (opcional)" className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-5"><button className="btn">+ Solicitar</button></div>
        </form>

        <div className="mt-3 divide-y divide-gray-200 text-sm">
          {(bills || []).map(b => (
            <div key={b.id} className="py-1">
              {b.direction === 'issued' ? 'Emitida' : 'Recibida'} · {b.concept} · {b.amount ? Number(b.amount).toLocaleString('es-ES',{style:'currency',currency:'EUR'}) : ''} · {b.due_rule}{b.due_date ? ` (${new Date(b.due_date).toLocaleDateString()})` : ''}
            </div>
          ))}
          {!bills?.length && <div className="text-gray-500">Sin solicitudes.</div>}
        </div>
      </ModuleCard>

      {/* PRODUCCIÓN LOCAL */}
      <ModuleCard title="Producción local" leftActions={<span className="badge">Editar</span>}>
        <form action={addLocalProduction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="block text-sm mb-1">Proveedor/Promotor (UUID)</label><input name="provider_id" className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Importe</label><input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-3"><label className="block text-sm mb-1">Detalles</label><input name="details" className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Responsable</label><input name="resp_name" className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Teléfono</label><input name="resp_phone" className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Email</label><input name="resp_email" className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-3"><button className="btn">+ Añadir producción local</button></div>
        </form>

        <div className="mt-3 text-sm divide-y divide-gray-200">
          {(locals || []).map(l => (
            <div key={l.id} className="py-1">
              {l.details || 'Producción local'} · {l.amount ? Number(l.amount).toLocaleString('es-ES',{style:'currency',currency:'EUR'}) : ''}
            </div>
          ))}
          {!locals?.length && <div className="text-gray-500">Sin producción local.</div>}
        </div>
      </ModuleCard>

      {/* PRODUCCIÓN TÉCNICA */}
      <ModuleCard title="Producción técnica" leftActions={<span className="badge">Editar</span>}>
        <form action={saveTech} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="block text-sm mb-1">Resp. técnico</label><input name="tech_resp_name" defaultValue={tech?.tech_resp_name || ''} className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Teléfono</label><input name="tech_resp_phone" defaultValue={tech?.tech_resp_phone || ''} className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Email</label><input name="tech_resp_email" defaultValue={tech?.tech_resp_email || ''} className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-3"><label className="block text-sm mb-1">Empresa sonido</label><input name="sound_company" defaultValue={tech?.sound_company || ''} className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Contacto</label><input name="sound_contact" defaultValue={tech?.sound_contact || ''} className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Teléfono</label><input name="sound_phone" defaultValue={tech?.sound_phone || ''} className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">Email</label><input name="sound_email" defaultValue={tech?.sound_email || ''} className="w-full border rounded px-2 py-1" /></div>
          <div className="md:col-span-3"><button className="btn">Guardar</button></div>
        </form>
      </ModuleCard>

      {/* SOCIOS */}
      <ModuleCard title="Socios" leftActions={<span className="badge">Editar</span>}>
        <form action={addPartner} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><label className="block text-sm mb-1">Tercero (UUID)</label><input name="counterparty_id" className="w-full border rounded px-2 py-1" /></div>
          <div><label className="block text-sm mb-1">% participación</label><input name="pct" type="number" step="0.01" className="w-full border rounded px-2 py-1" /></div>
          <div>
            <label className="block text-sm mb-1">Base</label>
            <select name="base_on" className="w-full border rounded px-2 py-1" defaultValue="gross">
              <option value="gross">Ingreso bruto</option>
              <option value="net">Ingreso neto</option>
              <option value="office_gross">Ingreso oficina (bruto)</option>
              <option value="office_net">Ingreso oficina (neto)</option>
              <option value="artist_gross">Ingreso artista (bruto)</option>
              <option value="artist_net">Ingreso artista (neto)</option>
            </select>
          </div>
          <div className="md:col-span-4"><button className="btn">+ Añadir socio</button></div>
        </form>

        <div className="mt-3 text-sm divide-y divide-gray-200">
          {(partners || []).map(p => {
            const c = one<Counterparty>(p.counterparties as any)
            return (
              <div key={p.id} className="py-1">
                {c?.nick || c?.legal_name} · {p.pct}% · {p.base_on}
              </div>
            )
          })}
          {!partners?.length && <div className="text-gray-500">Sin socios.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
