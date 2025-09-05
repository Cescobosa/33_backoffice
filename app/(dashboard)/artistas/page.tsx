import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ClientSearch from '@/components/ClientSearch'

export const dynamic = 'force-dynamic'

function normalizeQ(q?: string | null) {
  return (q || '').trim()
}

export default async function ArtistsPage({
  searchParams,
}: { searchParams: { q?: string; archived?: string } }) {
  const supabase = createSupabaseServer()
  const q = normalizeQ(searchParams.q)
  const archived = searchParams.archived === '1'

  let query = supabase
    .from('artists')
    .select('id, stage_name, avatar_url, status')
    .eq('status', archived ? 'archived' : 'active')
    .order('stage_name', { ascending: true })

  if (q) {
    query = query.ilike('search_text', `%${q.toLowerCase()}%`)
  }

  const { data: artists, error } = await query
  if (error) throw new Error(error.message)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artistas</h1>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href={archived ? '/artistas' : '/artistas?archived=1'}>
            {archived ? 'Ver activos' : 'Archivados'}
          </Link>
          <Link className="btn" href="/artistas/new">+ Nuevo artista</Link>
        </div>
      </div>

      <ClientSearch placeholder="Buscar artistas..." />

      <div className="divide-y divide-gray-200">
        {artists?.map(a => (
          <Link key={a.id} href={`/artistas/${a.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50 rounded-md px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.avatar_url || '/avatar.png'} alt="" className="w-10 h-10 rounded-full object-cover border" />
            <div className="flex-1">
              <div className="font-medium">{a.stage_name}</div>
              {a.status === 'archived' && <span className="badge badge-red">Archivado</span>}
            </div>
          </Link>
        ))}
        {!artists?.length && <div className="text-gray-500 text-sm py-6">Sin resultados.</div>}
      </div>
    </div>
  )
}
