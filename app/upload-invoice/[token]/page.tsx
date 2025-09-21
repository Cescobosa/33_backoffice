import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function UploadInvoicePage({ params }: { params: { token: string } }) {
  const s = createSupabaseServer()
  const { data: exp, error } = await s.from('activity_expenses').select('id, activity_id').eq('invoice_request_token', params.token).maybeSingle()
  if (error) throw new Error(error.message)
  if (!exp) notFound()

  async function uploadAction(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const file = formData.get('file') as File | null
    if (!file || file.size===0) throw new Error('Archivo requerido')
    await ensurePublicBucket('invoices')
    const path = `invoices/${exp.activity_id}/${exp.id}_${Date.now()}_${file.name}`
    const up = await s.storage.from('invoices').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/pdf' })
    if (up.error) throw new Error(up.error.message)
    const pub = s.storage.from('invoices').getPublicUrl(up.data.path)

    const { error } = await s.from('activity_expenses').update({
      file_url: pub.data.publicUrl, billing_status: 'invoiced'
    }).eq('id', exp.id)
    if (error) throw new Error(error.message)
    revalidatePath(`/actividades/actividad/${exp.activity_id}`)
    redirect('/gracias')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form action={uploadAction} className="border rounded p-6 space-y-3">
        <h1 className="text-xl font-semibold">Subir factura/ticket</h1>
        <input type="file" name="file" accept="application/pdf,image/*" />
        <button className="btn">Subir</button>
      </form>
    </div>
  )
}
