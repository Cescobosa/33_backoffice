'use client'
import { useFormStatus } from 'react-dom'

export default function SaveButton({ label = 'Guardar' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button className="btn" disabled={pending}>
      {pending ? 'Guardando…' : label}
    </button>
  )
}
