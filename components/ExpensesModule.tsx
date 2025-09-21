'use client'

type CP = { id: string; legal_name?: string | null; nick?: string | null; logo_url?: string | null }
type Expense = {
  id: string
  kind?: string | null
  concept: string
  amount_net?: number | null
  amount_gross?: number | null
  is_invoice?: boolean | null
  billing_status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  payment_date?: string | null
  assumed_by?: string | null
  counterparty?: CP | null
  file_url?: string | null
}
type Grouped = Record<string, Expense[]>

export default function ExpensesModule({
  grouped,
  actionNewExpense,
  actionMarkPaid,
  actionRequestInvoice,
}: {
  grouped: Grouped
  actionNewExpense: (fd: FormData) => Promise<void>
  actionMarkPaid: (fd: FormData) => Promise<void>
  actionRequestInvoice: (fd: FormData) => Promise<void>
}) {
  const keys = Object.keys(grouped || {})

  return (
    <div className="space-y-4">
      <details className="border rounded p-3">
        <summary className="cursor-pointer font-medium">+ Nuevo gasto</summary>
        <form action={actionNewExpense} className="grid grid-cols-1 md:grid-cols-6 gap-2 mt-3">
          <select name="kind" className="border rounded px-2 py-1">
            <option value="equipment">Equipos</option>
            <option value="musicians">Músicos</option>
            <option value="staff">Personal</option>
            <option value="transport">Transporte</option>
            <option value="lodging">Hoteles</option>
            <option value="local_prod">Producción Local</option>
            <option value="promo">Promoción</option>
            <option value="commissions">Comisiones</option>
            <option value="other">Otros</option>
          </select>
          <input name="concept" placeholder="Concepto" className="border rounded px-2 py-1 md:col-span-2" />
          <input name="counterparty_id" placeholder="ID tercero (opcional)" className="border rounded px-2 py-1" />
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="is_invoice" /> Factura
          </label>
          <input name="invoice_number" placeholder="Nº factura (si aplica)" className="border rounded px-2 py-1" />
          <input name="invoice_date" type="date" className="border rounded px-2 py-1" />
          <input name="amount_net" type="number" step="0.01" placeholder="Importe neto" className="border rounded px-2 py-1" />
          <input name="amount_gross" type="number" step="0.01" placeholder="Importe bruto" className="border rounded px-2 py-1" />
          <input name="vat_pct" type="number" step="0.01" placeholder="% IVA" className="border rounded px-2 py-1" />
          <div className="md:col-span-6">
            <button className="btn">Guardar gasto</button>
          </div>
        </form>
      </details>

      {keys.length === 0 && <div className="text-sm text-gray-500">Aún no hay gastos.</div>}

      {keys.map((k) => {
        const items = grouped[k] || []
        const subtotal = items.reduce((a, e) => a + (Number(e.amount_net ?? 0)), 0)
        return (
          <div key={k} className="border rounded">
            <div className="px-3 py-2 font-medium bg-gray-50 flex items-center justify-between">
              <span>{titulo(k)}</span>
              <span className="text-sm text-gray-700">
                Total {subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
            <div className="divide-y divide-gray-200">
              {items.map((e) => (
                <div key={e.id} className="px-3 py-2 text-sm flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.concept}</div>
                    <div className="text-gray-600">
                      {e.counterparty?.nick || e.counterparty?.legal_name || ''}{' '}
                      · {Number(e.amount_net ?? e.amount_gross ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      {' · '}
                      {badgePago(e.payment_status)}
                      {' · '}
                      {e.is_invoice ? 'Factura' : 'Ticket'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={actionRequestInvoice}>
                      <input type="hidden" name="expense_id" value={e.id} />
                      <button className="btn-secondary">Solicitar factura</button>
                    </form>
                    <form action={actionMarkPaid}>
                      <input type="hidden" name="expense_id" value={e.id} />
                      <select name="payment_method" className="border rounded px-2 py-1 text-xs">
                        <option value="transfer">Transferencia</option>
                        <option value="card">Tarjeta</option>
                        <option value="cash">Efectivo</option>
                        <option value="pleo">Pleo</option>
                      </select>
                      <button className="btn ml-1">Marcar pagado</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function titulo(k: string) {
  const map: Record<string, string> = {
    equipment: 'Equipos',
    musicians: 'Músicos',
    staff: 'Personal',
    transport: 'Transporte',
    lodging: 'Hoteles',
    local_prod: 'Producción local',
    promo: 'Promoción',
    commissions: 'Comisiones',
    other: 'Otros',
  }
  return map[k] || k
}

function badgePago(status?: string | null) {
  const s = (status ?? 'pending').toLowerCase()
  const cls =
    s === 'paid'
      ? 'bg-green-100 text-green-700'
      : s === 'requested'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600'
  const txt = s === 'paid' ? 'Pagado' : s === 'requested' ? 'Pago solicitado' : 'Pendiente'
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{txt}</span>
}
