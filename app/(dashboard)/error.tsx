'use client'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Ha ocurrido un error</h1>
      <p className="text-gray-600">{error?.message || 'Error inesperado'}</p>
      <div className="flex justify-center gap-2">
        <button onClick={() => reset()} className="btn">Reintentar</button>
        <button onClick={() => history.back()} className="btn-secondary">Volver</button>
        <Link href="/" className="btn-secondary">Ir al inicio</Link>
      </div>
    </div>
  )
}
