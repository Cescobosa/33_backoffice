import Link from 'next/link'
import ModuleCard from '@/components/ModuleCard'
import { createSupabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function TicketingList({
  searchParams,
}: {
  searchParams: { q?: string; state?: 'all'|'upcoming'|'onsale'|'past' }
}) {
  const s = createSupabaseServer()
  const { data: rows } = await s
    .from('v_activity_ticket_rollup')
    .select('activity_id, enabled, on_sale_at, announcement_at, total_capacity_for_sale, sold_total, last_report_date')
  // Aquí puedes añadir filtros por fecha/estado con activities.date
  const acts = rows || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Venta de entradas</h1>
        <Link href="/entradas/report" className="btn">+ Añadir datos de venta</Link>
      </div>

      <ModuleCard title="Listado">
        <div className="divide-y divide-gray-200">
          {acts.map((r: any) => (
            <div key={r.activity_id} className="py-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Actividad {r.activity_id}</div>
                <Link href={`/actividades/actividad/${r.activity_id}`} className="btn-secondary">Abrir</Link>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                A la venta: {r.enabled ? 'Sí' : 'No'} · Capacidad: {r.total_capacity_for_sale} · Vendidas: {r.sold_total}
              </div>
            </div>
          ))}
          {!acts.length && <div className="text-sm text-gray-500">Sin actividades con venta de entradas.</div>}
        </div>
      </ModuleCard>
    </div>
  )
}
