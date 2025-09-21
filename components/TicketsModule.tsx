// components/TicketsModule.tsx
'use client'

import { useMemo, useState } from 'react'

export type TicketTypeRow = {
  id?: string
  name: string
  quantity: number
  price_gross: number
  invites_quota: number
}

export type TicketSettings = {
  enabled: boolean
  capacity?: number | null
  sgae_pct: number
  iva_pct: number
  announcement_tbc: boolean
  announcement_at?: string | null
  on_sale_at?: string | null
  vendor_name?: string | null
  sales_url?: string | null
}

function netFromGross(gross: number, iva_pct: number, sgae_pct: number) {
  const base = gross / (1 + (iva_pct || 0) / 100)
  const sgae = base * ((sgae_pct || 0) / 100)
  return Math.max(0, base - sgae)
}

export default function TicketsModule({
  activityId,
  settings,
  rows,
  actionSaveSettings,
  actionSaveTypes,
  actionDeleteType,
}: {
  activityId: string
  settings: TicketSettings
  rows: TicketTypeRow[]
  actionSaveSettings: (formData: FormData) => void
  actionSaveTypes: (formData: FormData) => void
  actionDeleteType: (formData: FormData) => void
}) {
  const [list, setList] = useState<TicketTypeRow[]>(
    rows?.length ? rows : [{ name: '', quantity: 0, price_gross: 0, invites_quota: 0 }]
  )
  const [s, setS] = useState<TicketSettings>(settings)

  const totals = useMemo(() => {
    const totalForSale = list.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0)
    const totalInvites = list.reduce((acc, r) => acc + (Number(r.invites_quota) || 0), 0)
    const totalCapacityUsed = totalForSale + totalInvites
    return { totalForSale, totalInvites, totalCapacityUsed }
  }, [list])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* IZQUIERDA: configuración y tipos */}
      <div className="space-y-6">
        <form action={actionSaveSettings} className="border rounded p-3">
          <input type="hidden" name="activity_id" value={activityId} />
          <div className="flex items-center gap-2 mb-3">
            <input
              id="enabled"
              type="checkbox"
              name="enabled"
              defaultChecked={s.enabled}
              onChange={(e) => setS({ ...s, enabled: e.target.checked })}
            />
            <label htmlFor="enabled" className="font-medium">¿Hay venta de entradas?</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">% SGAE</label>
              <input
                name="sgae_pct"
                type="number"
                step="0.01"
                defaultValue={s.sgae_pct}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">% IVA</label>
              <input
                name="iva_pct"
                type="number"
                step="0.01"
                defaultValue={s.iva_pct}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="announcement_tbc"
                type="checkbox"
                name="announcement_tbc"
                defaultChecked={s.announcement_tbc}
              />
              <label htmlFor="announcement_tbc">Anuncio TBC</label>
            </div>
            <div>
              <label className="block text-sm mb-1">Fecha anuncio</label>
              <input
                type="datetime-local"
                name="announcement_at"
                defaultValue={
                  s.announcement_at
                    ? new Date(s.announcement_at).toISOString().slice(0,16)
                    : ''
                }
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Salida a la venta</label>
              <input
                type="datetime-local"
                name="on_sale_at"
                defaultValue={
                  s.on_sale_at
                    ? new Date(s.on_sale_at).toISOString().slice(0,16)
                    : ''
                }
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Ticketera</label>
              <input
                name="vendor_name"
                defaultValue={s.vendor_name || ''}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Link venta</label>
              <input
                name="sales_url"
                defaultValue={s.sales_url || ''}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          </div>

          <div className="mt-3">
            <button className="btn">Guardar</button>
          </div>
        </form>

        <form action={actionSaveTypes} className="border rounded p-3">
          <input type="hidden" name="activity_id" value={activityId} />
          <input type="hidden" name="payload"
            value={JSON.stringify(list)}
            readOnly
          />

          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Tipos de entrada</div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setList([...list, { name: '', quantity: 0, price_gross: 0, invites_quota: 0 }])}
            >
              + Añadir tipo
            </button>
          </div>

          <div className="space-y-3">
            {list.map((r, i) => {
              const net = netFromGross(Number(r.price_gross) || 0, s.iva_pct || 0, s.sgae_pct || 0)
              return (
                <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 border rounded p-2">
                  <div>
                    <label className="block text-xs mb-1">Tipo</label>
                    <input
                      value={r.name}
                      onChange={(e) => setList(list.map((x,idx)=> idx===i ? {...x, name:e.target.value} : x))}
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Nº entradas</label>
                    <input
                      type="number"
                      value={r.quantity}
                      onChange={(e) => setList(list.map((x,idx)=> idx===i ? {...x, quantity:Number(e.target.value)||0} : x))}
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Precio venta (PVP)</label>
                    <input
                      type="number" step="0.01"
                      value={r.price_gross}
                      onChange={(e) => setList(list.map((x,idx)=> idx===i ? {...x, price_gross:Number(e.target.value)||0} : x))}
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Invitaciones</label>
                    <input
                      type="number"
                      value={r.invites_quota}
                      onChange={(e) => setList(list.map((x,idx)=> idx===i ? {...x, invites_quota:Number(e.target.value)||0} : x))}
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="text-xs text-gray-600">
                      Neto aprox.: <span className="font-medium">{net.toFixed(2)} €</span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setList(list.filter((_,idx)=> idx!==i))}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 text-sm">
            <div className="font-medium">
              Total entradas a la venta: {totals.totalForSale}
            </div>
            <div>Invitaciones disponibles: {totals.totalInvites}</div>
            <div className="font-medium">
              Aforo utilizado: {totals.totalCapacityUsed}{settings.capacity ? ` / ${settings.capacity}` : ''}
            </div>
          </div>

          <div className="mt-3">
            <button className="btn">Guardar</button>
          </div>
        </form>
      </div>

      {/* DERECHA: estado (placeholder – se alimenta con los reportes) */}
      {s.enabled && (
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Estado de la venta (resumen)</div>
          <div className="text-sm text-gray-500">
            Aquí se representa la barra de progreso y, si hay reportes,
            el delta del último día, días para el evento y para la salida
            a la venta. Esta sección se alimenta de <code>activity_ticket_reports</code>.
          </div>
        </div>
      )}
    </div>
  )
}
