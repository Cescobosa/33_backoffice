import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'

export const dynamic = 'force-dynamic'

type Company = { id: string; name: string | null; nick: string | null; logo_url: string | null }

export default async function CompaniesPage() {
  const s = createSupabaseServer()
  const { data } = await s.from('group_companies').select('id, name, nick, logo_url').order('name', { ascending: true })
  const companies = (data || []) as Company[]
  return (
    <div className="space-y-6">
      <ModuleCard title="Empresas del grupo" leftActions={<Link href="/empresas/new" className="btn">+ Nueva</Link>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {companies.map(c => (
            <Link key={c.id} href={`/empresas/${c.id}`} className="border rounded p-3 hover:bg-gray-50">
              {c.logo_url ? <img src={c.logo_url} alt="" className="h-10 w-auto object-contain mb-2" /> : <div className="h-10" />}
              <div className="font-medium">{c.nick || c.name}</div>
            </Link>
          ))}
          {!companies.length && <div className="text-sm text-gray-500">Aún no hay empresas.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
