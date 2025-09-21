'use client'

import { useState, useTransition } from 'react'
import clsx from 'clsx'

type Expense = {
  id: string
  kind: string
  concept: string
  amount_net: number
  amount_gross: number | null
  is_invoice: boolean
  billing_status: 'pending'|'invoiced'|'paid'
  payment_status: 'pending'|'requested'|'paid'
  payment_method: 'card'|'pleo'|'cash'|'transfer'|null
  payment_date: string | null
  assumed_by: 'office'|'artist'|null
  file_url: string | null
  counterparty?: { id: string, legal_name?: string|null, nick?: string|null, logo_url?: string|null }
}

export default function ExpensesModule({
  grouped,
  actionNewExpense, actionMarkPaid, actionRequestInvoice
}: {
  grouped: Record<string, Expense[]>
  actionNewExpense: (formData: FormData) => Promise<void>
  actionMarkPaid: (formData: FormData) => Promise<void>
  actionRequestInvoice: (formData: FormData) => Promise<void>
}) {
  const [openNew, setOpenNew] = useState(false)
  const [pending, start] = useTransition()

  const kinds = Object.keys(grouped)
  const totalsByKind = kinds.map(k => ({
    kind: k,
    total: grouped[k].reduce((s, e) => s + (e.amount_net || 0), 0)
  }))
  const grandTotal = totalsByKind.reduce((s, x) => s + x.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium text-lg">Bolsa de gastos</div>
        <button className="btn" onClick={() => setOpenNew(true)}>+ Nuevo gasto</button>
      </div>

      {openNew && (
        <form action={actionNewExpense} className="border rounded p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select name="kind" className="border rounded px-2 py-1">
            <option value="equipment">Equipos</option><option value="musicians">Músicos</option>
            <option value="staff">Personal</option><option value="transport">Transporte</option>
            <option value="hotels">Hoteles</option><option value="local_prod">Producción local</option>
            <option value="promo">Promoción</option><option value="commissions">Comisiones</option>
            <option value="other">Otros</option>
          </select>
          <input name="concept" placeholder="Concepto" className="border rounded px-2 py-1" />
          <input name="counterparty_id" placeholder="UUID tercero (temporal)" className="border rounded px-2 py-1" />
          <div className="md:col-span-3 flex items-center gap-3">
            <label className="text-sm"><input type="checkbox" name="is_invoice" defaultChecked /> ¿Factura?</label>
            <input name="invoice_number" placeholder="Nº factura" className="border rounded px-2 py-1" />
            <input type="date" name="invoice_date" className="border rounded px-2 py-1" />
            <input type="number" step="0.01" name="amount_net" placeholder="Importe (sin IVA si factura, total si ticket)" className="border rounded px-2 py-1" />
            <input type="number" step="0.01" name="amount_gross" placeholder="Total con IVA (si ticket)" className="border rounded px-2 py-1" />
            <input type="number" step="0.01" name="vat_pct" placeholder="% IVA (si factura)" className="border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <button className="btn">{pending ? 'Guardando…' : 'Guardar gasto'}</button>
            <button type="button" className="btn-secondary ml-2" onClick={() => setOpenNew(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {kinds.map(k => (
        <div key={k} className="border rounded">
          <div className="p-2 font-medium">{labelKind(k)}</div>
          <div className="divide-y divide-gray-200">
            {grouped[k].map(e => (
              <div key={e.id} className={clsx('p-2 flex items-center justify-between gap-3', !e.file_url && 'bg-gray-50')}>
                <div className="flex items-center gap-3">
                  {e.counterparty?.logo_url
                    ? <img src={e.counterparty.logo_url} className="h-6 w-auto object-contain" alt="" />
                    : <div className="h-6 w-6 rounded bg-gray-200" />}
                  <div className="text-sm">
                    <div className="font-medium">{e.concept} {e.assumed_by && <span className="text-xs text-gray-500">· asumido por {e.assumed_by==='office'?'oficina':'artista'}</span>}</div>
                    <div className="text-xs text-gray-600">{e.counterparty?.nick || e.counterparty?.legal_name || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={clsx('px-2 py-0.5 rounded border', badgeColor(e.payment_status))}>
                    {labelPay(e.payment_status)}
                  </span>
                  <span className="px-2 py-0.5 rounded border">Neto: {e.amount_net.toFixed(2)}€</span>
                  {e.file_url
                    ? <a href={e.file_url} target="_blank" className="px-2 py-0.5 rounded border">Ver doc</a>
                    : (
                      <form action={actionRequestInvoice}>
                        <input type="hidden" name="expense_id" value={e.id} />
                        <button className="btn-secondary">Solicitar factura</button>
                      </form>
                    )
                  }
                  <form action={actionMarkPaid}>
                    <input type="hidden" name="expense_id" value={e.id} />
                    <select name="payment_method" className="border rounded px-2 py-0.5">
                      <option value="card">Tarjeta</option><option value="pleo">Pleo</option>
                      <option value="cash">Efectivo</option><option value="transfer">Transferencia</option>
                    </select>
                    <button className="btn ml-1">Marcar pagado</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 text-sm bg-gray-50">Total {labelKind(k)}: {totalsByKind.find(x => x.kind===k)?.total.toFixed(2)}€</div>
        </div>
      ))}

      <div className="text-right font-medium">Total gastos: {grandTotal.toFixed(2)}€</div>
    </div>
  )
}

function labelKind(k: string) {
  switch (k) {
    case 'equipment': return 'Equipos'
    case 'musicians': return 'Músicos'
    case 'staff': return 'Personal'
    case 'transport': return 'Transporte'
    case 'hotels': return 'Hoteles'
    case 'local_prod': return 'Producción local'
    case 'promo': return 'Promoción'
    case 'commissions': return 'Comisiones'
    default: return 'Otros'
  }
}
function labelPay(s: string) {
  if (s === 'requested') return 'Pago solicitado'
  if (s === 'paid') return 'Pagado'
  return 'Pendiente'
}
function badgeColor(s: string) {
  if (s === 'requested') return 'border-yellow-300 bg-yellow-50 text-yellow-700'
  if (s === 'paid') return 'border-green-300 bg-green-50 text-green-700'
  return 'border-gray-300 bg-white text-gray-700'
}
