'use client'
import { FormHTMLAttributes, useEffect, useRef } from 'react'

type Props = FormHTMLAttributes<HTMLFormElement> & {
  /** milisegundos para debounce en inputs de texto */
  debounceMs?: number
}

/**
 * Formulario que se envía automáticamente cuando cambian los filtros.
 * - Inputs de texto: debounce para no saturar.
 * - Select/checkbox: envío inmediato.
 */
export default function AutoSubmitForm({ children, debounceMs = 300, ...rest }: Props) {
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const form = ref.current
    if (!form) return

    let t: any = null
    const onInput = (ev: Event) => {
      const target = ev.target as HTMLElement
      if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search' || target.type === 'date')) {
        clearTimeout(t)
        t = setTimeout(() => form.requestSubmit(), debounceMs)
      }
    }
    const onChange = (ev: Event) => {
      const target = ev.target as HTMLElement
      if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio' || target.type === 'date'))) {
        form.requestSubmit()
      }
    }
    form.addEventListener('input', onInput)
    form.addEventListener('change', onChange)
    return () => {
      form.removeEventListener('input', onInput)
      form.removeEventListener('change', onChange)
      clearTimeout(t)
    }
  }, [debounceMs])

  return (
    <form ref={ref} method="get" {...rest}>
      {children}
    </form>
  )
}
