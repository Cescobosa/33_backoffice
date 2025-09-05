import { createSupabaseServer } from './supabaseServer'

export async function ensurePublicBucket(name: string) {
  const supabase = createSupabaseServer()
  const { data: bucket } = await supabase.storage.getBucket(name)
  if (bucket) return
  const { error } = await supabase.storage.createBucket(name, { public: true })
  if (error) throw new Error(`No se pudo crear bucket ${name}: ${error.message}`)
}
