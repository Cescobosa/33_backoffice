'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ClientSearch({ placeholder }: { placeholder: string }) {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(sp.get('q') || '')

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString())
      if (q) params.set('q', q); else params.delete('q')
      router.replace(`${pathname}?${params.toString()}`)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <input
      value={q} onChange={(e) => setQ(e.target.value)}
      placeholder={placeholder}
      className="w-full border rounded px-3 py-2"
    />
  )
}
