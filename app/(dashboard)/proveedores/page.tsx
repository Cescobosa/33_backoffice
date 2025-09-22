import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ProvidersAliasPage() {
  // Ruta legado → sección unificada
  redirect('/terceros')
}
