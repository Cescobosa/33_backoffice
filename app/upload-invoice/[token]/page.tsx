// app/upload-invoice/[token]/page.tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { ensurePublicBucket } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PageProps = {
  params: { token: string }
  searchParams?: { ok?: string }
}

export default async function UploadInvoicePage({ params, searchParams }: PageProps) {
  const s = createSupabaseServer()

  // 1) Localiza el gasto por token
  const res = await s
    .from('activity_expenses')
    .select('id, activity_id, concept, file_url')
    .eq('upload_token', params.token)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  if (!res.data) notFound()

  // 2) Saca constantes NO anulables para usarlas dentro de la Server Action
  const expenseId: string = String(res.data.id)
  const activityId: string = String(res.data.activity_id)
  const currentFileUrl: string | null = res.data.file_url ?? null

  // 3) Server Action: subir archivo y actualizar fila
  async function uploadInvoice(formData: FormData) {
    'use server'
    const s = createSupabaseServer()

    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      throw new Error('Archivo requerido')
    }

    // Asegura bucket público
    await ensurePublicBucket('invoices')

    // Nombre seguro y ruta dentro del bucket
    const safeName = (file.name || 'factura.pdf').replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${activityId}/${expenseId}_${Date.now()}_${safeName}`

    // Sube al bucket "invoices"
    const up = await s.storage.from('invoices').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
    if (up.error) throw new Error(up.error.message)

    // URL pública
    const pub = s.storage.from('invoices').getPublicUrl(up.data.path)
    const file_url = pub.data.publicUrl

    // Actualiza la fila del gasto
    const upd = await s
      .from('activity_expenses')
      .update({
        file_url,
        // Si usáis estados, ajusta este valor a vuestro enum/validación
        billing_status: 'uploaded',
      })
      .eq('id', expenseId)

    if (upd.error) throw new Error(upd.error.message)

    // Vuelve a esta misma página con confirmación
    redirect(`/upload-invoice/${params.token}?ok=1`)
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <h1 className="text-xl font-semibold mb-1">Subir factura</h1>
      <p className="text-sm text-gray-600 mb-6">
        Gasto <span className="font-mono">{expenseId.slice(0, 8)}…</span> · Actividad{' '}
        <span className="font-mono">{activityId.slice(0, 8)}…</span>
      </p>

      {currentFileUrl ? (
        <div className="mb-6">
          <p className="text-sm mb-2">Factura actual:</p>
          <a href={currentFileUrl} target="_blank" className="underline break-all">
            {currentFileUrl}
          </a>
        </div>
      ) : null}

      <form action={uploadInvoice} className="space-y-4">
        <div>
          <input
            type="file"
            name="file"
            accept="application/pdf,image/*"
            className="block w-full text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Acepta PDF o imagen.</p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn">Subir</button>
          <Link href="/" className="btn-secondary">
            Volver
          </Link>
        </div>
      </form>

      {searchParams?.ok === '1' && (
        <p className="mt-4 text-green-700 text-sm">Cambio guardado.</p>
      )}
    </div>
  )
}
