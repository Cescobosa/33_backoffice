import Link from 'next/link'

function statusPill(s?: string | null) {
  const v = (s || '').toLowerCase()
  if (['confirmado', 'confirmed'].includes(v)) return <span className="ml-2 px-2 py-[2px] text-xs rounded bg-green-100 text-green-800">Confirmado</span>
  if (['reserva', 'reserved'].includes(v))  return <span className="ml-2 px-2 py-[2px] text-xs rounded bg-amber-100 text-amber-800">Reserva</span>
  if (['borrador', 'draft'].includes(v))    return <span className="ml-2 px-2 py-[2px] text-xs rounded bg-amber-100 text-amber-800">Borrador</span>
  return null
}

export default function ActivityListItem({
  a,
  showArtist,
}: {
  a: any
  showArtist?: boolean
}) {
  const place = [a.municipality, a.province, a.country].filter(Boolean).join(', ')
  return (
    <Link
      href={`/actividades/actividad/${a.id}`}
      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
    >
      <div>
        <div className="font-medium">
          {a.type} · {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'} · {place}
          {statusPill(a.status)}
        </div>
        {showArtist && a.artist && (
          <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.artist.avatar_url || '/avatar.png'} alt="" className="w-6 h-6 rounded-full border object-cover" />
            <span>{a.artist.stage_name}</span>
          </div>
        )}
      </div>
      {/* logo horizontal empresa del grupo */}
      {a.group_company?.logo_url
        ? <img src={a.group_company.logo_url} alt="" className="h-8 w-auto object-contain" />
        : (a.group_company?.nick || a.group_company?.name) ? <span className="text-xs text-gray-600">{a.group_company.nick || a.group_company.name}</span> : null}
    </Link>
  )
}
