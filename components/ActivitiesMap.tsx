'use client'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import L, { Marker } from 'leaflet'

export type ActivityForMap = {
  id: string
  // Supabase devuelve numeric como string → aceptamos ambos
  lat?: number | string | null
  lng?: number | string | null
  date?: string | null
  type?: string | null
  status?: string | null
  href?: string
  /** Foto del artista a mostrar en el pin */
  artist_avatar?: string | null
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function colorByStatus(status?: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'confirmed') return { bg: '#22c55e', border: '#16a34a', text: '#052e16' } // verde
  if (s === 'cancelled') return { bg: '#ef4444', border: '#dc2626', text: '#7f1d1d' } // rojo
  // borrador / reserva
  return { bg: '#fde047', border: '#f59e0b', text: '#422006' } // amarillo
}

function typeGlyph(t?: string | null) {
  switch ((t || '').toLowerCase()) {
    case 'concert': return '🎵'
    case 'promo_event': return '🎤'
    case 'promotion': return '📢'
    case 'record_invest': return '💿'
    default: return '📍'
  }
}

function markerHtml(p: ActivityForMap) {
  const { bg, border, text } = colorByStatus(p.status)
  const dateStr = p.date ? new Date(p.date).toLocaleDateString('es-ES') : ''
  const glyph = typeGlyph(p.type)
  const avatar = p.artist_avatar || '/avatar.png'

  // Etiqueta (pin) con icono + fecha + foto del artista
  return `
    <div style="
      display:inline-flex;align-items:center;gap:6px;
      border:2px solid ${border}; background:${bg}; color:${text};
      border-radius:16px; padding:4px 6px; font-size:12px;
      box-shadow:0 1px 2px rgba(0,0,0,.15);
      white-space:nowrap; cursor:pointer
    ">
      <span style="line-height:1">${glyph}</span>
      <span style="font-size:11px;line-height:1">${dateStr}</span>
      <img src="${avatar}" alt=""
        style="width:20px;height:20px;border-radius:50%;
               object-fit:cover;border:1px solid rgba(0,0,0,.15);background:#fff" />
    </div>`
}

export default function ActivitiesMap({ points }: { points: ActivityForMap[] }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const groupRef = useRef<L.FeatureGroup<Marker> | null>(null)

  // ¿Alguna ya trae coords (aunque vengan como string)?
  const [hasCoords, setHasCoords] = useState(() =>
    (points || []).some(p => toNum(p.lat) != null && toNum(p.lng) != null)
  )
  const [pending, setPending] = useState(false)

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

  // Pinta las marcas que YA tienen coordenadas
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return

    group.clearLayers()
    const markers: Marker[] = []

    const add = (p: ActivityForMap, lat: number, lng: number) => {
      const icon = L.divIcon({ className: 'custom-marker', html: markerHtml(p), iconSize: undefined })
      const m = L.marker([lat, lng] as L.LatLngTuple, { icon })
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

    ;(points || []).forEach(p => {
      const lat = toNum(p.lat)
      const lng = toNum(p.lng)
      if (lat != null && lng != null) add(p, lat, lng)
    })

    if (markers.length) {
      const bounds = L.featureGroup(markers).getBounds()
      map.fitBounds(bounds.pad(0.2))
    }
    setHasCoords(markers.length > 0)
  }, [points])

  // Geocodifica las que faltan, pinta en caliente y persiste lat/lng
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return

    const missing = (points || [])
      .filter(p => toNum(p.lat) == null || toNum(p.lng) == null)
      .map(p => p.id)

    if (!missing.length) { setPending(false); return }

    setPending(true)
    ;(async () => {
      try {
        const res = await fetch('/api/geocode/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: missing }),
        })
        if (!res.ok) { setPending(false); return }
        const updates: { id: string, lat: number, lng: number }[] = await res.json()
        if (!Array.isArray(updates) || !updates.length) { setPending(false); return }

        const byId = new Map(updates.map(u => [u.id, u]))
        const added: Marker[] = []

        ;(points || []).forEach(p => {
          const u = byId.get(p.id)
          if (!u) return
          const icon = L.divIcon({ className: 'custom-marker', html: markerHtml(p), iconSize: undefined })
          const m = L.marker([u.lat, u.lng] as L.LatLngTuple, { icon }).addTo(group)
          const popup =
            `<div style="font-size:12px">
               <div><b>${p.type ?? 'Actividad'}</b></div>
               ${p.date ? new Date(p.date).toLocaleDateString('es-ES') : ''} · ${p.status ?? ''}
               ${p.href ? `<div style="margin-top:6px"><a href="${p.href}">Abrir</a></div>` : ''}
             </div>`
          m.bindPopup(popup)
          m.on('click', () => { if (p.href) window.location.href = p.href })
          added.push(m)
        })

        if (added.length) {
          const bounds = L.featureGroup(added).getBounds()
          map.fitBounds(bounds.pad(0.2))
          setHasCoords(true)
        }
      } catch {
        // Silencioso
      } finally {
        setPending(false)
      }
    })()
  }, [points])

  const total = (points || []).length

  return (
    <div className="border rounded">
      <div ref={mapEl} style={{ height: 360 }} />
      {pending && (
        <div className="p-2 text-xs text-gray-500">
          Geolocalizando ubicaciones… (se guardarán para la próxima vez)
        </div>
      )}
      {!pending && !hasCoords && total > 0 && (
        <div className="p-2 text-xs text-gray-500">
          No hay ubicaciones con coordenadas para los filtros actuales.
        </div>
      )}
      {!pending && total === 0 && (
        <div className="p-2 text-xs text-gray-500">No hay actividades para mostrar.</div>
      )}
    </div>
  )
}
