'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type C = { id: string; nick?: string | null; legal_name: string; logo_url?: string | null }

export default function CounterpartiesSearchList({
  kind, // 'third' | 'provider'
  initial,
  basePath,
  placeholder
}: {
  kind: 'third' | 'provider'
  initial: C[]
  basePath: string
  placeholder: string
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<C[]>(initial)

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const url = `/api/search/counterparties?q=${encodeURIComponent(q)}&kind=${kind}`
      const res = await fetch(url, { signal: ctrl.signal })
      if (res.ok) setItems(await res.json())
    }, 180)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, kind])

  const has = useMemo(() => items?.length > 0, [items])

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2"
      />
      <div className="divide-y divide-gray-200">
        {has ? items.map(c => (
          <Link key={c.id} href={`${basePath}/${c.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.logo_url || '/avatar.png'} className="w-9 h-9 rounded-full border object-cover" alt="" />
            <div className="font-medium">{c.nick || c.legal_name}</div>
          </Link>
        )) : <div className="text-sm text-gray-500 px-2 py-3">Sin resultados.</div>}
      </div>
    </div>
  )
}
