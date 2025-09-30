// components/ArtistMultiSelect.tsx
'use client'

import { useMemo, useState } from 'react'

type ArtistOption = { id: string; stage_name: string; avatar_url: string | null }

export default function ArtistMultiSelect({
  options,
  name = 'artist_ids',
  initialSelected = [],
  placeholder = 'Buscar artistas…',
}: {
  options: ArtistOption[]
  name?: string
  initialSelected?: string[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>(initialSelected)

  const byId = useMemo(
    () => Object.fromEntries(options.map(o => [o.id, o] as const)),
    [options]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o =>
      (o.stage_name || '').toLowerCase().includes(q)
    )
  }, [options, query])

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function remove(id: string) {
    setSelected(prev => prev.filter(x => x !== id))
  }

  return (
    <div className="border rounded-md p-2">
      {/* chips seleccionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(id => {
            const a = byId[id]
            return (
              <span key={id} className="inline-flex items-center gap-2 bg-gray-100 border rounded-full px-2 py-1">
                <img
                  src={a?.avatar_url || '/avatar.png'}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border"
                />
                <span className="text-sm">{a?.stage_name || '—'}</span>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-900"
                  onClick={() => remove(id)}
                  aria-label="Quitar"
                  title="Quitar"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* buscador */}
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 mb-2"
      />

      {/* lista */}
      <div className="max-h-64 overflow-auto border rounded">
        {filtered.length === 0 && (
          <div className="p-3 text-sm text-gray-500">No se han encontrado resultados</div>
        )}
        <ul className="divide-y divide-gray-200">
          {filtered.map(o => {
            const isSel = selected.includes(o.id)
            return (
              <li
                key={o.id}
                className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 ${isSel ? 'bg-gray-50' : ''}`}
                onClick={() => toggle(o.id)}
              >
                <img
                  src={o.avatar_url || '/avatar.png'}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{o.stage_name}</div>
                </div>
                <input type="checkbox" readOnly checked={isSel} className="w-4 h-4" />
              </li>
            )
          })}
        </ul>
      </div>

      {/* inputs ocultos para enviar en el form */}
      {selected.map(id => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  )
}
