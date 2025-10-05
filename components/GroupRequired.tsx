// components/GroupRequired.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * GroupRequired
 * -------------
 * Valida que en un formulario haya al menos un checkbox marcado
 * para un nombre de grupo concreto (por ejemplo, "artist_ids").
 *
 * Uso:
 *   <GroupRequired groupName="artist_ids" message="Selecciona al menos un artista" />
 *
 * No interfiere con el envío del formulario cuando la condición se cumple.
 */
export default function GroupRequired({
  groupName,
  message = 'Selecciona al menos una opción',
}: {
  groupName: string
  message?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const root = boxRef.current
    if (!root) return
    const form = root.closest('form')
    if (!form) return

    const checkboxes = Array.from(
      form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${groupName}"]`)
    )

    function validate() {
      const anyChecked = checkboxes.some((c) => c.checked)
      setError(anyChecked ? null : message)
      return anyChecked
    }

    const onSubmit = (ev: Event) => {
      if (!validate()) {
        ev.preventDefault()
        ev.stopPropagation()
        // foco al primer checkbox del grupo
        const first = checkboxes[0]
        if (first) first.focus()
      }
    }

    const onChange = () => validate()

    form.addEventListener('submit', onSubmit)
    checkboxes.forEach((c) => c.addEventListener('change', onChange))

    // validación inicial (p. ej., si hay valores por defecto)
    validate()

    return () => {
      form.removeEventListener('submit', onSubmit)
      checkboxes.forEach((c) => c.removeEventListener('change', onChange))
    }
  }, [groupName, message])

  return (
    <div ref={boxRef}>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
