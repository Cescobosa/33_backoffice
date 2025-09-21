'use client'

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from 'react'

export type CompanyLite = {
  id: string
  name: string | null
  nick: string | null
  logo_url: string | null
}

type Props = {
  /** name del input oculto que enviará el id de la empresa */
  name?: string
  /** listado completo de empresas */
  companies: CompanyLite[]
  /** id por defecto (preseleccionado) */
  defaultValue?: string | null
  /** callback opcional al cambiar */
  onChangeId?: (id: string | null) => void
  /** placeholder del buscador */
  placeholder?: string
  /** clase extra para el contenedor */
  className?: string
}

/**
 * Selector de empresas con:
 * - búsqueda por nombre/nick
 * - menú en posición *fixed* para que no se corte por contenedores con overflow
 * - cierre por click fuera / scroll / resize
 * - tipado correcto de listeners (Event, no MouseEvent)
 */
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
  const [selectedId, setSelectedId] = useState<string | null>(
    defaultValue ?? null
  )
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  // Establece el texto del input si viene un valor por defecto
  useEffect(() => {
    const pre = companies.find((c) => c.id === defaultValue)
    if (pre) setQuery(pre.nick || pre.name || '')
    setSelectedId(defaultValue ?? null)
  }, [defaultValue, companies])

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim()
    if (!q) return companies
    return companies.filter((c) => {
      const s = `${c.nick ?? ''} ${c.name ?? ''}`.toLowerCase()
      return s.includes(q)
    })
  }, [companies, query])

  // Abre y recoloca el menú
  const openMenu = () => {
    setOpen(true)
    if (anchorRef.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect())
    }
  }

  // Cierre seguro (tipado con Event, no MouseEvent)
  useEffect(() => {
    if (!open) return

    const updateRect = () => {
      if (anchorRef.current) {
        setAnchorRect(anchorRef.current.getBoundingClientRect())
      }
    }

    const handleOutside = (ev: Event) => {
      const t = ev.target as Node | null
      if (!t) return
      if (
        anchorRef.current?.contains(t) ||
        dropdownRef.current?.contains(t)
      ) {
        return
      }
      setOpen(false)
    }

    // OJO: para scroll en cualquier contenedor usamos capture=true
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    document.addEventListener('click', handleOutside)

    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
      document.removeEventListener('click', handleOutside)
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

  // Cálculo de posición/altura del dropdown en fixed
  const styleFixed: React.CSSProperties = (() => {
    if (!anchorRect) return { display: 'none' }
    const margin = 6
    const top = Math.min(
      anchorRect.bottom + margin,
      window.innerHeight - 16
    )
    const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - anchorRect.width - 8))
    const maxH = Math.max(
      160,
      Math.min(360, window.innerHeight - top - 12)
    )
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

  const selected = selectedId
    ? companies.find((c) => c.id === selectedId) || null
    : null

  return (
    <div className={`w-full ${className}`} ref={anchorRef}>
      {/* input visible para búsqueda */}
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
        {/* Botón limpiar */}
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Limpiar"
          >
            ×
          </button>
        )}
        {/* Indicador */}
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          ▾
        </div>
      </div>

      {/* input oculto que envía el id */}
      <input type="hidden" name={name} value={selectedId ?? ''} />

      {/* Dropdown en *fixed* para que no se corte */}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.logo_url || '/avatar.png'}
                  alt=""
                  className="h-6 w-auto object-contain rounded border bg-white"
                />
                <div className="flex-1">
                  <div className="font-medium leading-5">{label}</div>
                  {c.name && c.nick && c.name !== c.nick && (
                    <div className="text-xs text-gray-500 leading-4">
                      {c.name}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Ayuda visual de selección actual (opcional) */}
      {selected && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.logo_url || '/avatar.png'}
            alt=""
            className="h-5 w-auto object-contain rounded border bg-white"
          />
          <span className="truncate">
            Seleccionada: {selected.nick || selected.name}
          </span>
        </div>
      )}
    </div>
  )
}
