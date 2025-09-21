'use client'

import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import 'dayjs/locale/es'
import { useMemo, useState } from 'react'

dayjs.extend(isoWeek); dayjs.locale('es')

export default function ArtistCalendar({ artistId, searchParams }: { artistId: string, searchParams: any }) {
  const now = dayjs()
  const [year, setYear] = useState<number>(Number(searchParams.year || now.year()))

  // En esta versión la parte del calendario es presentacional; los eventos se renderizan fuera.
  // Si quieres pre-cargar eventos para la leyenda, pásalos como prop.
  const months = useMemo(() => Array.from({length:12}, (_,i) => dayjs(`${year}-${i+1}-01`)), [year])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1">
          {[now.year()-1, now.year(), now.year()+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => window.print()}>Descargar PDF</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3">
        {months.map((m, idx) => (
          <div key={idx} className="border rounded p-2">
            <div className="font-medium mb-1">{m.format('MMMM YYYY')}</div>
            <CalendarMonth month={m} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarMonth({ month }: { month: dayjs.Dayjs }) {
  const start = month.startOf('month').startOf('week')
  const end = month.endOf('month').endOf('week')
  const days = []
  let cur = start
  while (cur.isBefore(end) || cur.isSame(end)) {
    days.push(cur)
    cur = cur.add(1, 'day')
  }
  return (
    <div className="grid grid-cols-7 gap-1 text-xs">
      {['L','M','X','J','V','S','D'].map(d => <div key={d} className="text-center text-gray-500">{d}</div>)}
      {days.map((d, i) => {
        const inMonth = d.month() === month.month()
        return (
          <div key={i} className={`h-7 border rounded ${inMonth ? 'bg-white' : 'bg-gray-50'} text-center leading-7`}>
            {d.date()}
          </div>
        )
      })}
    </div>
  )
}
