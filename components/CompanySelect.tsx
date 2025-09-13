'use client'
import { useState } from 'react'

export type CompanyLite = { id: string; name?: string | null; nick?: string | null; logo_url?: string | null }

export default function CompanySelect({
  name,
  companies,
  defaultValue,
  disabled,
}: {
  name: string
  companies: CompanyLite[]
  defaultValue?: string | null
  disabled?: boolean
}) {
  const initial = companies.find(c => c.id === defaultValue) || null
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<CompanyLite | null>(initial)
  const onPick = (c: CompanyLite) => { setSel(c); setOpen(false) }
  return (
    <div className="relative">
      <input type="hidden" name={name} value={sel?.id || ''} />
      <button type="button" disabled={disabled}
        className="w-full border rounded px-3 py-2 flex items-center justify-between disabled:opacity-50"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          {sel?.logo_url ? <img src={sel.logo_url} alt="" className="h-6 w-auto object-contain" /> : <span className="text-xs text-gray-500">Sin logo</span>}
          <span className="text-sm">{sel?.nick || sel?.name || '(sin empresa)'}</span>
        </div>
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-64 overflow-auto">
          <button type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
            onClick={() => onPick({ id: '', name: '', nick: '', logo_url: '' })}>
            <span className="text-sm text-gray-600">(sin empresa)</span>
          </button>
          {companies.map(c => (
            <button key={c.id} type="button" onClick={() => onPick(c)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
              {c.logo_url ? <img src={c.logo_url} alt="" className="h-6 w-auto object-contain" /> : <span className="w-6 h-6 bg-gray-200 inline-block" />}
              <span className="text-sm">{c.nick || c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
