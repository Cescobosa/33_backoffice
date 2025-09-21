// app/(dashboard)/empresas/[companyId]/page.tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getCompany(id: string) {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('group_companies')
    .select('id, name, nick, logo_url')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function getCompanyActivities(companyId: string) {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('activities')
    .select(`
      id, type, status, date, municipality, province, country,
      artists ( id, stage_name, avatar_url )
    `)
    .eq('company_id', companyId)
    .order('date', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: { companyId: string }
  searchParams: { saved?: string }
}) {
  const company = await getCompany(params.companyId)
  if (!company) notFound()

  const activities = await getCompanyActivities(company.id)

  async function deleteCompany() {
    'use server'
    const s = createSupabaseServer()
    const companyId = String(params.id)
  
    // (Opcional pero recomendable) Comprueba que existe
    const existing = await s.from('group_companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle()
    if (existing.error && existing.error.code !== 'PGRST116') {
      throw new Error(existing.error.message)
    }
    if (!existing.data) {
      // Si no existe, navega fuera o lanza 404
      redirect('/empresas')
      return
    }
  
    // 1) Desvincula actividades para no romper la FK
    const up = await s
      .from('activities')
      .update({ company_id: null })
      .eq('company_id', companyId)
    if (up.error) throw new Error(up.error.message)
  
    // 2) Borra la empresa
    const del = await s
      .from('group_companies')
      .delete()
      .eq('id', companyId)
    if (del.error) throw new Error(del.error.message)
  
    revalidatePath('/empresas')
    redirect('/empresas')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {company.logo_url && (
            <img src={company.logo_url} className="h-10 w-auto object-contain" alt="" />
          )}
          <h1 className="text-2xl font-semibold">{company.nick || company.name}</h1>
        </div>
        <div className="flex gap-2">
          <form action={deleteCompany}>
            <button className="btn-secondary">Eliminar empresa</button>
          </form>
          <Link href="/empresas" className="btn-secondary">Volver</Link>
        </div>
      </div>

      <ModuleCard title="Datos de la empresa">
        <div className="text-sm">
          <div><span className="text-gray-500">Nombre: </span>{company.name}</div>
          <div><span className="text-gray-500">Alias: </span>{company.nick}</div>
        </div>
      </ModuleCard>

      <ModuleCard title="Actividades vinculadas">
        <div className="divide-y divide-gray-200">
          {(activities || []).map((a: any) => {
            const art = Array.isArray(a.artists) ? a.artists[0] : (a as any).artists
            return (
              <Link
                href={`/actividades/actividad/${a.id}`}
                key={a.id}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div className="flex items-center gap-3">
                  {art?.avatar_url
                    ? <img src={art.avatar_url} className="h-8 w-8 rounded-full object-cover border" alt="" />
                    : <div className="h-8 w-8 rounded-full bg-gray-200" />
                  }
                  <div>
                    <div className="font-medium">{a.type}</div>
                    <div className="text-sm text-gray-600">
                      {a.date ? new Date(a.date).toLocaleDateString() : 'Sin fecha'} · {[a.municipality, a.province, a.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
                <span className={`badge ${String(a.status).toLowerCase()==='confirmed' ? 'badge-green' : 'badge-yellow'}`}>
                  {a.status}
                </span>
              </Link>
            )
          })}
          {!activities?.length && <div className="text-sm text-gray-500">Esta empresa aún no tiene actividades.</div>}
        </div>
      </ModuleCard>

      <SavedToast show={searchParams?.saved === '1'} />
    </div>
  )
}
