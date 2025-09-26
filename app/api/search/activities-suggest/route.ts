import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ artists: [], counterparties: [] })

  const like = `%${q}%`
  const s = createSupabaseServer()

  const [aRes, cRes] = await Promise.all([
    s.from('artists')
      .select('id, stage_name, avatar_url, search_text')
      .or(`stage_name.ilike.${like},search_text.ilike.${like}`)
      .order('stage_name', { ascending: true })
      .limit(8),
    s.from('counterparties')
      .select('id, nick, legal_name, logo_url, search_text')
      .or(`nick.ilike.${like},legal_name.ilike.${like},search_text.ilike.${like}`)
      .order('legal_name', { ascending: true })
      .limit(8),
  ])

  const artists = (aRes.data || []).map(a => ({ id: a.id, name: a.stage_name, avatar_url: a.avatar_url }))
  const counterparties = (cRes.data || []).map(c => ({ id: c.id, label: c.nick || c.legal_name, logo_url: c.logo_url }))

  return NextResponse.json({ artists, counterparties })
}
