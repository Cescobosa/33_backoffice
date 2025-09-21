'use client'
import { useEffect, useMemo, useState } from 'react'

type Row = { id: string; label: string; sub?: string; logo_url?: string; kind: 'counterparty'|'company' }

export default function CounterpartyPicker({ includeCompanies = false }: { includeCompanies?: boolean }) {
  const [mode, setMode] = useState<'existing'|'create'>('existing')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Row[]>([])
  const [selected, setSelected] = useState<Row | null>(null)

  // carga masiva y filtrado en cliente
  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await fetch(`/api/search/counterparties?bulk=1&companies=${includeCompanies ? '1' : '0'}`, { cache: 'no-store' })
      const data = await res.json()
      if (alive) setItems(Array.isArray(data) ? data : [])
    })()
    return () => { alive = false }
  }, [includeCompanies])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return items
    return items.filter(r =>
      r.label.toLowerCase().includes(qq) || (r.sub || '').toLowerCase().includes(qq)
    )
  }, [q, items])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <label className="text-sm"><input type="radio" name="mode" defaultChecked onChange={()=>setMode('existing')} /> Elegir existente</label>
        <label className="text-sm"><input type="radio" name="mode" onChange={()=>setMode('create')} /> Crear nuevo</label>
      </div>

      {mode === 'existing' ? (
        <>
          <input type="hidden" name="counterparty_id" value={selected?.kind === 'counterparty' ? selected.id : ''} />
          <input type="hidden" name="selected_company_id" value={selected?.kind === 'company' ? selected.id : ''} />

          <div className="relative">
            <input value={q} onChange={e=>setQ(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Buscar…"/>
            <div className="max-h-56 overflow-auto mt-2 border rounded divide-y">
              {filtered.map(r => (
                <button type="button" key={r.kind+':'+r.id} onClick={()=>setSelected(r)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${selected?.id===r.id?'bg-gray-50':''}`}>
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.logo_url || '/avatar.png'} className="w-6 h-6 rounded-full border object-cover bg-white" alt=""/>
                    <div className="font-medium">{r.label}</div>
                    {r.sub && <div className="text-xs text-gray-500">{r.sub}</div>}
                    <span className="text-xs text-gray-400 ml-auto">{r.kind==='company'?'Empresa del grupo':'Tercero'}</span>
                  </div>
                </button>
              ))}
              {!filtered.length && <div className="text-sm text-gray-500 px-3 py-2">Sin resultados</div>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" name="is_company" /> ¿Empresa?</label>
            <div>
              <div className="text-sm mb-1">Logo/Foto</div>
              <input type="file" name="logo" accept="image/*" />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm mb-1">Alias (nick)</div>
              <input name="nick" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm mb-1">Nombre legal</div>
              <input name="legal_name" className="w-full border rounded px-3 py-2" required />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm mb-1">DNI/CIF</div>
              <input name="tax_id" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
