import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Treintay3 Producciones & Management',
    short_name: 'Treintay3',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#d42842',
    icons: [
      { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
    ]
  }
}
