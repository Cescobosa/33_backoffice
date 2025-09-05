import Link from 'next/link'
import ClientSearch from '@/components/ClientSearch'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function Providers({ searchParams }: { searchParams: { q?: string; archived?: string } }) {
  const s = createSupabaseServer()
  const q = (searchParams.q || '').trim().toLowerCase()
  const archived = searchParams.archived === '1'
  let query = s.from('counterparties')
    .select('id, legal_name, nick, logo_url, status')
    .eq('as_provider', true)
    .eq('status', archived ? 'archived' : 'active')
    .order('legal_name', { ascending: true })
  if (q) query = query.ilike('search_text', `%${q}%`)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href={archived?'/proveedores':'/proveedores?archived=1'}>{archived?'Ver activos':'Archivados'}</Link>
          <Link className="btn" href="/proveedores/new">+ Nuevo proveedor</Link>
        </div>
      </div>
      <ClientSearch placeholder="Buscar proveedores..." />
      <div className="divide-y divide-gray-200">
        {data?.map(t => (
          <Link key={t.id} href={`/proveedores/${t.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50 rounded-md px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.logo_url || '/avatar.png'} className="w-10 h-10 rounded-full object-cover border" alt="" />
            <div className="flex-1">
              <div className="font-medium">{t.nick || t.legal_name}</div>
              {t.status === 'archived' && <span className="badge badge-red">Archivado</span>}
            </div>
          </Link>
        ))}
        {!data?.length && <div className="text-sm text-gray-500 py-6">Sin resultados.</div>}
      </div>
    </div>
  )
}
