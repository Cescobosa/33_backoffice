'use client'

import { useState, useTransition } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'
import clsx from 'clsx'

dayjs.extend(relativeTime)
dayjs.locale('es')

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

type TypeRow = {
  id: string
  activity_id: string
  name: string
  qty: number
  price_gross: number
  price_net: number
  invitations_qty: number
  position: number
}

type ReportLite = {
  id: string
  report_date: string
  totals_sold: number
  totals_net_revenue: number
  created_at: string
}

export default function TicketSalesModule({
  setup, types, reports,
  actionSaveSetup, actionAddType, actionDelType, actionSaveReport,
  capacityFromActivity
}: {
  setup: Setup | null
  types: TypeRow[]
  reports: ReportLite[]
  actionSaveSetup: (formData: FormData) => Promise<void>
  actionAddType: (formData: FormData) => Promise<void>
  actionDelType: (formData: FormData) => Promise<void>
  actionSaveReport: (formData: FormData) => Promise<void>
  capacityFromActivity: number | null
}) {
  const [pending, start] = useTransition()
  const latest = reports[0]
  const prev = reports[1]
  const diff = latest && prev ? (latest.totals_sold - prev.totals_sold) : 0

  const totalQty = types.reduce((s, t) => s + (t.qty || 0), 0)
  const totalInv = types.reduce((s, t) => s + (t.invitations_qty || 0), 0)
  const capacity = setup?.capacity_on_sale ?? capacityFromActivity ?? 0
  const sold = latest?.totals_sold ?? 0
  const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuración y tipos */}
      <div className="space-y-4">
        <form action={actionSaveSetup} className="border rounded p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Ajustes venta de entradas</div>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" name="has_ticket_sales" defaultChecked={!!setup?.has_ticket_sales} />
              ¿Hay venta?
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="text-xs text-gray-600">Aforo venta</label>
              <input name="capacity_on_sale" defaultValue={setup?.capacity_on_sale ?? capacityFromActivity ?? ''} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">% SGAE</label>
              <input name="sgae_pct" type="number" step="0.01" defaultValue={setup?.sgae_pct ?? 10} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">% IVA</label>
              <input name="vat_pct" type="number" step="0.01" defaultValue={setup?.vat_pct ?? 21} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Ticketera</label>
              <input name="ticketing_name" defaultValue={setup?.ticketing_name ?? ''} className="w-full border rounded px-2 py-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600">URL venta</label>
              <input name="ticketing_url" defaultValue={setup?.ticketing_url ?? ''} className="w-full border rounded px-2 py-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="text-xs text-gray-600">Fecha anuncio</label>
              <input type="datetime-local" name="announcement_at" defaultValue={setup?.announcement_at?.slice(0,16) ?? ''} className="w-full border rounded px-2 py-1" />
              <label className="text-xs flex items-center gap-1 mt-1"><input type="checkbox" name="announcement_tbc" defaultChecked={!!setup?.announcement_tbc} /> TBC</label>
            </div>
            <div>
              <label className="text-xs text-gray-600">Salida a la venta</label>
              <input type="datetime-local" name="onsale_at" defaultValue={setup?.onsale_at?.slice(0,16) ?? ''} className="w-full border rounded px-2 py-1" />
            </div>
          </div>

          <div className="mt-3">
            <button className="btn">{pending ? 'Guardando…' : 'Guardar ajustes'}</button>
          </div>
        </form>

        <div className="border rounded">
          <div className="p-3 font-medium">Tipos de entradas</div>
          <div className="px-3 pb-3">
            <form action={actionAddType} className="grid grid-cols-1 md:grid-cols-6 gap-2 border rounded p-2">
              <input type="hidden" name="action" value="add" />
              <div className="md:col-span-2"><input name="name" placeholder="Tipo" className="w-full border rounded px-2 py-1" /></div>
              <div><input name="qty" type="number" placeholder="Cantidad" className="w-full border rounded px-2 py-1" /></div>
              <div><input name="price_gross" type="number" step="0.01" placeholder="PVP (IVA inc.)" className="w-full border rounded px-2 py-1" /></div>
              <div><input name="invitations_qty" type="number" placeholder="Invitaciones" className="w-full border rounded px-2 py-1" /></div>
              <div><button className="btn w-full">+ Añadir</button></div>
            </form>

            <div className="mt-3 divide-y divide-gray-200 text-sm">
              {types.map(t => (
                <div key={t.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-gray-600">Unidades: {t.qty} · PVP: {t.price_gross.toFixed(2)}€ · Neto: {t.price_net.toFixed(2)}€ · Invitaciones: {t.invitations_qty}</div>
                  </div>
                  <form action={actionDelType}><input type="hidden" name="type_id" value={t.id} /><button className="btn-secondary">Eliminar</button></form>
                </div>
              ))}
              {!types.length && <div className="text-gray-500">Sin tipos de entrada.</div>}
            </div>

            <div className="mt-4 p-2 bg-gray-50 rounded text-sm">
              <div><span className="font-medium">Total entradas a la venta:</span> {totalQty}</div>
              <div><span className="font-medium">Invitaciones disponibles:</span> {totalInv}</div>
              <div><span className="font-medium">Aforo utilizado:</span> {totalQty + totalInv} / {capacity || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Estado y reportes */}
      <div className="space-y-4">
        {(setup?.has_ticket_sales && capacity > 0) ? (
          <div className="border rounded p-3">
            <div className="font-medium mb-2">Estado de la venta</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-4 rounded bg-red-100 relative overflow-hidden">
                <div className={clsx('absolute left-0 top-0 h-full', pct===100 ? 'bg-green-500' : 'bg-green-300')}
                     style={{ width: `${pct}%` }} />
                <div className="absolute right-2 -top-5 text-xs font-medium">{pct}%</div>
              </div>
              <div className="text-sm whitespace-nowrap">{sold}/{capacity} vendidas</div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              {latest ? (
                <>
                  Último reporte: {dayjs(latest.report_date).format('DD/MM/YYYY')} · Diferencia: {diff >= 0 ? '+' : ''}{diff}
                </>
              ) : 'Sin reportes aún.'}
            </div>

            <form action={actionSaveReport} className="mt-4 border rounded p-2 grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-600">Fecha reporte</label>
                <input type="date" name="report_date" className="w-full border rounded px-2 py-1" defaultValue={dayjs().format('YYYY-MM-DD')} />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <label className="text-xs"><input type="checkbox" name="aggregate_only" /> No desglosado</label>
                <input name="totals_sold" type="number" placeholder="Total vendidas (opcional)" className="border rounded px-2 py-1 w-48" />
                <input name="totals_net_revenue" type="number" step="0.01" placeholder="Recaudación neta (opcional)" className="border rounded px-2 py-1 w-56" />
              </div>
              <div className="md:col-span-5">
                <div className="text-xs text-gray-600 mb-1">Desglose por tipo (opcional)</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {types.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className="text-xs w-28 truncate" title={t.name}>{t.name}</span>
                      <input type="number" name={`by_${t.id}`} placeholder="vendidas" className="border rounded px-2 py-1 w-28" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-5">
                <textarea name="note" placeholder="Nota (opcional)" className="w-full border rounded px-2 py-1" />
              </div>
              <div className="md:col-span-5"><button className="btn">Guardar reporte</button></div>
            </form>

            {setup?.onsale_at && dayjs(setup.onsale_at).isAfter(dayjs()) && (
              <div className="mt-3 text-xs">
                Falta {dayjs().to(dayjs(setup.onsale_at), true)} para la salida a la venta ({dayjs(setup.onsale_at).format('DD/MM/YYYY HH:mm')})
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded p-3 text-sm text-gray-600">
            Activa “¿Hay venta?” y guarda para ver el estado y reportes.
          </div>
        )}

        <div className="border rounded p-3">
          <div className="font-medium mb-2">Histórico</div>
          <div className="divide-y divide-gray-200 text-sm">
            {reports.map(r => (
              <div key={r.id} className="py-2 flex items-center justify-between">
                <div>{dayjs(r.report_date).format('DD/MM/YYYY')} · vendidas {r.totals_sold} · neto {r.totals_net_revenue.toFixed(2)}€</div>
                <div className="text-xs text-gray-500">registrado {dayjs(r.created_at).fromNow()}</div>
              </div>
            ))}
            {!reports.length && <div className="text-gray-500">Sin registros.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
