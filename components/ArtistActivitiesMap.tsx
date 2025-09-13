'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Activity = {
  id: string
  type?: string | null
  status?: string | null
  date?: string | null
  municipality?: string | null
  province?: string | null
  country?: string | null
  // En algunos esquemas pueden venir coordenadas con nombres distintos:
  lat?: number | null
  lng?: number | null
  latitude?: number | null
  longitude?: number | null
  location_lat?: number | null
  location_lng?: number | null
  geo_lat?: number | null
  geo_lng?: number | null
}

export default function ArtistActivitiesMap({ activities }: { activities: Activity[] }) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  // Carga de Leaflet desde CDN (CSS + JS) sólo en cliente
  function ensureLeafletAssets(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve()
      const w = window as any
      const d = document

      // CSS
      if (!d.getElementById('leaflet-css')) {
        const link = d.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        d.head.appendChild(link)
      }

      // JS
      if (w.L) return resolve()
      if (!d.getElementById('leaflet-js')) {
        const s = d.createElement('script')
        s.id = 'leaflet-js'
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        s.async = true
        s.onload = () => resolve()
        d.body.appendChild(s)
      } else {
        resolve()
      }
    })
  }

  function statusColor(status?: string | null) {
    const s = (status || '').toLowerCase()
    if (['confirmado', 'confirmed'].includes(s)) return '#16a34a' // verde
    if (
      ['reserva', 'reserved', 'prebook', 'borrador', 'draft', 'pendiente', 'tentative', 'hold'].includes(
        s,
      )
    )
      return '#f59e0b' // amarillo/ámbar
    return '#3b82f6' // azul por defecto
  }

  function typeEmoji(type?: string | null) {
    const t = (type || '').toLowerCase()
    if (['concierto', 'concert', 'show', 'gig', 'bolo'].includes(t)) return '🎤'
    if (['promo', 'promoción', 'press', 'pr'].includes(t)) return '📣'
    if (['tv', 'radio', 'media'].includes(t)) return '📺'
    if (['festival'].includes(t)) return '🎪'
    if (['meeting', 'reunión'].includes(t)) return '🤝'
    return '📍'
  }

  function dayMonthLabel(date?: string | null) {
    if (!date) return ''
    try {
      return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    } catch {
      return ''
    }
  }

  // Geocoding educado con cache en localStorage para direcciones sin coordenadas
  async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
    if (!address) return null
    try {
      const key = 'geo:' + address
      const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (cached) {
        const v = JSON.parse(cached)
        if (v && typeof v.lat === 'number' && typeof v.lon === 'number') return v
      }
      // Cortesía: ligera pausa para no saturar Nominatim
      await new Promise((r) => setTimeout(r, 250))
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
        encodeURIComponent(address)
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'es',
          // Nominatim agradece un user-agent claro
          'User-Agent': 'Treintay3-Backoffice/1.0 (mapa actividades)',
        } as any,
      })
      const json = await res.json()
      const first = json?.[0]
      if (first) {
        const v = { lat: parseFloat(first.lat), lon: parseFloat(first.lon) }
        try {
          localStorage.setItem(key, JSON.stringify(v))
        } catch {}
        return v
      }
    } catch {}
    return null
  }

  // Construcción del mapa
  useEffect(() => {
    let map: any
    let layer: any
    let destroyed = false

    ;(async () => {
      await ensureLeafletAssets()
      if (destroyed || !mapEl.current) return

      const L = (window as any).L
      if (!L) return

      // Crear mapa
      map = L.map(mapEl.current, { zoomControl: true, attributionControl: true })

      layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      // Calcular marcadores (coordenadas directas o geocodificadas)
      const bounds = L.latLngBounds([])
      for (const a of activities) {
        let lat: number | undefined
        let lon: number | undefined

        lat =
          (a.lat as any) ??
          (a.latitude as any) ??
          (a.location_lat as any) ??
          (a.geo_lat as any) ??
          undefined
        lon =
          (a.lng as any) ??
          (a.longitude as any) ??
          (a.location_lng as any) ??
          (a.geo_lng as any) ??
          undefined

        if ((lat == null || lon == null) && (a.municipality || a.province || a.country)) {
          const addr = [a.municipality, a.province, a.country].filter(Boolean).join(', ')
          const g = await geocode(addr)
          if (g) {
            lat = g.lat
            lon = g.lon
          }
        }

        if (lat == null || lon == null) continue

        const color = statusColor(a.status)
        const emoji = typeEmoji(a.type)
        const label = dayMonthLabel(a.date)

        const html = `
          <div class="tt-pin" style="border-color:${color}">
            <span class="tt-pin-emoji">${emoji}</span>
            <span class="tt-pin-date">${label}</span>
          </div>
        `

        const icon = L.divIcon({
          html,
          className: 'tt-pin-wrap',
          iconSize: [1, 1],
          iconAnchor: [12, 12],
        })

        const marker = L.marker([lat, lon], { icon })
          .on('click', () => router.push(`/actividades/actividad/${a.id}`))
          .addTo(map)

        bounds.extend(marker.getLatLng())
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] })
      } else {
        // Vista por defecto (España)
        map.setView([40.4168, -3.70379], 5)
      }
    })()

    return () => {
      destroyed = true
      try {
        if (map) {
          map.remove()
        }
      } catch {}
    }
  }, [activities, router])

  return (
    <div className="w-full">
      <div ref={mapEl} className="tt-map rounded border" />
      {/* Estilos mínimos para los pines y el contenedor */}
      <style jsx global>{`
        .tt-map {
          width: 100%;
          height: 380px;
        }
        .leaflet-div-icon {
          background: transparent;
          border: none;
        }
        .tt-pin {
          background: #fff;
          border: 3px solid #3b82f6;
          border-radius: 14px;
          padding: 2px 6px;
          line-height: 1;
          font-weight: 700;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
          user-select: none;
          -webkit-user-select: none;
        }
        .tt-pin-emoji {
          font-size: 14px;
        }
        .tt-pin-date {
          font-size: 12px;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  )
}
