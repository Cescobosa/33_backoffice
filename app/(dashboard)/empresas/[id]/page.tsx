import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getCompany(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s.from('group_companies').select('id, name, nick, logo_url').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export default async function CompanyPage({ params }: { params: { id: string } }) {
  const company = await getCompany(params.id)
  if (!company) notFound()

  async function deleteCompany() {
    'use server'
    const s = createSupabaseServer()
    const companyId = company.id
    // Desvincula actividades
    const up = await s.from('activities').update({ company_id: null }).eq('company_id', companyId)
    if (up.error) throw new Error(up.error.message)
    // Borra empresa
    const del = await s.from('group_companies').delete().eq('id', companyId)
    if (del.error) throw new Error(del.error.message)
    revalidatePath('/empresas')
    redirect('/empresas')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {company.logo_url && <img src={company.logo_url} className="h-10 w-auto object-contain" alt="" />}
          <h1 className="text-2xl font-semibold">{company.nick || company.name}</h1>
        </div>
        <div className="flex gap-2">
          <form action={deleteCompany}><button className="btn-secondary">Eliminar empresa</button></form>
          <Link href="/empresas" className="btn-secondary">Volver</Link>
        </div>
      </div>

      <ModuleCard title="Datos de la empresa">
        <div className="text-sm">
          <div><span className="text-gray-500">Nombre: </span>{company.name}</div>
          <div><span className="text-gray-500">Alias: </span>{company.nick || '-'}</div>
        </div>
      </ModuleCard>
    </div>
  )
}
