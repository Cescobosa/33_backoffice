import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="p-8 text-center space-y-4">
      <h1 className="text-2xl font-semibold">No encontrado</h1>
      <p className="text-gray-600">No se encontró el recurso solicitado.</p>
      <div className="flex justify-center">
        <Link href="/" className="btn">Volver</Link>
      </div>
    </div>
  )
}
