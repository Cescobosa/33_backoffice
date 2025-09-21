'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="p-6">
        <div className="max-w-xl mx-auto border rounded p-6 space-y-4">
          <h2 className="text-lg font-semibold">Se ha producido un error</h2>
          <div className="text-sm text-gray-700">{error.message || 'Error inesperado'}</div>
          <div className="flex gap-2">
            <button onClick={() => reset()} className="btn">Reintentar</button>
            <button onClick={() => history.back()} className="btn-secondary">Volver</button>
          </div>
        </div>
      </body>
    </html>
  )
}
