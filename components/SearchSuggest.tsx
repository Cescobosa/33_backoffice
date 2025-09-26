'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type ArtistItem = { id: string; name: string; avatar_url: string | null }
type CpItem = { id: string; label: string; logo_url: string | null }

export default function SearchSuggest({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial || '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [artists, setArtists] = useState<ArtistItem[]>([])
  const [cps, setCps] = useState<CpItem[]>([])
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const boxRef = useRef<HTMLDivElement>(null)

  // Cierra el desplegable al clicar fuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as any)) setOpen(false)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])

  // Consulta sugerencias (artistas + terceros)
  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim()
      if (term.length < 2) { setArtists([]); setCps([]); setLoading(false); return }
      setLoading(true)
      try {
        const res = await fetch(`/api/search/activities-suggest?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          setArtists(json.artists || [])
          setCps(json.counterparties || [])
          setOpen(true)
        } else {
          setArtists([]); setCps([])
        }
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  // Añade un valor al array de querystrings (artists / cp)
  const pushWith = (key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    const arr = p.getAll(key)
    if (!arr.includes(value)) p.append(key, value)
    // al seleccionar algo, quitamos la página (si existiera) y limpiamos q
    p.delete('page')
    p.set('q', q) // dejamos el texto si quiere además buscar por campos de actividad
    router.push(`${pathname}?${p.toString()}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="search"
        name="q"
        defaultValue={initial || ''}
        placeholder="Buscar…"
        className="border rounded px-3 py-2 w-full"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (artists.length || cps.length) setOpen(true) }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-80 overflow-auto">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">Buscando…</div>}

          {!loading && !artists.length && !cps.length && (
            <div className="px-3 py-2 text-sm text-gray-500">No se han encontrado resultados</div>
          )}

          {!!artists.length && (
            <>
              <div className="px-3 py-1 text-xs text-gray-500 uppercase">Artistas</div>
              {artists.map(a => (
                <button type="button" key={a.id}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => pushWith('artists', a.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar_url || '/avatar.png'} className="h-6 w-6 rounded-full object-cover border" alt="" />
                  <span>{a.name}</span>
                </button>
              ))}
            </>
          )}

          {!!cps.length && (
            <>
              <div className="px-3 py-1 text-xs text-gray-500 uppercase">Terceros</div>
              {cps.map(c => (
                <button type="button" key={c.id}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => pushWith('cp', c.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.logo_url || '/avatar.png'} className="h-6 w-6 rounded object-contain bg-white border" alt="" />
                  <span>{c.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
