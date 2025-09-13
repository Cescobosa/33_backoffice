'use client'
import { useEffect, useState } from 'react'

export default function SavedToast({ show }: { show?: boolean }) {
  const [visible, setVisible] = useState(!!show)
  useEffect(() => { if (show) setVisible(true) }, [show])
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(t)
  }, [visible])
  if (!visible) return null
  return (
    <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-3 py-2 rounded shadow">
      Cambio guardado
    </div>
  )
}
