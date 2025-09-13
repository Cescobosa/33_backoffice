'use client'

import { useEffect, useRef } from 'react'

export type ActivityForMap = {
  id: string
  type?: string
  status?: string
  date?: string
  municipality?: string
  province?: string
  country?: string
}

declare global {
  interface Window {
    L?: any
  }
}

// Carga Leaflet JS + CSS desde CDN (sin dependencias npm)
function ensureLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return
    if (window.L) return resolve(window.L)

    // CSS
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.setAttribute('data-leaflet-css', '1')
      document.head.appendChild(link)
    }
    // JS
    const existing = document.querySelector('script[data-leaflet-js]') as HTMLScriptElement | null
    if (existing && window.L) return resolve(window.L)
    if (existing && !window.L) {
      existing.addEventListener('load', () => resolve(window.L))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.defer = true
    script.setAttribute('data-leaflet-js', '1')
    script.onload = () => resolve(window.L)
    document.body.appendChild(script)
  })
}

function markerHtml(a: ActivityForMap) {
  const d = a.date ? new Date(a.date) : null
  const day = d ? String(d.getDate()).padStart(2, '0') : ''
  const mon = d ? d.toLocaleString('es-ES', { month: 'short' }).toUpperCase() : ''
  const status = (a.status || '').toLowerCase()
  const border =
    status === 'confirmed' ? '#16a34a' : status === 'hold' || status === 'draft' ? '#f59e0b' : '#9ca3af'
  const icon =
    a.type === 'concert' ? '🎤' :
    a.type === 'promo_event' ? '📣' :
    a.type === 'record_investment' ? '💿' : '⭐'
  return `
    <div style="border:2px solid ${border}; background:white; border-radius:8px; padding:2px 6px; font-size:11px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.25);">
      <div style="font-weight:700">${mon}</div>
      <div style="font-size:14px; font-weight:800; line-height:1">${day}</div>
      <div style="font-size:12px">${icon}</div>
    </div>
  `
}

export default function ActivitiesMap({ activities }: { activities: ActivityForMap[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: any
    let markers: any[] = []
    let aborted = false

    async function run() {
      const L = await ensureLeaflet()
      if (aborted || !ref.current) return

      map = L.map(ref.current).setView([40.4168, -3.7038], 5)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      // Agrupamos por lugar (para minimizar geocodificaciones)
      const groups = new Map<string, ActivityForMap[]>()
      for (const a of activities) {
        const key = [a.municipality, a.province, a.country].filter(Boolean).join(', ')
        if (!key) continue
        const arr = groups.get(key) || []
        arr.push(a)
        groups.set(key, arr)
      }

      const ctrls: AbortController[] = []

      async function geocode(place: string): Promise<[number, number] | null> {
        try {
          const ac = new AbortController()
          ctrls.push(ac)
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`
          const res = await fetch(url, {
            signal: ac.signal,
            headers: { 'Accept-Language': 'es', 'User-Agent': '33-Backoffice/1.0' },
          })
          const json = await res.json()
          if (json && json[0]) return [parseFloat(json[0].lat), parseFloat(json[0].lon)]
          return null
        } catch {
          return null
        }
      }

      for (const [place, acts] of groups.entries()) {
        const ll = await geocode(place)
        if (!ll) continue
        for (const a of acts) {
          const icon = L.divIcon({ html: markerHtml(a), className: '' })
          const m = L.marker(ll, { icon }).addTo(map)
          m.on('click', () => { window.location.href = `/actividades/actividad/${a.id}` })
          markers.push(m)
        }
      }

      if (markers.length) {
        const fg = L.featureGroup(markers)
        map.fitBounds(fg.getBounds().pad(0.2))
      }
    }

    run()
    return () => { aborted = true; if (map) map.remove() }
  }, [activities])

  return <div ref={ref} className="w-full h-80 rounded border" />
}
