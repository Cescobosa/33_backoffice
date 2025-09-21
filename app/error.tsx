'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-xl w-full border rounded-lg p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-2">Ha ocurrido un error</h1>
          <p className="text-sm text-gray-600 mb-4">
            {error.message || 'Error inesperado.'}
            {error.digest && <span className="ml-2 text-xs text-gray-500">({error.digest})</span>}
          </p>
          <div className="flex gap-2">
            <button className="btn" onClick={() => router.back()}>Volver</button>
            <button className="btn-secondary" onClick={() => reset()}>Reintentar</button>
          </div>
        </div>
      </body>
    </html>
  )
}
