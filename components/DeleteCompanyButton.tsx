// components/DeleteCompanyButton.tsx
'use client'

import * as React from 'react'
import { useFormStatus } from 'react-dom'

type Props = {
  action: (fd: FormData) => Promise<void>
}

/**
 * Botón de borrado de empresa (sólo admin).
 * Muestra estado "pending" mientras se envía la Server Action.
 */
export default function DeleteCompanyButton({ action }: Props) {
  const { pending } = useFormStatus()

  return (
    <form action={action} className="flex items-center gap-2">
      <input
        name="confirm"
        placeholder="Escribe ELIMINAR"
        className="border rounded px-2 py-1"
        aria-label="Confirmación"
        required
      />
      <button
        type="submit"
        className="btn-secondary"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? 'Eliminando…' : 'Eliminar empresa'}
      </button>
    </form>
  )
}
