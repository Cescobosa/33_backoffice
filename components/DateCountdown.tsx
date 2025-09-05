'use client'
export default function DateCountdown({ to, tooltip }: { to?: string | null; tooltip?: string }) {
  if (!to) return null
  const target = new Date(to)
  const now = new Date()
  const ms = target.getTime() - now.getTime()
  const days = Math.round(Math.abs(ms) / 86400000)
  const txt = ms >= 0 ? `faltan ${days} días` : `venció hace ${days} días`
  return (
    <span className="badge badge-yellow" title={tooltip ?? target.toLocaleDateString()}>
      {txt}
    </span>
  )
}
