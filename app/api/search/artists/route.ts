// app/api/search/artists/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

function normalize(q: string) {
  return q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const archived = searchParams.get('archived') === '1'

  const s = createSupabaseServer()
  let query = s.from('artists')
    .select('id, stage_name, avatar_url, status')
    .eq('status', archived ? 'archived' : 'active')
    .order('stage_name', { ascending: true })
    .limit(50)

  if (q) {
    const nq = normalize(q)
    query = query.ilike('search_text', `%${nq}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}
