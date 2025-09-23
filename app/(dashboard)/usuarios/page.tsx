import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import SavedToast from '@/components/SavedToast'

export const dynamic = 'force-dynamic'

export default async function UsersPage({ searchParams }: { searchParams?: { saved?: string } }) {
  const showSaved = searchParams?.saved === '1'
  const s = createSupabaseServer()

  const { data: departments, error: deptErr } = await s
    .from('departments')
    .select('id, name')
    .order('name')
  if (deptErr) throw new Error(deptErr.message)

  const { data: users, error: usersErr } = await s
    .from('profiles')
    .select('id, full_name, nick, email, avatar_url, is_admin, departments:department_id(name)')
    .order('full_name', { ascending: true })
  if (usersErr) throw new Error(usersErr.message)

  async function createUser(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const full_name = String(formData.get('full_name') || '').trim()
    const nick = String(formData.get('nick') || '').trim() || null
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const department_id = String(formData.get('department_id') || '') || null
    const is_admin = formData.get('is_admin') === 'on'

    if (!full_name || !email) throw new Error('Nombre y email requeridos')

    // 1) Crear usuario en Auth (requiere SERVICE ROLE en el servidor)
    const { data: created, error: authErr } = await s.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (authErr) throw new Error(authErr.message)
    const authId = created.user?.id
    if (!authId) throw new Error('No se pudo crear el usuario en Auth')

    // 2) Vincular perfil a la organización
    const { data: org, error: orgErr } = await s.from('organizations').select('id').limit(1).single()
    if (orgErr) throw new Error(orgErr.message)

    const { error: profErr } = await s.from('profiles').insert({
      id: authId,
      organization_id: org.id,
      full_name,
      nick,
      email,
      department_id: department_id || null,
      is_admin,
    })
    if (profErr) throw new Error(profErr.message)

    // 3) Revalidar y redirigir (sin devolver objetos al formulario)
    revalidatePath('/usuarios')
    redirect('/usuarios?saved=1')
  }

  return (
    <div className="space-y-6">
      <SavedToast show={showSaved} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>

        <details className="relative">
          <summary className="btn">+ Añadir usuario</summary>
          <div className="absolute right-0 mt-2 w-[28rem] border rounded bg-white shadow p-4 z-10">
            <form action={createUser} className="space-y-3">
              <div>
                <div className="text-sm mb-1">Nombre completo</div>
                <input name="full_name" className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <div className="text-sm mb-1">Nick</div>
                <input name="nick" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <div className="text-sm mb-1">Email</div>
                <input type="email" name="email" className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <div className="text-sm mb-1">Departamento</div>
                <select name="department_id" className="w-full border rounded px-3 py-2">
                  <option value="">(sin departamento)</option>
                  {(departments || []).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_admin" /> Administrador
              </label>
              <div className="flex gap-2">
                <button className="btn">Crear</button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => (location.href = '/usuarios')}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </details>
      </div>

      <div className="border rounded divide-y">
        {(users || []).map((u: any) => (
          <div key={u.id} className="p-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u.avatar_url || '/avatar.png'}
              className="w-8 h-8 rounded-full border object-cover"
              alt=""
            />
            <div className="grow">
              <div className="font-medium">{u.nick || u.full_name}</div>
              <div className="text-sm text-gray-600">
                {u.email} · {u.departments?.name || 'Sin depto.'}
              </div>
            </div>
            {u.is_admin && <span className="badge badge-green">Admin</span>}
          </div>
        ))}
        {!users?.length && <div className="p-3 text-sm text-gray-500">Aún no hay usuarios.</div>}
      </div>
    </div>
  )
}
