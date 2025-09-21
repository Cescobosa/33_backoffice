'use server'
import { revalidatePath } from 'next/cache'

export async function revalidateApp(extraPaths: string[] = []) {
  const base = [
    '/', '/dashboard',
    '/artistas', '/terceros', '/actividades', '/empresas', '/entradas', '/usuarios',
  ]
  const uniq = Array.from(new Set([...base, ...extraPaths]))
  for (const p of uniq) {
    try { revalidatePath(p) } catch { /* no-op */ }
  }
}
