'use client'

/**
 * Mapa liviano basado en Leaflet con pins “píldora” sin recortes ni deformaciones.
 * No requiere importar 'leaflet/dist/leaflet.css' en el bundle: incluye CSS mínimo embebido.
 */

import { useEffect, useRef } from 'react'

type Point = {
  id: string
  lat: number
  lng: number
  date?: string | null
  status?: 'draft' | 'hold' | 'confirmed' | string | null
  type?: string | null
  href: string
}

export default function ActivitiesMap({
  points,
  height = 360,
  zoom = 5,
}: { points: Point[]; height?: number; zoom?: number }) {
  const mapEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: any
    let L: any
    let markers: any[] = []

    ;(async () => {
      const leaflet = await import('leaflet')
      L = leaflet.default || leaflet
      // Evita icono por defecto roto en Next
      delete (L.Icon.Default as any).prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!mapEl.current) return
      map = L.map(mapEl.current, {
        zoomControl: true,
        attributionControl: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map)

      const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      if (valid.length) {
        const b = L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number]))
        map.fitBounds(b.pad(0.2))
      } else {
        map.setView([40.4168, -3.7038], zoom) // España por defecto
      }

      const mk = (p: Point) => {
        const color =
          p.status === 'confirmed' ? '#22c55e' : p.status === 'hold' || p.status === 'draft' ? '#f59e0b' : '#94a3b8'
        const dateLabel = p.date
          ? new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()
          : 'S/F'
        const typeIcon = iconForType(p.type)

        const html = `
          <a class="act-pin" href="${p.href}" target="_self" style="border-color:${color}">
            <span class="act-pin__date">${dateLabel}</span>
            <span class="act-pin__sep">·</span>
            <span class="act-pin__type">${typeIcon}</span>
          </a>
        `
        const divIcon = L.divIcon({
          className: 'act-div-icon',
          html,
          iconSize: undefined, // tamaño según contenido (no se recorta)
        })
        const m = L.marker([p.lat, p.lng], {
          icon: divIcon,
          zIndexOffset: p.status === 'confirmed' ? 1000 : 0,
        })
        m.addTo(map)
        markers.push(m)
      }

      valid.forEach(mk)
    })()

    return () => {
      try {
        markers.forEach((m) => m.remove?.())
        // @ts-ignore
        if (mapEl.current && (mapEl.current as any)._leaflet_id) {
          // @ts-ignore
          mapEl.current._leaflet_id = null
        }
      } catch {}
    }
  }, [points, zoom])

  return (
    <div style={{ height }} ref={mapEl}>
      {/* CSS mínimo Leaflet + estilo de pin “píldora” */}
      <style jsx global>{`
        .leaflet-container {
          width: 100%;
          height: 100%;
          touch-action: pan-x pan-y;
          font: 12px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }
        .leaflet-pane,
        .leaflet-tile,
        .leaflet-marker-icon,
        .leaflet-marker-shadow,
        .leaflet-tile-container,
        .leaflet-pane > svg,
        .leaflet-pane > canvas {
          position: absolute;
          left: 0;
          top: 0;
        }
        .leaflet-marker-icon,
        .leaflet-div-icon {
          background: transparent;
          border: 0;
        }

        .act-div-icon {
          overflow: visible; /* evita cortes */
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
          white-space: nowrap; /* no se corta el texto */
          transform: translate(-50%, -100%); /* ancla desde la base */
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

function iconForType(type?: string | null) {
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
