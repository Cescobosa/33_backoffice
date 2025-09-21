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
import ExpensesModule from '@/components/ExpensesModule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}
type Counterparty = { id: string; legal_name?: string; nick?: string; logo_url?: string }

export default async function ActivityDetail({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams?: { saved?: string; tab?: 'datos'|'tickets'|'bolsa' }
}) {
  const s = createSupabaseServer()
  const activityId = params.activityId
  const tab = (searchParams?.tab as any) || 'datos'

  // Actividad
  const { data: a, error: aErr } = await s
    .from('activities')
    .select(`
      id, artist_id, company_id, type, status, date, time, municipality, province, country, capacity, pay_kind, tags,
      venues ( id, name, photo_url, address ),
      group_companies ( id, nick, name, logo_url )
    `)
    .eq('id', activityId)
    .single()
  if (aErr || !a) notFound()

  // Artista
  const { data: artist } = await s
    .from('artists')
    .select('id, stage_name')
    .eq('id', a.artist_id).single()

  // Empresas del grupo
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

  // Ingresos
  const { data: incomes } = await s
    .from('activity_incomes')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at')

  // Agente zona
  const { data: agents } = await s
    .from('activity_zone_agents')
    .select('id, counterparty_id, commission_type, commission_pct, commission_base, commission_amount, counterparties(id,legal_name,nick)')
    .eq('activity_id', activityId)

  // Equipos
  const { data: equip } = await s
    .from('activity_equipment')
    .select('*').eq('activity_id', activityId).maybeSingle()

  // Descripción
  const { data: descr } = await s
    .from('activity_description')
    .select('*').eq('activity_id', activityId).maybeSingle()

  // Partidas cubiertas promotor
  const { data: costs } = await s
    .from('activity_promoter_costs')
    .select('*').eq('activity_id', activityId)

  // Facturación
  const { data: bills } = await s
    .from('activity_billing_requests')
    .select('*').eq('activity_id', activityId).order('created_at')

  // Producción local
  const { data: locals } = await s
    .from('activity_local_productions')
    .select('*').eq('activity_id', activityId)

  // Producción técnica
  const { data: tech } = await s
    .from('activity_tech')
    .select('*').eq('activity_id', activityId).maybeSingle()

  // Socios
  const { data: partners } = await s
    .from('activity_partners')
    .select('id, counterparty_id, pct, base_on, counterparties(id,legal_name,nick)')
    .eq('activity_id', activityId)

  // Ticketing
  const { data: setup } = await s.from('activity_ticket_setup').select('*').eq('activity_id', activityId).maybeSingle()
  const { data: typesRows } = await s.from('activity_ticket_types').select('*').eq('activity_id', activityId).order('position')
  const { data: reportsRows } = await s.from('activity_ticket_reports').select('id, report_date, totals_sold, totals_net_revenue, created_at').eq('activity_id', activityId).order('report_date', { ascending: false })

  // Bolsa / gastos (listado agrupado)
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

  // ====== Server Actions ======

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

    const { error } = await s.from('activities').update({ status, date, time, municipality, province, country, capacity, pay_kind }).eq('id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function setCompany(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const company_id = String(formData.get('company_id') || '') || null
    const { error } = await s.from('activities').update({ company_id }).eq('id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
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
      const ins = await s.from('counterparties').insert({
        organization_id: org.data!.id, legal_name, is_company, tax_id, as_third_party: true,
      }).select('id').single()
      if (ins.error) throw new Error(ins.error.message)
      counterparty_id = ins.data.id
    }
    const del = await s.from('activity_promoters').delete().eq('activity_id', activityId)
    if (del.error) throw new Error(del.error.message)
    const { error } = await s.from('activity_promoters').insert({ activity_id: activityId, counterparty_id })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function addIncome(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const kind = String(formData.get('kind') || 'fixed') as any
    const label = String(formData.get('label') || '').trim() || null
    const amount = formData.get('amount') ? Number(formData.get('amount')) : null
    const percent = formData.get('percent') ? Number(formData.get('percent')) : null
    const rule_from_tickets = formData.get('from_tickets') ? Number(formData.get('from_tickets')) : null
    const { error } = await s.from('activity_incomes').insert({ activity_id: activityId, kind, label, amount, percent, rule_from_tickets })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
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
      const ins = await s.from('counterparties').insert({
        organization_id: org.data!.id, legal_name, is_company, as_third_party: true,
      }).select('id').single()
      if (ins.error) throw new Error(ins.error.message)
      counterparty_id = ins.data.id
    }
    const commission_type = String(formData.get('commission_type') || 'percent') as any
    const commission_pct = formData.get('commission_pct') ? Number(formData.get('commission_pct')) : null
    const commission_base = String(formData.get('commission_base') || 'fixed') as any
    const commission_amount = formData.get('commission_amount') ? Number(formData.get('commission_amount')) : null
    const { error } = await s.from('activity_zone_agents').insert({
      activity_id: activityId, counterparty_id, commission_type, commission_pct, commission_base, commission_amount,
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
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
      const up = await s.storage.from('contracts').upload(`activities/${activityId}/rider_${crypto.randomUUID()}.pdf`, rider, {
        cacheControl: '3600', upsert: false, contentType: 'application/pdf',
      })
      if (up.error) throw new Error(up.error.message)
      rider_pdf_url = s.storage.from('contracts').getPublicUrl(up.data.path).data.publicUrl
    }
    const exists = await s.from('activity_equipment').select('id').eq('activity_id', activityId).maybeSingle()
    if (exists.data) {
      const { error } = await s.from('activity_equipment').update({ mode, extra_party, ...(rider_pdf_url ? { rider_pdf_url } : {}) }).eq('activity_id', activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s.from('activity_equipment').insert({ activity_id: activityId, mode, extra_party, rider_pdf_url })
      if (error) throw new Error(error.message)
    }
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function saveDescr(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const formation = String(formData.get('formation') || 'full') as any
    const reduced_notes = String(formData.get('reduced_notes') || '').trim() || null
    const show_duration = formData.get('show_duration') ? Number(formData.get('show_duration')) : null
    const exists = await s.from('activity_description').select('id').eq('activity_id', activityId).maybeSingle()
    if (exists.data) {
      const { error } = await s.from('activity_description').update({ formation, reduced_notes, show_duration }).eq('activity_id', activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s.from('activity_description').insert({ activity_id: activityId, formation, reduced_notes, show_duration })
      if (error) throw new Error(error.message)
    }
    revalidatePath(`/actividades/actividad/${activityId}`)
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
    const { error } = await s.from('activity_promoter_costs').insert({
      activity_id: activityId, category, details, coverage, amount, promoter_handles, refacturable,
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
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
    const cp = one<Counterparty>(promoterLink?.counterparties as any)
    if (!counterparty_id && cp?.id) counterparty_id = cp.id
    const { error } = await s.from('activity_billing_requests').insert({
      activity_id: activityId, direction, concept, amount, due_rule, due_date, counterparty_id,
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
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
    const { error } = await s.from('activity_local_productions').insert({
      activity_id: activityId, provider_id, amount, details, resp_name, resp_phone, resp_email,
    })
    if (error) throw new Error(error.message)
    await s.from('activity_billing_requests').insert({
      activity_id: activityId, direction: 'received', concept: 'local_production', amount, due_rule: 'date', counterparty_id: provider_id,
    })
    revalidatePath(`/actividades/actividad/${activityId}`)
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
    const exists = await s.from('activity_tech').select('id').eq('activity_id', activityId).maybeSingle()
    if (exists.data) {
      const { error } = await s.from('activity_tech').update({
        tech_resp_name, tech_resp_phone, tech_resp_email, sound_company, sound_contact, sound_phone, sound_email,
      }).eq('activity_id', activityId)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await s.from('activity_tech').insert({
        activity_id: activityId, tech_resp_name, tech_resp_phone, tech_resp_email, sound_company, sound_contact, sound_phone, sound_email,
      })
      if (error) throw new Error(error.message)
    }
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  async function addPartner(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const counterparty_id = String(formData.get('counterparty_id') || '')
    const pct = formData.get('pct') ? Number(formData.get('pct')) : null
    const base_on = String(formData.get('base_on') || 'gross') as any
    const { error } = await s.from('activity_partners').insert({ activity_id: activityId, counterparty_id, pct, base_on })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  // Tickets actions
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
      announcement_at, announcement_tbc, onsale_at, ticketing_name, ticketing_url,
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

    const { data: tts } = await s.from('activity_ticket_types').select('id, name, price_net').eq('activity_id', activityId)
    const by: Record<string, { sold: number, net: number }> = {}
    let soldAcc = 0
    let netAcc = 0
    for (const t of (tts || [])) {
      const val = formData.get(`by_${t.id}`)
      const num = val ? Number(val) : 0
      if (num > 0) {
        const net = (Number((t as any).price_net) || 0) * num
        by[(t as any).name] = { sold: num, net }
        soldAcc += num
        netAcc += net
      }
    }
    const finalSold = totals_sold || soldAcc
    const finalNet = totals_net_revenue || netAcc

    const { error } = await s.from('activity_ticket_reports').insert({
      activity_id: activityId, report_date, aggregate_only, totals_sold: finalSold, totals_net_revenue: finalNet,
      by_type: Object.keys(by).length ? by : null, note
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  // Bolsa actions
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
      activity_id: activityId, kind, concept, counterparty_id, is_invoice, invoice_number, invoice_date, amount_net, amount_gross, vat_pct
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
    const { error } = await s.from('activity_expenses').update({ payment_status: 'requested' }).eq('id', expense_id).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${activityId}`)
  }

  // ====== RENDER ======
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{artist?.stage_name || 'Actividad'} · {a.type}</h1>
          <div className="text-sm text-gray-600">{a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'} {a.time ? ('· ' + a.time) : ''}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/actividades" className="btn-secondary">Volver</Link>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex gap-2">
        {[
          { key: 'datos', label: 'Datos' },
          { key: 'tickets', label: 'Venta de entradas' },
          { key: 'bolsa', label: 'Bolsa' },
        ].map((t) => (
          <Link
            key={t.key}
            href={{ pathname: `/actividades/actividad/${activityId}`, query: { tab: t.key } }}
            className={`px-3 py-2 rounded-md ${tab === t.key ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* === CONTENIDO === */}
      {tab === 'datos' && (
        <>
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

          <ModuleCard title="Promotor" leftActions={<span className="badge">Editar</span>}>
            <form action={attachPromoter} className="border rounded p-3">
              <CounterpartyPicker />
              <div className="mt-2">
                <button className="btn">Vincular promotor</button>
              </div>
            </form>
            {promoterCp?.id && (
              <div className="mt-3 flex items-center gap-3">
                <img src={promoterCp.logo_url || '/avatar.png'} className="w-8 h-8 rounded-full border object-cover" alt="" />
                <Link href={`/terceros/${promoterCp.id}`} className="underline font-medium">
                  {promoterCp.nick || promoterCp.legal_name}
                </Link>
              </div>
            )}
          </ModuleCard>

          <ModuleCard title="Ingresos" leftActions={<span className="badge">Editar</span>}>
            <ActivityIncomeCreator actionAdd={addIncome} />
            <div className="divide-y divide-gray-200 mt-4">
              {(incomes || []).map((i: any) => (
                <div key={i.id} className="py-2 text-sm">
                  <span className="font-medium">
                    {i.kind === 'fixed' ? 'Caché fijo' :
                     i.kind === 'variable_fixed_after' ? 'Variable · fijo desde N' :
                     i.kind === 'per_ticket' ? 'Variable · por entrada' :
                     i.kind === 'percent' ? 'Variable · % sobre ventas' : i.kind}
                  </span>{' · '}
                  {i.amount ? `${Number(i.amount).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}` : ''}
                  {i.percent ? ` · ${i.percent}%` : ''}
                  {i.rule_from_tickets ? ` · desde ${i.rule_from_tickets} entradas` : ''}
                </div>
              ))}
              {!incomes?.length && <div className="text-sm text-gray-500">Sin ingresos configurados.</div>}
            </div>
          </ModuleCard>

          {/* Resto de módulos de “Datos” (agente zona, equipos, descripción, partidas cubiertas, facturación, prod. local, prod. técnica, socios)
              -> idénticos a tu versión anterior (no repetimos por longitud). Puedes mantener los tuyos o quedarte con los de mi
                 mensaje previo; ya integran los server actions corregidos con `activityId`.
          */}
        </>
      )}

      {tab === 'tickets' && (
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
      )}

      {tab === 'bolsa' && (
        <ModuleCard title="Bolsa">
          <ExpensesModule
            grouped={groupedExpenses}
            actionNewExpense={newExpense}
            actionMarkPaid={markPaid}
            actionRequestInvoice={requestInvoice}
          />
        </ModuleCard>
      )}

      <SavedToast show={searchParams?.saved === '1'} />
    </div>
  )
}
