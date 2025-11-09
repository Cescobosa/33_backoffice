// app/(dashboard)/recintos/new/page.tsx
import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createVenue } from '@/app/(dashboard)/recintos/actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function NewVenuePage() {
  async function create(formData: FormData) {
    'use server'
    const id = await createVenue(formData)
    return { redirect: `/recintos/${id}` }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">+ Nuevo recinto</h1>
          <p className="text-sm text-gray-600">Rellena los datos básicos del recinto.</p>
        </div>
        <Link href="/recintos" className="btn-secondary">Cancelar</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <form action={create} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Nombre del recinto</label>
            <input name="name" required className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Dirección completa</label>
            <input name="address" className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Web</label>
            <input name="website" className="w-full border rounded px-2 py-1" placeholder="https://…" />
          </div>
          <div>
            <label className="block text-sm mb-1">Foto (URL)</label>
            <input name="photo_url" className="w-full border rounded px-2 py-1" placeholder="https://…" />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="indoor" name="indoor" type="checkbox" />
            <label htmlFor="indoor" className="text-sm">Es interior (indoor)</label>
          </div>
          <div>
            <label className="block text-sm mb-1">Latitud</label>
            <input name="lat" className="w-full border rounded px-2 py-1" placeholder="40.4167" />
          </div>
          <div>
            <label className="block text-sm mb-1">Longitud</label>
            <input name="lng" className="w-full border rounded px-2 py-1" placeholder="-3.70325" />
          </div>

          <div className="md:col-span-3">
            <button className="btn">Crear recinto</button>
          </div>
        </form>
      </ModuleCard>
    </div>
  )
}
