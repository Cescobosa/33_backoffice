import { createSupabaseServer } from '@/lib/supabaseServer'
import UserCreate from '@/components/UserCreate'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const s = createSupabaseServer()

  const { data: org } = await s.from('organizations').select('id,name').limit(1).single()
  const { data: departments } = await s.from('departments').select('id,name').order('name')
  const { data: profiles } = await s
    .from('profiles')
    .select('id, full_name, nick, email, is_admin, departments(id,name)')
    .order('created_at', { ascending: false })

  async function createUser(formData: FormData) {
    'use server'
    const { createSupabaseAdmin } = await import('@/lib/supabaseAdmin')
    const admin = createSupabaseAdmin()
    const server = createSupabaseServer()

    const email = String(formData.get('email') || '').trim()
    const full_name = String(formData.get('full_name') || '').trim()
    const nick = String(formData.get('nick') || '').trim() || null
    const department_id = String(formData.get('department_id') || '') || null
    const is_admin = formData.get('is_admin') === 'on'

    if (!email) throw new Error('Email requerido')
    const res = await admin.auth.admin.createUser({
      email,
      email_confirm: true
    })
    if (res.error || !res.data.user) throw new Error(res.error?.message || 'Error creando usuario')

    const { error: pErr } = await server.from('profiles').insert({
      id: res.data.user.id,
      organization_id: org!.id,
      full_name,
      nick,
      email,
      department_id: department_id || null,
      is_admin
    })
    if (pErr) throw new Error(pErr.message)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        {/* Botón que despliega el formulario */}
        {/* @ts-expect-error Server Action prop */}
        <UserCreate actionCreate={createUser} departments={departments || []} />
      </div>

      <div className="border rounded divide-y divide-gray-200">
        {(profiles || []).map(p => (
          <div key={p.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.nick || p.full_name || p.email}</div>
              <div className="text-xs text-gray-600">{p.email} · {p.departments?.name || 'Sin departamento'}</div>
            </div>
            {p.is_admin && <span className="badge">Admin</span>}
          </div>
        ))}
        {!profiles?.length && <div className="p-3 text-sm text-gray-500">Aún no hay usuarios.</div>}
      </div>
    </div>
  )
}
