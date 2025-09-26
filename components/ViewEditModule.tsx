'use client'
import { useEffect, useState } from 'react'
import SaveButton from '@/components/SaveButton'

export default function ViewEditModule({
  title,
  isEmpty,
  childrenView,
  childrenEdit,
  action,
}: {
  title: string
  isEmpty?: boolean
  childrenView: React.ReactNode
  childrenEdit: React.ReactNode
  /** Server Action del módulo */
  action: (formData: FormData) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)

  // Soporte para "Editar pestaña" / "Guardar pestaña"
  useEffect(() => {
    const onToggle = (e: any) => setEditing(!!e?.detail?.open)
    const onSaveAll = (e: any) => {
      if (!editing) return
      const form = document.getElementById(`form-${title}`) as HTMLFormElement | null
      form?.requestSubmit()
    }
    window.addEventListener('tab-edit-all', onToggle as any)
    window.addEventListener('tab-save-all', onSaveAll as any)
    return () => {
      window.removeEventListener('tab-edit-all', onToggle as any)
      window.removeEventListener('tab-save-all', onSaveAll as any)
    }
  }, [editing, title])

  return (
    <div className="border rounded p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-[#008aa4]">{title}</h3>
        <div className="flex items-center gap-2">
          {!editing && (
            <button className="btn-secondary" onClick={() => setEditing(true)}>Editar</button>
          )}
        </div>
      </div>

      {!editing ? (
        isEmpty ? <div className="text-sm text-gray-500">—</div> : <div>{childrenView}</div>
      ) : (
        <form id={`form-${title}`} action={async (fd: FormData) => { await action(fd); setEditing(false) }} data-autosave="module" className="space-y-3">
          <div className="space-y-3">{childrenEdit}</div>
          <div className="flex gap-2">
            <SaveButton label="Guardar" pendingLabel="Guardando…" />
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}
