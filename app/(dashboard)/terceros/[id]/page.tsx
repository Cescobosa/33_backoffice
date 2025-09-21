import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CounterpartyDetail({ params }: { params: { id: string } }) {
  const s = createSupabaseServer()
  const { data: cp } = await s.from('counterparties').select('*').eq('id', params.id).maybeSingle()
  if (!cp) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cp.logo_url || '/avatar.png'}
          className={`h-10 ${cp.is_company ? 'w-auto object-contain rounded' : 'w-10 rounded-full object-cover'} border bg-white`}
          alt=""
        />
        <h1 className="text-2xl font-semibold">{cp.nick || cp.legal_name}</h1>
        <Link href="/terceros" className="ml-auto btn-secondary">Volver</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <div className="text-sm">
          <div><span className="text-gray-500">Nombre fiscal: </span>{cp.legal_name}</div>
          {cp.nick && <div><span className="text-gray-500">Alias: </span>{cp.nick}</div>}
          <div><span className="text-gray-500">Tipo: </span>{cp.is_company ? 'Empresa' : 'Particular'}</div>
          {cp.tax_id && <div><span className="text-gray-500">DNI/CIF: </span>{cp.tax_id}</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
