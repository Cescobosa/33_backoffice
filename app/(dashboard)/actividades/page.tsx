import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/** Si un join viene como array (PostgREST), normaliza a 1 registro */
function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined)
}

function companyLabel(c: any) {
  return c?.nick || c?.name
}

export default async function ActivitiesIndex() {
  const s = createSupabaseServer()
  const { data: acts, error } = await s
    .from('activities')
    .select(`
      id, artist_id, type, status, date, time, municipality, province, country,
      artists ( id, stage_name, avatar_url ),
      group_companies ( id, nick, name, logo_url )
    `)
    .order('date', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades</h1>
        <Link href="/actividades/new" className="btn">+ Nueva actividad</Link>
      </div>

      <ModuleCard title="Listado">
        <div className="divide-y divide-gray-200">
          {(acts || []).map((a: any) => {
            const art = one(a.artists)
            const gc = one(a.group_companies)
            return (
              <Link
                key={a.id}
                href={`/actividades/actividad/${a.id}`}
                className="block hover:bg-gray-50"
              >
                <div className="py-3 px-1">
                  <div className="font-medium">
                    {art?.stage_name || 'Artista'} · {a.type}
                  </div>
                  <div className="text-sm text-gray-600">
                    {a.status} · {a.date ? new Date(a.date).toLocaleDateString('es-ES') : ''} · {a.municipality || ''}{a.province ? `, ${a.province}` : ''}{a.country ? `, ${a.country}` : ''}
                    {gc ? ` · ${companyLabel(gc)}` : ''}
                  </div>
                </div>
              </Link>
            )
          })}
          {!acts?.length && <div className="py-3 text-sm text-gray-500">No hay actividades.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
