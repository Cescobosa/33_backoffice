// app/(dashboard)/recintos/new/page.tsx
import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createVenue } from '@/app/(dashboard)/recintos/actions'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function NewVenuePage({ searchParams }: { searchParams: { returnTo?: string } }) {
  async function create(formData: FormData) {
    'use server'
    const id = await createVenue(formData)
    const ret = String(searchParams?.returnTo || '')
    if (ret) redirect(`${ret}?venue_id=${id}`)
    redirect(`/recintos/${id}`)
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
        <form action={create} className="grid grid-cols-1 md:grid-cols-3 gap-3" encType="multipart/form-data">
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Nombre del recinto</label>
            <input name="name" required className="w-full border rounded px-2 py-1" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Dirección completa</label>
            <input name="address" className="w-full border rounded px-2 py-1" placeholder="Calle, nº, ciudad, país" />
            <p className="text-xs text-gray-500 mt-1">La ubicación del mapa se calculará automáticamente.</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Web</label>
            <input name="website" className="w-full border rounded px-2 py-1" placeholder="https://…" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Foto (PNG o JPG)</label>
            <input type="file" name="photo" accept="image/png,image/jpeg" className="w-full text-sm" />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="indoor" name="indoor" type="checkbox" />
            <label htmlFor="indoor" className="text-sm">Es interior (indoor)</label>
          </div>

          <div className="md:col-span-3">
            <button className="btn">Crear recinto</button>
          </div>
        </form>
      </ModuleCard>
    </div>
  )
}
