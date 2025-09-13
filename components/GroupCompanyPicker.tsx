'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

export type GroupCompany = { id: string; name?: string | null; nick?: string | null; logo_url?: string | null }

export default function GroupCompanyPicker({
  name = 'company_id',
  companies,
  initialId,
  placeholder = 'Selecciona empresa',
}: {
  name?: string
  companies: GroupCompany[]
  initialId?: string | null
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | undefined>(initialId || undefined)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.nick || '').toLowerCase().includes(q)
    )
  }, [companies, query])

  const current = companies.find(c => c.id === selected)

  return (
    <div className="relative" ref={boxRef}>
      <input type="hidden" name={name} value={selected || ''} />
      <button type="button" className="w-full border rounded px-3 py-2 flex items-center justify-between"
              onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          {current?.logo_url && <img src={current.logo_url} alt="" className="h-6 w-auto object-contain" />}
          <span className="text-sm">{current ? (current.nick || current.name) : placeholder}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 20 20"><path d="M5 8l5 5 5-5H5z" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow">
          <div className="p-2">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar…"
                   className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <ul className="max-h-64 overflow-auto">
            {list.map(c => (
              <li key={c.id}
                  onClick={() => { setSelected(c.id); setOpen(false) }}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                {c.logo_url && <img src={c.logo_url} alt="" className="h-6 w-auto object-contain" />}
                <span className="text-sm">{c.nick || c.name}</span>
              </li>
            ))}
            {!list.length && <li className="px-3 py-2 text-sm text-gray-500">Sin resultados</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
