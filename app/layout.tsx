import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Treintay3',
  description: 'Gestión de Management y Producción',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  )
}
