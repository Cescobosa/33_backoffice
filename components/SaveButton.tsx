'use client'
import { useFormStatus } from 'react-dom'

export default function SaveButton({ children = 'Guardar', className = 'btn' }: { children?: React.ReactNode, className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button className={className} disabled={pending}>
      {pending ? 'Guardando…' : children}
    </button>
  )
}
