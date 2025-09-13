'use client'

import { experimental_useFormStatus as useFormStatus } from 'react-dom'

export default function DeleteCompanyButton({ action }: { action: (fd: FormData)=>Promise<void> }) {
  const { pending } = useFormStatus()
  return (
    <form action={action} className="flex items-center gap-2">
      <input
        name="confirm"
        placeholder="Escribe ELIMINAR"
        className="border rounded px-2 py-1"
        aria-label="Confirmación"
      />
      <button className="btn-secondary" disabled={pending}>
        {pending ? 'Eliminando…' : 'Eliminar empresa'}
      </button>
    </form>
  )
}
