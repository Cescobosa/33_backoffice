import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'

export const dynamic = 'force-dynamic'

export default async function ActivitiesByArtist({ params }: { params: { artistId: string } }) {
  const s = createSupabaseServer()
  const { data: artist } = await s.from('artists').select('id, stage_name').eq('id', params.artistId).maybeSingle()
  const { data: acts } = await s
    .from('activities')
    .select('id, type, status, date, municipality, province, country')
    .eq('artist_id', params.artistId)
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades · {artist?.stage_name || ''}</h1>
        <div className="flex gap-2">
          <Link href={`/actividades/new?artist=${params.artistId}`} className="btn">+ Nueva actividad</Link>
          <Link href={`/artistas/${params.artistId}`} className="btn-secondary">Volver a artista</Link>
        </div>
      </div>

      <ModuleCard title="Listado">
        <div className="divide-y divide-gray-200">
          {(acts || []).map(a => (
            <div key={a.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{a.type}</div>
                <div className="text-sm text-gray-600">
                  {a.status} · {a.date ? new Date(a.date).toLocaleDateString() : ''} · {a.municipality || ''}{a.province ? ` (${a.province})` : ''}{a.country ? ` · ${a.country}` : ''}
                </div>
              </div>
              <Link href={`/actividades/actividad/${a.id}`} className="btn-secondary">Abrir</Link>
            </div>
          ))}
          {!acts?.length && <div className="text-sm text-gray-500">No hay actividades para este artista.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
