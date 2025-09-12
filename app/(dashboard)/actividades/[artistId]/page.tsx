import { redirect } from 'next/navigation'

export default function ActivitiesArtistAlias({
  params,
}: { params: { artistId: string } }) {
  // Redirige la ruta antigua /actividades/:artistId
  // a la ruta real /actividades/artista/:artistId
  redirect(`/actividades/artista/${params.artistId}`)
}
