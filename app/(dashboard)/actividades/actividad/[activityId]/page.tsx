import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ModuleCard from '@/components/ModuleCard'
import ViewEditModule from '@/components/ViewEditModule'
import TabEditToolbar from '@/components/TabEditToolbar'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ActivityPage({ params }: { params: { activityId: string } }) {
  const s = createSupabaseServer()

  const { data, error } = await s
    .from('activities')
    .select(`
      id, type, status, date, time,
      municipality, province, country, capacity, pay_kind,
      company_id, artist_id,
      artists:artist_id (id, stage_name, avatar_url),
      company:company_id (id, nick, name, logo_url),
      venues:venue_id (id, name, address)
    `)
    .eq('id', params.activityId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) notFound()

  const a: any = data
  // Normalizar relaciones (Supabase puede tiparlas como array)
  const artist = Array.isArray(a.artists) ? a.artists[0] : a.artists
  const company = Array.isArray(a.company) ? a.company[0] : a.company

  const { data: companies } = await s
    .from('group_companies')
    .select('id, nick, name, logo_url')
    .order('name', { ascending: true })

  // ---------- Server Action (no captura 'a') ----------
  async function saveBasics(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const activityId = String(formData.get('activity_id') || '')
    if (!activityId) throw new Error('activity_id requerido')

    const payload: any = {
      date: formData.get('date') || null,
      time: String(formData.get('time') || ''),
      municipality: String(formData.get('municipality') || ''),
      province: String(formData.get('province') || ''),
      country: String(formData.get('country') || 'España'),
      status: String(formData.get('status') || 'draft'),
      type: String(formData.get('type') || 'concert'),
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      pay_kind: String(formData.get('pay_kind') || 'pay'),
      company_id: String(formData.get('company_id') || '') || null,
    }

    const { error } = await s.from('activities').update(payload).eq('id', activityId)
    if (error) throw new Error(error.message)

    revalidatePath(`/actividades/actividad/${activityId}`)
  }
  // ----------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artist?.avatar_url || '/avatar.png'}
          className="h-10 w-10 rounded-full border object-cover"
          alt=""
        />
        <div>
          <div className="text-xl font-semibold">{artist?.stage_name}</div>
          <div className="text-sm text-gray-600">
            {a.type || 'Actividad'} · {a.date || '—'}
          </div>
        </div>
      </div>

      {/* Botonera para editar/guardar todos los módulos de la pestaña */}
      <TabEditToolbar />

      <ModuleCard title="Datos básicos">
        <ViewEditModule
          title="Datos básicos"
          isEmpty={false}
          action={saveBasics}
          childrenView={
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500">Estado:</span> {a.status || '—'}</div>
              <div><span className="text-gray-500">Tipo:</span> {a.type}</div>
              <div><span className="text-gray-500">Fecha:</span> {a.date || '—'} {a.time ? `· ${a.time}` : ''}</div>
              <div className="md:col-span-3">
                <span className="text-gray-500">Lugar:</span>{' '}
                {[a.municipality, a.province, a.country].filter(Boolean).join(', ') || '—'}
              </div>
              <div><span className="text-gray-500">Aforo:</span> {a.capacity ?? '—'}</div>
              <div><span className="text-gray-500">Pago:</span> {a.pay_kind || '—'}</div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Empresa:</span>
                {company?.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logo_url}
                    className="h-5 w-auto object-contain border rounded bg-white"
                    alt=""
                  />
                )}
                <span>{company?.nick || company?.name || '—'}</span>
              </div>
            </div>
          }
          childrenEdit={
            <div className="grid md:grid-cols-3 gap-3">
              {/* ID oculto para la Server Action */}
              <input type="hidden" name="activity_id" value={a.id} />
              <div>
                <div className="text-sm mb-1">Estado</div>
                <select
                  name="status"
                  defaultValue={a.status || 'draft'}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="draft">Borrador</option>
                  <option value="hold">Reserva</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <div className="text-sm mb-1">Tipo</div>
                <select
                  name="type"
                  defaultValue={a.type || 'concert'}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="concert">Concierto</option>
                  <option value="promo_event">Evento promocional</option>
                  <option value="promotion">Promoción</option>
                  <option value="record_invest">Inversión discográfica</option>
                </select>
              </div>
              <div>
                <div className="text-sm mb-1">Fecha</div>
                <input
                  type="date"
                  name="date"
                  defaultValue={a.date || ''}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <div className="text-sm mb-1">Hora</div>
                <input name="time" defaultValue={a.time || ''} className="border rounded px-3 py-2 w-full" />
              </div>
              <div>
                <div className="text-sm mb-1">Municipio</div>
                <input
                  name="municipality"
                  defaultValue={a.municipality || ''}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <div className="text-sm mb-1">Provincia</div>
                <input
                  name="province"
                  defaultValue={a.province || ''}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <div className="text-sm mb-1">País</div>
                <input
                  name="country"
                  defaultValue={a.country || 'España'}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <div className="text-sm mb-1">Aforo</div>
                <input
                  type="number"
                  name="capacity"
                  defaultValue={a.capacity ?? ''}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <div className="text-sm mb-1">Pago</div>
                <select
                  name="pay_kind"
                  defaultValue={a.pay_kind || 'pay'}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="pay">De pago</option>
                  <option value="free">Gratuito</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <div className="text-sm mb-1">Empresa del grupo</div>
                <div className="flex items-center gap-2">
                  <select name="company_id" defaultValue={a.company_id || ''} className="border rounded px-3 py-2">
                    <option value="">(sin empresa)</option>
                    {(companies || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.nick || c.name}
                      </option>
                    ))}
                  </select>
                  {company?.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={company.logo_url}
                      className="h-6 w-auto object-contain border rounded bg-white"
                      alt=""
                    />
                  )}
                </div>
              </div>
            </div>
          }
        />
      </ModuleCard>

      {/* Aquí podrás seguir añadiendo el resto de módulos/pestañas reutilizando <ViewEditModule /> */}
    </div>
  )
}
