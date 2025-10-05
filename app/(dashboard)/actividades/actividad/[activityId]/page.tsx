import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ArtistLite = { id: string; stage_name: string; avatar_url: string | null }
type CompanyLite = { id: string; name: string | null; nick: string | null; logo_url: string | null }

async function getActivityCore(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('activities')
    .select(
      [
        'id',
        'artist_id',
        'company_id',
        'type',
        'status',
        'date',
        'time',
        'municipality',
        'province',
        'country',
        'venue_id',
        'lat',
        'lng',
      ].join(','),
    )
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  if (!data) return null
  return data as any
}

async function getArtistsForActivity(primaryArtistId: string | null, activityId: string) {
  const s = createSupabaseServer()

  const ids: string[] = []
  if (primaryArtistId) ids.push(primaryArtistId)

  // Si existe tabla de many-to-many, añadimos los extra (tolerante a error 42P01 si no existe).
  try {
    const { data: rels, error: relErr } = await s
      .from('activity_artists')
      .select('artist_id')
      .eq('activity_id', activityId)
    if (!relErr && Array.isArray(rels)) {
      for (const r of rels) {
        if (r?.artist_id && !ids.includes(r.artist_id)) ids.push(r.artist_id)
      }
    }
  } catch {
    // Ignorar si la tabla no existe en esta fase.
  }

  if (!ids.length) return [] as ArtistLite[]

  const { data, error } = await s
    .from('artists')
    .select('id, stage_name, avatar_url')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return (data || []) as ArtistLite[]
}

async function getCompany(companyId: string | null) {
  if (!companyId) return null
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('group_companies')
    .select('id, name, nick, logo_url')
    .eq('id', companyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data || null) as CompanyLite | null
}

// ===== Actions mínimas de ejemplo (cambiar estado, borrar, etc.) =====
async function updateStatusAction(activityId: string, nextStatus: string) {
  'use server'
  const s = createSupabaseServer()
  const { error } = await s.from('activities').update({ status: nextStatus }).eq('id', activityId)
  if (error) throw new Error(error.message)
  revalidatePath(`/actividades/actividad/${activityId}`)
  redirect(`/actividades/actividad/${activityId}?saved=1`)
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: { activityId: string }
  searchParams: { saved?: string }
}) {
  const id = params.activityId
  const saved = searchParams.saved === '1'

  const a = await getActivityCore(id)
  if (!a) notFound()

  const [artists, company] = await Promise.all([
    getArtistsForActivity(a.artist_id ?? null, a.id),
    getCompany(a.company_id ?? null),
  ])

  // ---------- UI ----------
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-semibold">
            {new Date(a.date ?? Date.now()).toLocaleDateString('es-ES')}
          </div>
          <div className="text-sm text-gray-600">
            {a.type || 'actividad'} · {a.municipality || ''}{a.province ? `, ${a.province}` : ''}{a.country ? `, ${a.country}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <form action={async () => updateStatusAction(a.id, a.status === 'confirmed' ? 'draft' : 'confirmed')} >
            <button className="btn-secondary">
              {a.status === 'confirmed' ? 'Pasar a borrador' : 'Confirmar'}
            </button>
          </form>
          <Link className="btn-secondary" href="/actividades">Volver</Link>
        </div>
      </div>

      {/* Módulo básico */}
      <ModuleCard title="Datos básicos">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Estado</div>
            <div className="font-medium">{a.status || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Hora</div>
            <div className="font-medium">{a.time || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Localización</div>
            <div className="font-medium">
              {[a.municipality, a.province, a.country].filter(Boolean).join(', ') || '—'}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Empresa del grupo</div>
            <div className="flex items-center gap-2">
              {company?.logo_url && <img src={company.logo_url} alt="" className="h-6 object-contain" />}
              <span className="font-medium">{company?.nick || company?.name || '—'}</span>
            </div>
          </div>
        </div>
      </ModuleCard>

      {/* Artistas vinculados */}
      <ModuleCard title="Artista(s)">
        {artists.length ? (
          <div className="flex flex-wrap gap-4">
            {artists.map(ar => (
              <Link key={ar.id} href={`/artistas/${ar.id}`} className="flex items-center gap-2 hover:underline">
                <img src={ar.avatar_url || '/avatar.png'} alt="" className="w-8 h-8 rounded-full object-cover border" />
                <span className="text-sm font-medium">{ar.stage_name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No hay artistas vinculados.</div>
        )}
      </ModuleCard>

      {/* Aquí podrás renderizar el resto de pestañas/módulos (mapa, promotor, ingresos, etc.) */}

      <SavedToast show={saved} />
    </div>
  )
}
