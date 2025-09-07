import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ArtistsSearchList from '@/components/ArtistsSearchList'

export default async function ArtistsPage({ searchParams }: { searchParams: { archived?: string } }) {
  const archived = searchParams.archived === '1'
  const s = createSupabaseServer()
  const { data: initial } = await s.from('artists')
    .select('id, stage_name, avatar_url')
    .eq('status', archived ? 'archived' : 'active')
    .order('stage_name', { ascending: true })
    .limit(50)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artistas</h1>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href={archived ? '/artistas' : '/artistas?archived=1'}>
            {archived ? 'Ver activos' : 'Artistas archivados'}
          </Link>
          <Link className="btn" href="/artistas/new">+ Nuevo artista</Link>
        </div>
      </div>

      <ArtistsSearchList
        archived={archived}
        initial={initial || []}
        basePath="/artistas"
        placeholder="Buscar artistas…"
      />
    </div>
  )
}
