'use server'

import { revalidatePath } from 'next/cache'

/**
 * Revalida rutas comunes del backoffice para que los cambios
 * se reflejen inmediatamente en listados y fichas.
 * Puedes pasar rutas extra (p.ej. de detalle concreto).
 */
export async function revalidateApp(extraPaths: string[] = []) {
  const base = [
    '/', '/dashboard',
    '/artistas', '/terceros', '/actividades', '/empresas', '/empresas-del-grupo',
  ]
  const uniq = Array.from(new Set([...base, ...extraPaths]))
  for (const p of uniq) {
    try { revalidatePath(p) } catch { /* no-op */ }
  }
}
