import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import CounterpartiesSearchList from '@/components/CounterpartiesSearchList'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CounterpartiesPage() {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('counterparties')
    .select('id, legal_name, nick, is_company, logo_url, tax_id')
    .order('legal_name', { ascending: true })
    .limit(50)

  if (error) throw new Error(error.message)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terceros</h1>
        <Link href="/terceros/new" className="btn">+ Nuevo</Link>
      </div>

      <ModuleCard title="Buscar">
        <CounterpartiesSearchList initial={data || []} />
      </ModuleCard>
    </div>
  )
}
