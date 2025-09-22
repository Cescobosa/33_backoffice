import Link from 'next/link'

export type ActivityListModel = {
  id: string
  type: string | null
  status: string | null
  date: string | null
  municipality: string | null
  province: string | null
  country: string | null
  artist?: { id: string; stage_name: string | null; avatar_url: string | null } | null
  group_company?: { id: string; name: string | null; nick: string | null; logo_url: string | null } | null
}

function stateBadge(status?: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'confirmed') return <span className="ml-2 badge badge-green">Confirmado</span>
  if (s === 'hold' || s === 'draft' || s === 'reservation')
    return <span className="ml-2 badge badge-yellow">{s === 'hold' ? 'Reserva' : 'Borrador'}</span>
  if (s === 'cancelled') return <span className="ml-2 badge badge-red">Cancelado</span>
  return null
}

export default function ActivityListItem({
  a,
  href,
  showArtist = true,
}: {
  a: ActivityListModel
  /** Ruta de destino al abrir la actividad. Si no se pasa, se usa /actividades/actividad/[id] */
  href?: string
  /** Mostrar avatar del artista (útil en listados globales). En fichas de artista, poner false. */
  showArtist?: boolean
}) {
  const url = href ?? `/actividades/actividad/${a.id}`

  return (
    <Link href={url} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
      <div className="flex items-center gap-3">
        {showArtist && (
          a.artist?.avatar_url
            ? <img src={a.artist.avatar_url!} className="h-8 w-8 rounded-full object-cover border" alt="" />
            : <div className="h-8 w-8 rounded-full bg-gray-200" />
        )}
        <div>
          <div className="font-medium">
            {a.type || 'Actividad'} {stateBadge(a.status)}
          </div>
          <div className="text-sm text-gray-600">
            {a.date ? new Date(a.date).toLocaleDateString('es-ES') : '-'}
            {' · '}
            {[a.municipality, a.province, a.country].filter(Boolean).join(', ')}
          </div>
        </div>
      </div>
    </Link>
  )
}
