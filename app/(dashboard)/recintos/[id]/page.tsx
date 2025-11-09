// app/(dashboard)/recintos/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ModuleCard from '@/components/ModuleCard'
import SavedToast from '@/components/SavedToast'
import ViewEditModule from '@/components/ViewEditModule'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { 
  updateVenueBasic, addVenueCapacity, deleteVenueCapacity,
  addVenueContact, deleteVenueContact, addVenueComment, deleteVenueComment,
  addVenueFile, deleteVenueFile
} from '@/app/(dashboard)/recintos/actions'
import ActivityListItem, { ActivityListModel } from '@/components/ActivityListItem'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Venue = {
  id: string
  name: string | null
  address: string | null
  photo_url: string | null
  website: string | null
  indoor: boolean | null
  lat: number | null
  lng: number | null
}

export default async function VenueDetailPage({ params, searchParams }: { params: { id: string }, searchParams?: { saved?: string } }) {
  const s = createSupabaseServer()
  const saved = searchParams?.saved === '1'
  const { data, error } = await s.from('venues').select('*').eq('id', params.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) notFound()
  const v = data as Venue

  const [{ data: capacities }, { data: contacts }, { data: files }, { data: comments }] = await Promise.all([
    s.from('venue_capacities').select('id, name, capacity').eq('venue_id', v.id).order('name'),
    s.from('venue_contacts').select('id, company_name, contact_name, phone, email, role').eq('venue_id', v.id).order('company_name'),
    s.from('venue_files').select('id, title, file_url, created_at').eq('venue_id', v.id).order('created_at', { ascending: false }),
    s.from('venue_comments').select('id, content, created_at').eq('venue_id', v.id).order('created_at', { ascending: false }),
  ])

  const actsRes = await s
    .from('activities')
    .select(`
      id, type, status, date, municipality, province, country, lat, lng,
      artist_id, company_id,
      artists:artist_id (id, stage_name, avatar_url)
    `)
    .eq('venue_id', v.id)
    .order('date', { ascending: false })

  const activities = (actsRes.data || []).map((a: any) => ({
    id: a.id, type: a.type, status: a.status, date: a.date, municipality: a.municipality,
    province: a.province, country: a.country, lat: a.lat, lng: a.lng,
    artist: a.artists ? { id: a.artists.id, stage_name: a.artists.stage_name, avatar_url: a.artists.avatar_url } : null,
  })) as ActivityListModel[]

  const hasMap = v.lat != null && v.lng != null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.photo_url || '/logo.png'} alt="" className="h-10 w-10 rounded object-cover border" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{v.name}</h1>
            {v.address && <div className="text-sm text-gray-600 truncate">{v.address}</div>}
          </div>
        </div>
        <Link href="/recintos" className="btn-secondary">Volver</Link>
      </div>

      <ModuleCard title="Datos básicos">
        <ViewEditModule
          title="Datos del recinto"
          isEmpty={false}
          action={async (fd: FormData) => { 'use server'; await updateVenueBasic(v.id, fd) }}
          childrenView={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <div><span className="text-gray-500">Nombre:</span> {v.name || '—'}</div>
                <div><span className="text-gray-500">Dirección:</span> {v.address || '—'}</div>
                {v.indoor != null && <div><span className="text-gray-500">Tipo:</span> {v.indoor ? 'Interior' : 'Exterior'}</div>}
                {v.website && <div><span className="text-gray-500">Web:</span> <a className="underline" href={v.website} target="_blank">{v.website}</a></div>}
              </div>
              <div>
                {hasMap && (
                  <div className="mt-2">
                    <iframe
                      className="w-full h-48 rounded border"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps?q=${v.lat},${v.lng}&z=16&output=embed`}
                    />
                  </div>
                )}
              </div>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.photo_url || '/logo.png'} alt="" className="h-32 w-48 object-cover rounded border" />
              </div>
            </div>
          }
          childrenEdit={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" encType="multipart/form-data">
              <div>
                <label className="block text-sm mb-1">Nombre</label>
                <input name="name" defaultValue={v.name || ''} className="w-full border rounded px-2 py-1" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Dirección completa</label>
                <input name="address" defaultValue={v.address || ''} className="w-full border rounded px-2 py-1" />
                <p className="text-xs text-gray-500 mt-1">La ubicación se recalculará automáticamente si cambias la dirección.</p>
              </div>
              <div>
                <label className="block text-sm mb-1">Web</label>
                <input name="website" defaultValue={v.website || ''} className="w-full border rounded px-2 py-1" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Nueva foto (PNG/JPG)</label>
                <input type="file" name="photo" accept="image/png,image/jpeg" className="w-full text-sm" />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="indoor" name="indoor" type="checkbox" defaultChecked={!!v.indoor} />
                <label htmlFor="indoor" className="text-sm">Es interior (indoor)</label>
              </div>
            </div>
          }
        />
      </ModuleCard>

      {/* Aforos */}
      <ModuleCard title="Aforos">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-[#008aa4] mb-2">Configurados</h3>
            <ul className="divide-y">
              {(capacities || []).map((c: any) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <div className="text-sm">{c.name}: <span className="font-medium">{c.capacity}</span></div>
                  <form action={async () => { 'use server'; await deleteVenueCapacity(v.id, c.id) }}>
                    <button className="text-red-600 text-sm hover:underline">Eliminar</button>
                  </form>
                </li>
              ))}
              {(!capacities || capacities.length === 0) && <li className="py-2 text-sm text-gray-500">—</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[#008aa4] mb-2">+ Añadir aforo</h3>
            <form action={async (fd: FormData) => { 'use server'; await addVenueCapacity(v.id, fd) }} className="space-y-2">
              <div>
                <label className="block text-sm mb-1">Nombre</label>
                <input name="cap_name" className="w-full border rounded px-2 py-1" placeholder="p.ej. Pista, Sentado, etc." />
              </div>
              <div>
                <label className="block text-sm mb-1">Aforo</label>
                <input name="cap_value" type="number" className="w-full border rounded px-2 py-1" />
              </div>
              <button className="btn">Añadir</button>
            </form>
          </div>
        </div>
      </ModuleCard>

      {/* Contactos */}
      <ModuleCard title="Contactos">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-[#008aa4] mb-2">Existentes</h3>
            <ul className="divide-y">
              {(contacts || []).map((c: any) => (
                <li key={c.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{c.company_name || '—'}</div>
                      <div className="text-gray-600">{c.contact_name || '—'}{c.role ? ` · ${c.role}` : ''}</div>
                      <div className="text-xs text-gray-600">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
                    </div>
                    <form action={async () => { 'use server'; await deleteVenueContact(v.id, c.id) }}>
                      <button className="text-red-600 text-sm hover:underline">Eliminar</button>
                    </form>
                  </div>
                </li>
              ))}
              {(!contacts || contacts.length === 0) && <li className="py-2 text-sm text-gray-500">—</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[#008aa4] mb-2">+ Añadir contacto</h3>
            <form action={async (fd: FormData) => { 'use server'; await addVenueContact(v.id, fd) }} className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Nombre (empresa)</label>
                <input name="company_name" className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm mb-1">Persona de contacto</label>
                <input name="contact_name" className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm mb-1">Cargo</label>
                <input name="role" className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm mb-1">Teléfono</label>
                <input name="phone" className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input type="email" name="email" className="w-full border rounded px-2 py-1" />
              </div>
              <div className="md:col-span-2">
                <button className="btn">Añadir contacto</button>
              </div>
            </form>
          </div>
        </div>
      </ModuleCard>

      {/* Adjuntos */}
      <ModuleCard title="Adjuntos">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-[#008aa4] mb-2">Documentos</h3>
            <ul className="divide-y">
              {(files || []).map((f: any) => (
                <li key={f.id} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{f.title}</div>
                    <a href={f.file_url} target="_blank" className="text-xs text-gray-600 underline break-all">{f.file_url}</a>
                  </div>
                  <form action={async () => { 'use server'; await deleteVenueFile(v.id, f.id) }}>
                    <button className="text-red-600 text-sm hover:underline">Eliminar</button>
                  </form>
                </li>
              ))}
              {(!files || files.length === 0) && <li className="py-2 text-sm text-gray-500">—</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[#008aa4] mb-2">+ Subir documento</h3>
            <form action={async (fd: FormData) => { 'use server'; await addVenueFile(v.id, fd) }} className="space-y-2">
              <div>
                <label className="block text-sm mb-1">Título</label>
                <input name="title" className="w-full border rounded px-2 py-1" placeholder="Plano, contrato, etc." />
              </div>
              <div>
                <input type="file" name="file" className="block w-full text-sm" accept="application/pdf,image/*" />
                <p className="text-xs text-gray-500 mt-1">Acepta PDF o imagen.</p>
              </div>
              <button className="btn">Subir</button>
            </form>
          </div>
        </div>
      </ModuleCard>

      {/* Comentarios */}
      <ModuleCard title="Comentarios">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <ul className="space-y-3">
              {(comments || []).map((c: any) => (
                <li key={c.id} className="border rounded p-2 bg-blue-50">
                  <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                    <div>{new Date(c.created_at).toLocaleString('es-ES')}</div>
                    <form action={async () => { 'use server'; await deleteVenueComment(v.id, c.id) }}>
                      <button className="text-red-600 hover:underline">Eliminar</button>
                    </form>
                  </div>
                </li>
              ))}
              {(!comments || comments.length === 0) && <li className="text-sm text-gray-500">—</li>}
            </ul>
          </div>
          <div>
            <form action={async (fd: FormData) => { 'use server'; await addVenueComment(v.id, fd) }} className="space-y-2">
              <div>
                <label className="block text-sm mb-1">+ Añadir comentario</label>
                <textarea name="content" className="w-full border rounded px-2 py-1 h-32" />
              </div>
              <button className="btn">Guardar comentario</button>
            </form>
          </div>
        </div>
      </ModuleCard>

      <SavedToast show={saved} />
    </div>
  )
}
