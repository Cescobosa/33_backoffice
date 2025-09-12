'use client'

import { useState } from 'react'

type IncomeType = { id: string; name: string }
type Props = {
  incomeTypes: IncomeType[]
  artistContractType: 'booking' | 'general'
  actionAdd: (formData: FormData) => void
}

/**
 * Formulario cliente para "Añadir condición".
 * - Sólo se muestra el % oficina cuando el modo es comisión.
 * - Permite seleccionar un tipo de ingreso existente o crear uno nuevo (campo libre).
 * - El contenedor <details> cumple el requisito: primero botón, luego se despliega el form.
 */
export default function IncomeConditionForm({
  incomeTypes,
  artistContractType,
  actionAdd,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'commission' | 'split'>(
    artistContractType === 'booking' ? 'commission' : 'commission'
  )

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="btn inline-block cursor-pointer select-none">
        + Añadir condición
      </summary>

      <form action={actionAdd} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
        {/* Tipo de ingreso existente */}
        <div>
          <label className="block text-sm mb-1">Tipo de ingreso</label>
          <select name="income_type_id" className="w-full border rounded px-3 py-2" defaultValue="">
            <option value="">— seleccionar —</option>
            {incomeTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            o crea uno nuevo (sólo para este artista):
          </div>
          <input
            name="new_income_type_name"
            placeholder="Nuevo tipo (p. ej. Patrocinios especiales)"
            className="w-full border rounded px-3 py-2 mt-1"
          />
        </div>

        {/* Modo */}
        <div>
          <label className="block text-sm mb-1">Modo</label>
          {artistContractType === 'booking' ? (
            <div className="text-sm text-gray-600">Comisión oficina (Booking)</div>
          ) : (
            <div className="flex items-center gap-4">
              <label className="text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="commission"
                  defaultChecked
                  onChange={() => setMode('commission')}
                />{' '}
                Comisión oficina
              </label>
              <label className="text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="split"
                  onChange={() => setMode('split')}
                />{' '}
                Reparto (artista/oficina)
              </label>
            </div>
          )}

          <label className="block text-sm mb-1 mt-3">Base</label>
          <select name="base" className="w-full border rounded px-3 py-2" defaultValue="gross">
            <option value="gross">Bruto</option>
            <option value="net">Neto</option>
          </select>
        </div>

        {/* Porcentajes */}
        <div>
          <label className="block text-sm mb-1">% Oficina</label>
          <input
            name="pct_office"
            type="number"
            step="0.01"
            className="w-full border rounded px-3 py-2"
            placeholder="% oficina"
          />
          {artistContractType !== 'booking' && mode === 'split' && (
            <>
              <label className="block text-sm mb-1 mt-3">% Artista</label>
              <input
                name="pct_artist"
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2"
                placeholder="% artista"
              />
            </>
          )}
        </div>

        <div className="lg:col-span-3">
          <button className="btn">Guardar condición</button>
        </div>
      </form>
    </details>
  )
}
