import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import CounterpartiesSearchList from '@/components/CounterpartiesSearchList'

export default async function ThirdsPage() {
  const s = createSupabaseServer()
  const { data: initial } = await s.from('counterparties')
    .select('id, nick, legal_name, logo_url')
    .eq('as_third_party', true)
    .eq('status', 'active')
    .order('legal_name', { ascending: true })
    .limit(50)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terceros</h1>
        <Link className="btn" href="/terceros/new">+ Nuevo tercero</Link>
      </div>

      <CounterpartiesSearchList
        kind="third"
        initial={initial || []}
        basePath="/terceros"
        placeholder="Buscar terceros…"
      />
    </div>
  )
}
