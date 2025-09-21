import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CounterpartyDetail({
  params,
}: { params: { id: string } }) {
  const s = createSupabaseServer()
  const { data: cp } = await s.from('counterparties').select('*').eq('id', params.id).maybeSingle()
  if (!cp) notFound()

  const { data: acts } = await s
    .from('activities')
    .select(`id, type, status, date, municipality, province, country, artists(id,stage_name,avatar_url)`)
    .or(`counterparty_id.eq.${params.id},promoter_id.eq.${params.id}`) // ajusta según tu modelo
    .order('date', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img
          src={cp.logo_url || cp.photo_url || '/avatar.png'}
          className={`h-10 ${cp.is_company ? 'w-auto object-contain rounded' : 'w-10 rounded-full object-cover'} border bg-white`}
          alt=""
        />
        <h1 className="text-2xl font-semibold">{cp.nick || cp.legal_name}</h1>
        <Link href="/terceros" className="ml-auto btn-secondary">Volver</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <div className="text-sm">
          <div><span className="text-gray-500">Nombre fiscal: </span>{cp.legal_name}</div>
          <div><span className="text-gray-500">Alias: </span>{cp.nick || '-'}</div>
          <div><span className="text-gray-500">Tipo: </span>{cp.is_company ? 'Empresa' : 'Particular'}</div>
          {cp.tax_id && <div><span className="text-gray-500">DNI/CIF: </span>{cp.tax_id}</div>}
        </div>
      </ModuleCard>

      <ModuleCard title="Actividades">
        <div className="divide-y divide-gray-200">
          {(acts || []).map((a: any) => {
            const art = Array.isArray(a.artists) ? a.artists[0] : (a as any).artists
            return (
              <Link key={a.id} href={`/actividades/actividad/${a.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                <div className="flex items-center gap-3">
                  {art?.avatar_url
                    ? <img src={art.avatar_url} className="h-8 w-8 rounded-full object-cover border" alt="" />
                    : <div className="h-8 w-8 rounded-full bg-gray-200" />
                  }
                  <div>
                    <div className="font-medium">{a.type}</div>
                    <div className="text-sm text-gray-600">
                      {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'} · {[a.municipality,a.province,a.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
                <span className={`badge ${String(a.status).toLowerCase()==='confirmed' ? 'badge-green' : 'badge-yellow'}`}>{a.status}</span>
              </Link>
            )
          })}
          {!acts?.length && <div className="text-sm text-gray-500">Sin actividades vinculadas.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
