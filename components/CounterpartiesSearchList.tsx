'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type C = { id: string; nick?: string | null; legal_name: string; is_company: boolean; logo_url?: string | null; photo_url?: string | null }

export default function CounterpartiesSearchList({
  initial
}: { initial: C[] }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<C[]>(initial || [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      const res = await fetch(`/api/search/counterparties?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!alive) return
      setItems(Array.isArray(data) ? data : [])
    }
    load()
    return () => { alive = false }
  }, [q])

  const has = useMemo(() => (items?.length ?? 0) > 0, [items])

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, alias o CIF/DNI…"
        className="w-full border rounded px-3 py-2"
      />
      <div className="divide-y divide-gray-200">
        {has ? items.map(c => (
          <Link key={c.id} href={`/terceros/${c.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.logo_url || c.photo_url || '/avatar.png'}
              alt=""
              className={`h-8 ${c.is_company ? 'w-auto object-contain rounded' : 'w-8 rounded-full object-cover'} border bg-white`}
            />
            <div>
              <div className="font-medium">{c.nick || c.legal_name}</div>
              {c.nick && c.legal_name && <div className="text-xs text-gray-500">{c.legal_name}</div>}
            </div>
          </Link>
        )) : <div className="text-sm text-gray-500 px-2 py-3">Sin resultados.</div>}
      </div>
    </div>
  )
}
