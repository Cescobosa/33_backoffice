// app/(dashboard)/recintos/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import AutoSubmitForm from '@/components/AutoSubmitForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function VenuesPage({ searchParams }: { searchParams: { q?: string } }) {
  const s = createSupabaseServer()
  const q = (searchParams.q || '').trim()
  let qb = s.from('venues').select('id, name, address, photo_url').order('name', { ascending: true })
  if (q) {
    const like = `%${q}%`
    qb = qb.or([
      `name.ilike.${like}`,
      `address.ilike.${like}`
    ].join(','))
  }
  const { data, error } = await qb
  if (error) throw new Error(error.message)
  const venues = data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recintos</h1>
          <p className="text-sm text-gray-600">Gestiona recintos y sus contactos, aforos, documentos y ubicación.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/recintos/new" className="btn">+ Nuevo recinto</Link>
        </div>
      </div>

      <ModuleCard title="Buscar">
        <form className="flex gap-2 items-center" action="/recintos" method="get">
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, dirección, ciudad…" className="border rounded px-3 py-2 w-full" />
          <button className="btn-secondary">Buscar</button>
          <AutoSubmitForm />
        </form>
      </ModuleCard>

      <ModuleCard title="Listado">
        {venues.length === 0 ? (
          <div className="text-sm text-gray-500">No hay recintos.</div>
        ) : (
          <ul className="divide-y">
            {venues.map((v: any) => (
              <li key={v.id} className="py-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.photo_url || '/logo.png'} alt="" className="h-10 w-10 rounded object-cover border" />
                <div className="min-w-0 flex-1">
                  <Link href={`/recintos/${v.id}`} className="font-medium hover:underline">{v.name}</Link>
                  <div className="text-xs text-gray-600 truncate">{v.address || ''}</div>
                </div>
                <Link href={`/recintos/${v.id}`} className="btn-secondary">Abrir</Link>
              </li>
            ))}
          </ul>
        )}
      </ModuleCard>
    </div>
  )
}
