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
  if (s === 'hold' || s === 'draft') return <span className="ml-2 badge badge-yellow">{s === 'hold' ? 'Reserva' : 'Borrador'}</span>
  return null
}
function typeLabel(t?: string | null) {
  if (!t) return 'Actividad'
  if (t === 'concert') return 'Concierto'
  return t
}

export default function ActivityListItem({ a, showArtist = true }: { a: ActivityListModel; showArtist?: boolean }) {
  const place = [a.municipality, a.province, a.country].filter(Boolean).join(', ')
  return (
    <Link href={`/actividades/actividad/${a.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {typeLabel(a.type)} · {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'} · {place}
          {stateBadge(a.status)}
        </div>
        {showArtist && a.artist && (
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.artist.avatar_url || '/avatar.png'} className="w-5 h-5 rounded-full object-cover border" alt="" />
            <span className="truncate">{a.artist.stage_name}</span>
          </div>
        )}
      </div>
      {a.group_company?.logo_url && <img src={a.group_company.logo_url} alt="" className="h-6 w-auto object-contain" />}
    </Link>
  )
}
