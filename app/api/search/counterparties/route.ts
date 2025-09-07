// app/api/search/counterparties/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

function normalize(q: string) {
  return q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const kind = searchParams.get('kind') === 'provider' ? 'provider' : 'third' // default third

  const s = createSupabaseServer()
  let query = s.from('counterparties')
    .select('id, nick, legal_name, logo_url, status')
    .eq(kind === 'provider' ? 'as_provider' : 'as_third_party', true)
    .eq('status', 'active')
    .order('legal_name', { ascending: true })
    .limit(50)

  if (q) {
    const nq = normalize(q)
    query = query.ilike('search_text', `%${nq}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}
