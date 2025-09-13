'use client'
import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type ActivityForMap = {
  id: string
  type?: string
  status?: string
  date?: string
  municipality?: string
  province?: string
  country?: string
}

function markerHtml(a: ActivityForMap) {
  const d = a.date ? new Date(a.date) : null
  const day = d ? String(d.getDate()).padStart(2, '0') : ''
  const mon = d ? d.toLocaleString('es-ES', { month: 'short' }).toUpperCase() : ''
  const status = (a.status || '').toLowerCase()
  const border = status === 'confirmed' ? '#16a34a' : status === 'hold' || status === 'draft' ? '#f59e0b' : '#9ca3af'
  const icon = a.type === 'concert' ? '🎤' : a.type === 'promo_event' ? '📣' : a.type === 'record_investment' ? '💿' : '⭐'
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
  const mapRef = useRef<LeafletMap | null>(null)
  const [Lmod, setLmod] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const L = await import('leaflet')
      setLmod(L)
    })()
  }, [])

  useEffect(() => {
    if (!Lmod || !ref.current || mapRef.current) return
    const L = Lmod
    mapRef.current = L.map(ref.current).setView([40.4168, -3.7038], 5)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(mapRef.current)
  }, [Lmod])

  useEffect(() => {
    if (!Lmod || !mapRef.current) return
    const L = Lmod
    const map = mapRef.current

    const uniques = new Map<string, ActivityForMap[]>()
    activities.forEach(a => {
      const key = [a.municipality, a.province, a.country].filter(Boolean).join(', ')
      if (!key) return
      const arr = uniques.get(key) || []
      arr.push(a)
      uniques.set(key, arr)
    })

    const controllers: AbortController[] = []
    const markers: any[] = []

    async function geocodePlace(place: string): Promise<[number, number] | null> {
      try {
        const ac = new AbortController()
        controllers.push(ac)
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`
        const res = await fetch(url, { signal: ac.signal, headers: { 'Accept-Language': 'es', 'User-Agent': '33-Backoffice/1.0' } })
        const json = await res.json()
        if (json && json[0]) return [parseFloat(json[0].lat), parseFloat(json[0].lon)]
        return null
      } catch { return null }
    }

    ;(async () => {
      for (const [place, acts] of uniques.entries()) {
        const ll = await geocodePlace(place)
        if (!ll) continue
        acts.forEach(a => {
          const icon = L.divIcon({ html: markerHtml(a), className: '' })
          const m = L.marker(ll, { icon }).addTo(map)
          m.on('click', () => { window.location.href = `/actividades/actividad/${a.id}` })
          markers.push(m)
        })
      }
      if (markers.length) {
        const fg = L.featureGroup(markers)
        map.fitBounds(fg.getBounds().pad(0.2))
      }
    })()

    return () => { controllers.forEach(c => c.abort()) }
  }, [Lmod, activities])

  return <div ref={ref} className="w-full h-80 rounded border" />
}
