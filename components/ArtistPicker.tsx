'use client'

import { useMemo, useState } from 'react'

type Artist = { id: string; stage_name: string; avatar_url?: string | null }

export default function ArtistPicker({
  artists,
  name,
  defaultId,
}: {
  artists: Artist[]
  name: string
  defaultId?: string
}) {
  const defaultArtist = useMemo(
    () => artists.find(a => a.id === defaultId),
    [artists, defaultId]
  )
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Artist | undefined>(defaultArtist)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? artists.filter(a => a.stage_name.toLowerCase().includes(q)) : artists
  }, [artists, query])

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id || ''} required />
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full border rounded px-3 py-2 flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected?.avatar_url || '/avatar.png'}
            alt=""
            className="w-6 h-6 rounded-full object-cover border"
          />
          <span>{selected?.stage_name || 'Selecciona artista…'}</span>
        </span>
        <span className="text-xs text-gray-500">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow">
          <div className="p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border rounded px-2 py-1"
              placeholder="Buscar…"
            />
          </div>
          <ul className="max-h-56 overflow-auto">
            {filtered.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => { setSelected(a); setOpen(false) }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.avatar_url || '/avatar.png'}
                    className="w-6 h-6 rounded-full object-cover border"
                    alt=""
                  />
                  <span>{a.stage_name}</span>
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
