'use client'
import { useState } from 'react'
import SaveButton from './SaveButton'

export default function ActivityIncomeEditor({
  incomeTypes,
  onSubmit, // server action pasada desde la page (use: <form action={onSubmit}>)
}: {
  incomeTypes: { id: string; name: string }[]
  onSubmit: (formData: FormData) => void
}) {
  const [kind, setKind] = useState<'fixed'|'variable'>('fixed')
  const [varMode, setVarMode] = useState<'fixed_from'|'per_ticket'|'pct_sales'>('fixed_from')

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1 module-title">Tipo de ingreso</label>
          <select name="income_type_id" className="w-full border rounded px-2 py-1">
            {incomeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1 module-title">Clase</label>
          <select value={kind} onChange={e => setKind(e.target.value as any)} className="w-full border rounded px-2 py-1">
            <option value="fixed">Caché Fijo</option>
            <option value="variable">Caché Variable</option>
          </select>
          <input type="hidden" name="kind" value={kind} />
        </div>

        {kind === 'variable' && (
          <div>
            <label className="block text-sm mb-1 module-title">Modo variable</label>
            <select value={varMode} onChange={e => setVarMode(e.target.value as any)} className="w-full border rounded px-2 py-1">
              <option value="fixed_from">Importe fijo a partir de N entradas</option>
              <option value="per_ticket">Importe por entrada vendida</option>
              <option value="pct_sales">% sobre venta de entradas</option>
            </select>
            <input type="hidden" name="var_mode" value={varMode} />
          </div>
        )}
      </div>

      {/* Campos según tipo */}
      {kind === 'fixed' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 module-title">Importe (sin IVA)</label>
            <input name="amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
        </div>
      )}

      {kind === 'variable' && varMode === 'fixed_from' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 module-title">Importe fijo</label>
            <input name="amount_fixed" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1 module-title">A partir de nº de entradas</label>
            <input name="from_tickets" type="number" className="w-full border rounded px-2 py-1" />
          </div>
        </div>
      )}

      {kind === 'variable' && varMode === 'per_ticket' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 module-title">Importe por entrada</label>
            <input name="amount_per_ticket" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1 module-title">Desde nº de entradas (opcional)</label>
            <input name="from_tickets" type="number" className="w-full border rounded px-2 py-1" />
          </div>
        </div>
      )}

      {kind === 'variable' && varMode === 'pct_sales' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 module-title">% sobre venta</label>
            <input name="pct_sales" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1 module-title">Mínimo exento (€) (opcional)</label>
            <input name="min_exempt_amount" type="number" step="0.01" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1 module-title">Entradas exentas (opcional)</label>
            <input name="free_tickets" type="number" className="w-full border rounded px-2 py-1" />
          </div>
        </div>
      )}

      <div><SaveButton>Guardar ingreso</SaveButton></div>
    </form>
  )
}
