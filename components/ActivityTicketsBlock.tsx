// components/ActivityTicketsBlock.tsx
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'

type Props = {
  activityId: string
  /** Ruta a revalidar cuando se guarde (ej. `/actividades/actividad/ID`) */
  pathnameForRevalidate: string
}

export default async function ActivityTicketsBlock({ activityId, pathnameForRevalidate }: Props) {
  const s = createSupabaseServer()

  // Actividad (capacidad base)
  const act = await s.from('activities').select('id, date, capacity').eq('id', activityId).maybeSingle()
  if (act.error) {
    return <div className="text-red-600 text-sm">Error cargando actividad: {act.error.message}</div>
  }
  const capacity = act.data?.capacity ?? null

  // Configuración de tickets (activity_ticket_setup)  ← tabla del esquema
  const setup = await s
    .from('activity_ticket_setup')
    .select('activity_id, has_ticket_sales, sgae_pct, vat_pct, capacity_on_sale, announcement_tbc, announcement_at, onsale_at, ticketing_name, ticketing_url')
    .eq('activity_id', activityId)
    .maybeSingle()

  if (setup.error && setup.error.code !== 'PGRST116') {
    return <div className="text-red-600 text-sm">Error cargando venta: {setup.error.message}</div>
  }

  // Tipos de entradas
  const types = await s
    .from('activity_ticket_types')
    .select('id, name, quantity, price_gross, invites_quota')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true })

  if (types.error) {
    return <div className="text-red-600 text-sm">Error cargando tipos de entrada: {types.error.message}</div>
  }

  // Último reporte y vendidos (opcional)
  const lastReport = await s
    .from('activity_ticket_reports')
    .select('id, report_date')
    .eq('activity_id', activityId)
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let lastSold = 0
  if (lastReport.data?.id) {
    const items = await s
      .from('activity_ticket_report_items')
      .select('sold_count')
      .eq('report_id', lastReport.data.id)

    if (!items.error) {
      lastSold = (items.data || []).reduce((a: number, r: any) => a + (Number(r.sold_count) || 0), 0)
    }
  }

  // ===== Actions =====
  async function saveSetup(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const payload = {
      activity_id: activityId,
      has_ticket_sales: formData.get('has_ticket_sales') === 'on',
      sgae_pct: Number(formData.get('sgae_pct') || 0),
      vat_pct: Number(formData.get('vat_pct') || 21),
      capacity_on_sale: formData.get('capacity_on_sale') ? Number(formData.get('capacity_on_sale')) : null,
      announcement_tbc: formData.get('announcement_tbc') === 'on',
      announcement_at: String(formData.get('announcement_at') || '') || null,
      onsale_at: String(formData.get('onsale_at') || '') || null,
      ticketing_name: String(formData.get('ticketing_name') || '') || null,
      ticketing_url: String(formData.get('ticketing_url') || '') || null,
    }

    const up = await s.from('activity_ticket_setup').upsert(payload, { onConflict: 'activity_id' })
    if (up.error) throw new Error(up.error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function addType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const name = String(formData.get('name') || '').trim()
    if (!name) throw new Error('Nombre requerido')

    const quantity = Number(formData.get('quantity') || 0)
    const price_gross = Number(formData.get('price_gross') || 0)
    const invites_quota = Number(formData.get('invites_quota') || 0)

    const ins = await s
      .from('activity_ticket_types')
      .insert({ activity_id: activityId, name, quantity, price_gross, invites_quota })

    if (ins.error) throw new Error(ins.error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function updateType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const id = String(formData.get('id') || '')
    if (!id) throw new Error('Falta ID')

    const quantity = Number(formData.get('quantity') || 0)
    const price_gross = Number(formData.get('price_gross') || 0)
    const invites_quota = Number(formData.get('invites_quota') || 0)

    const up = await s
      .from('activity_ticket_types')
      .update({ quantity, price_gross, invites_quota })
      .eq('id', id)

    if (up.error) throw new Error(up.error.message)
    revalidatePath(pathnameForRevalidate)
  }

  async function deleteType(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const id = String(formData.get('id') || '')
    if (!id) throw new Error('Falta ID')

    const del = await s.from('activity_ticket_types').delete().eq('id', id)
    if (del.error) throw new Error(del.error.message)
    revalidatePath(pathnameForRevalidate)
  }

  const sgae = Number(setup.data?.sgae_pct ?? 0)
  const vat = Number(setup.data?.vat_pct ?? 21)

  return (
    <div className="space-y-6">
      {/* Configuración */}
      <form action={saveSetup} method="post" className="border rounded p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="has_ticket_sales" defaultChecked={!!setup.data?.has_ticket_sales} />
          Hay venta de entradas
        </label>

        <div>
          <div className="text-sm mb-1">Aforo a la venta</div>
          <input
            name="capacity_on_sale"
            type="number"
            defaultValue={setup.data?.capacity_on_sale ?? capacity ?? ''}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div>
          <div className="text-sm mb-1">% SGAE</div>
          <input name="sgae_pct" type="number" step="0.01" defaultValue={sgae} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <div className="text-sm mb-1">% IVA</div>
          <input name="vat_pct" type="number" step="0.01" defaultValue={vat} className="w-full border rounded px-2 py-1" />
        </div>

        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="announcement_tbc" defaultChecked={!!setup.data?.announcement_tbc} />
            Anuncio TBC
          </label>
          <div>
            <div className="text-sm mb-1">Fecha/hora anuncio</div>
            <input name="announcement_at" type="datetime-local" defaultValue={toLocalInput(setup.data?.announcement_at)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <div className="text-sm mb-1">Salida a la venta</div>
            <input name="onsale_at" type="datetime-local" defaultValue={toLocalInput(setup.data?.onsale_at)} className="w-full border rounded px-2 py-1" />
          </div>
        </div>

        <div>
          <div className="text-sm mb-1">Ticketera</div>
          <input name="ticketing_name" defaultValue={setup.data?.ticketing_name ?? ''} className="w-full border rounded px-2 py-1" />
        </div>
        <div className="md:col-span-2">
          <div className="text-sm mb-1">URL venta</div>
          <input name="ticketing_url" defaultValue={setup.data?.ticketing_url ?? ''} className="w-full border rounded px-2 py-1" />
        </div>

        <div className="md:col-span-3">
          <button className="btn">Guardar configuración</button>
        </div>
      </form>

      {/* Tipos de entradas */}
      <div className="border rounded p-3">
        <div className="font-medium mb-2">Tipos de entrada</div>

        <div className="space-y-2">
          {(types.data || []).map((t) => (
            <form key={t.id} action={updateType} method="post" className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <input type="hidden" name="id" value={t.id} />
              <div className="md:col-span-2">
                <div className="text-sm mb-1">Tipo</div>
                <input defaultValue={t.name} disabled className="w-full border rounded px-2 py-1 bg-gray-50" />
              </div>
              <div>
                <div className="text-sm mb-1">Entradas</div>
                <input name="quantity" type="number" defaultValue={t.quantity ?? 0} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <div className="text-sm mb-1">PVP</div>
                <input name="price_gross" type="number" step="0.01" defaultValue={t.price_gross ?? 0} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <div className="text-sm mb-1">Invitaciones</div>
                <input name="invites_quota" type="number" defaultValue={t.invites_quota ?? 0} className="w-full border rounded px-2 py-1" />
              </div>
              <div className="flex gap-2">
                <button className="btn">Guardar</button>
                <form action={deleteType} method="post">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn-secondary">Eliminar</button>
                </form>
              </div>
            </form>
          ))}

          <form action={addType} method="post" className="grid grid-cols-1 md:grid-cols-6 gap-2 mt-3">
            <div className="md:col-span-2">
              <input name="name" placeholder="Nuevo tipo (ej. General)" className="w-full border rounded px-2 py-1" />
            </div>
            <input name="quantity" type="number" placeholder="Entradas" className="w-full border rounded px-2 py-1" />
            <input name="price_gross" type="number" step="0.01" placeholder="PVP" className="w-full border rounded px-2 py-1" />
            <input name="invites_quota" type="number" placeholder="Invitaciones" className="w-full border rounded px-2 py-1" />
            <button className="btn">+ Añadir tipo</button>
          </form>
        </div>
      </div>

      {/* Estado de ventas (resumen) */}
      <div className="border rounded p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Estado de ventas</div>
          {lastReport.data?.report_date ? (
            <div className="text-xs text-gray-600">
              Último reporte: {new Date(lastReport.data.report_date).toLocaleDateString()}
            </div>
          ) : (
            <div className="text-xs text-gray-500">Sin datos</div>
          )}
        </div>

        <div className="mt-2">
          <div className="h-3 w-full bg-gray-200 rounded">
            {/* barra simple: vendidos sobre aforo a la venta */}
            {(() => {
              const cap = Number(setup.data?.capacity_on_sale ?? capacity ?? 0) || 0
              const pct = cap > 0 ? Math.min(100, Math.round((lastSold / cap) * 100)) : 0
              return <div className="h-3 rounded bg-green-500" style={{ width: `${pct}%` }} />
            })()}
          </div>
          <div className="text-xs text-gray-700 mt-1">
            Vendidas: {lastSold.toLocaleString('es-ES')} / {(setup.data?.capacity_on_sale ?? capacity ?? 0).toLocaleString('es-ES')}
          </div>
        </div>
      </div>
    </div>
  )
}

function toLocalInput(v?: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
