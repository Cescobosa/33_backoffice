import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function artistFromLink(lnk: any) {
  const a = lnk?.artists
  return Array.isArray(a) ? a[0] : a
}

export default async function ThirdDetail({ params }: { params: { id: string } }) {
  const s = createSupabaseServer()

  const { data: cp, error: e1 } = await s
    .from('counterparties')
    .select('id, legal_name, nick, logo_url, is_company')
    .eq('id', params.id)
    .single()
  if (e1) throw new Error(e1.message)
  if (!cp) notFound()

  const { data: links, error: e2 } = await s
    .from('third_party_links')
    .select('id, status, linked_at, unlinked_at, artist_id, artists(id, stage_name, avatar_url)')
    .eq('counterparty_id', params.id)
    .order('linked_at', { ascending: false })
  if (e2) throw new Error(e2.message)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{cp.nick || cp.legal_name}</h1>
          <div className="text-sm text-gray-600">{cp.is_company ? 'Empresa' : 'Particular'}</div>
        </div>
        <Link className="btn-secondary" href="/terceros">Volver</Link>
      </div>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cp.logo_url || '/avatar.png'} className="w-12 h-12 rounded-full border object-cover" alt="" />
        <div className="text-sm text-gray-500">Ficha del tercero.</div>
      </div>

      <div className="border rounded p-3">
        <div className="font-medium mb-2">Artistas vinculados</div>
        <div className="divide-y divide-gray-200">
          {!links?.length && <div className="text-sm text-gray-500">Sin vínculos.</div>}
          {links?.map((l: any) => {
            const a = artistFromLink(l)
            const href = a?.id ? `/artistas/${a.id}` : '/artistas'
            return (
              <Link key={l.id} href={href} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-md px-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a?.avatar_url || '/avatar.png'} className="w-8 h-8 rounded-full border object-cover" alt="" />
                <div className="font-medium">{a?.stage_name || 'Artista'}</div>
                {l.status === 'unlinked' && <span className="badge badge-red ml-auto">Desvinculado</span>}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
