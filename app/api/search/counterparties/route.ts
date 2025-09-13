import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const includeCompanies = url.searchParams.get('companies') === '1'
  const s = createSupabaseServer()

  // Cargamos un listado amplio para filtrar en cliente
  const [cp, gc] = await Promise.all([
    s.from('counterparties')
      .select('id, legal_name, nick, logo_url, tax_id')
      .limit(1000)
      .order('legal_name', { ascending: true }),
    includeCompanies
      ? s.from('group_companies')
          .select('id, name, nick, logo_url')
          .order('name', { ascending: true })
      : Promise.resolve({ data: [] as any[] } as any),
  ])

  const rows = [
    ...(cp.data || []).map((c: any) => ({
      id: c.id,
      label: c.nick || c.legal_name,
      sub: c.tax_id || c.legal_name,
      logo_url: c.logo_url,
      kind: 'counterparty' as const,
    })),
    ...(gc.data || []).map((c: any) => ({
      id: c.id,
      label: c.nick || c.name,
      sub: c.name,
      logo_url: c.logo_url,
      kind: 'company' as const,
    })),
  ]

  return NextResponse.json(rows)
}
