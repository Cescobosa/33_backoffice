'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export type ActivityForMap = {
  id: string
  lat?: number | null
  lng?: number | null
  date?: string | null
  type?: string | null
  status?: string | null
  href?: string
}

export default function ActivitiesMap({
  points,
  height = 360,
}: {
  points: ActivityForMap[]
  height?: number
}) {
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: any
    let L: any
    const valid = (points || []).filter(
      (p) => typeof p.lat === 'number' && typeof p.lng === 'number'
    )

    if (!el.current || valid.length === 0) return

    ;(async () => {
      L = (await import('leaflet')).default
      const icon = L.icon({
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      })

      map = L.map(el.current)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      const latlngs = valid.map((v) => [v.lat, v.lng])
      if (latlngs.length > 1) {
        const bounds = L.latLngBounds(latlngs)
        map.fitBounds(bounds.pad(0.2))
      } else {
        map.setView(latlngs[0], 6)
      }

      valid.forEach((p) => {
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map)
        const html = `<div style="font-size:12px">
          <div><b>${p.type ?? 'Actividad'}</b></div>
          ${p.date ?? ''} · ${p.status ?? ''}
          ${p.href ? `<div style="margin-top:6px"><a href="${p.href}">Abrir</a></div>` : ''}
        </div>`
        m.bindPopup(html)
      })
    })()

    return () => {
      if (map) map.remove()
    }
  }, [points])

  const validCount = (points || []).filter(
    (p) => typeof p.lat === 'number' && typeof p.lng === 'number'
  ).length

  if (!validCount) {
    return (
      <div className="text-sm text-gray-500">
        No hay actividades con coordenadas para mostrar en el mapa.
      </div>
    )
  }

  return <div ref={el} style={{ height }} className="rounded border" />
}
