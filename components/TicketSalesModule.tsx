'use client'

import { useMemo } from 'react'

type Setup = {
  has_ticket_sales?: boolean | null
  capacity_on_sale?: number | null
  sgae_pct?: number | null
  vat_pct?: number | null
  announcement_at?: string | null
  announcement_tbc?: boolean | null
  onsale_at?: string | null
  ticketing_name?: string | null
  ticketing_url?: string | null
}

type TypeRow = {
  id: string
  name: string
  qty: number | null
  price_gross: number | null
  price_net: number | null
  invitations_qty: number | null
}

type ReportRow = {
  id: string
  report_date: string | null
  totals_sold: number | null
  totals_net_revenue: number | null
  created_at?: string
}

export default function TicketSalesModule({
  setup,
  types,
  reports,
  capacityFromActivity,
  actionSaveSetup,
  actionAddType,
  actionDelType,
  actionSaveReport,
}: {
  setup: Setup | null
  types: TypeRow[]
  reports: ReportRow[]
  capacityFromActivity: number | null
  actionSaveSetup: (fd: FormData) => Promise<void>
  actionAddType: (fd: FormData) => Promise<void>
  actionDelType: (fd: FormData) => Promise<void>
  actionSaveReport: (fd: FormData) => Promise<void>
}) {
  const totals = useMemo(() => {
    const qty = (types || []).reduce((a, t) => a + (t.qty ?? 0), 0)
    const invites = (types || []).reduce((a, t) => a + (t.invitations_qty ?? 0), 0)
    return { qty, invites }
  }, [types])

  const lastReport = reports?.[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuración */}
      <div className="space-y-3">
        <div className="font-medium">Configuración</div>
        <form action={actionSaveSetup} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="has_ticket_sales" defaultChecked={!!setup?.has_ticket_sales} />
            Hay venta de entradas
          </label>

          <div>
            <label className="block text-sm mb-1">Aforo a la venta</label>
            <input
              name="capacity_on_sale"
              type="number"
              placeholder={capacityFromActivity ? String(capacityFromActivity) : ''}
              defaultValue={setup?.capacity_on_sale ?? ''}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">% SGAE</label>
            <input
              name="sgae_pct"
              type="number"
              step="0.01"
              defaultValue={setup?.sgae_pct ?? 10}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">% IVA</label>
            <input
              name="vat_pct"
              type="number"
              step="0.01"
              defaultValue={setup?.vat_pct ?? 21}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Fecha anuncio</label>
            <input
              name="announcement_at"
              type="datetime-local"
              defaultValue={setup?.announcement_at ?? ''}
              className="w-full border rounded px-2 py-1"
            />
            <label className="flex items-center gap-2 text-sm mt-1">
              <input type="checkbox" name="announcement_tbc" defaultChecked={!!setup?.announcement_tbc} />
              TBC (sin fecha cerrada)
            </label>
          </div>

          <div>
            <label className="block text-sm mb-1">Salida a la venta</label>
            <input
              name="onsale_at"
              type="datetime-local"
              defaultValue={setup?.onsale_at ?? ''}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Ticketera (nombre)</label>
            <input
              name="ticketing_name"
              defaultValue={setup?.ticketing_name ?? ''}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Link de venta</label>
            <input
              name="ticketing_url"
              defaultValue={setup?.ticketing_url ?? ''}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div className="md:col-span-2">
            <button className="btn">Guardar configuración</button>
          </div>
        </form>

        <div className="text-sm text-gray-600">
          <div><span className="font-medium">Total entradas a la venta:</span> {totals.qty}</div>
          <div><span className="font-medium">Invitaciones disponibles:</span> {totals.invites}</div>
          {capacityFromActivity !== null && (
            <div>
              <span className="font-medium">Aforo utilizado:</span>{' '}
              {totals.qty + totals.invites} / {capacityFromActivity}
            </div>
          )}
        </div>
      </div>

      {/* Tipologías */}
      <div className="space-y-3">
        <div className="font-medium">Tipos de entradas</div>

        <form action={actionAddType} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input name="name" placeholder="Tipo" className="border rounded px-2 py-1" />
          <input name="qty" type="number" placeholder="Unidades" className="border rounded px-2 py-1" />
          <input name="price_gross" type="number" step="0.01" placeholder="PVP" className="border rounded px-2 py-1" />
          <input name="invitations_qty" type="number" placeholder="Invitaciones" className="border rounded px-2 py-1" />
          <button className="btn">+ Añadir</button>
        </form>

        <div className="divide-y divide-gray-200 text-sm">
          {(types || []).map((t) => (
            <div key={t.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-gray-600">
                  {t.qty ?? 0} uds · PVP {Number(t.price_gross ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · Neto{' '}
                  {Number(t.price_net ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · Inv: {t.invitations_qty ?? 0}
                </div>
              </div>
              <form action={actionDelType}>
                <input type="hidden" name="type_id" value={t.id} />
                <button className="btn-secondary">Eliminar</button>
              </form>
            </div>
          ))}
          {!types?.length && <div className="text-sm text-gray-500">Sin tipos configurados.</div>}
        </div>
      </div>

      {/* Reportes */}
      <div className="lg:col-span-2 space-y-3">
        <div className="font-medium">Reportes de venta</div>
        <form action={actionSaveReport} className="border rounded p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm mb-1">Fecha reporte</label>
              <input name="report_date" type="date" className="w-full border rounded px-2 py-1" />
            </div>
            <div className="flex items-center gap-2">
              <input id="aggregate_only" name="aggregate_only" type="checkbox" />
              <label htmlFor="aggregate_only" className="text-sm">Sin desglose (dato global)</label>
            </div>
            <div>
              <label className="block text-sm mb-1">Entradas vendidas (total)</label>
              <input name="totals_sold" type="number" className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm mb-1">Ingreso neto (total)</label>
              <input name="totals_net_revenue" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
            </div>
          </div>

          {(types || []).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {(types || []).map((t) => (
                <div key={t.id}>
                  <label className="block text-sm mb-1">Vendidas · {t.name}</label>
                  <input name={`by_${t.id}`} type="number" className="w-full border rounded px-2 py-1" />
                </div>
              ))}
            </div>
          )}

          <button className="btn">Guardar reporte</button>
        </form>

        <div className="text-sm">
          {lastReport ? (
            <div className="text-gray-700">
              Último reporte: {lastReport.report_date ? new Date(lastReport.report_date).toLocaleDateString() : '-'} ·{' '}
              {Number(lastReport.totals_sold ?? 0)} vendidas ·{' '}
              {Number(lastReport.totals_net_revenue ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} neto
            </div>
          ) : (
            <div className="text-gray-500">Aún no hay reportes.</div>
          )}
        </div>
      </div>
    </div>
  )
}
