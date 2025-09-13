'use client'

/**
 * Mapa de actividades sin dependencias NPM.
 * Carga Leaflet desde CDN (JS + CSS) y usa window.L.
 * Exporta el tipo ActivityForMap para tipar los puntos desde las páginas.
 */

import { useEffect, useRef } from 'react'

/** === Tipo que usas en las páginas === */
export type ActivityForMap = {
  id: string
  lat: number
  lng: number
  date?: string | null
  status?: 'draft' | 'hold' | 'confirmed' | string | null
  type?: string | null
  href: string
}

declare global {
  interface Window {
    L?: any
  }
}

const LJS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LCSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

function loadLeafletFromCDN(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'))
    if (window.L) return resolve(window.L)

    // CSS
    if (!document.querySelector(`link[href="${LCSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LCSS
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // JS
    const existing = document.querySelector(`script[src="${LJS}"]`) as HTMLScriptElement | null
    if (existing && window.L) return resolve(window.L)

    const script = existing ?? document.createElement('script')
    script.src = LJS
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = (e) => reject(e)
    if (!existing) document.body.appendChild(script)
  })
}

function labelForType(type?: string | null) {
  if (!type) return 'Actividad'
  switch (type) {
    case 'concert':
      return 'Concierto'
    case 'promo':
      return 'Promo'
    case 'festival':
      return 'Festival'
    default:
      return type
  }
}

export default function ActivitiesMap({
  points,
  height = 360,
  zoom = 5,
}: {
  points: ActivityForMap[]
  height?: number
  zoom?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const L = await loadLeafletFromCDN()
        if (cancelled || !ref.current) return

        if (!mapRef.current) {
          mapRef.current = L.map(ref.current, {
            zoomControl: true,
            attributionControl: false,
          })
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
          }).addTo(mapRef.current)
        }

        // Limpia y pinta
        markersRef.current.forEach((m) => m.remove?.())
        markersRef.current = []

        const valid = (points || []).filter(
          (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
        )

        if (valid.length) {
          const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number]))
          mapRef.current.fitBounds(bounds.pad(0.2))
        } else {
          mapRef.current.setView([40.4168, -3.7038], zoom) // centro ES
        }

        valid.forEach((p) => {
          const color =
            p.status === 'confirmed'
              ? '#22c55e'
              : p.status === 'hold' || p.status === 'draft'
              ? '#f59e0b'
              : '#94a3b8'

          const dateLabel = p.date
            ? new Date(p.date).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
              }).toUpperCase()
            : 'S/F'

          const html = `
            <a class="act-pin" href="${p.href}" target="_self" style="border-color:${color}">
              <span class="act-pin__date">${dateLabel}</span>
              <span class="act-pin__sep">·</span>
              <span class="act-pin__type">${labelForType(p.type)}</span>
            </a>
          `

          const icon = L.divIcon({
            className: 'act-div-icon',
            html,
            iconSize: undefined, // deja que el contenido defina el tamaño → no se corta
          })

          const m = L.marker([p.lat, p.lng], {
            icon,
            zIndexOffset: p.status === 'confirmed' ? 1000 : 0,
          })
          m.addTo(mapRef.current)
          markersRef.current.push(m)
        })
      } catch (err) {
        console.error('Leaflet CDN load error', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [points, zoom])

  return (
    <div ref={ref} style={{ height }}>
      <style jsx global>{`
        .leaflet-container {
          width: 100%;
          height: 100%;
          font: 12px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          touch-action: pan-x pan-y;
        }
        .act-div-icon {
          overflow: visible; /* evita el recorte del HTML interno */
        }
        .act-pin {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: #fff;
          border: 2px solid #e5e7eb;
          border-radius: 9999px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          text-decoration: none;
          color: #111827;
          white-space: nowrap;       /* no cortar texto */
          transform: translate(-50%, -100%); /* ancla al punto geográfico */
        }
        .act-pin__date {
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.3px;
        }
        .act-pin__sep {
          color: #94a3b8;
        }
        .act-pin__type {
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          text-transform: capitalize;
        }
      `}</style>
    </div>
  )
}
