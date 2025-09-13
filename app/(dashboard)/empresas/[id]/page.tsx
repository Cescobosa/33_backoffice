import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import { revalidatePath } from 'next/cache'
import { ensurePublicBucket } from '@/lib/storage'
import ActivitiesMap from '@/components/ActivitiesMap'
import SavedToast from '@/components/SavedToast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function CompanyDetail({
  params,
  searchParams,
}: {
  params: { companyId: string }
  searchParams?: { tab?: string; edit?: string; saved?: string; q?: string; type?: string; past?: string }
}) {
  const s = createSupabaseServer()
  const tab = searchParams?.tab || 'datos'
  const isEditing = searchParams?.edit === '1'
  const { data: company } = await s
    .from('group_companies')
    .select('id, name, nick, logo_url, tax_id, notes')
    .eq('id', params.companyId)
    .maybeSingle()

  if (!company) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Empresa</h1>
        <div className="text-sm text-gray-600">No se encontró la empresa solicitada.</div>
        <Link href="/empresas" className="btn-secondary">Volver</Link>
      </div>
    )
  }

  // ====== datos actividades filtrables ======
  const q = (searchParams?.q || '').trim()
  const type = (searchParams?.type || '').trim()
  const past = searchParams?.past === '1'
  const today = new Date().toISOString().slice(0, 10)

  let query = s
    .from('activities')
    .select(`
      id, type, status, date, municipality, province, country, lat, lng,
      artists(id,stage_name,avatar_url)
    `)
    .eq('company_id', company.id)
    .order('date', { ascending: true })

  if (!past) query = query.gte('date', today)
  if (type) query = query.eq('type', type)
  if (q && q.length >= 2) {
    // filtros seguros (no incluimos relaciones en el or para evitar errores)
    query = query.or(
      `municipality.ilike.%${q}%,province.ilike.%${q}%,country.ilike.%${q}%,type.ilike.%${q}%`
    )
  }
  const { data: acts } = await query

  // ====== ACTIONS ======
  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const name = String(formData.get('name') || '').trim()
    const nick = String(formData.get('nick') || '').trim() || null
    const tax_id = String(formData.get('tax_id') || '').trim() || null
    const notes = String(formData.get('notes') || '').trim() || null
    let logo_url: string | null = null
    const file = formData.get('logo') as File | null
    if (file && file.size > 0) {
      await ensurePublicBucket('avatars')
      const up = await s.storage.from('avatars').upload(
        `group_companies/${params.companyId}/${crypto.randomUUID()}`,
        file,
        { cacheControl: '3600', upsert: false, contentType: file.type || 'image/*' }
      )
      if (up.error) throw new Error(up.error.message)
      logo_url = s.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl
    }
    const { error } = await s
      .from('group_companies')
      .update({ name, nick, tax_id, notes, ...(logo_url ? { logo_url } : {}) })
      .eq('id', params.companyId)
    if (error) throw new Error(error.message)
    revalidatePath(`/empresas/${params.companyId}`)
  }

  // ====== UI ======
  const toggleHref = (v: '0' | '1') =>
    ({ pathname: `/empresas/${company.id}`, query: { tab, edit: v } } as any)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={company.logo_url || '/avatar.png'} alt="" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-semibold">{company.nick || company.name}</h1>
            <div className="text-sm text-gray-600">{company.name}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === 'datos' ? (
            <Link href={toggleHref(isEditing ? '0' : '1')} className="btn-secondary">
              {isEditing ? 'Terminar edición' : 'Editar pestaña'}
            </Link>
          ) : null}
          <Link href="/empresas" className="btn-secondary">Volver</Link>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={{ pathname: `/empresas/${company.id}`, query: { tab: 'datos' } }}
              className={`px-3 py-2 rounded-md ${tab === 'datos' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
          Datos de la empresa
        </Link>
        <Link href={{ pathname: `/empresas/${company.id}`, query: { tab: 'actividades' } }}
              className={`px-3 py-2 rounded-md ${tab === 'actividades' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
          Actividades
        </Link>
      </div>

      {tab === 'datos' && (
        <ModuleCard
          title="Datos"
          leftActions={
            <Link href={toggleHref(isEditing ? '0' : '1')} className="badge">{isEditing ? 'Terminar edición' : 'Editar'}</Link>
          }
        >
          {!isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><div className="module-title">Nombre</div><div>{company.name}</div></div>
              <div><div className="module-title">Nick</div><div>{company.nick || '—'}</div></div>
              <div><div className="module-title">CIF/DNI</div><div>{company.tax_id || '—'}</div></div>
              <div className="md:col-span-2"><div className="module-title">Notas</div><div>{company.notes || '—'}</div></div>
            </div>
          ) : (
            <form action={saveBasics} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm mb-1 module-title">Logo</label><input name="logo" type="file" accept="image/*" /></div>
              <div><label className="block text-sm mb-1 module-title">Nick</label><input name="nick" defaultValue={company.nick || ''} className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-2"><label className="block text-sm mb-1 module-title">Nombre</label><input name="name" defaultValue={company.name} className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm mb-1">CIF/DNI</label><input name="tax_id" defaultValue={company.tax_id || ''} className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-2"><label className="block text-sm mb-1">Notas</label><input name="notes" defaultValue={company.notes || ''} className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-2"><button className="btn">Guardar</button></div>
            </form>
          )}
        </ModuleCard>
      )}

      {tab === 'actividades' && (
        <ModuleCard title="Actividades de la empresa">
          {/* Filtros */}
          <form className="flex flex-wrap gap-2 items-end mb-3" method="GET">
            <input type="hidden" name="tab" value="actividades" />
            <div>
              <label className="block text-xs text-gray-600 mb-1">Buscar</label>
              <input name="q" defaultValue={q} placeholder="Ciudad, provincia, país, tipo..."
                     className="border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo</label>
              <select name="type" defaultValue={type} className="border rounded px-3 py-2">
                <option value="">Todos</option>
                <option value="concert">Concierto</option>
                <option value="festival">Festival</option>
                <option value="promo">Promo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Rango</label>
              <select name="past" defaultValue={past ? '1' : ''} className="border rounded px-3 py-2">
                <option value="">Futuras</option>
                <option value="1">Pasadas</option>
              </select>
            </div>
            <button className="btn">Aplicar</button>
          </form>

          {/* Mapa */}
          <div className="mb-4">
            <ActivitiesMap
              points={(acts || [])
                .filter((a) => Number.isFinite((a as any).lat) && Number.isFinite((a as any).lng))
                .map((a: any) => ({
                  id: a.id,
                  lat: a.lat,
                  lng: a.lng,
                  date: a.date,
                  status: a.status,
                  type: a.type,
                  href: `/actividades/actividad/${a.id}`,
                }))}
              height={320}
            />
          </div>

          {/* Listado */}
          <div className="divide-y divide-gray-200">
            {(acts || []).map((ac: any) => (
              <Link key={ac.id} href={`/actividades/actividad/${ac.id}`}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{labelType(ac.type)}</div>
                  <div className="text-sm text-gray-600">
                    {stateBadge(ac.status)} · {ac.date ? new Date(ac.date).toLocaleDateString() : 'Sin fecha'}
                    {' · '}
                    {[ac.municipality, ac.province, ac.country].filter(Boolean).join(', ')}
                  </div>
                </div>
                {/* Avatar de artista para vista “todas” */}
                {ac.artists?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ac.artists.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border" />
                ) : null}
              </Link>
            ))}
            {!acts?.length && <div className="text-sm text-gray-500 py-3">No hay actividades con estos filtros.</div>}
          </div>

          <SavedToast show={searchParams?.saved === '1'} />
        </ModuleCard>
      )}
    </div>
  )
}

function labelType(t?: string | null) {
  if (!t) return 'Actividad'
  return t === 'concert' ? 'Concierto' : t
}
function stateBadge(s?: string | null) {
  if (s === 'confirmed') return 'Confirmado'
  if (s === 'hold') return 'Reserva'
  return 'Borrador'
}
