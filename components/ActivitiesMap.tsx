'use client'

import { useEffect, useRef } from 'react'

/** Modelo de punto en el mapa */
export type ActivityForMap = {
  id: string
  lat?: number | null
  lng?: number | null
  date?: string | null
  status?: string | null // draft | hold | confirmed | ...
  type?: string | null
  href: string
}

type Props = {
  /** Prop nueva preferente */
  points?: ActivityForMap[]
  /** Prop legacy (compatibilidad) */
  activities?: ActivityForMap[]
  /** Alto del mapa (px) */
  height?: number
}

/** Carga Leaflet desde CDN (JS + CSS) sólo en cliente */
function loadLeafletFromCDN(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null)
    const w = window as any
    if (w.L) return resolve(w.L)

    // CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity =
        'sha256-o9N1j7kGIC3G1n9G8ei2t7Ff5Q8hCqZ0Z1Z8aQ2v3yQ='
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // JS
    if (document.getElementById('leaflet-js') && (window as any).L) {
      return resolve((window as any).L)
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.integrity =
      'sha256-o9N1j7kGIC3G1n9G8ei2t7Ff5Q8hCqZ0Z1Z8aQ2v3yQ='
    script.crossOrigin = ''
    script.async = true
    script.onload = () => resolve((window as any).L)
    document.body.appendChild(script)
  })
}

export default function ActivitiesMap({ points, activities, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any | null>(null)

  // Usar points si viene, si no, activities (compatibilidad)
  const list: ActivityForMap[] = (points ?? activities ?? []) as ActivityForMap[]

  useEffect(() => {
    let layer: any | null = null
    let disposed = false

    ;(async () => {
      const L = await loadLeafletFromCDN()
      if (!L || !containerRef.current || disposed) return

      // Mapa una sola vez
      if (!mapRef.current) {
        const madrid: [number, number] = [40.4168, -3.7038]
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView(madrid, 5)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current)
      }

      const map = mapRef.current!
      layer = L.layerGroup().addTo(map)

      const isNum = (n: unknown): n is number =>
        typeof n === 'number' && !Number.isNaN(n)

      const valid = (list || []).filter(p => isNum(p.lat) && isNum(p.lng))
      const bounds: [number, number][] = []

      for (const p of valid) {
        const dateLabel = p.date
          ? new Date(p.date).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
            }).toUpperCase()
          : ''

        const color =
          p.status === 'confirmed'
            ? '#16a34a' // verde
            : p.status === 'hold' || p.status === 'draft'
            ? '#f59e0b' // amarillo
            : '#94a3b8' // gris

        // Etiqueta compacta, sin recortes ni deformaciones
        const html = `
          <div style="
            background:#fff;
            border:2px solid ${color};
            border-radius:14px;
            padding:2px 8px;
            display:inline-flex;
            align-items:center;
            gap:8px;
            box-shadow:0 1px 3px rgba(0,0,0,.2);
            white-space:nowrap;
            font:600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
            <span style="text-transform:uppercase">${dateLabel || ''}</span>
            ${p.type ? `<span style="opacity:.8">${p.type}</span>` : ''}
          </div>
        `

        const icon = L.divIcon({
          className: '',
          html,
          iconSize: [Math.max(90, (dateLabel?.length ?? 0) * 9 + (p.type ? 70 : 30)), 28],
          iconAnchor: [45, 14],
        })

        const marker = L.marker([p.lat!, p.lng!], {
          icon,
          title: dateLabel || '',
        }).addTo(layer)

        marker.on('click', () => {
          if (p.href) window.location.href = p.href
        })

        bounds.push([p.lat!, p.lng!])
      }

      if (bounds.length) {
        map.fitBounds(bounds as any, { padding: [24, 24], maxZoom: 11 })
      }
    })()

    return () => {
      disposed = true
      if (mapRef.current && layer) {
        mapRef.current.removeLayer(layer)
      }
    }
    // Depende del contenido relevante
  }, [JSON.stringify(list.map(p => [p.id, p.lat, p.lng, p.status, p.date, p.type]))])

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded border"
    />
  )
}
