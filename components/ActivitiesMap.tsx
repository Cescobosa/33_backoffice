'use client'
import { useEffect, useRef, useState } from 'react'
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

function colorByStatus(status?: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'confirmed') return { bg: '#22c55e', border: '#16a34a', text: '#052e16' } // verde
  if (s === 'cancelled') return { bg: '#ef4444', border: '#dc2626', text: '#7f1d1d' } // rojo
  // borrador/reserva
  return { bg: '#fde047', border: '#f59e0b', text: '#422006' } // amarillo
}

export default function ActivitiesMap({ points }: { points: ActivityForMap[] }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const groupRef = useRef<L.FeatureGroup<Marker> | null>(null)
  const [hasCoords, setHasCoords] = useState(
    (points || []).some(p => typeof p.lat === 'number' && typeof p.lng === 'number')
  )

  // Inicializa mapa
  useEffect(() => {
    if (!mapEl.current) return
    const map = L.map(mapEl.current).setView([40.4168, -3.7038] as L.LatLngTuple, 5)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    const group = L.featureGroup<Marker>([]).addTo(map)
    groupRef.current = group

    return () => { map.remove() }
  }, [])

  // Pinta marcas existentes
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return

    group.clearLayers()
    const markers: Marker[] = []

    const addMarker = (p: ActivityForMap) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return
      const { bg, border, text } = colorByStatus(p.status)
      const html =
        `<div style="border:2px solid ${border}; background:${bg}; color:${text}; border-radius:14px; padding:4px 6px; font-size:11px; white-space:nowrap">
           ${p.type || 'Actividad'}${p.date ? ` · ${new Date(p.date).toLocaleDateString('es-ES')}` : ''}
         </div>`
      const icon = L.divIcon({ className: 'custom-marker', html, iconSize: undefined })
      const m = L.marker([p.lat, p.lng] as L.LatLngTuple, { icon })
      const popup =
        `<div style="font-size:12px">
           <div><b>${p.type ?? 'Actividad'}</b></div>
           ${p.date ? new Date(p.date).toLocaleDateString('es-ES') : ''} · ${p.status ?? ''}
           ${p.href ? `<div style="margin-top:6px"><a href="${p.href}">Abrir</a></div>` : ''}
         </div>`
      m.bindPopup(popup)
      m.on('click', () => { if (p.href) window.location.href = p.href })
      m.addTo(group)
      markers.push(m)
    }

    (points || []).forEach(addMarker)

    if (markers.length) {
      const bounds = L.featureGroup(markers).getBounds()
      map.fitBounds(bounds.pad(0.2))
    }

    setHasCoords(markers.length > 0)
  }, [points])

  // Geocodifica faltantes en caliente y añade marcas
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return

    const missing = (points || [])
      .filter(p => !(typeof p.lat === 'number' && typeof p.lng === 'number'))
      .map(p => p.id)

    if (!missing.length) return

    ;(async () => {
      try {
        const res = await fetch('/api/geocode/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: missing }),
        })
        const updates: { id: string, lat: number, lng: number }[] = await res.json()
        if (!Array.isArray(updates) || !updates.length) return

        const byId = new Map(updates.map(u => [u.id, u]))
        const newlyAdded: Marker[] = []

        const addMarker = (p: ActivityForMap, u: { lat: number, lng: number }) => {
          const { bg, border, text } = colorByStatus(p.status)
          const html =
            `<div style="border:2px solid ${border}; background:${bg}; color:${text}; border-radius:14px; padding:4px 6px; font-size:11px; white-space:nowrap">
               ${p.type || 'Actividad'}${p.date ? ` · ${new Date(p.date).toLocaleDateString('es-ES')}` : ''}
             </div>`
          const icon = L.divIcon({ className: 'custom-marker', html, iconSize: undefined })
          const m = L.marker([u.lat, u.lng] as L.LatLngTuple, { icon }).addTo(group)
          const popup =
            `<div style="font-size:12px">
               <div><b>${p.type ?? 'Actividad'}</b></div>
               ${p.date ? new Date(p.date).toLocaleDateString('es-ES') : ''} · ${p.status ?? ''}
               ${p.href ? `<div style="margin-top:6px"><a href="${p.href}">Abrir</a></div>` : ''}
             </div>`
          m.bindPopup(popup)
          m.on('click', () => { if (p.href) window.location.href = p.href })
          newlyAdded.push(m)
        }

        ;(points || []).forEach(p => {
          const u = byId.get(p.id)
          if (u) addMarker(p, u)
        })

        if (newlyAdded.length) {
          const bounds = L.featureGroup(newlyAdded).getBounds()
          map.fitBounds(bounds.pad(0.2))
          setHasCoords(true)
        }
      } catch {
        // Silencioso: el mapa sigue operativo aunque falle el geocoder
      }
    })()
  }, [points])

  const total = (points || []).length

  return (
    <div className="border rounded">
      <div ref={mapEl} style={{ height: 360 }} />
      {(!hasCoords && total > 0) && (
        <div className="p-2 text-xs text-gray-500">
          Geolocalizando ubicaciones… (se guardarán para la próxima vez)
        </div>
      )}
      {(!hasCoords && total === 0) && (
        <div className="p-2 text-xs text-gray-500">No hay actividades para mostrar.</div>
      )}
    </div>
  )
}
