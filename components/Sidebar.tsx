'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/artistas', label: 'Artistas' },
  { href: '/terceros', label: 'Terceros' },
  { href: '/proveedores', label: 'Proveedores' },
  { href: '/usuarios', label: 'Usuarios' },
]

export default function Sidebar() {
  const pathname = usePathname() || ''
  return (
    <aside className="w-64 shrink-0 border-r bg-white p-4 space-y-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Treintay3" className="h-10" />
      </div>
      <nav className="space-y-1">
        {items.map(it => (
          <Link
            key={it.href}
            href={it.href}
            className={`block rounded-md px-3 py-2 hover:bg-gray-50 ${pathname.startsWith(it.href) ? 'bg-gray-100 font-medium' : ''}`}
          >
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
