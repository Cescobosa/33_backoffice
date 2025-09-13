'use client'

/**
 * ActivityMap
 * =============
 * Mapa auto-contenido (Leaflet vía CDN en iframe srcDoc)
 * Props:
 *  - items: [{ id, date, status, type, lat, lng }]
 *  - height?: px
 *
 * Colores:
 *  - draft/hold => amarillo
 *  - confirmed  => verde
 *
 * Iconos por tipo:
 *  - concert           => 🎤
 *  - promo_event       => 🎬
 *  - promotion         => 📣
 *  - record_investment => 💿
 *  - custom/otros      => ✳️
 */
export default function ActivityMap({
  items,
  height = 380,
}: {
  items: Array<{
    id: string
    date: string | null
    status: 'draft' | 'hold' | 'confirmed' | string | null
    type: 'concert' | 'promo_event' | 'promotion' | 'record_investment' | 'custom' | string | null
    lat?: number | null
    lng?: number | null
  }>
  height?: number
}) {
  const data = (items || [])
    .filter(i => typeof i.lat === 'number' && typeof i.lng === 'number')
    .map(i => ({
      id: i.id,
      date: i.date,
      status: (i.status || 'draft') as string,
      type: (i.type || 'custom') as string,
      lat: Number(i.lat),
      lng: Number(i.lng),
    }))

  const srcDoc = buildHtml(data)

  return (
    <iframe
      title="Mapa de actividades"
      style={{ width: '100%', height, border: '1px solid #e5e7eb', borderRadius: 8 }}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
    />
  )
}

function buildHtml(points: Array<{ id: string; date: string | null; status: string; type: string; lat: number; lng: number }>) {
  const payload = JSON.stringify(points || [])
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { height: 100%; margin: 0; }
      .pin {
        display:inline-flex; align-items:center; gap:6px;
        padding:2px 6px; background:#fff; border:2px solid #999; border-radius:14px;
        font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color:#111; box-shadow: 0 1px 5px rgba(0,0,0,.25);
      }
      .pin .date { font-weight:700; }
      .pin.yellow { border-color:#f59e0b; } /* draft/hold */
      .pin.green  { border-color:#10b981; } /* confirmed */
    </style>
  </head>
  <body>
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      const points = ${payload};

      const map = L.map('map', { scrollWheelZoom: true, zoomControl: true });
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      function iconForType(t){
        switch((t||'').toLowerCase()){
          case 'concert': return '🎤';
          case 'promo_event': return '🎬';
          case 'promotion': return '📣';
          case 'record_investment': return '💿';
          default: return '✳️';
        }
      }
      function colorClassByStatus(s){
        const k=(s||'').toLowerCase();
        return (k==='confirmed') ? 'green' : 'yellow';
      }
      function fmtDate(d){
        if(!d) return '';
        try{
          const dt = new Date(d);
          const m = dt.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
          const day = dt.getDate().toString().padStart(2,'0');
          return m + ' ' + day;
        }catch(_){ return ''; }
      }

      const markers=[]
      for(const p of points){
        const html = '<div class="pin '+colorClassByStatus(p.status)+'"><span>'+iconForType(p.type)+'</span><span class="date">'+fmtDate(p.date)+'</span></div>';
        const divIcon = L.divIcon({ html, className: '', iconSize: [10,10] });
        const m = L.marker([p.lat, p.lng], { icon: divIcon }).addTo(map);
        m.on('click', ()=> { window.top.location.href = '/actividades/actividad/'+p.id; });
        markers.push(m)
      }

      if(markers.length){
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      } else {
        map.setView([40.0, -3.7], 4); // España / EU
      }
    </script>
  </body>
</html>`.trim()
}
