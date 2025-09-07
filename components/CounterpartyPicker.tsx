'use client'
import { useEffect, useState } from 'react'

type Item = { id: string; nick?: string | null; legal_name: string; logo_url?: string | null }

export default function CounterpartyPicker({
  nameHiddenId = 'counterparty_id',
  nameHiddenMode = 'mode' // "existing" | "create"
}: {
  nameHiddenId?: string
  nameHiddenMode?: string
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [picked, setPicked] = useState<Item | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!q) { setItems([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search/counterparties?q=${encodeURIComponent(q)}&kind=third`, { signal: ctrl.signal })
      if (res.ok) setItems(await res.json())
    }, 180)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  useEffect(() => {
    setCreateOpen(!picked && q.length > 1 && items.length === 0)
  }, [picked, q, items])

  return (
    <div className="space-y-3">
      {/* inputs ocultos que viajan con el form */}
      <input type="hidden" name={nameHiddenMode} value={picked ? 'existing' : (createOpen ? 'create' : '')} />
      <input type="hidden" name={nameHiddenId} value={picked?.id || ''} />

      <div className="relative">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPicked(null) }}
          placeholder="Buscar tercero (por nombre, nick o DNI/CIF)"
          className="w-full border rounded px-3 py-2"
        />
        {!!items.length && (
          <div className="absolute z-10 bg-white border rounded w-full mt-1 max-h-64 overflow-auto">
            {items.map(it => (
              <button
                key={it.id}
                type="button"
                onClick={() => { setPicked(it); setItems([]); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.logo_url || '/avatar.png'} className="w-6 h-6 rounded-full border object-cover" alt="" />
                <span className="font-medium">{it.nick || it.legal_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {picked && (
        <div className="text-sm text-gray-600">
          Seleccionado: <span className="font-medium">{picked.nick || picked.legal_name}</span>
          <button type="button" className="ml-3 underline" onClick={() => setPicked(null)}>Cambiar</button>
        </div>
      )}

      {createOpen && !picked && (
        <div className="border rounded p-3">
          <div className="text-sm font-medium mb-2">No hay coincidencias. Crear nuevo tercero:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input name="legal_name" placeholder="Nombre / Razón social *" required className="border rounded px-2 py-1" />
            <select name="kind" className="border rounded px-2 py-1">
              <option value="person">Particular</option>
              <option value="company">Empresa</option>
            </select>
            <input name="tax_id" placeholder="DNI / CIF (opcional)" className="border rounded px-2 py-1" />
          </div>
          <div className="text-xs text-gray-500 mt-2">Se guardará como Tercero y podrás completarlo luego.</div>
        </div>
      )}
    </div>
  )
}
