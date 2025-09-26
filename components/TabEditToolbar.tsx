'use client'
export default function TabEditToolbar() {
  const toggle = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('tab-edit-all', { detail: { open } }))
  }
  const saveAll = () => {
    window.dispatchEvent(new CustomEvent('tab-save-all'))
    // cerramos edición global
    window.dispatchEvent(new CustomEvent('tab-edit-all', { detail: { open: false } }))
  }
  return (
    <div className="flex items-center gap-2 mb-3">
      <button className="btn-secondary" onClick={() => toggle(true)}>Editar pestaña</button>
      <button className="btn" onClick={saveAll}>Guardar pestaña</button>
      <button className="btn-secondary" onClick={() => toggle(false)}>Cancelar</button>
    </div>
  )
}
