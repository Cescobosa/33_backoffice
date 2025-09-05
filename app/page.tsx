import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Treintay3" className="mx-auto h-16" />
        <h1 className="text-2xl font-semibold">Gestión interna</h1>
        <Link href="/artistas" className="btn">Entrar</Link>
      </div>
    </main>
  )
}
