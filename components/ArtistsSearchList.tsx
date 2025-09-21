'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Artist = { id: string; stage_name: string; avatar_url?: string | null }

export default function ArtistsSearchList({
  archived = false,
  initial,
  basePath = '/artistas',
  placeholder = 'Buscar artistas…'
}: {
  archived?: boolean
  initial: Artist[]
  basePath?: string
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Artist[]>(initial || [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (archived) params.set('archived', '1')
      const res = await fetch(`/api/search/artists?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!alive) return
      setItems(Array.isArray(data) ? data : [])
    }
    load()
    return () => { alive = false }
  }, [q, archived])

  const has = useMemo(() => (items?.length ?? 0) > 0, [items])

  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2"
      />
      <div className="divide-y divide-gray-200">
        {has ? items.map(a => (
          <Link key={a.id} href={`${basePath}/${a.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.avatar_url || '/avatar.png'} className="w-9 h-9 rounded-full border object-cover" alt="" />
            <div className="font-medium">{a.stage_name}</div>
          </Link>
        )) : <div className="text-sm text-gray-500 px-2 py-3">Sin resultados.</div>}
      </div>
    </div>
  )
}
