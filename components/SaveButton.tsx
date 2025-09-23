'use client'
import { useFormStatus } from 'react-dom'
import { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Texto por defecto si no pasas children */
  label?: string
  /** Texto mientras guarda; por defecto: "Guardando…" */
  pendingLabel?: string
  /** Puedes pasar contenido (iconos + texto) como children si prefieres */
  children?: ReactNode
}

export default function SaveButton({
  label = 'Guardar',
  pendingLabel = 'Guardando…',
  children,
  className,
  type,
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus()
  const content = pending ? pendingLabel : (children ?? label)

  return (
    <button
      type={type ?? 'submit'}
      className={`btn ${className ?? ''}`.trim()}
      disabled={pending || disabled}
      aria-busy={pending}
      {...rest}
    >
      {content}
    </button>
  )
}
