import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import CounterpartyPicker from '@/components/CounterpartyPicker'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'
import { ensurePublicBucket } from '@/lib/storage'
import { notFound } from 'next/navigation'

import ActivityIncomeCreator from '@/components/ActivityIncomeCreator'
import CompanySelect, { CompanyLite } from '@/components/CompanySelect'
import SavedToast from '@/components/SavedToast'
import TicketSalesModule from '@/components/TicketSalesModule'
import ExpensesModule from '@/components/ExpensesModule' // Bolsa de gastos

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ========= Utils =========
function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}

type Counterparty = { id: string; legal_name?: string; nick?: string; logo_url?: string }

// ========= Página =========
export default async function ActivityDetail({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams?: { saved?: string }
}) {
  const s = createSupabaseServer()

  // Actividad
  const { data: a, error: aErr } = await s
    .from('activities')
    .select(`
      id, artist_id, company_id, type, status, date, time, municipality, province, country, capacity, pay_kind, tags,
      venues ( id, name, photo_url, address ),
      group_companies ( id, nick, name, logo_url )
    `)
    .eq('id', params.activityId)
    .single()

  if (aErr || !a) notFound()

  // Artista
  const { data: artist } = await s
    .from('artists')
    .select('id, stage_name')
    .eq('id', a.artist_id)
    .single()

  // Empresas del grupo para el selector (con logo)
  const { data: companiesData } = await s
    .from('group_companies')
    .select('id, name, nick, logo_url')
    .order('name', { ascending: true })
  const companies = (companiesData || []) as CompanyLite[]

  // Promotor vinculado
  const { data: promoterLink } = await s
    .from('activity_promoters')
    .select('id, counterparty_id, counterparties(id,legal_name,nick,logo_url)')
    .eq('activity_id', activityId)
    .maybeSingle()
  const promoterCp = one<Counterparty>(promoterLink?.counterparties as any)

  // Resto de módulos
  const { data: incomes } = await s
    .from('activity_incomes')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at')

  const { data: agents } = await s
    .from('activity_zone_agents')
    .select(
      'id, counterparty_id, commission_type, commission_pct, commission_base, commission_amount, counterparties(id,legal_name,nick)'
    )
    .eq('activity_id', activityId)

  const { data: equip } = await s
    .from('activity_equipment')
    .select('*')
    .eq('activity_id', activityId)
    .maybeSingle()

  const { data: descr } = await s
    .from('activity_description')
    .select('*')
    .eq('activity_id', activityId)
    .maybeSingle()

  const { data: costs } = await s
    .from('activity_promoter_costs')
    .select('*')
    .eq('activity_id', activityId)

  const { data: bills } = await s
    .from('activity_billing_requests')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at')

  const { data: locals } = await s
    .from('activity_local_productions')
    .select('*')
    .eq('activity_id', activityId)

  const { data: tech } = await s
    .from('activity_tech')
    .select('*')
    .eq('activity_id', activityId)
    .maybeSingle()

  const { data: partners } = await s
    .from('activity_partners')
    .select('id, counterparty_id, pct, base_on, counterparties(id,legal_name,nick)')
    .eq('activity_id', activityId)

  // ====== Venta de entradas ======
  const { data: setup } = await s.from('activity_ticket_setup').select('*').eq('activity_id', activityId).maybeSingle()
  const { data: typesRows } = await s.from('activity_ticket_types').select('*').eq('activity_id', activityId).order('position')
  const { data: reportsRows } = await s
    .from('activity_ticket_reports')
    .select('id, report_date, totals_sold, totals_net_revenue, created_at')
    .eq('activity_id', activityId)
    .order('report_date', { ascending: false })

  // ====== Bolsa de gastos (listado) ======
  const { data: expensesRows } = await s
    .from('activity_expenses')
    .select('id, kind, concept, amount_net, amount_gross, is_invoice, billing_status, payment_status, payment_method, payment_date, assumed_by, file_url, counterparty:counterparties(id,legal_name,nick,logo_url)')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false })

  const groupedExpenses: Record<string, any[]> = {}
  for (const e of (expensesRows || [])) {
    const k = e.kind || 'other'
    groupedExpenses[k] = groupedExpenses[k] || []
    groupedExpenses[k].push(e)
  }

  // ========= Server Actions =========

  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const status = String(formData.get('status') || 'draft') as any
    const date = String(formData.get('date') || '') || null
    const time = String(formData.get('time') || '') || null
    const municipality = String(formData.get('municipality') || '').trim() || null
    const province = String(formData.get('province') || '').trim() || null
    const country = String(formData.get('country') || 'España').trim()
    const capacity = formData.get('capacity') ? Number(formData.get('capacity')) : null
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
    const company_id = String(formData.get('company_id') || '') || null
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
      const ins = await s
        .from('counterparties')
        .insert({
          organization_id: org.data!.id,
          legal_name,
          is_company,
          tax_id,
          as_third_party: true,
        })
        .select('id')
        .single()
      if (ins.error) throw new Error(ins.error.message)
      counterparty_id = ins.data.id
    }
    const del = await s.from('activity_promoters').delete().eq('activity_id', params.activityId)
    if (del.error) throw new Error(del.error.message)
    const { error } = await s
      .from('activity_promoters')
      .insert({ activity_id: params.activityId, counterparty_id })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  async function addIncome(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    // Tipos admitidos por el creador: fixed | variable_fixed_after | per_ticket | percent
    const kind = String(formData.get('kind') || 'fixed') as any
    const label = String(formData.get('label') || '').trim() || null
    const amount = formData.get('amount') ? Number(formData.get('amount')) : null
    const percent = formData.get('percent') ? Number(formData.get('percent')) : null
    const rule_from_tickets = formData.get('from_tickets') ? Number(formData.get('from_tickets')) : null

    const { error } = await s
      .from('activity_incomes')
      .insert({ activity_id: params.activityId, kind, label, amount, percent, rule_from_tickets })
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
      const ins = await s
        .from('counterparties')
        .insert({
          organization_id: org.data!.id,
          legal_name,
          is_company,
          as_third_party: true,
        })
        .select('id')
        .single()
      if (ins.error) throw new Error(ins.error.message)
      counterparty_id = ins.data.id
    }
    const commission_type = String(formData.get('commission_type') || 'percent') as any
    const commission_pct = formData.get('commission_pct') ? Number(formData.get('commission_pct')) : null
    const commission_base = String(formData.get('commission_base') || 'fixed') as any
    const commission_amount = formData.get('commission_amount') ? Number(formData.get('commission_amount')) : null
    const { error } = await s
      .from('activity_zone_agents')
      .insert({
        activity_id: params.activityId,
        counterparty_id,
        commission_type,
        commission_pct,
        commission_base,
        commission_amount,
      })
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
    const exists = await s
      .from('activity_equipment')
      .select('id')
      .eq('activity_id', params.activityId)
      .maybeSingle()
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
    const exists = await s
      .from('activity_description')
      .select('id')
      .eq('activity_id', params.activityId)
      .maybeSingle()
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
      .insert({
        activity_id: params.activityId,
        category,
        details,
        coverage,
        amount,
        promoter_handles,
        refacturable,
      })
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

    // Usa promotor vinculado si no se especifica
    const cp = one<Counterparty>(promoterLink?.counterparties as any)
    if (!counterparty_id && cp?.id) {
      counterparty_id = cp.id
    }
    const { error } = await s
      .from('activity_billing_requests')
      .insert({
        activity_id: params.activityId,
        direction,
        concept,
        amount,
        due_rule,
        due_date,
        counterparty_id,
      })
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
      .insert({
        activity_id: params.activityId,
        provider_id,
        amount,
        details,
        resp_name,
        resp_phone,
        resp_email,
      })
    if (error) throw new Error(error.message)
    await s
      .from('activity_billing_requests')
      .insert({
        activity_id: params.activityId,
        direction: 'received',
        concept: 'local_production',
        amount,
        due_rule: 'date',
        counterparty_id: provider_id,
      })
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
    const exists = await s
      .from('activity_tech')
      .select('id')
      .eq('activity_id', params.activityId)
      .maybeSingle()
    if (exists.data) {
      const { error } = await s
        .from('activity_tech')
        .update({
          tech_resp_name,
          tech_resp_phone,
          tech_resp_email,
          sound_company,
          sound_contact,
          sound_phone,
          sound_email,
        })
        .eq('activity_id', params.activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s
        .from('activity_tech')
        .insert({
          activity_id: params.activityId,
          tech_resp_name,
          tech_resp_phone,
          tech_resp_email,
          sound_company,
          sound_contact,
          sound_phone,
          sound_email,
        })
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
    const { error } = await s
      .from('activity_partners')
      .insert({ activity_id: params.activityId, counterparty_id, pct, base_on })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${params.activityId}`)
  }

  // ====== Venta de entradas (server actions) ======
  async function saveTicketSetup(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const has_ticket_sales = formData.get('has_ticket_sales') === 'on'
    const capacity_on_sale = String(formData.get('capacity_on_sale') || '') || null
    const sgae_pct = Number(formData.get('sgae_pct') || 10)
    const vat_pct = Number(formData.get('vat_pct') || 21)
    const announcement_at = String(formData.get('announcement_at') || '') || null
    const announcement_tbc = formData.get('announcement_tbc') === 'on'
    const onsale_at = String(formData.get('onsale_at') || '') || null
    const ticketing_name = String(formData.get('ticketing_name') || '') || null
    const ticketing_url = String(formData.get('ticketing_url') || '') || null

    const existing = await s.from('activity_ticket_setup').select('activity_id').eq('activity_id', activityId).maybeSingle()
    const row = {
      has_ticket_sales, sgae_pct, vat_pct,
      capacity_on_sale: capacity_on_sale ? Number(capacity_on_sale) : null,
      announcement_at, announcement_tbc, onsale_at, ticketing_name, ticketing_url
    }
    if (existing.data) {
      const { error } = await s.from('activity_ticket_setup').update(row).eq('activity_id', activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s.from('activity_ticket_setup').insert({ activity_id: activityId, ...row })
      if (error) throw new Error(error.message)
    }
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function addTicketType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const name = String(formData.get('name') || '').trim()
    const qty = Number(formData.get('qty') || 0)
    const price_gross = Number(formData.get('price_gross') || 0)
    const invitations_qty = Number(formData.get('invitations_qty') || 0)
    if (!name) throw new Error('Nombre requerido')

    // neto = (PVP / (1+IVA)) * (1 - SGAE)
    const setup = await s.from('activity_ticket_setup').select('sgae_pct, vat_pct').eq('activity_id', activityId).maybeSingle()
    const vat = setup.data?.vat_pct ?? 21
    const sgae = setup.data?.sgae_pct ?? 10
    const price_net = Math.max(0, (price_gross / (1 + vat/100)) * (1 - sgae/100))

    const { error } = await s.from('activity_ticket_types').insert({
      activity_id: activityId, name, qty, price_gross, price_net, invitations_qty
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function delTicketType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const type_id = String(formData.get('type_id') || '')
    if (!type_id) return
    const { error } = await s.from('activity_ticket_types').delete().eq('id', type_id).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function saveTicketReport(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const report_date = String(formData.get('report_date') || '') || null
    const aggregate_only = formData.get('aggregate_only') === 'on'
    const totals_sold = Number(formData.get('totals_sold') || 0)
    const totals_net_revenue = Number(formData.get('totals_net_revenue') || 0)
    const note = String(formData.get('note') || '').trim() || null

    // Desglose por tipo si viene
    const { data: tts } = await s.from('activity_ticket_types').select('id, name, price_net').eq('activity_id', activityId)
    const by: Record<string, { sold: number, net: number }> = {}
    let soldAcc = 0
    let netAcc = 0
    for (const t of (tts || [])) {
      const val = formData.get(`by_${t.id}`)
      const num = val ? Number(val) : 0
      if (num > 0) {
        const net = (Number(t.price_net) || 0) * num
        by[t.name] = { sold: num, net }
        soldAcc += num
        netAcc += net
      }
    }
    const finalSold = totals_sold || soldAcc
    const finalNet = totals_net_revenue || netAcc

    const { error } = await s.from('activity_ticket_reports').insert({
      activity_id: activityId,
      report_date, aggregate_only, totals_sold: finalSold, totals_net_revenue: finalNet,
      by_type: Object.keys(by).length ? by : null, note
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  // === Bolsa de gastos (server actions) ===
  async function newExpense(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const kind = String(formData.get('kind') || 'other')
    const concept = String(formData.get('concept') || '').trim()
    const counterparty_id = String(formData.get('counterparty_id') || '') || null
    const is_invoice = formData.get('is_invoice') === 'on'
    const invoice_number = String(formData.get('invoice_number') || '') || null
    const invoice_date = String(formData.get('invoice_date') || '') || null
    const amount_net = Number(formData.get('amount_net') || 0)
    const amount_gross = formData.get('amount_gross') ? Number(formData.get('amount_gross')) : null
    const vat_pct = formData.get('vat_pct') ? Number(formData.get('vat_pct')) : null

    if (!concept) throw new Error('Concepto requerido')

    const { error } = await s.from('activity_expenses').insert({
      activity_id: activityId, kind, concept, counterparty_id, is_invoice, invoice_number, invoice_date,
      amount_net, amount_gross, vat_pct
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function markPaid(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const expense_id = String(formData.get('expense_id') || '')
    const payment_method = String(formData.get('payment_method') || 'transfer') as any
    const { error } = await s.from('activity_expenses').update({
      payment_status: 'paid', payment_method, payment_date: new Date().toISOString().slice(0,10)
    }).eq('id', expense_id).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function requestInvoice(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const expense_id = String(formData.get('expense_id') || '')
    // Aquí podrías generar un token y mandar email, en esta versión sólo marcamos "requested"
    const { error } = await s.from('activity_expenses').update({
      payment_status: 'requested'
    }).eq('id', expense_id).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }
  const activityId = a?.id ?? params.activityId
  // =================== RENDER ===================
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{artist?.stage_name || 'Actividad'} · {a.type}</h1>
          <div className="text-sm text-gray-600">
            {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'} {a.time ? ('· ' + a.time) : ''}
          </div>
        </div>
        <Link href="/actividades" className="btn-secondary">Volver</Link>
      </div>

      {/* DATOS BÁSICOS */}
      <ModuleCard title="Datos básicos" leftActions={<span className="badge">Editar</span>}>
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

          <div>
            <label className="block text-sm mb-1">Municipio</label>
            <input name="municipality" defaultValue={a.municipality || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Provincia</label>
            <input name="province" defaultValue={a.province || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">País</label>
            <input name="country" defaultValue={a.country || 'España'} className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm mb-1">Aforo</label>
            <input name="capacity" type="number" defaultValue={a.capacity || ''} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Pago/Gratuito</label>
            <select name="pay_kind" defaultValue={a.pay_kind || 'pay'} className="w-full border rounded px-3 py-2">
              <option value="pay">Pago</option>
              <option value="free">Gratuito</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <button className="btn">Guardar cambios</button>
          </div>
        </form>
      </ModuleCard>

      {/* VENTA DE ENTRADAS */}
      <ModuleCard title="Venta de entradas">
        <TicketSalesModule
          setup={setup || null}
          types={(typesRows || []) as any}
          reports={(reportsRows || []) as any}
          actionSaveSetup={saveTicketSetup}
          actionAddType={addTicketType}
          actionDelType={delTicketType}
          actionSaveReport={saveTicketReport}
          capacityFromActivity={a.capacity || null}
        />
      </ModuleCard>

      {/* Empresa del grupo con logos */}
      <ModuleCard title="Empresa del grupo">
        <form action={setCompany} className="max-w-lg">
          <CompanySelect
            name="company_id"
            companies={companies}
            defaultValue={a.company_id || one(a.group_companies as any)?.id || null}
          />
          <button className="btn mt-2">Guardar empresa</button>
        </form>
      </ModuleCard>

      {/* PROMOTOR */}
      <ModuleCard title="Promotor" leftActions={<span className="badge">Editar</span>}>
        <form action={attachPromoter} className="border rounded p-3">
          <CounterpartyPicker />
          <div className="mt-2">
            <button className="btn">Vincular promotor</button>
          </div>
        </form>

        {promoterCp?.id && (
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={promoterCp.logo_url || '/avatar.png'}
              className="w-8 h-8 rounded-full border object-cover"
              alt=""
            />
            <Link href={`/terceros/${promoterCp.id}`} className="underline font-medium">
              {promoterCp.nick || promoterCp.legal_name}
            </Link>
          </div>
        )}
      </ModuleCard>

      {/* INGRESOS */}
      <ModuleCard title="Ingresos" leftActions={<span className="badge">Editar</span>}>
        <ActivityIncomeCreator actionAdd={addIncome} />

        <div className="divide-y divide-gray-200 mt-4">
          {(incomes || []).map((i: any) => (
            <div key={i.id} className="py-2 text-sm">
              <span className="font-medium">
                {i.kind === 'fixed'
                  ? 'Caché fijo'
                  : i.kind === 'variable_fixed_after'
                  ? 'Variable · fijo desde N'
                  : i.kind === 'per_ticket'
                  ? 'Variable · por entrada'
                  : i.kind === 'percent'
                  ? 'Variable · % sobre ventas'
                  : i.kind}
              </span>
              {' · '}
              {i.amount ? `${Number(i.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : ''}
              {i.percent ? ` · ${i.percent}%` : ''}
              {i.rule_from_tickets ? ` · desde ${i.rule_from_tickets} entradas` : ''}
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
            <div>
              <label className="block text-sm mb-1">% comisión</label>
              <input name="commission_pct" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm mb-1">Base</label>
              <select name="commission_base" className="w-full border rounded px-2 py-1" defaultValue="gross">
                <option value="gross">Caché fijo bruto</option>
                <option value="gross_plus_var">Fijo + variable</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Importe (si fijo)</label>
              <input name="commission_amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
            </div>
          </div>
          <div className="mt-2">
            <button className="btn">Guardar agente</button>
          </div>
        </form>

        <div className="mt-3 text-sm">
          {(agents || []).map((ag: any) => (
            <div key={ag.id} className="py-1">
              {ag.counterparties?.nick || ag.counterparties?.legal_name} ·{' '}
              {ag.commission_type === 'fixed'
                ? `${ag.commission_amount?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                : `${ag.commission_pct}% (${ag.commission_base})`}
            </div>
          ))}
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
            {equip?.rider_pdf_url && (
              <div className="text-xs mt-1">
                <a href={equip.rider_pdf_url} target="_blank" className="underline">
                  Ver rider
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">Extra de equipos lo cubre</label>
            <select name="extra_party" defaultValue={equip?.extra_party || ''} className="w-full border rounded px-2 py-1">
              <option value="">(no aplica)</option>
              <option value="artist">Artista</option>
              <option value="promoter">Promotor</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button className="btn">Guardar</button>
          </div>
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
          <div className="md:col-span-3">
            <button className="btn">Guardar</button>
          </div>
        </form>
      </ModuleCard>

      {/* PARTIDAS CUBIERTAS */}
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
          <div>
            <label className="block text-sm mb-1">Cobertura</label>
            <select name="coverage" className="w-full border rounded px-2 py-1" defaultValue="all">
              <option value="all">Todos los gastos</option>
              <option value="up_to">Hasta importe</option>
              <option value="text">Texto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Importe (si aplica)</label>
            <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">
              <input type="checkbox" name="promoter_handles" /> Se encarga promotor
            </label>
            <label className="text-sm">
              <input type="checkbox" name="refacturable" /> Se refactura
            </label>
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm mb-1">Detalle</label>
            <input name="details" className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-4">
            <button className="btn">+ Añadir</button>
          </div>
        </form>

        <div className="mt-3 text-sm divide-y divide-gray-200">
          {(costs || []).map((c: any) => (
            <div key={c.id} className="py-1">
              {c.category} · {c.coverage}{' '}
              {c.amount ? `(${Number(c.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})` : ''} ·{' '}
              {c.promoter_handles ? 'Promotor' : ''} {c.refacturable ? '· Refacturable' : ''}
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
          <div>
            <label className="block text-sm mb-1">Importe</label>
            <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Vencimiento</label>
            <select name="due_rule" className="w-full border rounded px-2 py-1" defaultValue="date">
              <option value="date">Fecha concreta</option>
              <option value="before_event">Antes del concierto</option>
              <option value="after_30">30 días después</option>
              <option value="after_60">60 días después</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Fecha (si concreta)</label>
            <input type="date" name="due_date" className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-5">
            <label className="block text-sm mb-1">Destinatario (si distinto al promotor)</label>
            <input name="counterparty_id" placeholder="UUID del tercero (opcional)" className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-5">
            <button className="btn">+ Solicitar</button>
          </div>
        </form>

        <div className="mt-3 divide-y divide-gray-200 text-sm">
          {(bills || []).map((b: any) => (
            <div key={b.id} className="py-1">
              {b.direction === 'issued' ? 'Emitida' : 'Recibida'} · {b.concept} ·{' '}
              {b.amount ? Number(b.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : ''} ·{' '}
              {b.due_rule}
              {b.due_date ? ` (${new Date(b.due_date).toLocaleDateString()})` : ''}
            </div>
          ))}
          {!bills?.length && <div className="text-sm text-gray-500">Sin solicitudes.</div>}
        </div>
      </ModuleCard>

      {/* PRODUCCIÓN LOCAL */}
      <ModuleCard title="Producción local" leftActions={<span className="badge">Editar</span>}>
        <form action={addLocalProduction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Proveedor/Promotor (UUID)</label>
            <input name="provider_id" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Importe</label>
            <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Detalles</label>
            <input name="details" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Responsable</label>
            <input name="resp_name" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono</label>
            <input name="resp_phone" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="resp_email" className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <button className="btn">+ Añadir producción local</button>
          </div>
        </form>

        <div className="mt-3 text-sm divide-y divide-gray-200">
          {(locals || []).map((l: any) => (
            <div key={l.id} className="py-1">
              {l.details || 'Producción local'} ·{' '}
              {l.amount ? Number(l.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : ''}
            </div>
          ))}
          {!locals?.length && <div className="text-gray-500">Sin producción local.</div>}
        </div>
      </ModuleCard>

      {/* PRODUCCIÓN TÉCNICA */}
      <ModuleCard title="Producción técnica" leftActions={<span className="badge">Editar</span>}>
        <form action={saveTech} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Resp. técnico</label>
            <input name="tech_resp_name" defaultValue={tech?.tech_resp_name || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono</label>
            <input name="tech_resp_phone" defaultValue={tech?.tech_resp_phone || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="tech_resp_email" defaultValue={tech?.tech_resp_email || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Empresa sonido</label>
            <input name="sound_company" defaultValue={tech?.sound_company || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Contacto</label>
            <input name="sound_contact" defaultValue={tech?.sound_contact || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono</label>
            <input name="sound_phone" defaultValue={tech?.sound_phone || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="sound_email" defaultValue={tech?.sound_email || ''} className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <button className="btn">Guardar</button>
          </div>
        </form>
      </ModuleCard>

      {/* SOCIOS */}
      <ModuleCard title="Socios" leftActions={<span className="badge">Editar</span>}>
        <form action={addPartner} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">Tercero (UUID)</label>
            <input name="counterparty_id" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">% participación</label>
            <input name="pct" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
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
          <div className="md:col-span-4">
            <button className="btn">+ Añadir socio</button>
          </div>
        </form>

        <div className="mt-3 text-sm divide-y divide-gray-200">
          {(partners || []).map((p: any) => (
            <div key={p.id} className="py-1">
              {p.counterparties?.nick || p.counterparties?.legal_name} · {p.pct}% · {p.base_on}
            </div>
          ))}
          {!partners?.length && <div className="text-sm text-gray-500">Sin socios.</div>}
        </div>
      </ModuleCard>

      {/* BOLSA DE GASTOS */}
      <ModuleCard title="Bolsa">
        <ExpensesModule
          grouped={groupedExpenses}
          actionNewExpense={newExpense}
          actionMarkPaid={markPaid}
          actionRequestInvoice={requestInvoice}
        />
      </ModuleCard>

      <SavedToast show={searchParams?.saved === '1'} />
    </div>
  )
}
