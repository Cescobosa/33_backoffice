import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const bulk = url.searchParams.get('bulk') === '1'
  const includeCompanies = url.searchParams.get('companies') === '1'

  const s = createSupabaseServer()

  // Terceros
  let cQ = s.from('counterparties')
    .select('id, legal_name, nick, is_company, logo_url, tax_id, search_text')
    .order('legal_name', { ascending: true })

  if (q && !bulk) {
    const like = `%${q}%`
    cQ = cQ.or(`legal_name.ilike.${like},nick.ilike.${like},tax_id.ilike.${like},search_text.ilike.${like}`)
  }
  const cp = await cQ.limit(bulk ? 1000 : 100)
  if (cp.error) return NextResponse.json({ error: cp.error.message }, { status: 400 })

  // Empresas del grupo (opcional)
  let gcRows: any[] = []
  if (includeCompanies) {
    const gc = await s.from('group_companies').select('id, name, nick, logo_url').order('name', { ascending: true })
    if (gc.error) return NextResponse.json({ error: gc.error.message }, { status: 400 })
    gcRows = gc.data || []
  }

  if (!bulk) {
    return NextResponse.json((cp.data || []).map((c: any) => ({
      id: c.id, legal_name: c.legal_name, nick: c.nick, is_company: c.is_company, logo_url: c.logo_url, photo_url: c.logo_url
    })))
  }

  // Para el CounterpartyPicker (masivo para filtrar en cliente)
  const rows = [
    ...(cp.data || []).map((c: any) => ({
      id: c.id,
      label: c.nick || c.legal_name,
      sub: c.legal_name,
      logo_url: c.logo_url,
      kind: 'counterparty' as const,
    })),
    ...gcRows.map((c: any) => ({
      id: c.id,
      label: c.nick || c.name,
      sub: c.name,
      logo_url: c.logo_url,
      kind: 'company' as const,
    })),
  ]

  return NextResponse.json(rows)
}
