'use client'
import { useMemo, useState } from 'react'

type Person = { id: string; full_name: string }
type FI = {
  id?: string
  owner_type: 'artist' | 'artist_person'
  owner_id: string
  invoice_as?: string
  fiscal_name?: string
  tax_id?: string
  fiscal_address?: string
  iban?: string
  iban_certificate_url?: string
  settlement_email?: string
  agent_name?: string
  agent_phone?: string
  agent_email?: string
}

export default function ArtistFiscalEditorClient({
  artistId,
  isGroup,
  people,
  existing,
}: {
  artistId: string
  isGroup: boolean
  people: Person[]
  existing: FI[]
}) {
  // key estable para cada fila (id existente o "new-x")
  const initialRows = useMemo(() => {
    const rows = existing.map((fi, i) => ({ key: fi.id || `new-${i}`, data: fi }))
    // para solista, si no hay ninguna, ofrecemos una en blanco
    if (!isGroup && !rows.length) rows.push({ key: 'new-0', data: { owner_type: 'artist', owner_id: artistId } as FI })
    return rows
  }, [existing, isGroup, artistId])

  const [rows, setRows] = useState(initialRows)

  const addFor = (owner_type: 'artist' | 'artist_person', owner_id: string) => {
    const key = `new-${rows.length + 1}`
    setRows([...rows, { key, data: { owner_type, owner_id } as FI }])
  }

  const removeRow = (key: string) => setRows(rows.filter(r => r.key !== key))

  return (
    <div className="space-y-3">
      <input type="hidden" name="rows" value={JSON.stringify(rows.map(r => ({ key: r.key, id: r.data.id || null, owner_type: r.data.owner_type, owner_id: r.data.owner_id })))} />

      {rows.map(({ key, data }) => (
        <div key={key} className="border rounded p-3 space-y-2">
          {isGroup && data.owner_type === 'artist_person' && (
            <div className="text-sm font-medium">
              Miembro: {people.find(p => p.id === data.owner_id)?.full_name || '—'}
            </div>
          )}
          <input type="hidden" name={`fi_${key}_id`} defaultValue={data.id || ''} />
          <input type="hidden" name={`fi_${key}_owner_type`} defaultValue={data.owner_type || 'artist'} />
          <input type="hidden" name={`fi_${key}_owner_id`} defaultValue={data.owner_id || artistId} />

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm mb-1">Facturar como</div>
              <select name={`fi_${key}_invoice_as`} defaultValue={data.invoice_as || 'company'} className="border rounded px-3 py-2 w-full">
                <option value="company">Empresa</option>
                <option value="person">Particular</option>
              </select>
            </div>
            <div>
              <div className="text-sm mb-1">Nombre fiscal</div>
              <input name={`fi_${key}_fiscal_name`} defaultValue={data.fiscal_name || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">CIF / DNI</div>
              <input name={`fi_${key}_tax_id`} defaultValue={data.tax_id || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div className="md:col-span-3">
              <div className="text-sm mb-1">Domicilio fiscal</div>
              <input name={`fi_${key}_fiscal_address`} defaultValue={data.fiscal_address || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">IBAN</div>
              <input name={`fi_${key}_iban`} defaultValue={data.iban || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Certificado IBAN (URL PDF)</div>
              <input name={`fi_${key}_iban_certificate_url`} defaultValue={data.iban_certificate_url || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Email liquidaciones</div>
              <input type="email" name={`fi_${key}_settlement_email`} defaultValue={data.settlement_email || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Representante (opcional)</div>
              <input name={`fi_${key}_agent_name`} defaultValue={data.agent_name || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Tel. representante</div>
              <input name={`fi_${key}_agent_phone`} defaultValue={data.agent_phone || ''} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-sm mb-1">Email representante</div>
              <input type="email" name={`fi_${key}_agent_email`} defaultValue={data.agent_email || ''} className="border rounded px-3 py-2 w-full" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => removeRow(key)}>Eliminar</button>
          </div>
        </div>
      ))}

      {!isGroup ? (
        <button type="button" className="btn-secondary" onClick={() => addFor('artist', artistId)}>
          + Añadir otra empresa
        </button>
      ) : (
        <div className="space-y-2">
          <div className="text-sm">Añadir empresa para miembro:</div>
          <div className="flex flex-wrap gap-2">
            {people.map(p => (
              <button type="button" key={p.id} className="btn-secondary" onClick={() => addFor('artist_person', p.id)}>
                + {p.full_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
