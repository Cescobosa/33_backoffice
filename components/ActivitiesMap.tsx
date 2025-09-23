'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L, { Marker } from 'leaflet'

export type ActivityForMap = {
  id: string
  lat?: number | null
  lng?: number | null
  date?: string | null
  type?: string | null
  status?: string | null
  href?: string
}

export default function ActivitiesMap({ points }: { points: ActivityForMap[] }) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current) return
    const el = mapRef.current

    // Centrado inicial en España
    const map = L.map(el).setView([40.4168, -3.7038] as L.LatLngTuple, 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    const markers: Marker[] = []

    ;(points || []).forEach((p) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return

      const latlng = [p.lat, p.lng] as L.LatLngTuple
      const color = (p.status || '').toLowerCase() === 'confirmed' ? 'green' : 'orange'

      // DivIcon sin recorte (iconSize undefined) para evitar “chinchetas” deformadas
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="border:2px solid ${color}; background:#fff; border-radius:14px; padding:4px 6px; font-size:11px; white-space:nowrap">
                 ${p.type || 'Actividad'}${p.date ? ` · ${p.date}` : ''}
               </div>`,
        iconSize: undefined, // deja que el contenido determine el tamaño
      })

      const m = L.marker(latlng, { icon }).addTo(map)
      const html = `<div style="font-size:12px">
        <div><b>${p.type ?? 'Actividad'}</b></div>
        ${p.date ?? ''} · ${p.status ?? ''}
        ${p.href ? `<div style="margin-top:6px"><a href="${p.href}">Abrir</a></div>` : ''}
      </div>`
      m.bindPopup(html)
      markers.push(m)
    })

    // Ajusta el mapa a todos los marcadores (evita líos de tipos con tuplas)
    if (markers.length) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds().pad(0.2))
    }

    return () => { map.remove() }
  }, [points])

  const withCoords = (points || []).filter(
    p => typeof p.lat === 'number' && typeof p.lng === 'number'
  ).length

  return (
    <div className="border rounded">
      <div ref={mapRef} style={{ height: 360 }} />
      {!withCoords && (
        <div className="p-2 text-xs text-gray-500">
          No hay ubicaciones con coordenadas.
        </div>
      )}
    </div>
  )
}
