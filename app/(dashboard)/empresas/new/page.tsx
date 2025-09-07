import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default function NewCompanyPage() {
  async function createCompany(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const nick = String(formData.get('nick') || '').trim() || null
    const name = String(formData.get('name') || '').trim()
    if (!name) throw new Error('Nombre requerido')
    const ins = await s.from('group_companies').insert({ nick, name }).select('id').single()
    if (ins.error) throw new Error(ins.error.message)
    redirect(`/empresas/${ins.data.id}`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nueva empresa</h1>
      <form action={createCompany} className="border rounded p-3 space-y-3">
        <div>
          <label className="block text-sm mb-1">Nick (opcional)</label>
          <input name="nick" className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Nombre *</label>
          <input name="name" required className="w-full border rounded px-3 py-2" />
        </div>
        <button className="btn">Crear</button>
      </form>
    </div>
  )
}
