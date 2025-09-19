'use client'

import { useEffect, useRef } from 'react'
import type L from 'leaflet'

// Importamos Leaflet solo en cliente
let Leaflet: typeof import('leaflet') | null = null
async function ensureLeaflet() {
  if (!Leaflet) {
    Leaflet = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
  }
  return Leaflet
}

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
  points: ActivityForMap[]
  height?: number
}

export default function ActivitiesMap({ points, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    let layer: L.LayerGroup | null = null
    let disposed = false

    ;(async () => {
      const L = (await ensureLeaflet())!

      if (!containerRef.current || disposed) return

      // Crear mapa 1 sola vez
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

      const has = (n: unknown): n is number =>
        typeof n === 'number' && !Number.isNaN(n)

      const valid = (points || []).filter(p => has(p.lat) && has(p.lng))

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

        // Pin con estilo compacto y sin deformaciones
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

        const icon = (await ensureLeaflet())!.divIcon({
          className: '',
          html,
          iconSize: [90, 28],
          iconAnchor: [45, 14],
        })

        const marker = (await ensureLeaflet())!.marker([p.lat!, p.lng!], {
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
  }, [
    // Dependencia estable: id + coordenadas + estado/fecha
    JSON.stringify(
      (points || []).map(p => [p.id, p.lat, p.lng, p.status, p.date, p.type]),
    ),
  ])

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded border"
    />
  )
}
