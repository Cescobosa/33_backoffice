// components/ActivityTicketsBlock.tsx
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'

type Setup = {
  activity_id: string
  has_ticket_sales: boolean
  sgae_pct: number
  vat_pct: number
  capacity_on_sale: number | null
  announcement_tbc: boolean
  announcement_at: string | null
  onsale_at: string | null
  ticketing_name: string | null
  ticketing_url: string | null
}

type TicketType = {
  id: string
  activity_id: string
  name: string
  quantity: number
  price_gross: number
  invites_quota: number
}

async function ensureSetup(activityId: string): Promise<{ setup: Setup, types: TicketType[], activityCapacity: number | null }> {
  const s = createSupabaseServer()
  const act = await s.from('activities').select('capacity').eq('id', activityId).maybeSingle()
  if (act.error) throw new Error(act.error.message)
  const activityCapacity = (act.data?.capacity ?? null) as number | null

  const q = await s.from('activity_ticket_setup').select('*').eq('activity_id', activityId).maybeSingle()
  let setup = q.data as Setup | null

  if (!setup) {
    const init: Partial<Setup> = {
      has_ticket_sales: false,
      sgae_pct: 10,
      vat_pct: 21,
      capacity_on_sale: activityCapacity,
      announcement_tbc: false,
      announcement_at: null,
      onsale_at: null,
      ticketing_name: null,
      ticketing_url: null,
    }
    const ins = await s.from('activity_ticket_setup').insert({ activity_id: activityId, ...init }).select('*').single()
    if (ins.error) throw new Error(ins.error.message)
    setup = ins.data as Setup
  }

  const tt = await s.from('activity_ticket_types')
    .select('id, activity_id, name, quantity, price_gross, invites_quota')
    .eq('activity_id', activityId).order('created_at', { ascending: true })
  if (tt.error) throw new Error(tt.error.message)

  return { setup: setup!, types: (tt.data || []) as TicketType[], activityCapacity }
}

export default async function ActivityTicketsBlock({ activityId, pathnameForRevalidate }: { activityId: string, pathnameForRevalidate: string }) {
  const { setup, types, activityCapacity } = await ensureSetup(activityId)

  // ====== Actions (server) ======
  async function toggleSales() {
    'use server'
    const s = createSupabaseServer()
    const cur = await s.from('activity_ticket_setup').select('has_ticket_sales').eq('activity_id', activityId).single()
    if (cur.error) throw new Error(cur.error.message)
    const { error } = await s.from('activity_ticket_setup').update({ has_ticket_sales: !cur.data.has_ticket_sales }).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function saveSetup(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const patch = {
      capacity_on_sale: formData.get('capacity_on_sale') ? Number(formData.get('capacity_on_sale')) : null,
      sgae_pct: Number(formData.get('sgae_pct') || 0),
      vat_pct: Number(formData.get('vat_pct') || 0),
      announcement_tbc: formData.get('announcement_tbc') === 'on',
      announcement_at: String(formData.get('announcement_at') || '') || null,
      onsale_at: String(formData.get('onsale_at') || '') || null,
      ticketing_name: String(formData.get('ticketing_name') || '') || null,
      ticketing_url: String(formData.get('ticketing_url') || '') || null,
    }
    const { error } = await s.from('activity_ticket_setup').update(patch).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function addType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const row = {
      activity_id: activityId,
      name: String(formData.get('name') || '').trim() || 'General',
      quantity: Number(formData.get('quantity') || 0),
      price_gross: Number(formData.get('price_gross') || 0),
      invites_quota: Number(formData.get('invites_quota') || 0),
    }
    const { error } = await s.from('activity_ticket_types').insert(row)
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function updateType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const id = String(formData.get('id') || '')
    const patch = {
      name: String(formData.get('name') || ''),
      quantity: Number(formData.get('quantity') || 0),
      price_gross: Number(formData.get('price_gross') || 0),
      invites_quota: Number(formData.get('invites_quota') || 0),
    }
    const { error } = await s.from('activity_ticket_types').update(patch).eq('id', id).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function deleteType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const id = String(formData.get('id') || '')
    const { error } = await s.from('activity_ticket_types').delete().eq('id', id).eq('activity_id', activityId)
    if (error) throw new Error(error.message)
    revalidatePath(pathnameForRevalidate)
  }

  // Totales
  const totals = types.reduce(
    (acc, t) => {
      acc.q += Number(t.quantity || 0)
      acc.inv += Number(t.invites_quota || 0)
      acc.gross += Number(t.price_gross || 0) * Number(t.quantity || 0)
      return acc
    }, { q: 0, inv: 0, gross: 0 }
  )
  const used = totals.q + totals.inv
  const cap = setup.capacity_on_sale ?? activityCapacity ?? 0

  function netFromGross(gross: number) {
    // neto aprox = bruto / (1 + IVA) * (1 - SGAE)
    const vat = (setup.vat_pct || 0) / 100
    const sgae = (setup.sgae_pct || 0) / 100
    return gross / (1 + vat) * (1 - sgae)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Venta de entradas</div>
        <form action={toggleSales} method="post">
          <button className="btn-secondary">{setup.has_ticket_sales ? 'Desactivar' : 'Activar'}</button>
        </form>
      </div>

      {!setup.has_ticket_sales ? (
        <div className="text-sm text-gray-600">Esta actividad está marcada como <strong>sin venta</strong> (gratuita o sin control de tickets).</div>
      ) : (
        <>
          {/* Configuración general */}
          <form action={saveSetup} method="post" className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Aforo a la venta</label>
              <input name="capacity_on_sale" type="number" className="w-full border rounded px-2 py-1" defaultValue={setup.capacity_on_sale ?? activityCapacity ?? ''} />
            </div>
            <div>
              <label className="block text-sm mb-1">% SGAE</label>
              <input name="sgae_pct" type="number" step="0.01" className="w-full border rounded px-2 py-1" defaultValue={setup.sgae_pct} />
            </div>
            <div>
              <label className="block text-sm mb-1">% IVA</label>
              <input name="vat_pct" type="number" step="0.01" className="w-full border rounded px-2 py-1" defaultValue={setup.vat_pct} />
            </div>

            <div>
              <label className="block text-sm mb-1">Anuncio</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="announcement_tbc" name="announcement_tbc" defaultChecked={setup.announcement_tbc} />
                <label htmlFor="announcement_tbc" className="text-sm">TBC</label>
              </div>
              <input name="announcement_at" type="datetime-local" className="w-full border rounded px-2 py-1 mt-1" defaultValue={setup.announcement_at ?? ''} />
            </div>
            <div>
              <label className="block text-sm mb-1">Salida a la venta</label>
              <input name="onsale_at" type="datetime-local" className="w-full border rounded px-2 py-1" defaultValue={setup.onsale_at ?? ''} />
            </div>
            <div>
              <label className="block text-sm mb-1">Ticketera</label>
              <input name="ticketing_name" className="w-full border rounded px-2 py-1 mb-1" defaultValue={setup.ticketing_name ?? ''} />
              <input name="ticketing_url" className="w-full border rounded px-2 py-1" defaultValue={setup.ticketing_url ?? ''} placeholder="URL de venta" />
            </div>

            <div className="md:col-span-3"><button className="btn">Guardar configuración</button></div>
          </form>

          {/* Tipos de entrada */}
          <div className="border rounded mt-4">
            <div className="p-2 font-medium">Tipos de entrada</div>
            <div className="divide-y divide-gray-200">
              {types.map(t => (
                <form key={t.id} action={updateType} method="post" className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 items-end">
                  <input type="hidden" name="id" value={t.id} />
                  <div>
                    <label className="block text-sm mb-1">Tipo</label>
                    <input name="name" defaultValue={t.name} className="w-full border rounded px-2 py-1" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Entradas</label>
                    <input name="quantity" type="number" defaultValue={t.quantity} className="w-full border rounded px-2 py-1" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">PVP (€)</label>
                    <input name="price_gross" type="number" step="0.01" defaultValue={Number(t.price_gross || 0)} className="w-full border rounded px-2 py-1" />
                    <div className="text-xs text-gray-500 mt-1">Neto aprox: {netFromGross(Number(t.price_gross || 0)).toFixed(2)} €</div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Invitaciones</label>
                    <input name="invites_quota" type="number" defaultValue={t.invites_quota} className="w-full border rounded px-2 py-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn">Guardar</button>
                    <form action={deleteType} method="post">
                      <input type="hidden" name="id" value={t.id} />
                    </form>
                    <button formAction={deleteType} className="btn-secondary">Eliminar</button>
                  </div>
                </form>
              ))}
              {types.length === 0 && <div className="p-3 text-sm text-gray-500">Aún no hay tipos de entrada.</div>}
            </div>

            {/* Añadir nuevo */}
            <form action={addType} method="post" className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3">
              <div><input name="name" placeholder="Nombre" className="w-full border rounded px-2 py-1" /></div>
              <div><input name="quantity" type="number" placeholder="Entradas" className="w-full border rounded px-2 py-1" /></div>
              <div><input name="price_gross" type="number" step="0.01" placeholder="PVP (€)" className="w-full border rounded px-2 py-1" /></div>
              <div><input name="invites_quota" type="number" placeholder="Invitaciones" className="w-full border rounded px-2 py-1" /></div>
              <div><button className="btn">+ Añadir tipo</button></div>
            </form>
          </div>

          {/* Totales */}
          <div className="p-2 text-sm">
            <div><strong>Total entradas a la venta:</strong> {totals.q.toLocaleString('es-ES')}</div>
            <div><strong>Invitaciones disponibles:</strong> {totals.inv.toLocaleString('es-ES')}</div>
            <div><strong>Aforo utilizado:</strong> {used.toLocaleString('es-ES')} / {cap.toLocaleString('es-ES')}</div>
          </div>
        </>
      )}
    </div>
  )
}
