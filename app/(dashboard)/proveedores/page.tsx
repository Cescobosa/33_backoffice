import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import CounterpartiesSearchList from '@/components/CounterpartiesSearchList'

export default async function ProvidersPage() {
  const s = createSupabaseServer()
  const { data: initial } = await s.from('counterparties')
    .select('id, nick, legal_name, logo_url')
    .eq('as_provider', true)
    .eq('status', 'active')
    .order('legal_name', { ascending: true })
    .limit(50)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <Link className="btn" href="/proveedores/new">+ Nuevo proveedor</Link>
      </div>

      <CounterpartiesSearchList
        kind="provider"
        initial={initial || []}
        basePath="/proveedores"
        placeholder="Buscar proveedores…"
      />
    </div>
  )
}
