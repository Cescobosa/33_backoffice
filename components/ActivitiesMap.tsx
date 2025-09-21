// components/ActivitiesMap.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'

// CSS de Leaflet (requiere el paquete instalado)
import 'leaflet/dist/leaflet.css'

// Nota: Next/Vercel a veces no resuelve los iconos por defecto de Leaflet.
// Lo fijamos a las URLs públicas del CDN oficial.
const fixDefaultIcon = (L: typeof import('leaflet')) => {
  (L as any).Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

export type ActivityForMap = {
  id: string
  lat?: number
  lng?: number
  date?: string | null
  status?: 'draft' | 'hold' | 'confirmed' | string | null
  type?: string | null
  href: string
}

function statusColor(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'confirmed':
      return '#16a34a' // verde
    case 'hold':
    case 'reserva':
      return '#f59e0b' // amarillo
    case 'draft':
    case 'borrador':
    default:
      return '#f59e0b' // amarillo por defecto
  }
}

export default function ActivitiesMap({
  points,
  height = 360,
}: {
  points: ActivityForMap[]
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: LeafletMap | null = null
    let featureGroup: any = null

    ;(async () => {
      const L = await import('leaflet')
      fixDefaultIcon(L)

      if (!ref.current) return

      map = L.map(ref.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([40.4168, -3.7038], 5) // España (vista inicial)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      featureGroup = L.featureGroup().addTo(map)

      for (const p of points || []) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue

        const color = statusColor(p.status)
        const dateTxt = p?.date
          ? new Date(p.date).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
            }).toUpperCase()
          : ''

        const html = `
          <div style="white-space:nowrap;position:relative;transform:translate(-50%,-100%);">
            <div style="
              padding:4px 8px;
              border:2px solid ${color};
              border-radius:9999px;
              background:#fff;
              font-size:12px;
              font-weight:600;
              box-shadow:0 1px 3px rgba(0,0,0,.15);
            ">
              ${dateTxt}${p.type ? ` · ${p.type}` : ''}
            </div>
            <div style="
              width:0;height:0;position:absolute;left:50%;
              border-left:7px solid transparent;border-right:7px solid transparent;
              border-top:10px solid ${color};transform:translate(-50%,-1px);
            "></div>
          </div>
        `
        const icon = L.divIcon({ html, className: '', iconSize: [0, 0] })
        const m = L.marker([p.lat, p.lng], { icon }).addTo(featureGroup)
        m.on('click', () => (window.location.href = p.href))
      }

      const count = featureGroup.getLayers().length
      if (count > 0) {
        map.fitBounds(featureGroup.getBounds().pad(0.25))
      }
    })()

    return () => {
      try {
        map?.remove()
      } catch {}
    }
  }, [JSON.stringify(points)])

  return (
    <div
      ref={ref}
      style={{ height }}
      className="rounded border overflow-hidden"
    />
  )
}
