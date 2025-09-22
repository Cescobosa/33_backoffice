import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ProviderAliasById({ params }: { params: { id: string } }) {
  redirect(`/terceros/${params.id}`)
}
