import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = createSupabaseServer()
  const { data, error } = await s
    .from('fiscal_identities')
    .select('id, fiscal_name, tax_id')
    .eq('owner_type', 'counterparty')
    .eq('owner_id', params.id)
    .order('fiscal_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ companies: data || [] })
}
