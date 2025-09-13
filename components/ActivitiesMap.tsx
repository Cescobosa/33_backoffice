'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export type ActivityForMap = {
  id: string
  type?: string | null
  status?: string | null
  date?: string | null
  municipality?: string | null
  province?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  latitude?: number | null
  longitude?: number | null
  location_lat?: number | null
  location_lng?: number | null
  geo_lat?: number | null
  geo_lng?: number | null
}

export default function ActivitiesMap({ activities }: { activities: ActivityForMap[] }) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  function ensureLeaflet(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve()
      const w = window as any
      const d = document
      if (!d.getElementById('leaflet-css')) {
        const link = d.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        d.head.appendChild(link)
      }
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
    if (['confirmado', 'confirmed'].includes(s)) return '#16a34a'
    if (['reserva', 'reserved', 'borrador', 'draft', 'tentative', 'hold', 'prebook', 'pendiente'].includes(s)) return '#f59e0b'
    return '#3b82f6'
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
    try { return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) } catch { return '' }
  }

  async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
    if (!address) return null
    const key = 'geo:' + address
    try {
      const cached = localStorage.getItem(key)
      if (cached) {
        const v = JSON.parse(cached)
        if (v && typeof v.lat === 'number' && typeof v.lon === 'number') return v
      }
      await new Promise(r => setTimeout(r, 250))
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address), {
        headers: { 'Accept-Language': 'es', 'User-Agent': 'Treintay3-Backoffice/1.0' } as any,
      })
      const j = await res.json()
      const f = j?.[0]
      if (f) {
        const v = { lat: parseFloat(f.lat), lon: parseFloat(f.lon) }
        try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
        return v
      }
    } catch {}
    return null
  }

  useEffect(() => {
    let map: any
    let destroyed = false
    ;(async () => {
      await ensureLeaflet()
      if (destroyed || !mapEl.current) return
      const L = (window as any).L
      if (!L) return

      map = L.map(mapEl.current)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map)

      const bounds = L.latLngBounds([])

      for (const a of activities) {
        let lat = a.lat ?? a.latitude ?? a.location_lat ?? a.geo_lat ?? undefined
        let lon = a.lng ?? a.longitude ?? a.location_lng ?? a.geo_lng ?? undefined

        if ((lat == null || lon == null) && (a.municipality || a.province || a.country)) {
          const addr = [a.municipality, a.province, a.country].filter(Boolean).join(', ')
          const g = await geocode(addr)
          if (g) { lat = g.lat; lon = g.lon }
        }
        if (lat == null || lon == null) continue

        const html = `
          <div class="tt-pin" style="border-color:${statusColor(a.status)}">
            <span class="tt-pin-emoji">${typeEmoji(a.type)}</span>
            <span class="tt-pin-date">${dayMonthLabel(a.date)}</span>
          </div>
        `
        const icon = L.divIcon({ html, className: 'tt-pin-wrap', iconSize: [1,1], iconAnchor: [12,12] })
        const m = L.marker([lat, lon], { icon }).addTo(map)
        m.on('click', () => router.push(`/actividades/actividad/${a.id}`))
        bounds.extend(m.getLatLng())
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24,24] })
      else map.setView([40.4168, -3.70379], 5) // España
    })()
    return () => { destroyed = true; try { (map as any)?.remove?.() } catch {} }
  }, [activities, router])

  return (
    <div className="w-full">
      <div ref={mapEl} className="tt-map rounded border" />
      <style jsx global>{`
        .tt-map { width: 100%; height: 380px; }
        .leaflet-div-icon { background: transparent; border: none; }
        .tt-pin { background:#fff; border:3px solid #3b82f6; border-radius:14px; padding:2px 6px;
                  display:inline-flex; gap:4px; align-items:center; font-weight:700; line-height:1;
                  box-shadow:0 1px 6px rgba(0,0,0,.25); user-select:none }
        .tt-pin-emoji { font-size:14px }
        .tt-pin-date { font-size:12px; text-transform:uppercase }
      `}</style>
    </div>
  )
}
