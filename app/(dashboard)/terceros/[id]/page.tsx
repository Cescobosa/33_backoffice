import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'
import { MainTabs } from '@/components/Tabs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CounterpartyDetail({ params }: { params: { id: string } }) {
  const s = createSupabaseServer()
  const { data: cp } = await s.from('counterparties').select('*').eq('id', params.id).maybeSingle()
  if (!cp) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {cp.logo_url
          ? <img src={cp.logo_url!} className="h-10 w-auto object-contain" alt="" />
          : <div className="h-10 w-10 bg-gray-200 rounded" />
        }
        <div>
          <h1 className="text-2xl font-semibold">{cp.nick || cp.legal_name}</h1>
          <div className="text-sm text-gray-600">Tercero</div>
        </div>
        <Link href="/terceros" className="ml-auto btn-secondary">Volver</Link>
      </div>

      <MainTabs
        current="datos"
        items={[
          { key: 'datos', label: 'Datos', href: `/terceros/${cp.id}` },
          { key: 'actividades', label: 'Actividades', href: `/terceros/${cp.id}/actividades` },
        ]}
      />

      <ModuleCard title="Datos básicos">
        <div className="text-sm">
          <div><span className="text-gray-500">Nombre fiscal: </span>{cp.legal_name || '—'}</div>
          {cp.nick && <div><span className="text-gray-500">Alias: </span>{cp.nick}</div>}
          <div><span className="text-gray-500">Tipo: </span>{cp.is_company ? 'Empresa' : 'Particular'}</div>
          {cp.tax_id && <div><span className="text-gray-500">DNI/CIF: </span>{cp.tax_id}</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
