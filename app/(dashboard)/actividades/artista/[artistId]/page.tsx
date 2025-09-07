import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function ArtistActivities({ params }: { params: { artistId: string } }) {
  const s = createSupabaseServer()
  const { data: artist } = await s.from('artists').select('id, stage_name').eq('id', params.artistId).single()
  const { data: items } = await s
    .from('activities')
    .select('id, type, status, date, municipality, country, tags')
    .eq('artist_id', params.artistId)
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades · {artist?.stage_name}</h1>
        <Link href={`/actividades/new?artistId=${params.artistId}`} className="btn">+ Añadir actividad</Link>
      </div>

      <div className="border rounded divide-y divide-gray-200">
        {(items || []).map(a => (
          <Link key={a.id} href={`/actividades/${a.id}`} className="p-3 hover:bg-gray-50 flex items-center justify-between">
            <div>
              <div className="font-medium">{a.type === 'concert' ? 'Concierto' : a.type}</div>
              <div className="text-xs text-gray-600">
                {a.date ? new Date(a.date).toLocaleDateString() : ''} · {a.municipality || ''} · {a.country || ''}
              </div>
            </div>
            <span className={`badge ${a.status === 'confirmed' ? 'badge-green' : a.status === 'hold' ? 'badge-yellow' : 'badge-red'}`}>
              {a.status === 'confirmed' ? 'Confirmado' : a.status === 'hold' ? 'Reserva' : 'Borrador'}
            </span>
          </Link>
        ))}
        {!items?.length && <div className="p-3 text-sm text-gray-500">No hay actividades.</div>}
      </div>
    </div>
  )
}
