import Link from 'next/link'
import { redirect } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import SavedToast from '@/components/SavedToast'
import ActivitiesMap, { ActivityForMap } from '@/components/ActivitiesMap'
import ActivityListItem, { ActivityListModel } from '@/components/ActivityListItem'

export const dynamic = 'force-dynamic'

type Company = { id: string; name: string | null; nick: string | null; logo_url: string | null }
type ActivityRow = {
  id: string; type: string | null; status: string | null; date: string | null;
  municipality: string | null; province: string | null; country: string | null;
  artist_id: string | null; company_id: string | null
}
type ArtistLite = { id: string; stage_name: string | null; avatar_url: string | null }

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) }

async function getCompany(id: string) {
  const s = createSupabaseServer()
  const { data } = await s.from('group_companies').select('id, name, nick, logo_url').eq('id', id).single()
  return data as Company | null
}

async function getCompanyActivities({ companyId, q, type, from, to, past }:{
  companyId: string; q?: string; type?: string; from?: string; to?: string; past?: boolean
}): Promise<ActivityListModel[]> {
  const s = createSupabaseServer()
  let qb = s.from('activities').select('id, type, status, date, municipality, province, country, artist_id, company_id')
    .eq('company_id', companyId).order('date', { ascending: !past }).order('created_at', { ascending: false })
  if (type) qb = qb.eq('type', type)
  if (past) {
    const now = new Date(); const fromDef = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10)
    qb = qb.lte('date', to || todayISO()).gte('date', from || fromDef)
  } else {
    qb = qb.gte('date', from || todayISO()); if (to) qb = qb.lte('date', to)
  }
  if (q) {
    const like = `%${q}%`
    qb = qb.or(['municipality.ilike.'+like,'province.ilike.'+like,'country.ilike.'+like,'type.ilike.'+like,'status.ilike.'+like].join(','))
  }
  const { data: actsRaw } = await qb
  const acts = (actsRaw || []) as ActivityRow[]

  const artistIds = Array.from(new Set(acts.map(a => a.artist_id).filter((x): x is string => !!x)))
  const artistsRes = artistIds.length
    ? await s.from('artists').select('id, stage_name, avatar_url').in('id', artistIds)
    : ({ data: [] } as { data: ArtistLite[] })
  const byArtist: Record<string, ArtistLite> =
    Object.fromEntries(((artistsRes.data || []) as ArtistLite[]).map((a: ArtistLite) => [a.id, a] as const))

  const full: ActivityListModel[] = acts.map(a => ({
    ...a,
    artist: a.artist_id ? byArtist[a.artist_id] ?? null : null,
    group_company: null, // ya estamos en la ficha de la empresa
  }))
  return full
}
async function getTypes(): Promise<string[]> {
  const s = createSupabaseServer()
  const { data } = await s.from('activities').select('type').not('type', 'is', null).order('type', { ascending: true })
  return Array.from(new Set((data || []).map((x: any) => x.type).filter(Boolean))) as string[]
}

export default async function CompanyDetail({
  params, searchParams,
}: {
  params: { companyId: string },
  searchParams: { tab?: string, mode?: string, saved?: string, q?: string, type?: string, from?: string, to?: string, past?: string }
}) {
  const company = await getCompany(params.companyId)
  if (!company) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Empresa</h1><div className="text-sm text-gray-600">No encontrada.</div></div>

  const tab = searchParams.tab || 'datos'
  const isEdit = searchParams.mode === 'edit'
  const saved = searchParams.saved === '1'

  async function saveCompany(fd: FormData) {
    'use server'
    const s = createSupabaseServer()
    const name = String(fd.get('name') || '').trim() || null
    const nick = String(fd.get('nick') || '').trim() || null
    let logo_url: string | null = null
    const file = fd.get('logo') as File | null
    if (file && file.size > 0) {
      await ensurePublicBucket('avatars')
      const up = await s.storage.from('avatars').upload(`companies/${params.companyId}/${crypto.randomUUID()}`, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      logo_url = s.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    }
    const { error } = await s.from('group_companies').update({ name, nick, ...(logo_url ? { logo_url } : {}) }).eq('id', params.companyId)
    if (error) throw new Error(error.message)
    revalidatePath(`/empresas/${params.companyId}`)
    redirect(`/empresas/${params.companyId}?tab=datos&mode=edit&saved=1`)
  }

  // Actividades (si pestaña)
  let acts: ActivityListModel[] = []
  let types: string[] = []
  if (tab === 'actividades') {
    const q = searchParams.q || '', type = searchParams.type || '', past = searchParams.past === '1', from = searchParams.from, to = searchParams.to
    ;[acts, types] = await Promise.all([getCompanyActivities({ companyId: params.companyId, q, type, from, to, past }), getTypes()])
  }

  const mapData: ActivityForMap[] = acts.map(a => ({
    id: a.id, type: a.type || undefined, status: a.status || undefined, date: a.date || undefined,
    municipality: a.municipality || undefined, province: a.province || undefined, country: a.country || undefined,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {company.logo_url && <img src={company.logo_url} className="h-10 w-auto object-contain" alt="" />}
          <h1 className="text-2xl font-semibold">{company.nick || company.name}</h1>
        </div>
        <div className="flex gap-2">
          {!isEdit
            ? <Link className="btn" href={{ pathname: `/empresas/${company.id}`, query: { tab, mode: 'edit' } }}>Editar ficha</Link>
            : <Link className="btn-secondary" href={{ pathname: `/empresas/${company.id}`, query: { tab } }}>Terminar edición</Link>
          }
          <Link className="btn-secondary" href="/empresas">Volver</Link>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={{ pathname: `/empresas/${company.id}`, query: { tab: 'datos', mode: isEdit ? 'edit' : undefined } }}
          className={`px-3 py-2 rounded-md ${tab === 'datos' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>Datos de la empresa</Link>
        <Link href={{ pathname: `/empresas/${company.id}`, query: { tab: 'actividades' } }}
          className={`px-3 py-2 rounded-md ${tab === 'actividades' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>Actividades</Link>
      </div>

      {tab === 'datos' && (
        <ModuleCard title="Datos" leftActions={<span className="badge">{isEdit ? 'Editar' : 'Ver'}</span>}>
          {!isEdit ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Nombre</div>
                <div className="font-medium">{company.name}</div>
              </div>
              <div>
                <div className="text-gray-500">Nick</div>
                <div className="font-medium">{company.nick}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-gray-500">Logo</div>
                {company.logo_url ? <img src={company.logo_url} className="h-12 w-auto object-contain mt-1" alt="" /> : <div className="text-gray-500">(sin logo)</div>}
              </div>
            </div>
          ) : (
            <form action={saveCompany} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm mb-1">Nombre</label><input name="name" defaultValue={company.name || ''} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">Nick</label><input name="nick" defaultValue={company.nick || ''} className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-2"><label className="block text-sm mb-1">Logo</label><input type="file" name="logo" accept="image/*" /></div>
              <div className="md:col-span-2"><button className="btn">Guardar</button></div>
            </form>
          )}
        </ModuleCard>
      )}

      {tab === 'actividades' && (
        <ModuleCard title="Actividades de la empresa">
          <form className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4" method="get">
            <input type="hidden" name="tab" value="actividades" />
            <div className="md:col-span-2">
              <input name="q" defaultValue={searchParams.q || ''} placeholder="Buscar…" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <select name="type" defaultValue={searchParams.type || ''} className="w-full border rounded px-3 py-2">
                <option value="">Todos los tipos</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2"><label className="text-sm">Desde</label><input type="date" name="from" defaultValue={searchParams.from} className="border rounded px-2 py-1 w-full" /></div>
            <div className="flex items-center gap-2"><label className="text-sm">Hasta</label><input type="date" name="to" defaultValue={searchParams.to} className="border rounded px-2 py-1 w-full" /></div>
            <div className="md:col-span-5 flex items-center gap-2">
              <button className="btn">Aplicar</button>
              {searchParams.past === '1'
                ? <Link className="btn-secondary" href={{ pathname: `/empresas/${company.id}`, query: { ...searchParams, tab: 'actividades', past: undefined } }}>Ver futuras</Link>
                : <Link className="btn-secondary" href={{ pathname: `/empresas/${company.id}`, query: { ...searchParams, tab: 'actividades', past: '1' } }}>Ver pasadas</Link>}
            </div>
          </form>

          <ActivitiesMap activities={mapData} />
          <div className="divide-y divide-gray-200 mt-4">
            {acts.map(a => <ActivityListItem key={a.id} a={a} showArtist={true} />)}
            {!acts.length && <div className="text-sm text-gray-500 py-3">No hay actividades con estos filtros.</div>}
          </div>
        </ModuleCard>
      )}

      <SavedToast show={saved} />
    </div>
  )
}
