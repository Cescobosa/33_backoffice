'use client'
import Link from 'next/link'

export function MainTabs({
  items, current,
}: { items: { key: string, label: string, href: string }[], current: string }) {
  return (
    <div className="border-b border-gray-200 mb-2">
      <nav className="tabs-main -mb-px flex gap-2">
        {items.map(t => (
          <Link key={t.key} href={t.href} data-active={current === t.key ? 'true' : 'false'}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function SubTabs({
  items, current,
}: { items: { key: string, label: string, href: string }[], current: string }) {
  return (
    <div className="mb-3">
      <nav className="tabs-sub flex gap-2">
        {items.map(t => (
          <Link key={t.key} href={t.href} data-active={current === t.key ? 'true' : 'false'}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
