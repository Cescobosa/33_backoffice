import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const s = createSupabaseServer()
  const { data } = await s.from('group_companies').select('id, nick, name, logo_url').order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas del grupo</h1>
        <Link href="/empresas/new" className="btn">+ Añadir empresa</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data || []).map(c => (
          <Link key={c.id} href={`/empresas/${c.id}`} className="border rounded p-3 hover:bg-gray-50 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.logo_url || '/avatar.png'} className="w-10 h-10 rounded-full border object-cover" alt="" />
            <div>
              <div className="font-medium">{c.nick || c.name}</div>
              <div className="text-xs text-gray-600">{c.name}</div>
            </div>
          </Link>
        ))}
        {!data?.length && <div className="text-sm text-gray-500">Aún no hay empresas.</div>}
      </div>
    </div>
  )
}
