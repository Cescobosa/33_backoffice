'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/artistas', label: 'Artistas' },
  { href: '/terceros', label: 'Terceros' },
  { href: '/proveedores', label: 'Proveedores' },
  { href: '/empresas', label: 'Empresas del grupo' },
  { href: '/actividades', label: 'Actividades' },
  { href: '/usuarios', label: 'Usuarios' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 border-r bg-white min-h-screen p-4">
      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Treintay3" className="h-10" />
      </div>
      <nav className="space-y-1">
        {items.map(it => (
          <Link
            key={it.href}
            href={it.href}
            className={`block rounded-md px-3 py-2 hover:bg-gray-50 ${pathname?.startsWith(it.href) ? 'bg-gray-100 font-medium' : ''}`}
          >
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
