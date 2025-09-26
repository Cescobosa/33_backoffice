import ModuleCard from '@/components/ModuleCard'
import ViewEditModule from '@/components/ViewEditModule'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { revalidatePath } from 'next/cache'
import CounterpartyPicker from '@/components/CounterpartyPicker'

export default async function ArtistPromoterModule({ artistId }: { artistId: string }) {
  const s = createSupabaseServer()

  const { data: links } = await s
    .from('third_party_links')
    .select(`
      id,
      preferred_fiscal_identity_id,
      counterparty:counterparty_id (id, nick, legal_name, logo_url),
      fi:preferred_fiscal_identity_id (id, fiscal_name, tax_id)
    `)
    .eq('artist_id', artistId)
    .order('linked_at', { ascending: true })

  async function linkPromoter(formData: FormData) {
    'use server'
    const s = createSupabaseServer()
    const artist_id = String(formData.get('artist_id') || '')
    const counterparty_id = String(formData.get('promoter_counterparty_id') || '')
    const fi_id = String(formData.get('promoter_fiscal_identity_id') || '')

    if (!artist_id || !counterparty_id) throw new Error('Faltan datos')

    // ¿Existe ya vínculo?
    const existing = await s
      .from('third_party_links')
      .select('id')
      .eq('artist_id', artist_id)
      .eq('counterparty_id', counterparty_id)
      .maybeSingle()

    if (existing.data?.id) {
      await s
        .from('third_party_links')
        .update({ preferred_fiscal_identity_id: fi_id || null, status: 'linked', unlinked_at: null })
        .eq('id', existing.data.id)
    } else {
      await s.from('third_party_links').insert({
        artist_id,
        counterparty_id,
        preferred_fiscal_identity_id: fi_id || null,
      })
    }

    revalidatePath(`/artistas/${artist_id}`)
  }

  return (
    <ModuleCard title="Promotor / Tercero vinculado">
      <ViewEditModule
        title="Promotor / Tercero vinculado"
        isEmpty={!links?.length}
        action={linkPromoter}
        childrenView={
          !links?.length ? (
            <div className="text-sm text-gray-500">—</div>
          ) : (
            <div className="space-y-2">
              {links!.map((l: any) => (
                <div key={l.id} className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.counterparty?.logo_url || '/avatar.png'} className="h-6 w-10 object-contain bg-white border rounded" alt="" />
                  <div className="grow">
                    <div className="font-medium">
                      <a className="underline" href={`/terceros/${l.counterparty?.id}`}>{l.counterparty?.nick || l.counterparty?.legal_name}</a>
                    </div>
                    {l.fi?.fiscal_name && (
                      <div className="text-xs text-gray-600">
                        Empresa: {l.fi.fiscal_name}{l.fi.tax_id ? ` · ${l.fi.tax_id}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
        childrenEdit={
          <div className="space-y-3">
            <input type="hidden" name="artist_id" value={artistId} />
            <CounterpartyPicker
              nameCounterpartyId="promoter_counterparty_id"
              nameFiscalIdentityId="promoter_fiscal_identity_id"
            />
            <p className="text-xs text-gray-500">
              Busca en toda la base de terceros; si seleccionas uno con varias empresas te pedirá cuál aplicar por defecto.
            </p>
          </div>
        }
      />
    </ModuleCard>
  )
}
