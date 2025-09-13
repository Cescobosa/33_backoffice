'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = { id: string; label: string; sub?: string; logo_url?: string; kind: 'counterparty'|'company' }

export default function CounterpartyPicker({ includeCompanies = false }: { includeCompanies?: boolean }) {
  const [mode, setMode] = useState<'existing'|'create'>('existing')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Row[]>([])
  const [selected, setSelected] = useState<Row | null>(null)

  // Carga inicial (lista grande cacheada en cliente para filtro rápido)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/_pickers/counterparties?q=' + encodeURIComponent('') + (includeCompanies ? '&companies=1' : ''))
        const json = await res.json()
        if (alive) setItems(json as Row[])
      } catch { /* noop */ }
    })()
    return () => { alive = false }
  }, [includeCompanies])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items.slice(0, 50)
    return items.filter((i) =>
      i.label.toLowerCase().includes(term) || (i.sub || '').toLowerCase().includes(term)
    ).slice(0, 50)
  }, [items, q])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <label className="text-sm"><input type="radio" name="mode" value="existing" checked={mode==='existing'} onChange={()=>setMode('existing')} /> Elegir existente</label>
        <label className="text-sm"><input type="radio" name="mode" value="create" checked={mode==='create'} onChange={()=>setMode('create')} /> Crear nuevo</label>
      </div>

      {mode === 'existing' ? (
        <>
          <input type="hidden" name="counterparty_id" value={selected?.kind === 'counterparty' ? selected.id : ''} />
          <input type="hidden" name="selected_company_id" value={selected?.kind === 'company' ? selected.id : ''} />

          <div className="relative">
            <input
              placeholder="Busca por nombre, nick o CIF"
              className="w-full border rounded px-3 py-2"
              value={q} onChange={(e) => setQ(e.target.value)}
            />
            <div className="absolute z-10 bg-white border rounded mt-1 w-full max-h-64 overflow-auto">
              {filtered.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${selected?.id === r.id && selected.kind === r.kind ? 'bg-gray-50' : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.logo_url || '/avatar.png'} alt="" className="h-6 w-6 object-contain rounded border" />
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-gray-600">{r.sub}</div>
                  </div>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 border rounded">{r.kind === 'company' ? 'Empresa' : 'Tercero'}</span>
                </button>
              ))}
              {!filtered.length && <div className="px-3 py-2 text-sm text-gray-500">Sin resultados.</div>}
            </div>
            {selected && (
              <div className="text-xs text-gray-600 mt-2">
                Seleccionado: <strong>{selected.label}</strong> ({selected.kind === 'company' ? 'Empresa' : 'Tercero'})
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select name="kind" className="w-full border rounded px-2 py-1">
              <option value="person">Particular</option>
              <option value="company">Empresa</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Nombre / Razón social</label>
            <input name="legal_name" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">CIF / DNI (opcional)</label>
            <input name="tax_id" className="w-full border rounded px-3 py-2" />
          </div>
        </div>
      )}
    </div>
  )
}
