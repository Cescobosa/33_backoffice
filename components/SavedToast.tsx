'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function SavedToast({ show }: { show?: boolean }) {
  const [visible, setVisible] = useState(!!show)
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  useEffect(() => {
    if (!show) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 1800)
    // quitar ?saved=1 de la URL para no repetir
    const r = setTimeout(() => {
      const p = new URLSearchParams(sp!.toString())
      p.delete('saved')
      router.replace(`${pathname}?${p.toString()}`)
    }, 2000)
    return () => { clearTimeout(t); clearTimeout(r) }
  }, [show, pathname, router, sp])

  if (!visible) return null
  return (
    <div className="fixed bottom-4 right-4 z-[1000] rounded bg-green-600 text-white px-3 py-2 text-sm shadow">
      Cambio guardado
    </div>
  )
}
