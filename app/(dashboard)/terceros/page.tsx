// app/(dashboard)/terceros/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Counterparty = {
  id: string
  nick: string | null
  legal_name: string
  tax_id: string | null
  logo_url: string | null
  is_company: boolean
  status: string
}

async function getCounterparties(q?: string) {
  const s = createSupabaseServer()
  let qb = s
    .from('counterparties')
    .select('id, nick, legal_name, tax_id, logo_url, is_company, status')
    .eq('status', 'active') // activos
    .order('legal_name', { ascending: true })

  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    qb = qb.or([
      `nick.ilike.${like}`,
      `legal_name.ilike.${like}`,
      `tax_id.ilike.${like}`,
      `search_text.ilike.${like}`,
    ].join(','))
  }

  const { data, error } = await qb
  if (error) throw new Error(error.message)
  return (data || []) as Counterparty[]
}

export default async function ThirdPartiesPage({ searchParams }: { searchParams: { q?: string } }) {
  const list = await getCounterparties(searchParams.q)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terceros</h1>
        <Link className="btn" href="/terceros/new">+ Nuevo</Link>
      </div>

      <form className="space-y-2" method="get">
        <div className="font-medium">Buscar</div>
        <input
          name="q"
          defaultValue={searchParams.q || ''}
          placeholder="Buscar por nombre, alias o CIF/DNI…"
          className="w-full border rounded px-3 py-2"
        />
        <div>
          <button className="btn">Aplicar</button>
        </div>
      </form>

      <div className="divide-y divide-gray-200">
        {list.map(c => (
          <Link key={c.id} href={`/terceros/${c.id}`} className="block py-3 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <img
                src={c.logo_url || '/avatar.png'}
                alt=""
                className="w-10 h-10 object-cover border rounded" // logos horizontales, NO redondos
              />
              <div className="flex-1">
                <div className="font-medium">{c.nick || c.legal_name}</div>
                <div className="text-sm text-gray-600">{c.is_company ? 'Empresa' : 'Particular'}{c.tax_id ? ` · ${c.tax_id}` : ''}</div>
              </div>
            </div>
          </Link>
        ))}
        {!list.length && (
          <div className="py-8 text-sm text-gray-500">Sin resultados.</div>
        )}
      </div>
    </div>
  )
}
