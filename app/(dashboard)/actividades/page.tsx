import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function ActivitiesHome() {
  const s = createSupabaseServer()
  const { data: artists } = await s.from('artists').select('id, stage_name, avatar_url, status').eq('status','active').order('stage_name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Actividades</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(artists || []).map(a => (
          <Link key={a.id} href={`/actividades/${a.id}`} className="border rounded p-3 hover:bg-gray-50 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.avatar_url || '/avatar.png'} className="w-10 h-10 rounded-full border object-cover" alt="" />
            <div className="font-medium">{a.stage_name}</div>
          </Link>
        ))}
        {!artists?.length && <div className="text-sm text-gray-500">No hay artistas activos.</div>}
      </div>
    </div>
  )
}
