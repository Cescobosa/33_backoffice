import ModuleCard from '@/components/ModuleCard'
import ViewEditModule from '@/components/ViewEditModule'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'
import ArtistFiscalEditorClient from '@/components/ArtistFiscalEditorClient'

export default async function ArtistFiscalModule({ artistId }: { artistId: string }) {
  const s = createSupabaseServer()

  const { data: artist } = await s.from('artists').select('id, stage_name, is_group').eq('id', artistId).maybeSingle()
  const isGroup = !!artist?.is_group

  const { data: people } = isGroup
    ? await s.from('artist_people').select('id, full_name').eq('artist_id', artistId).order('full_name', { ascending: true })
    : { data: [] as any[] }

  // Cargar identidades fiscales existentes (artist y/o artist_person)
  const { data: fiArtist } = await s
    .from('fiscal_identities')
    .select('*')
    .eq('owner_type', 'artist')
    .eq('owner_id', artistId)

  const { data: fiMembers } = isGroup
    ? await s
        .from('fiscal_identities')
        .select('*')
        .eq('owner_type', 'artist_person')
        .in('owner_id', (people || []).map((p: any) => p.id))
    : { data: [] as any[] }

  const allFIs = [...(fiArtist || []), ...(fiMembers || [])]

  async function saveFiscal(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const rowsJson = String(formData.get('rows') || '[]')
    const rows: { key: string; id: string | null; owner_type: 'artist' | 'artist_person'; owner_id: string }[] = JSON.parse(rowsJson)

    for (const r of rows) {
      const get = (name: string) => formData.get(`fi_${r.key}_${name}`)
      const payload: any = {
        owner_type: r.owner_type,
        owner_id: r.owner_id,
        invoice_as: String(get('invoice_as') || 'company'),
        fiscal_name: String(get('fiscal_name') || ''),
        tax_id: String(get('tax_id') || ''),
        fiscal_address: String(get('fiscal_address') || ''),
        iban: String(get('iban') || ''),
        iban_certificate_url: String(get('iban_certificate_url') || ''),
        settlement_email: String(get('settlement_email') || ''),
        agent_name: String(get('agent_name') || ''),
        agent_phone: String(get('agent_phone') || ''),
        agent_email: String(get('agent_email') || ''),
      }

      if (r.id) {
        const { error } = await s.from('fiscal_identities').update(payload).eq('id', r.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await s.from('fiscal_identities').insert(payload)
        if (error) throw new Error(error.message)
      }
    }

    revalidatePath(`/artistas/${artistId}`)
  }

  return (
    <ModuleCard title="Datos fiscales">
      <ViewEditModule
        title="Datos fiscales"
        isEmpty={!allFIs.length}
        action={saveFiscal}
        childrenView={
          !allFIs.length ? (
            <div className="text-sm text-gray-500">—</div>
          ) : (
            <div className="space-y-3 text-sm">
              {isGroup ? (
                (people || []).map((p: any) => (
                  <div key={p.id} className="border rounded p-2">
                    <div className="font-medium mb-1">{p.full_name}</div>
                    {(allFIs.filter((fi: any) => fi.owner_type === 'artist_person' && fi.owner_id === p.id)).map((fi: any) => (
                      <div key={fi.id} className="flex items-center justify-between">
                        <div>
                          <div>{fi.fiscal_name} · {fi.tax_id}</div>
                          <div className="text-gray-600">{fi.fiscal_address}</div>
                          <div className="text-gray-600">IBAN: {fi.iban || '—'}{fi.iban_certificate_url ? ` · Cert: ${fi.iban_certificate_url}` : ''}</div>
                        </div>
                      </div>
                    ))}
                    {!allFIs.some((fi: any) => fi.owner_type === 'artist_person' && fi.owner_id === p.id) && (
                      <div className="text-xs text-gray-500">Sin datos fiscales.</div>
                    )}
                  </div>
                ))
              ) : (
                (allFIs || []).map((fi: any) => (
                  <div key={fi.id}>
                    <div>{fi.fiscal_name} · {fi.tax_id}</div>
                    <div className="text-gray-600">{fi.fiscal_address}</div>
                    <div className="text-gray-600">IBAN: {fi.iban || '—'}{fi.iban_certificate_url ? ` · Cert: ${fi.iban_certificate_url}` : ''}</div>
                  </div>
                ))
              )}
            </div>
          )
        }
        childrenEdit={
          <ArtistFiscalEditorClient
            artistId={artistId}
            isGroup={isGroup}
            people={(people || []).map((p: any) => ({ id: p.id, full_name: p.full_name }))}
            existing={(allFIs || []).map((fi: any) => ({
              id: fi.id,
              owner_type: fi.owner_type,
              owner_id: fi.owner_id,
              invoice_as: fi.invoice_as,
              fiscal_name: fi.fiscal_name,
              tax_id: fi.tax_id,
              fiscal_address: fi.fiscal_address,
              iban: fi.iban,
              iban_certificate_url: fi.iban_certificate_url,
              settlement_email: fi.settlement_email,
              agent_name: fi.agent_name,
              agent_phone: fi.agent_phone,
              agent_email: fi.agent_email,
            }))}
          />
        }
      />
    </ModuleCard>
  )
}
