'use client'
import { useState } from 'react'

type Props = { actionAdd: (fd: FormData) => Promise<void> }

export default function ActivityIncomeCreator({ actionAdd }: Props) {
  const [kind, setKind] = useState<'fixed'|'variable_fixed_after'|'per_ticket'|'percent'>('fixed')
  return (
    <form action={actionAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="md:col-span-2">
        <label className="block text-sm mb-1">Tipo</label>
        <select name="kind" value={kind} onChange={e => setKind(e.target.value as any)}
          className="w-full border rounded px-2 py-1">
          <option value="fixed">Caché fijo</option>
          <option value="variable_fixed_after">Variable · Importe fijo a partir de N entradas</option>
          <option value="per_ticket">Variable · Importe por entrada vendida</option>
          <option value="percent">Variable · % sobre venta de entradas</option>
        </select>
      </div>

      {kind === 'fixed' && (
        <div>
          <label className="block text-sm mb-1">Importe (sin IVA)</label>
          <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" required />
        </div>
      )}

      {kind === 'variable_fixed_after' && (
        <>
          <div>
            <label className="block text-sm mb-1">Importe fijo</label>
            <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" required />
          </div>
          <div>
            <label className="block text-sm mb-1">A partir de nº entradas</label>
            <input name="from_tickets" type="number" className="w-full border rounded px-2 py-1" required />
          </div>
        </>
      )}

      {kind === 'per_ticket' && (
        <>
          <div>
            <label className="block text-sm mb-1">Importe por entrada</label>
            <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" required />
          </div>
          <div>
            <label className="block text-sm mb-1">Desde nº entradas (opcional)</label>
            <input name="from_tickets" type="number" className="w-full border rounded px-2 py-1" />
          </div>
        </>
      )}

      {kind === 'percent' && (
        <>
          <div>
            <label className="block text-sm mb-1">% sobre venta</label>
            <input name="percent" type="number" step="0.01" className="w-full border rounded px-2 py-1" required />
          </div>
          <div>
            <label className="block text-sm mb-1">Entradas exentas (opcional)</label>
            <input name="from_tickets" type="number" className="w-full border rounded px-2 py-1" />
          </div>
        </>
      )}

      <div className="md:col-span-4">
        <button className="btn">+ Añadir</button>
      </div>
    </form>
  )
}
