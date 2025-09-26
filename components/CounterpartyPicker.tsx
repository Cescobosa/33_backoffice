'use client'
import { useEffect, useRef, useState } from 'react'

type Props = {
  /** Nombre del hidden que recibirá el counterparty_id seleccionado */
  nameCounterpartyId: string
  /** Nombre del hidden que recibirá el fiscal_identity_id seleccionado (si aplica) */
  nameFiscalIdentityId: string
}

type CP = { id: string; label: string; logo_url: string | null }
type FI = { id: string; fiscal_name: string; tax_id: string | null }

export default function CounterpartyPicker({ nameCounterpartyId, nameFiscalIdentityId }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CP[]>([])
  const [selected, setSelected] = useState<CP | null>(null)
  const [companies, setCompanies] = useState<FI[]>([])
  const [fiId, setFiId] = useState<string>('')

  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim()
      if (term.length < 2) { setItems([]); setOpen(false); return }
      setLoading(true)
      try {
        const res = await fetch(`/api/search/counterparties?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
        const json = await res.json()
        setItems(json.items || [])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as any)) setOpen(false)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])

  const pick = async (cp: CP) => {
    setSelected(cp)
    setOpen(false)
    setQ(cp.label)
    setCompanies([])
    setFiId('')
    const res = await fetch(`/api/counterparties/${cp.id}/companies`, { cache: 'no-store' })
    const json = await res.json()
    const list: FI[] = json.companies || []
    setCompanies(list)
    if (list.length === 1) setFiId(list[0].id)
  }

  return (
    <div className="space-y-2">
      {/* hidden outputs */}
      <input type="hidden" name={nameCounterpartyId} value={selected?.id || ''} />
      <input type="hidden" name={nameFiscalIdentityId} value={fiId} />

      <div className="relative" ref={boxRef}>
        <input
          type="search"
          placeholder="Buscar tercero…"
          className="border rounded px-3 py-2 w-full"
          value={q}
          onChange={(e) => { setQ(e.target.value); setSelected(null); setCompanies([]); setFiId('') }}
          onFocus={() => { if (items.length) setOpen(true) }}
          autoComplete="off"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-72 overflow-auto">
            {loading && <div className="px-3 py-2 text-sm text-gray-500">Buscando…</div>}
            {!loading && !items.length && (
              <div className="px-3 py-2 text-sm text-gray-500">
                No se han encontrado resultados.{' '}
                <a className="text-[#d42842] underline" href="/terceros/new" target="_blank" rel="noreferrer">+ Crear nuevo tercero</a>
              </div>
            )}
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-gray-50"
                onClick={() => pick(it)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.logo_url || '/avatar.png'} className="h-6 w-10 object-contain bg-white border rounded" alt="" />
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="text-sm">
          <div className="mb-1 text-gray-600">Seleccionado: <b>{selected.label}</b></div>
          {companies.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="text-sm">Empresa del tercero:</div>
              <select className="border rounded px-2 py-1" value={fiId} onChange={(e) => setFiId(e.target.value)}>
                <option value="">(elige una)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.fiscal_name}{c.tax_id ? ` · ${c.tax_id}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          {companies.length === 1 && (
            <div className="text-xs text-gray-500">
              Empresa: {companies[0].fiscal_name}{companies[0].tax_id ? ` · ${companies[0].tax_id}` : ''}
            </div>
          )}
          {companies.length === 0 && (
            <div className="text-xs text-gray-500">
              Este tercero no tiene empresas creadas todavía. Puedes añadirlas en su ficha.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
