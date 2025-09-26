import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ items: [] })

  const like = `%${q}%`
  const s = createSupabaseServer()

  const { data, error } = await s
    .from('counterparties')
    .select('id, nick, legal_name, logo_url, search_text')
    .or(`nick.ilike.${like},legal_name.ilike.${like},search_text.ilike.${like}`)
    .order('legal_name', { ascending: true })
    .limit(12)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const items = (data || []).map((c) => ({
    id: c.id,
    label: c.nick || c.legal_name,
    logo_url: c.logo_url,
  }))

  return NextResponse.json({ items })
}
