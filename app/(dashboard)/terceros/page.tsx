// app/(dashboard)/terceros/page.tsx
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function like(v?: string) { return v ? `%${v}%` : undefined }

async function getThirdParties(q?: string) {
  const s = createSupabaseServer()

  let qb = s.from('counterparties')
    .select('id, nick, legal_name, logo_url, is_company, status, as_third_party, as_provider')
    // Mostrar tanto terceros como proveedores unificados:
    .or('as_third_party.eq.true,as_provider.eq.true')
    .order('nick', { ascending: true })
    .order('legal_name', { ascending: true })

  if (q) {
    const l = like(q)!
    qb = qb.or([
      `nick.ilike.${l}`,
      `legal_name.ilike.${l}`,
      `tax_id.ilike.${l}`
    ].join(','))
  }

  const { data, error } = await qb
  if (error) throw new Error(error.message)
  return data || []
}

export default async function ThirdPartiesPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || ''
  const rows = await getThirdParties(q)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terceros</h1>
        <Link href="/terceros/new" className="btn">+ Nuevo</Link>
      </div>

      <form method="get" className="space-y-2">
        <div className="text-sm font-medium">Buscar</div>
        <input
          className="w-full border rounded px-3 py-2"
          name="q"
          placeholder="Buscar por nombre, alias o CIF/DNI…"
          defaultValue={q}
        />
      </form>

      <div className="divide-y divide-gray-200">
        {rows.map((c: any) => (
          <Link key={c.id} href={`/terceros/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50">
            <img
              src={c.logo_url || '/avatar.png'}
              alt=""
              className="w-8 h-8 object-cover border rounded" // cuadrado: logos horizontales no recortados
            />
            <div>
              <div className="font-medium">{c.nick || c.legal_name}</div>
              <div className="text-xs text-gray-600">
                {c.is_company ? 'Empresa' : 'Particular'}
                {c.status === 'archived' && <span className="ml-2 text-red-600">· Archivado</span>}
              </div>
            </div>
          </Link>
        ))}
        {!rows.length && <div className="text-sm text-gray-500 py-6">Sin resultados.</div>}
      </div>
    </div>
  )
}
