'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/artistas',   label: 'Artistas' },
  { href: '/terceros',   label: 'Terceros' },              // Unificación de terceros/proveedores/promotores
  { href: '/empresas',   label: 'Empresas del grupo' },
  { href: '/recintos',   label: 'Recintos' },              // NUEVA SECCIÓN
  { href: '/actividades',label: 'Actividades' },
  { href: '/entradas',   label: 'Venta de entradas' },
  { href: '/usuarios',   label: 'Usuarios' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 shrink-0 border-r bg-white h-screen sticky top-0 p-4">
      <div className="mb-4 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="33 Producciones" className="h-8 w-auto" />
      </div>
      <nav className="space-y-1">
        {items.map(it => {
          const active = pathname?.startsWith(it.href)
          return (
            <Link key={it.href} href={it.href}
              className={`block rounded-md px-3 py-2 hover:bg-gray-100 ${active ? 'bg-gray-100 font-medium' : ''}`}>
              {it.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
