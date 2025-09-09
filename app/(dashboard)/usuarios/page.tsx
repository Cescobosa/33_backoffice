// app/(dashboard)/usuarios/page.tsx
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabaseServer'
import UserCreate from '@/components/UserCreate'

export const dynamic = 'force-dynamic'

type Dept = { id: string; name: string }

export default async function UsersPage() {
  const s = createSupabaseServer()

  // Departamentos para el selector
  const { data: departments, error: deptErr } = await s
    .from('departments')
    .select('id, name')
    .order('name', { ascending: true })

  if (deptErr) {
    throw new Error(deptErr.message)
  }

  // ===== Server Action =====
  async function createUser(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const full_name = String(formData.get('full_name') || '').trim()
    const nick = String(formData.get('nick') || '').trim() || null
    const department_id = String(formData.get('department_id') || '') || null
    const is_admin = formData.get('is_admin') === 'on'

    if (!email) throw new Error('Email obligatorio')

    // Crea el usuario en Auth (admin) y marca email como verificado
    const { data: created, error: authErr } = await s.auth.admin.createUser({
      email,
      password: password || crypto.randomUUID(), // si no mandan password, generamos una
      email_confirm: true,
    })
    if (authErr) throw new Error(authErr.message)

    const authId = created.user?.id
    if (!authId) throw new Error('No se pudo crear el usuario en Auth')

    // Organización (usamos la primera)
    const org = await s.from('organizations').select('id').limit(1).single()
    if (org.error) throw new Error(org.error.message)

    // Inserta profile
    const { error: profErr } = await s.from('profiles').insert({
      id: authId,
      organization_id: org.data.id,
      full_name,
      nick,
      email,
      department_id: department_id || null,
      is_admin,
    })
    if (profErr) throw new Error(profErr.message)

    revalidatePath('/usuarios')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>

      {/* Botón + formulario (el despliegue lo maneja el componente cliente) */}
      <UserCreate actionCreate={createUser} departments={(departments as Dept[]) || []} />
    </div>
  )
}
