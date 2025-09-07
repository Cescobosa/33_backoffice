import { createSupabaseServer } from '@/lib/supabaseServer'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { ensurePublicBucket } from '@/lib/storage'

export default async function UsersPage() {
  const s = createSupabaseServer()
  const { data: org } = await s.from('organizations').select('id,name').limit(1).single()
  const { data: depts } = await s.from('departments').select('id,name').order('name')
  const { data: profiles } = await s.from('profiles').select('id, full_name, nick, email, avatar_url, is_admin').order('created_at', { ascending: false }).limit(50)

  async function createUser(formData: FormData) {
    'use server'
    // 1) Crear usuario de auth (requiere service role)
    const admin = createSupabaseAdmin()
    const email = String(formData.get('email') || '').trim()
    if (!email) throw new Error('Email requerido')

    const full_name = String(formData.get('full_name') || '').trim() || null
    const nick = String(formData.get('nick') || '').trim() || null
    const department_id = String(formData.get('department_id') || '') || null
    const is_admin = formData.get('is_admin') === 'on'

    const resp = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (resp.error) throw new Error(resp.error.message)
    const userId = resp.data.user!.id

    // 2) Subir avatar si llega
    const server = createSupabaseServer()
    let avatar_url: string | null = null
    const avatar = formData.get('avatar') as File | null
    if (avatar && avatar.size > 0) {
      await ensurePublicBucket('avatars')
      const path = `users/${userId}`
      const up = await server.storage.from('avatars').upload(path, avatar, { cacheControl: '3600', upsert: true, contentType: avatar.type || 'image/*' })
      if (up.error) throw new Error(up.error.message)
      const pub = server.storage.from('avatars').getPublicUrl(up.data.path)
      avatar_url = pub.data.publicUrl
    }

    // 3) Insertar perfil
    const { error } = await server.from('profiles').insert({
      id: userId,
      organization_id: org!.id,
      full_name,
      nick,
      email,
      department_id: department_id || null,
      is_admin,
      avatar_url
    })
    if (error) throw new Error(error.message)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
      </div>

      <form action={createUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><label className="block text-sm mb-1">Foto</label><input type="file" name="avatar" accept="image/*" /></div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">Email *</label><input name="email" required className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm mb-1">Nick</label><input name="nick" className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm mb-1">Nombre completo</label><input name="full_name" className="w-full border rounded px-3 py-2" /></div>
        <div>
          <label className="block text-sm mb-1">Departamento</label>
          <select name="department_id" className="w-full border rounded px-3 py-2">
            <option value="">–</option>
            {(depts || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2"><input type="checkbox" id="is_admin" name="is_admin" /><label htmlFor="is_admin">Administrador</label></div>
        <div className="md:col-span-3"><button className="btn">+ Crear usuario</button></div>
      </form>

      <div className="border rounded">
        <div className="px-3 py-2 font-medium">Usuarios recientes</div>
        <div className="divide-y divide-gray-200">
          {(profiles || []).map(u => (
            <div key={u.id} className="px-3 py-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.avatar_url || '/avatar.png'} className="w-8 h-8 rounded-full border object-cover" alt="" />
              <div className="flex-1">
                <div className="font-medium">{u.nick || u.full_name || u.email}</div>
                <div className="text-xs text-gray-600">{u.email} {u.is_admin && <span className="ml-1 badge badge-green">admin</span>}</div>
              </div>
            </div>
          ))}
          {!profiles?.length && <div className="px-3 py-4 text-sm text-gray-500">Aún no hay usuarios.</div>}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Nota: para crear usuarios es necesario definir la variable de entorno <code>SUPABASE_SERVICE_ROLE_KEY</code> en Vercel.
      </p>
    </div>
  )
}
