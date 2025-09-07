import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Treintay3',
  icons: {
    icon: [{ url: '/favicon.png' }],
    apple: [{ url: '/apple-touch-icon.png' }]
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Treintay3', statusBarStyle: 'default' }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  )
}
