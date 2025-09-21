'use client'
import Link from 'next/link'
import clsx from 'clsx'

export function MainTabs({ items, current }: { items: { key: string, label: string, href: string }[], current: string }) {
  return (
    <div className="border-b border-gray-200 mb-2">
      <nav className="-mb-px flex gap-2">
        {items.map(t => (
          <Link key={t.key} href={t.href}
            className={clsx(
              'px-3 py-2 text-sm rounded-t-md',
              current === t.key ? 'bg-white border border-gray-200 border-b-0' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function SubTabs({ items, current }: { items: { key: string, label: string, href: string }[], current: string }) {
  return (
    <div className="pl-2 mb-3">
      <nav className="flex gap-2">
        {items.map(t => (
          <Link key={t.key} href={t.href}
            className={clsx(
              'px-2 py-1 text-xs rounded',
              current === t.key ? 'bg-gray-100 border border-gray-200' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
