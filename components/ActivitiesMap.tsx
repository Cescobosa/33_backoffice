'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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
    const map = L.map(el).setView([40.4168, -3.7038], 5) // España por defecto

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    const bounds: L.LatLngBoundsExpression[] = []
    ;(points || []).forEach((p) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return
      const color = (p.status || '').toLowerCase() === 'confirmed' ? 'green' : 'orange'
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="border:2px solid ${color}; background:#fff; border-radius:14px; padding:4px 6px; font-size:11px; white-space:nowrap">
                 ${p.type || 'Actividad'}${p.date ? ` · ${p.date}` : ''}
               </div>`
      })
      const m = L.marker([p.lat, p.lng], { icon }).addTo(map)
      const html = `<div style="font-size:12px">
        <div><b>${p.type ?? 'Actividad'}</b></div>
        ${p.date ?? ''} · ${p.status ?? ''}
        ${p.href ? `<div style="margin-top:6px"><a href="${p.href}">Abrir</a></div>` : ''}
      </div>`
      m.bindPopup(html)
      bounds.push([p.lat, p.lng])
    })

    if (bounds.length) {
      const b = L.latLngBounds(bounds as any)
      map.fitBounds(b.pad(0.2))
    }

    return () => { map.remove() }
  }, [points])

  const validCount = (points || []).filter(p => typeof p.lat === 'number' && typeof p.lng === 'number').length

  return (
    <div className="border rounded">
      <div ref={mapRef} style={{ height: 360 }} />
      {!validCount && <div className="p-2 text-xs text-gray-500">No hay ubicaciones con coordenadas.</div>}
    </div>
  )
}
