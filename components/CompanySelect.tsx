// components/CompanySelect.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type CompanyLite = {
  id: string
  name?: string | null
  nick?: string | null
  logo_url?: string | null
}

export default function CompanySelect({
  name = 'company_id',
  companies,
  defaultValue,
}: {
  name?: string
  companies: CompanyLite[]
  defaultValue?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [value, setValue] = useState(defaultValue || '')
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setValue(defaultValue || '')
  }, [defaultValue])

  const selected = companies.find((c) => c.id === value) || null

  const filtered = useMemo(() => {
    if (!query) return companies
    const q = query.toLowerCase()
    return companies.filter((c) =>
      `${c.nick || ''} ${c.name || ''}`.toLowerCase().includes(q)
    )
  }, [companies, query])

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-full border rounded px-3 py-2 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.logo_url ? (
            // Logo horizontal, sin recortar a círculo
            <img
              src={selected.logo_url}
              className="h-6 w-auto object-contain"
              alt=""
            />
          ) : (
            <div className="h-6 w-6 rounded bg-gray-200" />
          )}
          <span className="truncate">
            {selected ? selected.nick || selected.name : 'Seleccionar empresa…'}
          </span>
        </div>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.08 1.04l-4.24 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded border bg-white shadow-lg">
          <div className="p-2 border-b">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(c.id)
                    setOpen(false)
                    btnRef.current?.focus()
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      className="h-6 w-auto object-contain"
                      alt=""
                    />
                  ) : (
                    <div className="h-6 w-6 rounded bg-gray-200" />
                  )}
                  <span className="truncate">{c.nick || c.name}</span>
                </button>
              </li>
            ))}
            {!filtered.length && (
              <li className="px-3 py-2 text-sm text-gray-500">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
