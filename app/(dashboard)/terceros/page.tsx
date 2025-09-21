import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CounterpartiesPage({
  searchParams,
}: { searchParams?: { q?: string } }) {
  const q = (searchParams?.q || '').trim()
  const s = createSupabaseServer()
  let qb = s.from('counterparties').select('id, legal_name, nick, is_company, logo_url, photo_url').order('legal_name', { ascending: true })
  if (q) {
    const like = `%${q}%`
    qb = qb.or(`legal_name.ilike.${like},nick.ilike.${like}`)
  }
  const { data, error } = await qb
  if (error) throw new Error(error.message)
  const items = data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terceros</h1>
        <Link href="/terceros/new" className="btn">+ Nuevo</Link>
      </div>

      <ModuleCard title="Buscar">
        <form className="flex gap-2" method="get">
          <input name="q" defaultValue={q} placeholder="Buscar por nombre o alias…" className="border rounded px-3 py-2 w-full" />
          <button className="btn">Buscar</button>
        </form>
      </ModuleCard>

      <ModuleCard title="Listado">
        <div className="divide-y divide-gray-200">
          {items.map((c: any) => (
            <Link href={`/terceros/${c.id}`} key={c.id} className="flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
              <img
                src={c.logo_url || c.photo_url || '/avatar.png'}
                alt=""
                className={`h-8 ${c.is_company ? 'w-auto object-contain rounded' : 'w-8 rounded-full object-cover'} border bg-white`}
              />
              <div>
                <div className="font-medium">{c.nick || c.legal_name}</div>
                {c.nick && c.legal_name && <div className="text-xs text-gray-500">{c.legal_name}</div>}
              </div>
            </Link>
          ))}
          {!items.length && <div className="text-sm text-gray-500">Sin resultados.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
