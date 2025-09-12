import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'

export const dynamic = 'force-dynamic'

export default async function ActivitiesHome() {
  const s = createSupabaseServer()
  const { data: acts } = await s
    .from('activities')
    .select('id, artist_id, type, status, date, municipality, province, country, artists(id,stage_name)')
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades</h1>
        <Link href="/actividades/new" className="btn">+ Nueva actividad</Link>
      </div>

      <ModuleCard title="Listado">
        <div className="divide-y divide-gray-200">
          {(acts || []).map(a => (
            <div key={a.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {a.artists?.stage_name || 'Artista'} · {a.type}
                </div>
                <div className="text-sm text-gray-600">
                  {a.status} · {a.date ? new Date(a.date).toLocaleDateString() : ''} · {a.municipality || ''}{a.province ? ` (${a.province})` : ''}{a.country ? ` · ${a.country}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/actividades/actividad/${a.id}`} className="btn-secondary">Abrir</Link>
                <Link href={`/actividades/artista/${a.artist_id}`} className="btn-secondary">Ver del artista</Link>
              </div>
            </div>
          ))}
          {!acts?.length && <div className="text-sm text-gray-500">Aún no hay actividades.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
