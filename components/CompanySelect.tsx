'use client'

import React, { useEffect, useMemo, useRef, useState, useId } from 'react'

export type CompanyLite = {
  id: string
  name: string | null
  nick: string | null
  logo_url: string | null
}

type Props = {
  name?: string
  companies: CompanyLite[]
  defaultValue?: string | null
  onChangeId?: (id: string | null) => void
  placeholder?: string
  className?: string
}

export default function CompanySelect({
  name = 'company_id',
  companies,
  defaultValue = null,
  onChangeId,
  placeholder = 'Selecciona empresa…',
  className = '',
}: Props) {
  const uid = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(defaultValue ?? null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const pre = companies.find((c) => c.id === defaultValue)
    if (pre) setQuery(pre.nick || pre.name || '')
    setSelectedId(defaultValue ?? null)
  }, [defaultValue, companies])

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim()
    if (!q) return companies
    return companies.filter((c) =>
      `${c.nick ?? ''} ${c.name ?? ''}`.toLowerCase().includes(q)
    )
  }, [companies, query])

  const openMenu = () => {
    setOpen(true)
    if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect())
  }

  useEffect(() => {
    if (!open) return

    const updateRect = () => {
      if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect())
    }
    const closeOutside = (ev: Event) => {
      const t = ev.target as Node | null
      if (!t) return
      if (anchorRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    document.addEventListener('click', closeOutside)

    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
      document.removeEventListener('click', closeOutside)
    }
  }, [open])

  const pick = (c: CompanyLite) => {
    setSelectedId(c.id)
    setQuery(c.nick || c.name || '')
    setOpen(false)
    onChangeId?.(c.id)
  }
  const clear = () => {
    setSelectedId(null)
    setQuery('')
    onChangeId?.(null)
  }

  const styleFixed: React.CSSProperties = (() => {
    if (!anchorRect) return { display: 'none' }
    const margin = 6
    const top = Math.min(anchorRect.bottom + margin, window.innerHeight - 16)
    const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - anchorRect.width - 8))
    const maxH = Math.max(160, Math.min(360, window.innerHeight - top - 12))
    return {
      position: 'fixed',
      top,
      left,
      width: anchorRect.width,
      maxHeight: maxH,
      overflowY: 'auto',
      zIndex: 60,
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 8,
      boxShadow:
        '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    }
  })()

  const selected = selectedId ? companies.find((c) => c.id === selectedId) || null : null

  return (
    <div className={`w-full ${className}`} ref={anchorRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={openMenu}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          placeholder={placeholder}
          className="w-full border rounded px-3 py-2 pr-9"
          aria-controls={`company-list-${uid}`}
          aria-expanded={open}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          ▾
        </div>
      </div>

      <input type="hidden" name={name} value={selectedId ?? ''} />

      {open && (
        <div
          id={`company-list-${uid}`}
          ref={dropdownRef}
          role="listbox"
          style={styleFixed}
          className="text-sm"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-gray-500">Sin resultados</div>
          )}
          {filtered.map((c) => {
            const label = c.nick || c.name || '(sin nombre)'
            const isSel = c.id === selectedId
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => pick(c)}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left ${
                  isSel ? 'bg-gray-50' : ''
                }`}
              >
                <img
                  src={c.logo_url || '/avatar.png'}
                  alt=""
                  className="h-6 w-auto object-contain rounded border bg-white"
                />
                <div className="flex-1">
                  <div className="font-medium leading-5">{label}</div>
                  {c.name && c.nick && c.name !== c.nick && (
                    <div className="text-xs text-gray-500 leading-4">{c.name}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
          <img
            src={selected.logo_url || '/avatar.png'}
            alt=""
            className="h-5 w-auto object-contain rounded border bg-white"
          />
          <span className="truncate">Seleccionada: {selected.nick || selected.name}</span>
        </div>
      )}
    </div>
  )
}
