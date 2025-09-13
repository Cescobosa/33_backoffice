import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CompaniesIndex() {
  const s = createSupabaseServer()
  const { data: companies, error } = await s
    .from('group_companies')
    .select('id, name, nick, logo_url')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas del grupo</h1>
        <Link href="/empresas/new" className="btn">+ Nueva empresa</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(companies || []).map((c) => (
          <Link key={c.id} href={`/empresas/${c.id}`} className="border rounded p-4 hover:bg-gray-50 flex items-center gap-3">
            {/* Logo horizontal, sin recortar en círculo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.logo_url || '/avatar.png'} alt="" className="h-10 w-auto object-contain" />
            <div>
              <div className="font-medium">{c.nick || c.name}</div>
              <div className="text-sm text-gray-600">{c.name}</div>
            </div>
          </Link>
        ))}
        {!companies?.length && <div className="text-sm text-gray-500">Aún no hay empresas.</div>}
      </div>
    </div>
  )
}
