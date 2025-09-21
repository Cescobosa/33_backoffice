'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type CompanyLite = { id: string; name: string | null; nick: string | null; logo_url: string | null }

export default function CompanySelect({
  name, companies, defaultValue,
}: { name: string, companies: CompanyLite[], defaultValue?: string | null }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)
  const [coords, setCoords] = useState<{top:number,left:number,width:number} | null>(null)
  const [value, setValue] = useState<string | null>(defaultValue ?? null)

  const selected = useMemo(() => companies.find(c => c.id === value) ?? null, [companies, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? companies.filter(c =>
      (c.nick || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)
    ) : companies
  }, [companies, query])

  useEffect(() => setPortalEl(document.body), [])

  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setCoords({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width })
  }, [open])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (open) setOpen(false) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('click', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('click', close)
    }
  }, [open])

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value ?? ''} />
      <button ref={btnRef} type="button" className="w-full border rounded px-3 py-2 text-left flex items-center gap-2"
        onClick={() => setOpen(o => !o)}>
        {selected?.logo_url && <img src={selected.logo_url} alt="" className="h-5 w-auto object-contain" />}
        <span>{selected ? (selected.nick || selected.name) : 'Seleccionar empresa…'}</span>
        <span className="ml-auto text-gray-400">▾</span>
      </button>

      {open && portalEl && coords && createPortal(
        <div
          className="z-[1000] bg-white border rounded shadow-lg"
          style={{ position: 'absolute', top: coords.top, left: coords.left, width: coords.width, maxHeight: 320, overflow: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-2 border-b">
            <input
              placeholder="Buscar…"
              className="w-full border rounded px-2 py-1 text-sm"
              value={query} onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="py-1">
            {filtered.map(c => (
              <li key={c.id}>
                <button type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => { setValue(c.id); setOpen(false) }}>
                  {c.logo_url && <img src={c.logo_url} className="h-5 w-auto object-contain" alt="" />}
                  <span className="text-sm">{c.nick || c.name}</span>
                </button>
              </li>
            ))}
            {!filtered.length && <li className="px-3 py-2 text-sm text-gray-500">Sin resultados</li>}
          </ul>
        </div>,
        portalEl
      )}
    </div>
  )
}
