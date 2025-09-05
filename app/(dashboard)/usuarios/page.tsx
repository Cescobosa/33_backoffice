import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const s = createSupabaseServer()
  const { data: depts } = await s.from('departments').select('id,name,organization_id').order('name')
  const { data: scopes } = await s.from('permission_scopes').select('id,key,label,category,field_level').order('category').order('label')
  const { data: perms } = await s.from('role_permissions').select('id,department_id,scope_id,allow_read,allow_edit,allow_manage')

  async function toggle(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const department_id = String(formData.get('department_id') || '')
    const scope_id = String(formData.get('scope_id') || '')
    const field = String(formData.get('field') || 'allow_read')
    const value = formData.get('value') === '1'
    // upsert
    const existing = await s.from('role_permissions').select('id').eq('department_id', department_id).eq('scope_id', scope_id).maybeSingle()
    if (existing.data) {
      await s.from('role_permissions').update({ [field]: value }).eq('id', existing.data.id)
    } else {
      await s.from('role_permissions').insert({ department_id, scope_id, [field]: value })
    }
  }

  const mapPerm = new Map<string, any>()
  perms?.forEach(p => mapPerm.set(`${p.department_id}:${p.scope_id}`, p))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios & Permisos</h1>
      <div className="text-sm text-gray-600">Matriz visible (sin enforcement por ahora). Se autocompleta con nuevas funcionalidades.</div>

      {depts?.map(d => (
        <div key={d.id} className="border rounded-md">
          <div className="px-3 py-2 font-medium bg-gray-50">{d.name}</div>
          <div className="overflow-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Scope</th>
                  <th className="p-2">Ver</th>
                  <th className="p-2">Editar</th>
                  <th className="p-2">Gestionar</th>
                </tr>
              </thead>
              <tbody>
                {scopes?.map(scp => {
                  const key = `${d.id}:${scp.id}`
                  const p = mapPerm.get(key) || { allow_read:false, allow_edit:false, allow_manage:false }
                  return (
                    <tr key={scp.id} className="border-t">
                      <td className="p-2">{scp.category} · {scp.label} {scp.field_level ? <span className="badge badge-yellow ml-2">Campo</span> : null}</td>
                      {(['allow_read','allow_edit','allow_manage'] as const).map(f => (
                        <td key={f} className="text-center">
                          <form action={toggle}>
                            <input type="hidden" name="department_id" value={d.id} />
                            <input type="hidden" name="scope_id" value={scp.id} />
                            <input type="hidden" name="field" value={f} />
                            <input type="hidden" name="value" value={p[f] ? '0' : '1'} />
                            <button className="btn-secondary">{p[f] ? '✓' : '—'}</button>
                          </form>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
