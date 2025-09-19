'use client'

import { useEffect, useRef } from 'react'

export type ActivityForMap = {
  id: string
  lat?: number | null
  lng?: number | null
  date?: string | null
  status?: string | null // draft | hold | confirmed…
  type?: string | null
  href: string
  // Aceptamos campos “legacy” por compatibilidad:
  latitude?: number | null
  longitude?: number | null
  venue_lat?: number | null
  venue_lng?: number | null
  venue?: { lat?: number | null; lng?: number | null } | null
  venues?: { lat?: number | null; lng?: number | null }[] | { lat?: number | null; lng?: number | null } | null
}

type Props = {
  points?: ActivityForMap[]
  activities?: ActivityForMap[] // compatibilidad
  height?: number
}

/** Carga Leaflet (CSS + JS) desde CDN sólo en cliente */
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
    script.crossOrigin = ''
    script.async = true
    script.onload = () => resolve((window as any).L)
    document.body.appendChild(script)
  })
}

export default function ActivitiesMap({ points, activities, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any | null>(null)

  // Compatibilidad: preferimos points, si no, activities.
  const list: ActivityForMap[] = (points ?? activities ?? []) as ActivityForMap[]

  // Normalizador de coordenadas — acepta múltiples “fuentes”
  const getLatLng = (p: any): { lat?: number; lng?: number } => {
    const v0 = Array.isArray(p?.venues) ? p.venues[0] : p?.venues
    const candidatesLat = [p.lat, p.latitude, p.venue_lat, p?.venue?.lat, v0?.lat]
    const candidatesLng = [p.lng, p.longitude, p.venue_lng, p?.venue?.lng, v0?.lng]
    const lat = candidatesLat.find((x) => typeof x === 'number' && !Number.isNaN(x))
    const lng = candidatesLng.find((x) => typeof x === 'number' && !Number.isNaN(x))
    return { lat, lng }
  }

  useEffect(() => {
    let layer: any | null = null
    let disposed = false

    ;(async () => {
      const L = await loadLeafletFromCDN()
      if (!L || !containerRef.current || disposed) return

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

      const bounds: [number, number][] = []
      for (const p of list || []) {
        const { lat, lng } = getLatLng(p)
        if (typeof lat !== 'number' || typeof lng !== 'number') continue

        const dateLabel = p.date
          ? new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()
          : ''

        const color =
          p.status === 'confirmed'
            ? '#16a34a' // verde
            : p.status === 'hold' || p.status === 'draft'
            ? '#f59e0b' // amarillo
            : '#94a3b8' // gris

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
            ${dateLabel ? `<span style="text-transform:uppercase">${dateLabel}</span>` : ''}
            ${p.type ? `<span style="opacity:.8">${p.type}</span>` : ''}
          </div>
        `
        const icon = L.divIcon({ className: '', html, iconAnchor: [45, 14] })
        const marker = L.marker([lat, lng], { icon }).addTo(layer)
        marker.on('click', () => { if (p.href) window.location.href = p.href })
        bounds.push([lat, lng])
      }

      if (bounds.length) map.fitBounds(bounds as any, { padding: [24, 24], maxZoom: 11 })
    })()

    return () => {
      disposed = true
      if (mapRef.current && layer) mapRef.current.removeLayer(layer)
    }
    // Re-render si cambian los puntos de forma relevante
  }, [JSON.stringify((list || []).map(p => [p.id, p.date, p.status, p.type, p.lat, p.lng, p.latitude, p.longitude, p.venue_lat, p.venue_lng]))])

  return <div ref={containerRef} style={{ height, width: '100%' }} className="rounded border" />
}
